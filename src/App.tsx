import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Route } from 'lucide-react';
import { CreateRideModal, type CreateRideDraft } from './components/CreateRideModal';
import { KharkivMap, type MapPickerTarget } from './components/KharkivMap';
import { RideCard } from './components/RideCard';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import {
  createRide,
  deleteRideById,
  fetchActiveRides,
  subscribeToRideUpdates,
} from './services/ridesService';
import type {
  AccentColorId,
  AppView,
  CreateRidePayload,
  LatLng,
  MapStyleId,
  Ride,
  RideFilter,
  TelegramUserProfile,
  ThemeMode,
} from './types/ride';
import {
  describePickedCoordinates,
  filterActiveRides,
} from './utils/ridesLogic';
import {
  applyTelegramThemeColors,
  initTelegramWebApp,
  triggerHaptic,
} from './utils/telegram';
import {
  ACCENT_STORAGE_KEY,
  isValidAccentColor,
  isValidMapStyle,
  MAP_STYLE_STORAGE_KEY,
  resolveCssAccentVars,
  THEME_STORAGE_KEY,
} from './utils/themeConfig';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === 'light' ? 'light' : 'dark';
}

function getInitialMapStyle(theme: ThemeMode): MapStyleId {
  if (typeof window === 'undefined') return theme === 'dark' ? 'twilight' : 'osm';
  const saved = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY);
  if (isValidMapStyle(saved)) {
    return saved;
  }
  return theme === 'dark' ? 'twilight' : 'osm';
}

function getInitialAccentColor(): AccentColorId {
  if (typeof window === 'undefined') return 'emerald';
  const saved = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return isValidAccentColor(saved) ? saved : 'emerald';
}

const INITIAL_DRAFT: CreateRideDraft = {
  role: 'driver',
  fromName: '',
  fromLat: null,
  fromLng: null,
  toName: '',
  toLat: null,
  toLng: null,
  departurePreset: 'Через 15 мин',
  customTime: '18:30',
  priceUah: '50',
  seats: 2,
  comment: '',
};

