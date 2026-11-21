import { useState } from 'react';
import {
  Car,
  Check,
  Clock,
  Hand,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react';
import type { LatLng, Ride, UserProfile } from '../types/ride';
import {
  buildTelegramLink,
  formatDistanceFromUser,
  formatPriceUah,
  formatRemainingTime,
  formatSeatsLabel,
  formatTimeAgo,
  getTagLabel,
  haversineDistanceKm,
} from '../utils/ridesLogic';
import { openTelegramUser, triggerHaptic } from '../utils/telegram';

interface RideCardProps {
  ride: Ride;
  isSelected: boolean;
  isMine: boolean;
  authorProfile?: UserProfile;
  userLocation?: LatLng | null;
  lowDataMode?: boolean;
  compactMode?: boolean;
  onSelect: (ride: Ride) => void;
  onDelete?: (rideId: string) => void;
  onUpdateSeats?: (rideId: string, nextSeats: number) => void;
  onExtendRide?: (ride: Ride) => void;
  onShareRide: (ride: Ride) => Promise<boolean>;
}

export function RideCard({
  ride,
  isSelected,
  isMine,
  authorProfile,
  userLocation,
  lowDataMode = false,
  compactMode = false,
  onSelect,
  onDelete,
  onUpdateSeats,
  onExtendRide,
  onShareRide,
}: RideCardProps) {
  const [copied, setCopied] = useState(false);
  const isDriver = ride.role === 'driver';
  const telegramHref = buildTelegramLink(
    ride.authorUsername ?? authorProfile?.username,
    ride.creatorTelegramId
  );
  const distanceLabel = userLocation
    ? formatDistanceFromUser(
        haversineDistanceKm(userLocation, { lat: ride.fromLat, lng: ride.fromLng })
      )
    : null;
  const tags = ride.tags ?? [];

  const handleShareClick = async () => {
    triggerHaptic('light');
    const copiedToClipboard = await onShareRide(ride);
    if (copiedToClipboard) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <article
      data-testid={`ride-card-${ride.id}`}
      className={`rounded-2xl border transition-colors duration-150 ${
        compactMode ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'
      } ${
        isSelected
          ? isDriver
            ? 'bg-emerald-50/70 border-emerald-500/80 dark:bg-[#151D29] dark:border-emerald-500/80'
            : 'bg-amber-50/70 border-amber-500/80 dark:bg-[#1A1A1F] dark:border-amber-400/80'
          : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-[#131822] dark:border-slate-800/90 dark:hover:border-slate-700'
      }`}
    >
      {/* Top interactive selection trigger: opens route on map */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          onSelect(ride);
        }}
        aria-pressed={isSelected}
        aria-label={`Показать маршрут ${ride.fromName} — ${ride.toName}`}
        className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-lg"
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs min-w-0">
            {isDriver ? (
              <Car className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <Hand className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" aria-hidden="true" />
            )}
            <span
              className={`font-semibold whitespace-nowrap ${
                isDriver
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {isDriver ? 'Водитель' : 'Пассажир'}
            </span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-500 dark:text-slate-400 truncate">
              {formatTimeAgo(ride.createdAt)}
            </span>
            {distanceLabel && (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono-tabular text-[11px] font-semibold text-[var(--accent-text)] whitespace-nowrap">
                  {distanceLabel}
                </span>
              </>
            )}
          </div>

          <span className="font-mono-tabular text-[15px] sm:text-base font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            {formatPriceUah(ride.priceUah)}
          </span>
        </div>

        <h3
          className={`${
            compactMode ? 'mt-1.5 text-sm' : 'mt-2 text-[15px]'
          } font-bold text-slate-900 dark:text-slate-100 leading-snug`}
        >
          {ride.fromName}{' '}
          <span className="text-slate-400 dark:text-slate-500 mx-0.5 sm:mx-1">→</span>{' '}
          {ride.toName}
        </h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400 font-mono-tabular">
          <span>Выезд: {ride.departureLabel}</span>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
            ·
          </span>
          <span>{formatSeatsLabel(ride.seats, ride.role)}</span>
          <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="font-sans text-slate-700 dark:text-slate-300 font-medium">
            {authorProfile?.firstName || ride.authorName}
          </span>
          {authorProfile && authorProfile.completedRides > 0 && (
            <>
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                Поездок: {authorProfile.completedRides}
              </span>
            </>
          )}
        </div>

        {tags.length > 0 && (
          <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {tags.map((t) => getTagLabel(t)).join(' · ')}
          </p>
        )}

        {ride.comment && (
          <p
            className={`${
              compactMode ? 'mt-1 text-xs line-clamp-1' : 'mt-1.5 text-[13px]'
            } text-slate-700 dark:text-slate-300/90 leading-relaxed`}
          >
            {ride.comment}
          </p>
        )}
      </button>

      {/* Owner management controls: seat stepper + lifetime extend */}
      {isMine && onUpdateSeats && onExtendRide && (
        <div
          className={`${
            compactMode ? 'mt-2 pt-2' : 'mt-2.5 pt-2.5'
          } border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2`}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-0.5">
              Мест:
            </span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onUpdateSeats(ride.id, ride.seats - 1);
              }}
              aria-label={
                ride.seats <= 1
                  ? `Убрать последнее место и завершить заявку ${ride.fromName} — ${ride.toName}`
                  : `Уменьшить количество мест для ${ride.fromName} — ${ride.toName}`
              }
              title={ride.seats <= 1 ? '0 мест — завершить заявку' : '−1 место'}
              className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <span className="min-w-[20px] text-center font-mono-tabular text-xs font-bold text-slate-900 dark:text-slate-100">
              {ride.seats}
            </span>
            <button
              type="button"
              disabled={ride.seats >= 4}
              onClick={() => {
                triggerHaptic('light');
                onUpdateSeats(ride.id, ride.seats + 1);
              }}
              aria-label={`Увеличить количество мест для ${ride.fromName} — ${ride.toName}`}
              className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onExtendRide(ride);
            }}
            aria-label={`Продлить заявку ${ride.fromName} — ${ride.toName} на 1 час`}
            className="min-h-[36px] px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
            <span>+1 ч</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono-tabular">
              ({formatRemainingTime(ride.createdAt, ride.expiresAt)})
            </span>
          </button>
        </div>
      )}

      {/* Card actions row */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {!lowDataMode && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onSelect(ride);
              }}
              className="min-h-[42px] px-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />
              На карте
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleShareClick()}
            aria-label={`Поделиться маршрутом ${ride.fromName} — ${ride.toName}`}
            title="Поделиться маршрутом"
            className="min-h-[42px] px-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                <span className="text-[var(--accent-text)]">Скопировано</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />
                <span className={lowDataMode ? 'inline' : 'hidden sm:inline'}>Поделиться</span>
              </>
            )}
          </button>
        </div>

        {isMine && onDelete ? (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onDelete(ride.id);
            }}
            aria-label={`Удалить заявку ${ride.fromName} — ${ride.toName}`}
            className="min-h-[42px] px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 dark:border-rose-500/30 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            Завершить
          </button>
        ) : telegramHref ? (
          <a
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              triggerHaptic('light');
              if (openTelegramUser(telegramHref)) {
                e.preventDefault();
              }
            }}
            className="min-h-[42px] px-3.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] active:scale-[0.98] text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            Написать в Telegram
          </a>
        ) : (
          <span className="min-h-[42px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 text-xs font-medium flex items-center whitespace-nowrap">
            Только в приложении
          </span>
        )}
      </div>
    </article>
  );
}
