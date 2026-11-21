import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Calendar,
  Car,
  Check,
  CheckCircle2,
  Hand,
  Loader2,
  MessageCircle,
  RotateCcw,
  Route,
  Users,
  X,
} from 'lucide-react';
import type {
  AccentColorId,
  CompletedRideRecord,
  FeedbackTagId,
  MapStyleId,
  Ride,
  RideFeedback,
  TelegramUserProfile,
  UserProfile,
} from '../types/ride';
import {
  fetchRoadRoute,
  formatRouteStats,
  getCachedRoadRoute,
  type RouteGeometryResult,
} from '../utils/osrmRoute';
import {
  buildTelegramLink,
  FEEDBACK_TAGS,
  formatHistoryDateTime,
  formatPriceUah,
  formatSeatsLabel,
  getTagLabel,
  getTopFeedbackTags,
} from '../utils/ridesLogic';
import { openTelegramUser, triggerHaptic } from '../utils/telegram';
import { getAccentOption, getMapStyleOption } from '../utils/themeConfig';

interface CompletedRideDetailModalProps {
  entry: CompletedRideRecord | null;
  theme: 'light' | 'dark';
  mapStyle: MapStyleId;
  accentColor: AccentColorId;
  lowDataMode: boolean;
  currentUser: TelegramUserProfile;
  authorProfile?: UserProfile;
  authorFeedback?: RideFeedback[];
  onClose: () => void;
  onSubmitFeedback?: (ride: Ride, tag: FeedbackTagId) => Promise<void>;
  onRepeatRide?: (ride: Ride) => void;
}