export default function App() {
  const [user] = useState<TelegramUserProfile>(() => initTelegramWebApp());
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [accentColor, setAccentColor] = useState<AccentColorId>(getInitialAccentColor);
  const [mapStyle, setMapStyle] = useState<MapStyleId>(() =>
    getInitialMapStyle(getInitialTheme())
  );
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<RideFilter>('all');
  const [appView, setAppView] = useState<AppView>('feed');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<MapPickerTarget>(null);
  const [draft, setDraft] = useState<CreateRideDraft>(INITIAL_DRAFT);

  // Sync theme & accent CSS custom properties to documentElement, localStorage, and Telegram WebApp
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);

    const cssVars = resolveCssAccentVars(accentColor, theme);
    for (const [key, value] of Object.entries(cssVars)) {
      document.documentElement.style.setProperty(key, value);
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0B0E14' : '#F8FAFC');
    }
    applyTelegramThemeColors(theme);
  }, [theme, accentColor]);

  const toggleTheme = () => {
    triggerHaptic('light');
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      const savedMapStyle = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY);
      if (!isValidMapStyle(savedMapStyle)) {
        setMapStyle(next === 'dark' ? 'twilight' : 'osm');
      }
      return next;
    });
  };

  const handleChangeAccentColor = (nextAccent: AccentColorId) => {
    setAccentColor(nextAccent);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
  };

  const handleChangeMapStyle = (nextStyle: MapStyleId) => {
    setMapStyle(nextStyle);
    window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, nextStyle);
  };

  const loadRides = useCallback(async () => {
    try {
      const result = await fetchActiveRides();
      setRides(result.rides);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Не удалось загрузить поездки'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRides();
    const unsubscribe = subscribeToRideUpdates(() => {
      void loadRides();
    });
    const expiryTimer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60_000);

    return () => {
      unsubscribe();
      window.clearInterval(expiryTimer);
    };
  }, [loadRides]);

  const myRides = useMemo(
    () =>
      filterActiveRides(rides, {
        roleFilter: 'all',
        onlyMineUserId: user.id,
        nowMs: nowTick,
      }),
    [rides, user.id, nowTick]
  );

  const visibleRides = useMemo(() => {
    if (appView === 'mine') {
      return filterActiveRides(rides, {
        roleFilter,
        onlyMineUserId: user.id,
        nowMs: nowTick,
      });
    }
    return filterActiveRides(rides, {
      roleFilter,
      nowMs: nowTick,
    });
  }, [rides, appView, roleFilter, user.id, nowTick]);

  // Clear selection if selected ride disappeared due to filtering/deletion/expiry
  useEffect(() => {
    if (selectedRide && !visibleRides.some((r) => r.id === selectedRide.id)) {
      setSelectedRide(null);
    }
  }, [visibleRides, selectedRide]);

  const handleOpenCreate = () => {
    triggerHaptic('light');
    setPickerTarget(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (payload: CreateRidePayload) => {
    const created = await createRide(payload, user);
    setRides((prev) => [created, ...prev]);
    setSelectedRide(created);
    setAppView('feed');
    setRoleFilter('all');
    setIsCreateOpen(false);
    setPickerTarget(null);
    setDraft(INITIAL_DRAFT);
  };

  const handleDeleteRide = async (rideId: string) => {
    await deleteRideById(rideId, user.id);
    setRides((prev) => prev.filter((r) => r.id !== rideId));
    if (selectedRide?.id === rideId) {
      setSelectedRide(null);
    }
  };

  const handlePickPointOnMap = (coords: LatLng) => {
    triggerHaptic('medium');
    const label = describePickedCoordinates(coords.lat, coords.lng);
    if (pickerTarget === 'from') {
      setDraft((prev) => ({
        ...prev,
        fromName: label,
        fromLat: coords.lat,
        fromLng: coords.lng,
      }));
    } else if (pickerTarget === 'to') {
      setDraft((prev) => ({
        ...prev,
        toName: label,
        toLat: coords.lat,
        toLng: coords.lng,
      }));
    }
    setPickerTarget(null);
  };

  const filterButtons: { id: RideFilter; label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'driver', label: 'Водители' },
    { id: 'passenger', label: 'Пассажиры' },
  ];

  return (
    <div className="h-[100dvh] w-full flex flex-col lg:grid lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_480px] bg-slate-50 text-slate-900 dark:bg-[#0B0E14] dark:text-slate-100 overflow-hidden">
      {/* Compact mobile header */}
      <header className="lg:hidden h-12 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0E14] flex items-center justify-between gap-2 shrink-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <Route className="w-5 h-5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
          <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Подвезун
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <nav aria-label="Разделы" className="flex items-center gap-1 bg-slate-100 dark:bg-[#131822] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setAppView('feed')}
              aria-pressed={appView === 'feed'}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                appView === 'feed'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Лента
            </button>
            <button
              type="button"
              onClick={() => setAppView('mine')}
              aria-pressed={appView === 'mine'}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                appView === 'mine'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Мои ({myRides.length})
            </button>
          </nav>

          <ThemeCustomizer
            theme={theme}
            accentColor={accentColor}
            onToggleTheme={toggleTheme}
            onChangeAccent={handleChangeAccentColor}
            compact
          />
        </div>
      </header>

      {/* Interactive Kharkiv Map */}
      <section
        aria-label="Карта попутчиков Харькова"
        className="relative h-[52dvh] min-h-[280px] lg:h-full w-full shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800/80"
      >
        {/* Top role filter segmented control */}
        {!pickerTarget && (
          <div className="absolute top-3 left-3 right-3 sm:right-auto z-[500] flex items-center justify-between gap-2 pointer-events-none">
            <div
              role="group"
              aria-label="Фильтр по роли"
              className="pointer-events-auto inline-flex items-center gap-1 p-1 rounded-2xl bg-white/92 dark:bg-[#131822]/92 border border-slate-200 dark:border-slate-700/80 shadow-xl backdrop-blur-md"
            >
              {filterButtons.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setRoleFilter(btn.id);
                  }}
                  aria-pressed={roleFilter === btn.id}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    roleFilter === btn.id
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-fg)] font-bold'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <KharkivMap
          rides={visibleRides}
          selectedRide={selectedRide}
          onSelectRide={setSelectedRide}
          pickerTarget={pickerTarget}
          draftFrom={{
            name: draft.fromName,
            lat: draft.fromLat,
            lng: draft.fromLng,
          }}
          draftTo={{
            name: draft.toName,
            lat: draft.toLat,
            lng: draft.toLng,
          }}
          onPickPoint={handlePickPointOnMap}
          onCancelPicker={() => setPickerTarget(null)}
          theme={theme}
          mapStyle={mapStyle}
          onChangeMapStyle={handleChangeMapStyle}
        />
      </section>

      {/* Right / Bottom Panel */}
      <main className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-[#0B0E14]">
        {/* Desktop Top Header inside sidebar */}
        <header className="hidden lg:flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0E14] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Route className="w-5 h-5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              Подвезун
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <nav aria-label="Разделы" className="flex items-center gap-1 bg-slate-100 dark:bg-[#131822] p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setAppView('feed')}
                aria-pressed={appView === 'feed'}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  appView === 'feed'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Лента
              </button>
              <button
                type="button"
                onClick={() => setAppView('mine')}
                aria-pressed={appView === 'mine'}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  appView === 'mine'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Мои заявки ({myRides.length})
              </button>
            </nav>

            <ThemeCustomizer
              theme={theme}
              accentColor={accentColor}
              onToggleTheme={toggleTheme}
              onChangeAccent={handleChangeAccentColor}
            />
          </div>
        </header>

        {/* Sub-header summary */}
        <div className="px-4 lg:px-5 pt-3 pb-2 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>
            {appView === 'mine'
              ? 'Ваши активные маршруты (скрываются через 3 ч)'
              : 'Актуальные поездки по Харькову'}
          </span>
          <span className="font-mono-tabular text-slate-700 dark:text-slate-300 font-semibold">
            {visibleRides.length}
          </span>
        </div>

        {/* Scrollable Ride Cards Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto theme-scroll px-4 lg:px-5 pb-4 space-y-3">
          {loading ? (
            <div className="space-y-3" aria-label="Загрузка заявок">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-32 rounded-2xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800/70 animate-pulse"
                />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-4 text-sm text-rose-800 dark:text-rose-200">
              <p className="font-semibold">{loadError}</p>
              <button
                type="button"
                onClick={() => void loadRides()}
                className="mt-2 min-h-[40px] px-3.5 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-xs font-bold text-rose-900 dark:text-rose-100 cursor-pointer"
              >
                Повторить
              </button>
            </div>
          ) : visibleRides.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800/80 p-6 text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {appView === 'mine'
                  ? 'У вас пока нет активных заявок'
                  : 'По выбранному фильтру сейчас нет заявок'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {appView === 'mine'
                  ? 'Разместите маршрут, чтобы водители или пассажиры по пути увидели вас.'
                  : 'Попробуйте переключить фильтр или добавьте свою поездку.'}
              </p>
            </div>
          ) : (
            visibleRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                isSelected={selectedRide?.id === ride.id}
                isMine={ride.authorId === user.id}
                onSelect={(r) => setSelectedRide(r)}
                onDelete={handleDeleteRide}
              />
            ))
          )}
        </div>

        {/* Ergonomic Bottom CTA */}
        <div className="px-4 lg:px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0E14] shrink-0">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-full min-h-[48px] px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] active:scale-[0.99] font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-black/10 dark:shadow-black/40"
          >
            <Plus className="w-5 h-5 shrink-0" aria-hidden="true" />
            Разместить маршрут
          </button>
        </div>
      </main>

      <CreateRideModal
        isOpen={isCreateOpen}
        isPickingOnMap={Boolean(pickerTarget)}
        draft={draft}
        onChangeDraft={setDraft}
        onStartMapPick={(target) => setPickerTarget(target)}
        onClose={() => {
          setIsCreateOpen(false);
          setPickerTarget(null);
        }}
        onSubmit={handleCreateSubmit}
      />
    </div>
  );
}
