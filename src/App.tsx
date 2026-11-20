import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  LocateFixed,
  Map as MapIcon,
  Plus,
  RotateCcw,
  Route,
  User as UserIcon,
  WifiOff,
  X,
} from 'lucide-react';
import { CreateRideModal, type CreateRideDraft } from './components/CreateRideModal';
import { KharkivMap, type MapPickerTarget } from './components/KharkivMap';
import { ProfileView } from './components/ProfileView';
import { RideCard } from './components/RideCard';
import { RouteRadarModal } from './components/RouteRadarModal';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import {
  fetchFeedbackForUsers,
  fetchProfilesByTelegramIds,
  incrementCompletedRides,
  saveUserProfile,
  submitRideFeedback,
  upsertUserProfileOnLogin,
} from './services/profileService';
import {
  createRide,
  deleteRideById,
  extendRideLifetime,
  fetchActiveRides,
  readWatchedAlerts,
  subscribeToRideUpdates,
  updateRideSeats,
  writeWatchedAlerts,
} from './services/ridesService';
import type {
  AccentColorId,
  AppView,
  CreateRidePayload,
  FeedbackTagId,
  LatLng,
  MapStyleId,
  ProfileRole,
  Ride,
  RideFeedback,
  RideFilter,
  RouteWatchAlert,
  TelegramUserProfile,
  ThemeMode,
  UserProfile,
} from './types/ride';
import {
  ALL_KHARKIV_POINTS,
  buildShareRideLink,
  buildShareRideText,
  describePickedCoordinates,
  filterActiveRides,
  findMatchingWatchedRides,
  isRideCreatedByUser,
  parseSharedRideId,
} from './utils/ridesLogic';
import {
  applyTelegramThemeColors,
  getTelegramStartParam,
  initTelegramWebApp,
  requestUserGeolocation,
  shareRideToTelegram,
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

const LOW_DATA_STORAGE_KEY = 'podvezun_low_data_mode';

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

function getInitialLowDataMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LOW_DATA_STORAGE_KEY) === '1';
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
  tags: [],
};