function createEndpointIcon(label: 'А' | 'Б', color: string, isDark: boolean): L.DivIcon {
  const bg = isDark ? '#0B0E14' : '#FFFFFF';
  const fg = isDark ? '#F8FAFC' : '#0F172A';
  return L.divIcon({
    className: 'podvezun-endpoint-wrapper',
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:${bg};border:2.5px solid ${color};color:${fg};font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.35);">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function CompletedRideDetailModal({
  entry,
  theme,
  mapStyle,
  accentColor,
  lowDataMode,
  currentUser,
  authorProfile,
  authorFeedback = [],
  onClose,
  onSubmitFeedback,
  onRepeatRide,
}: CompletedRideDetailModalProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteGeometryResult | null>(null);
  const [submittingTag, setSubmittingTag] = useState<FeedbackTagId | null>(null);

  const ride = entry?.ride ?? null;
  const isDark = theme === 'dark';
  const accentPrimary = getAccentOption(accentColor)[theme].primary;
  const currentStyle = getMapStyleOption(mapStyle);

  useEffect(() => {
    if (!entry) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [entry, onClose]);

  // Fetch OSRM route geometry when modal opens
  useEffect(() => {
    if (!ride) {
      setRouteResult(null);
      setRouteLoading(false);
      return;
    }

    const from = { lat: ride.fromLat, lng: ride.fromLng };
    const to = { lat: ride.toLat, lng: ride.toLng };
    const cached = getCachedRoadRoute(from, to);
    if (cached) {
      setRouteResult(cached);
      setRouteLoading(false);
      return;
    }

    const controller = new AbortController();
    setRouteLoading(true);
    setRouteResult(null);

    void fetchRoadRoute(from, to, {
      timeoutMs: 5000,
      signal: controller.signal,
    }).then((res) => {
      if (controller.signal.aborted) return;
      setRouteResult(res);
      setRouteLoading(false);
    });

    return () => controller.abort();
  }, [ride]);

  // Render mini Leaflet route preview inside modal when map mode is active
  useEffect(() => {
    if (!ride || lowDataMode || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [ride.fromLat, ride.fromLng],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer(currentStyle.url, {
      attribution: currentStyle.attribution,
      maxZoom: 19,
    }).addTo(map);

    const points: [number, number][] = routeResult?.coordinates ?? [
      [ride.fromLat, ride.fromLng],
      [ride.toLat, ride.toLng],
    ];

    L.polyline(points, {
      color: accentPrimary,
      weight: 8,
      opacity: isDark ? 0.25 : 0.2,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    L.polyline(points, {
      color: accentPrimary,
      weight: 4,
      opacity: 0.96,
      dashArray: !routeResult || routeResult.isFallback ? '7, 7' : undefined,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    L.marker([ride.fromLat, ride.fromLng], {
      icon: createEndpointIcon('А', accentPrimary, isDark),
      interactive: false,
    }).addTo(map);

    L.marker([ride.toLat, ride.toLng], {
      icon: createEndpointIcon('Б', accentPrimary, isDark),
      interactive: false,
    }).addTo(map);

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, {
      padding: [28, 28],
      maxZoom: 14,
      animate: false,
    });

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
  }, [
    ride,
    lowDataMode,
    currentStyle.url,
    currentStyle.attribution,
    routeResult,
    accentPrimary,
    isDark,
  ]);

  if (!entry || !ride) return null;

  const isDriver = ride.role === 'driver';
  const isCreator = entry.participation === 'created';
  const routeStatsLabel = routeResult
    ? formatRouteStats(routeResult.distanceMeters, routeResult.durationSeconds)
    : null;

  const existingMyFeedback =
    entry.myFeedbackTag ??
    authorFeedback.find(
      (f) => f.rideId === ride.id && f.fromTelegramId === currentUser.telegramId
    )?.tag ??
    null;

  const topAuthorTags = getTopFeedbackTags(authorFeedback, 2);
  const telegramHref = !isCreator
    ? buildTelegramLink(
        ride.authorUsername ?? authorProfile?.username,
        ride.creatorTelegramId
      )
    : null;

  const createdLabel = entry.originalCreatedAt
    ? formatHistoryDateTime(entry.originalCreatedAt)
    : null;
  const completedLabel = formatHistoryDateTime(entry.completedAt);

  return (
    <div
      className="fixed inset-0 z-[1050] flex items-end sm:items-center justify-center bg-slate-950/65 dark:bg-black/75 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completed-ride-detail-title"
      data-testid="completed-ride-detail-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/90 shrink-0">
          <div className="min-w-0">
            <h2
              id="completed-ride-detail-title"
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate"
            >
              Детали маршрута
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isCreator ? 'Создан вами' : 'Участие в поездке'}
              <span aria-hidden="true"> · </span>
              <span>Завершена: {completedLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть детали маршрута"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto theme-scroll p-5 space-y-4">
          {/* Interactive route map preview (hidden in lowDataMode) */}
          {!lowDataMode && (
            <div className="space-y-1.5">
              <div
                className={`relative h-44 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0B0E14] podvezun-map-${mapStyle}`}
              >
                <div ref={mapContainerRef} className="w-full h-full z-0" />
                {routeLoading && (
                  <div className="absolute bottom-2 left-2 z-[400] px-2.5 py-1 rounded-lg bg-white/90 dark:bg-[#131822]/90 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
                    <span>Строим маршрут...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Route Endpoints A -> B */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <span
                className="mt-0.5 w-5 h-5 rounded-full border-2 border-[var(--accent-primary)] text-[10px] font-mono-tabular font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                А
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {ride.fromName}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                  {ride.fromLat.toFixed(4)}, {ride.fromLng.toFixed(4)}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span
                className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-400 dark:border-slate-500 text-[10px] font-mono-tabular font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                Б
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {ride.toName}
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                  {ride.toLat.toFixed(4)}, {ride.toLng.toFixed(4)}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-mono-tabular">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1 font-sans font-semibold text-slate-800 dark:text-slate-100">
                  {isDriver ? (
                    <Car className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <Hand className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0" aria-hidden="true" />
                  )}
                  {isDriver ? 'Водитель' : 'Пассажир'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {formatPriceUah(ride.priceUah)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatSeatsLabel(ride.seats, ride.role)}</span>
              </div>
              {routeStatsLabel && (
                <span className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 font-semibold">
                  <Route className="w-3 h-3 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                  {routeStatsLabel}
                </span>
              )}
            </div>
          </div>

          {/* Trip Timing & Details */}
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span>{createdLabel ? `Создан: ${createdLabel}` : `Завершена: ${completedLabel}`}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>Выезд: {ride.departureLabel}</span>
            </div>

            {ride.tags && ride.tags.length > 0 && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Опции: {ride.tags.map((t) => getTagLabel(t)).join(' · ')}
              </p>
            )}

            {ride.comment && (
              <div className="pt-1">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  Комментарий
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {ride.comment}
                </p>
              </div>
            )}
          </div>

          {/* Companion / Creator & Trust Feedback */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                  {isCreator
                    ? `Автор: ${currentUser.firstName}`
                    : `Попутчик: ${authorProfile?.firstName || ride.authorName}`}
                </span>
              </div>
              {!isCreator && authorProfile && (
                <span className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                  Поездок: {authorProfile.completedRides}
                </span>
              )}
            </div>

            {!isCreator && ride.role === 'driver' && authorProfile?.carInfo && (
              <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                <span>{authorProfile.carInfo}</span>
              </p>
            )}

            {!isCreator && topAuthorTags.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Теги попутчика:{' '}
                {topAuthorTags.map((t) => `${t.tag} · ${t.count}`).join(' / ')}
              </p>
            )}

            {isCreator && entry.receivedFeedbackTags && entry.receivedFeedbackTags.length > 0 && (
              <p className="text-xs font-medium text-[var(--accent-text)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Полученные отметки: {entry.receivedFeedbackTags.join(' · ')}
                </span>
              </p>
            )}

            {!isCreator && (
              <div>
                {existingMyFeedback ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-text)]">
                    <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Ваша отметка: {existingMyFeedback}</span>
                  </div>
                ) : onSubmitFeedback &&
                  typeof ride.creatorTelegramId === 'number' &&
                  ride.creatorTelegramId !== currentUser.telegramId ? (
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Отметить попутчика:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {FEEDBACK_TAGS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          disabled={submittingTag !== null}
                          onClick={() => {
                            triggerHaptic('medium');
                            setSubmittingTag(tag);
                            void onSubmitFeedback(ride, tag).finally(() => {
                              setSubmittingTag(null);
                            });
                          }}
                          className="min-h-[34px] px-2.5 rounded-lg bg-slate-100 hover:bg-[var(--accent-soft)] border border-slate-200 hover:border-[var(--accent-border)] text-xs font-semibold text-slate-700 hover:text-[var(--accent-text)] dark:bg-[#0B0E14] dark:border-slate-700/80 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {submittingTag === tag ? '...' : tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-5 pt-3 pb-safe border-t border-slate-200 dark:border-slate-800/90 bg-slate-50/70 dark:bg-[#0B0E14]/80 flex items-center gap-2 shrink-0">
          {onRepeatRide && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onRepeatRide(ride);
                onClose();
              }}
              className="flex-1 min-h-[44px] px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
              Повторить маршрут
            </button>
          )}

          {telegramHref && (
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (openTelegramUser(telegramHref)) {
                  e.preventDefault();
                }
              }}
              className="flex-1 min-h-[44px] px-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 dark:bg-[#131822] dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-100 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              Telegram
            </a>
          )}

          {!onRepeatRide && !telegramHref && (
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-bold cursor-pointer"
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
