import { Car, Hand, MapPin, MessageCircle, Trash2 } from 'lucide-react';
import type { Ride } from '../types/ride';
import {
  buildTelegramLink,
  formatPriceUah,
  formatSeatsLabel,
  formatTimeAgo,
} from '../utils/ridesLogic';
import { openTelegramUser, triggerHaptic } from '../utils/telegram';

interface RideCardProps {
  ride: Ride;
  isSelected: boolean;
  isMine: boolean;
  onSelect: (ride: Ride) => void;
  onDelete?: (rideId: string) => void;
}

export function RideCard({
  ride,
  isSelected,
  isMine,
  onSelect,
  onDelete,
}: RideCardProps) {
  const isDriver = ride.role === 'driver';
  const telegramHref = buildTelegramLink(ride.authorUsername);

  return (
    <article
      data-testid={`ride-card-${ride.id}`}
      className={`rounded-2xl bg-[#131822] border transition-colors duration-150 p-4 ${
        isSelected
          ? isDriver
            ? 'border-emerald-500/80 bg-[#151D29]'
            : 'border-amber-400/80 bg-[#1A1A1F]'
          : 'border-slate-800/90 hover:border-slate-700'
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
        className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs min-w-0">
            {isDriver ? (
              <Car className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <Hand className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
            )}
            <span
              className={`font-semibold whitespace-nowrap ${
                isDriver ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {isDriver ? 'Водитель' : 'Пассажир'}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-400 truncate">{formatTimeAgo(ride.createdAt)}</span>
          </div>

          <span className="font-mono-tabular text-base font-bold text-slate-100 whitespace-nowrap shrink-0">
            {formatPriceUah(ride.priceUah)}
          </span>
        </div>

        <h3 className="mt-2 text-[15px] font-bold text-slate-100 leading-snug">
          {ride.fromName} <span className="text-slate-500 mx-1">→</span> {ride.toName}
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 font-mono-tabular">
          <span>Выезд: {ride.departureLabel}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span>{formatSeatsLabel(ride.seats, ride.role)}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="font-sans text-slate-300 font-medium">{ride.authorName}</span>
        </div>

        {ride.comment && (
          <p className="mt-2 text-[13px] text-slate-300/90 leading-relaxed">
            {ride.comment}
          </p>
        )}
      </button>

      {/* Card actions row */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onSelect(ride);
          }}
          className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          На карте
        </button>

        {isMine && onDelete ? (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onDelete(ride.id);
            }}
            aria-label={`Удалить заявку ${ride.fromName} — ${ride.toName}`}
            className="min-h-[44px] px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
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
            className="min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            Написать в Telegram
          </a>
        ) : (
          <span className="min-h-[44px] px-3 rounded-xl bg-slate-800/70 text-slate-400 text-xs font-medium flex items-center whitespace-nowrap">
            Только в приложении
          </span>
        )}
      </div>
    </article>
  );
}