export default function App() {
  const [user] = useState<TelegramUserProfile>(() => initTelegramWebApp());
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [accentColor, setAccentColor] = useState<AccentColorId>(getInitialAccentColor);
  const [mapStyle, setMapStyle] = useState<MapStyleId>(() =>
    getInitialMapStyle(getInitialTheme())
  );
  const [lowDataMode, setLowDataMode] = useState<boolean>(getInitialLowDataMode);

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<RideFilter>('all');
  const [fromDistrict, setFromDistrict] = useState<string>('');
  const [toDistrict, setToDistrict] = useState<string>('');
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [sortByProximity, setSortByProximity] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const [appView, setAppView] = useState<AppView>('feed');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<MapPickerTarget>(null);
  const [draft, setDraft] = useState<CreateRideDraft>(INITIAL_DRAFT);

  // User profile & social trust state
  const [userProfile, setUserProfile] = useState<UserProfile>(() => ({
    telegramId: user.telegramId,
    firstName: user.firstName,
    username: user.username,
    role: 'driver',
    carInfo: '',
    bio: '',
    completedRides: 0,
  }));
  const [profilesByTelegramId, setProfilesByTelegramId] = useState<
    Record<number, UserProfile>
  >({});
  const [feedbackByRecipient, setFeedbackByRecipient] = useState<
    Record<number, RideFeedback[]>
  >({});

  // Route Radar watch alerts
  const [alerts, setAlerts] = useState<RouteWatchAlert[]>(readWatchedAlerts);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [dismissedMatchIds, setDismissedMatchIds] = useState<string>('');
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const deepLinkHandledRef = useRef(false);

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

  useEffect(() => {
    window.localStorage.setItem(LOW_DATA_STORAGE_KEY, lowDataMode ? '1' : '0');
  }, [lowDataMode]);

  useEffect(() => {
    writeWatchedAlerts(alerts);
  }, [alerts]);

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

  // Upsert current Telegram user into Supabase profiles on launch
  useEffect(() => {
    let active = true;
    void upsertUserProfileOnLogin(user).then((prof) => {
      if (!active) return;
      setUserProfile(prof);
      setProfilesByTelegramId((prev) => ({ ...prev, [prof.telegramId]: prof }));
    });
    return () => {
      active = false;
    };
  }, [user]);

  // Fetch profiles and trust feedback tags for all visible ride authors + current user
  const refreshSocialTrustData = useCallback(
    async (rideList: Ride[]) => {
      const ids = new Set<number>([user.telegramId]);
      for (const ride of rideList) {
        if (typeof ride.creatorTelegramId === 'number' && ride.creatorTelegramId > 0) {
          ids.add(ride.creatorTelegramId);
        }
      }
      const idList = Array.from(ids);
      const [profilesMap, feedbackRes] = await Promise.all([
        fetchProfilesByTelegramIds(idList),
        fetchFeedbackForUsers(idList),
      ]);
      setProfilesByTelegramId((prev) => ({ ...prev, ...profilesMap }));
      if (profilesMap[user.telegramId]) {
        setUserProfile(profilesMap[user.telegramId]);
      }
      setFeedbackByRecipient(feedbackRes.byRecipient);
    },
    [user.telegramId]
  );

  useEffect(() => {
    void refreshSocialTrustData(rides);
  }, [rides, refreshSocialTrustData]);

  // Select ride automatically if opened via shared link (?ride=... or start_param=ride_...)
  useEffect(() => {
    if (deepLinkHandledRef.current || rides.length === 0) return;
    deepLinkHandledRef.current = true;
    const sharedId = parseSharedRideId(
      window.location.search,
      getTelegramStartParam()
    );
    if (!sharedId) return;
    const found = rides.find((r) => r.id === sharedId);
    if (found) {
      setSelectedRide(found);
      setLowDataMode(false);
    }
  }, [rides]);

  const activeAllRides = useMemo(
    () =>
      filterActiveRides(rides, {
        roleFilter: 'all',
        nowMs: nowTick,
      }),
    [rides, nowTick]
  );

  const myRides = useMemo(
    () =>
      filterActiveRides(rides, {
        roleFilter: 'all',
        nowMs: nowTick,
      }).filter((r) => isRideCreatedByUser(r, user)),
    [rides, user, nowTick]
  );

  const visibleRides = useMemo(() => {
    const base = filterActiveRides(rides, {
      roleFilter,
      fromDistrict,
      toDistrict,
      userLocation,
      sortByProximity,
      nowMs: nowTick,
    });
    if (appView === 'mine') {
      return base.filter((r) => isRideCreatedByUser(r, user));
    }
    return base;
  }, [
    rides,
    appView,
    roleFilter,
    fromDistrict,
    toDistrict,
    userLocation,
    sortByProximity,
    user,
    nowTick,
  ]);

  const watchedMatches = useMemo(
    () => findMatchingWatchedRides(activeAllRides, alerts),
    [activeAllRides, alerts]
  );

  // Fire optional browser Notification when a new ride matches Route Radar
  useEffect(() => {
    if (watchedMatches.length === 0) return;
    const signature = watchedMatches.map((m) => m.id).join(',');
    if (signature !== dismissedMatchIds) {
      // keep banner active when new match appears
    }
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      for (const match of watchedMatches) {
        if (!notifiedIdsRef.current.has(match.id)) {
          notifiedIdsRef.current.add(match.id);
          try {
            new Notification('Подвезун: найдена попутка', {
              body: `${match.fromName} → ${match.toName} (${match.departureLabel})`,
            });
          } catch {
            // Ignore notification failures on restricted webviews
          }
        }
      }
    }
  }, [watchedMatches, dismissedMatchIds]);

  // Clear selection if selected ride disappeared due to filtering/deletion/expiry
  useEffect(() => {
    if (selectedRide && !visibleRides.some((r) => r.id === selectedRide.id)) {
      setSelectedRide(null);
    }
  }, [visibleRides, selectedRide]);

  const handleToggleNearby = async () => {
    triggerHaptic('light');
    setLocationNotice(null);

    if (sortByProximity) {
      setSortByProximity(false);
      return;
    }

    if (userLocation) {
      setSortByProximity(true);
      return;
    }

    setLocatingUser(true);
    try {
      const coords = await requestUserGeolocation();
      setUserLocation(coords);
      setSortByProximity(true);
    } catch (err) {
      setLocationNotice(
        err instanceof Error ? err.message : 'Не удалось получить геолокацию'
      );
    } finally {
      setLocatingUser(false);
    }
  };

  const handleLocateOnMap = async () => {
    triggerHaptic('light');
    setLocationNotice(null);
    setLocatingUser(true);
    try {
      const coords = await requestUserGeolocation();
      setUserLocation(coords);
    } catch (err) {
      setLocationNotice(
        err instanceof Error ? err.message : 'Не удалось получить геолокацию'
      );
    } finally {
      setLocatingUser(false);
    }
  };

  const handleOpenCreate = () => {
    triggerHaptic('light');
    setPickerTarget(null);
    const defaultRole = userProfile.role === 'passenger' ? 'passenger' : 'driver';
    setDraft((prev) => ({
      ...prev,
      role: defaultRole,
      comment:
        defaultRole === 'driver' && !prev.comment.trim() && userProfile.carInfo
          ? userProfile.carInfo
          : prev.comment,
    }));
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (payload: CreateRidePayload) => {
    const created = await createRide(payload, user);
    setRides((prev) => [created, ...prev]);
    setSelectedRide(created);
    setAppView('feed');
    setRoleFilter('all');
    setFromDistrict('');
    setToDistrict('');
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

  const handleCompleteRide = async (ride: Ride) => {
    await deleteRideById(ride.id, user.id);
    setRides((prev) => prev.filter((r) => r.id !== ride.id));
    if (selectedRide?.id === ride.id) {
      setSelectedRide(null);
    }
    const nextCompleted = await incrementCompletedRides(user.telegramId);
    setUserProfile((prev) => ({ ...prev, completedRides: nextCompleted }));
    setProfilesByTelegramId((prev) => ({
      ...prev,
      [user.telegramId]: {
        ...(prev[user.telegramId] ?? userProfile),
        completedRides: nextCompleted,
      },
    }));
  };

  const handleSaveProfile = async (input: {
    role: ProfileRole;
    carInfo: string;
    bio: string;
  }) => {
    const saved = await saveUserProfile({
      telegramId: userProfile.telegramId,
      firstName: userProfile.firstName,
      username: userProfile.username,
      role: input.role,
      carInfo: input.carInfo,
      bio: input.bio,
      completedRides: userProfile.completedRides,
    });
    setUserProfile(saved);
    setProfilesByTelegramId((prev) => ({
      ...prev,
      [saved.telegramId]: saved,
    }));
  };

  const handleSubmitFeedback = async (ride: Ride, tag: FeedbackTagId) => {
    const toTelegramId = ride.creatorTelegramId;
    if (!toTelegramId || toTelegramId === user.telegramId) return;
    const saved = await submitRideFeedback({
      rideId: ride.id,
      fromTelegramId: user.telegramId,
      toTelegramId,
      tag,
    });
    setFeedbackByRecipient((prev) => {
      const existing = prev[toTelegramId] ?? [];
      if (existing.some((f) => f.id === saved.id || (f.rideId === saved.rideId && f.fromTelegramId === saved.fromTelegramId))) {
        return prev;
      }
      return {
        ...prev,
        [toTelegramId]: [saved, ...existing],
      };
    });
  };

  const handleUpdateSeats = async (rideId: string, nextSeats: number) => {
    const outcome = await updateRideSeats(rideId, user.id, nextSeats);
    if (outcome === 'deleted') {
      setRides((prev) => prev.filter((r) => r.id !== rideId));
      if (selectedRide?.id === rideId) {
        setSelectedRide(null);
      }
      return;
    }
    setRides((prev) =>
      prev.map((r) => (r.id === rideId ? { ...r, seats: outcome } : r))
    );
    if (selectedRide?.id === rideId) {
      setSelectedRide((prev) => (prev ? { ...prev, seats: outcome } : null));
    }
  };

  const handleExtendRide = async (ride: Ride) => {
    const nextExpiresAt = await extendRideLifetime(ride, user.id);
    setRides((prev) =>
      prev.map((r) => (r.id === ride.id ? { ...r, expiresAt: nextExpiresAt } : r))
    );
    if (selectedRide?.id === ride.id) {
      setSelectedRide((prev) => (prev ? { ...prev, expiresAt: nextExpiresAt } : null));
    }
  };

  const handleShareRide = async (ride: Ride): Promise<boolean> => {
    const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;
    const shareUrl = buildShareRideLink(ride.id, undefined, botUsername);
    const shareText = buildShareRideText(ride);

    if (shareRideToTelegram(shareUrl, shareText)) {
      return false;
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Подвезун: ${ride.fromName} → ${ride.toName}`,
          text: shareText,
          url: shareUrl,
        });
        return false;
      } catch {
        // Fallback to clipboard copy if user dismissed or Web Share unavailable
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  const handleAddWatchAlert = (input: Omit<RouteWatchAlert, 'id' | 'createdAt'>) => {
    const next: RouteWatchAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    setAlerts((prev) => [next, ...prev]);
    setDismissedMatchIds('');
  };

  const handleRemoveWatchAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
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

  const hasFiltersActive = Boolean(fromDistrict || toDistrict || sortByProximity);
  const currentMatchSignature = watchedMatches.map((m) => m.id).join(',');
  const showRadarBanner =
    watchedMatches.length > 0 && currentMatchSignature !== dismissedMatchIds;

  return (
    <div
      className={`h-[100dvh] w-full flex flex-col bg-slate-50 text-slate-900 dark:bg-[#0B0E14] dark:text-slate-100 overflow-hidden ${
        lowDataMode
          ? ''
          : 'lg:grid lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_480px]'
      }`}
    >
      {/* Compact mobile header: Brand + Explicit Profile shortcut + Theme */}
      <header className="lg:hidden px-3 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0E14] flex items-center justify-between gap-2 shrink-0 z-30">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Route className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
          <span className="text-[15px] sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            Подвезун
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setAppView('profile');
            }}
            aria-label="Открыть профиль"
            aria-pressed={appView === 'profile'}
            className={`min-h-[36px] px-2 sm:px-2.5 rounded-xl border text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              appView === 'profile'
                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--accent-fg)]'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800 dark:bg-[#131822] dark:hover:bg-slate-800 dark:border-slate-800 dark:text-slate-100'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Профиль</span>
          </button>

          <ThemeCustomizer
            theme={theme}
            accentColor={accentColor}
            onToggleTheme={toggleTheme}
            onChangeAccent={handleChangeAccentColor}
            compact
          />
        </div>
      </header>

      {/* Dedicated mobile 3-tab switcher (always visible & spacious on any phone width) */}
      <nav
        aria-label="Разделы"
        className="lg:hidden px-3 py-1.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0E14] shrink-0 z-20"
      >
        <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-[#131822] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setAppView('feed');
            }}
            aria-pressed={appView === 'feed'}
            className={`min-h-[36px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center ${
              appView === 'feed'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            Лента
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setAppView('mine');
            }}
            aria-pressed={appView === 'mine'}
            className={`min-h-[36px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center ${
              appView === 'mine'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            Мои ({myRides.length})
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setAppView('profile');
            }}
            aria-pressed={appView === 'profile'}
            className={`min-h-[36px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 ${
              appView === 'profile'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Профиль</span>
          </button>
        </div>
      </nav>

      {/* Interactive Kharkiv Map (hidden cleanly in low-data mode, and collapsed on mobile when viewing Profile) */}
      {!lowDataMode && (
        <section
          aria-label="Карта попутчиков Харькова"
          className={`relative h-[43dvh] min-h-[225px] sm:h-[46dvh] lg:h-full w-full shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800/80 ${
            appView === 'profile' ? 'hidden lg:block' : ''
          }`}
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
                    className={`min-h-[34px] sm:min-h-[38px] px-2 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
            accentColor={accentColor}
            onChangeMapStyle={handleChangeMapStyle}
            userLocation={userLocation}
            locatingUser={locatingUser}
            onLocateMe={() => void handleLocateOnMap()}
            onShareRide={handleShareRide}
            currentUser={user}
            profilesByTelegramId={profilesByTelegramId}
            feedbackByRecipient={feedbackByRecipient}
            onCompleteRide={handleCompleteRide}
            onSubmitFeedback={handleSubmitFeedback}
          />
        </section>
      )}

      {/* Right / Bottom Panel */}
      <main
        className={`flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-[#0B0E14] ${
          lowDataMode ? 'w-full max-w-2xl mx-auto lg:border-x lg:border-slate-200 lg:dark:border-slate-800/80' : ''
        }`}
      >
        {/* Desktop Top Header inside sidebar */}
        <header className="hidden lg:block px-5 pt-3.5 pb-3 space-y-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0E14] shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Route className="w-5 h-5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
                Подвезун
              </h1>
            </div>

            <ThemeCustomizer
              theme={theme}
              accentColor={accentColor}
              onToggleTheme={toggleTheme}
              onChangeAccent={handleChangeAccentColor}
            />
          </div>

          <nav
            aria-label="Разделы"
            className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-[#131822] p-1 rounded-xl border border-slate-200 dark:border-slate-800"
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setAppView('feed');
              }}
              aria-pressed={appView === 'feed'}
              className={`min-h-[38px] px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center ${
                appView === 'feed'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Лента
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setAppView('mine');
              }}
              aria-pressed={appView === 'mine'}
              className={`min-h-[38px] px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center ${
                appView === 'mine'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Мои ({myRides.length})
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setAppView('profile');
              }}
              aria-pressed={appView === 'profile'}
              className={`min-h-[38px] px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                appView === 'profile'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Профиль</span>
            </button>
          </nav>
        </header>

        {/* Sub-header + Utility Tools + District & Proximity Filter Bar (hidden on Profile tab) */}
        {appView !== 'profile' && (
          <div className="px-4 lg:px-5 pt-2.5 pb-2.5 space-y-2 border-b border-slate-200/70 dark:border-slate-800/70 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate">
                {appView === 'mine'
                  ? 'Ваши активные маршруты'
                  : 'Поездки по Харькову'}
              </span>
              <span className="font-mono-tabular text-slate-700 dark:text-slate-300 font-bold shrink-0">
                {visibleRides.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsRadarOpen(true);
                }}
                aria-label="Открыть радар попутчиков"
                className={`min-h-[34px] px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  watchedMatches.length > 0
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-bold'
                    : 'bg-white dark:bg-[#131822] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <BellRing className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Радар</span>
                {alerts.length > 0 && (
                  <span className="font-mono-tabular text-[11px] opacity-90">
                    ({watchedMatches.length > 0 ? watchedMatches.length : alerts.length})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setLowDataMode((prev) => !prev);
                }}
                aria-pressed={lowDataMode}
                aria-label={lowDataMode ? 'Включить карту' : 'Режим без карты (экономия связи и батареи)'}
                title={lowDataMode ? 'Показать карту' : 'Эконом-режим без карты'}
                className={`min-h-[34px] px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  lowDataMode
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-bold'
                    : 'bg-white dark:bg-[#131822] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {lowDataMode ? (
                  <>
                    <MapIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Карта</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Без карты</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* When map is disabled in low-data mode, show role filter cleanly in the list header */}
          {lowDataMode && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div
                role="group"
                aria-label="Фильтр по роли в списке"
                className="inline-flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800"
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
                    className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      roleFilter === btn.id
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-fg)] font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Эконом-режим
              </span>
            </div>
          )}

          {/* District From / To + Nearby Proximity Filter */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Фильтр по району отправления"
              value={fromDistrict}
              onChange={(e) => setFromDistrict(e.target.value)}
              className="flex-1 min-w-0 min-h-[36px] rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">Откуда: все</option>
              {ALL_KHARKIV_POINTS.map((lm) => (
                <option key={lm.id} value={lm.name}>
                  Из: {lm.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Фильтр по району назначения"
              value={toDistrict}
              onChange={(e) => setToDistrict(e.target.value)}
              className="flex-1 min-w-0 min-h-[36px] rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[var(--accent-primary)]"
            >
              <option value="">Куда: все</option>
              {ALL_KHARKIV_POINTS.map((lm) => (
                <option key={lm.id} value={lm.name}>
                  В: {lm.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void handleToggleNearby()}
              disabled={locatingUser}
              aria-pressed={sortByProximity}
              aria-label="Сортировать по близости ко мне"
              title="Показать ближайшие поездки"
              className={`min-h-[36px] px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${
                sortByProximity
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-bold'
                  : 'bg-white dark:bg-[#131822] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LocateFixed className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Рядом</span>
            </button>

            {hasFiltersActive && (
              <button
                type="button"
                onClick={() => {
                  setFromDistrict('');
                  setToDistrict('');
                  setSortByProximity(false);
                }}
                aria-label="Сбросить фильтры районов"
                title="Сбросить фильтры"
                className="min-h-[36px] min-w-[36px] rounded-xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {locationNotice && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200">
              <span>{locationNotice}</span>
              <button
                type="button"
                onClick={() => setLocationNotice(null)}
                aria-label="Скрыть уведомление о геолокации"
                className="p-0.5 hover:opacity-80 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showRadarBanner && (
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-bold text-[var(--accent-text)]">
                  Радар: {watchedMatches.length} совп.
                </span>{' '}
                <span className="text-slate-700 dark:text-slate-200 truncate">
                  {watchedMatches[0].fromName} → {watchedMatches[0].toName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAppView('feed');
                    setSelectedRide(watchedMatches[0]);
                    if (lowDataMode) setLowDataMode(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-fg)] font-bold cursor-pointer whitespace-nowrap"
                >
                  Открыть
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedMatchIds(currentMatchSignature)}
                  aria-label="Скрыть оповещение радара"
                  className="p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          </div>
        )}

        {/* Scrollable Ride Cards Feed or Profile View */}
        <div className="flex-1 min-h-0 overflow-y-auto theme-scroll px-4 lg:px-5 pt-3 pb-4 space-y-3">
          {appView === 'profile' ? (
            <ProfileView
              profile={userProfile}
              feedbackList={feedbackByRecipient[userProfile.telegramId] ?? []}
              isFallbackDemo={user.isFallbackDemo}
              photoUrl={user.photoUrl}
              onSaveProfile={handleSaveProfile}
            />
          ) : loading ? (
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
                  : 'По выбранным фильтрам сейчас нет заявок'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {appView === 'mine'
                  ? 'Разместите маршрут, чтобы водители или пассажиры по пути увидели вас.'
                  : 'Попробуйте сбросить фильтр районов или включите «Радар», чтобы не пропустить поездку.'}
              </p>
            </div>
          ) : (
            visibleRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                isSelected={selectedRide?.id === ride.id}
                isMine={isRideCreatedByUser(ride, user)}
                authorProfile={
                  typeof ride.creatorTelegramId === 'number'
                    ? profilesByTelegramId[ride.creatorTelegramId]
                    : undefined
                }
                userLocation={sortByProximity ? userLocation : null}
                lowDataMode={lowDataMode}
                onSelect={(r) => setSelectedRide(r)}
                onDelete={handleDeleteRide}
                onUpdateSeats={handleUpdateSeats}
                onExtendRide={handleExtendRide}
                onShareRide={handleShareRide}
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
        savedCarInfo={userProfile.carInfo}
        onChangeDraft={setDraft}
        onStartMapPick={(target) => setPickerTarget(target)}
        onClose={() => {
          setIsCreateOpen(false);
          setPickerTarget(null);
        }}
        onSubmit={handleCreateSubmit}
      />

      <RouteRadarModal
        isOpen={isRadarOpen}
        alerts={alerts}
        activeRides={activeAllRides}
        onClose={() => setIsRadarOpen(false)}
        onAddAlert={handleAddWatchAlert}
        onRemoveAlert={handleRemoveWatchAlert}
        onSelectMatchedRide={(ride) => {
          setAppView('feed');
          setRoleFilter('all');
          setFromDistrict('');
          setToDistrict('');
          setSelectedRide(ride);
          if (lowDataMode) setLowDataMode(false);
        }}
      />
    </div>
  );
}
