import { useState } from 'react';
import { Bell, BellRing, Plus, Trash2, X } from 'lucide-react';
import type { Ride, RideFilter, RouteWatchAlert } from '../types/ride';
import {
  findMatchingWatchedRides,
  formatPriceUah,
  KHARKIV_HUBS,
  KHARKIV_LANDMARKS,
} from '../utils/ridesLogic';
import { triggerHaptic } from '../utils/telegram';

interface RouteRadarModalProps {
  isOpen: boolean;
  alerts: RouteWatchAlert[];
  activeRides: Ride[];
  onClose: () => void;
  onAddAlert: (alert: Omit<RouteWatchAlert, 'id' | 'createdAt'>) => void;
  onRemoveAlert: (id: string) => void;
  onSelectMatchedRide: (ride: Ride) => void;
}

export function RouteRadarModal({
  isOpen,
  alerts,
  activeRides,
  onClose,
  onAddAlert,
  onRemoveAlert,
  onSelectMatchedRide,
}: RouteRadarModalProps) {
  const [fromName, setFromName] = useState('Салтовка');
  const [toName, setToName] = useState('Центр');
  const [role, setRole] = useState<RideFilter>('driver');
  const [formError, setFormError] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  if (!isOpen) return null;

  const matchedRides = findMatchingWatchedRides(activeRides, alerts);

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifStatus('unsupported');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);
    } catch {
      // Ignore permission rejection
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromName && !toName) {
      setFormError('Выберите хотя бы точку отправления или назначения');
      return;
    }
    if (fromName && toName && fromName === toName) {
      setFormError('Точки А и Б должны отличаться');
      return;
    }
    setFormError(null);
    triggerHaptic('medium');
    onAddAlert({ fromName, toName, role });
  };

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="radar-modal-title"
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/90 shrink-0">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
            <h2 id="radar-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Радар попутчиков
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть радар попутчиков"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto theme-scroll p-5 space-y-5">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Укажите нужное направление — как только появится подходящая заявка, приложение сразу подсветит её в ленте и отправит оповещение.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 p-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="radar-from" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Откуда
                </label>
                <select
                  id="radar-from"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-white dark:bg-[#131822] border border-slate-300 dark:border-slate-800 px-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="">Любой район</option>
                  <optgroup label="Районы">
                    {KHARKIV_LANDMARKS.map((lm) => (
                      <option key={lm.id} value={lm.name}>
                        {lm.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Метро и ориентиры">
                    {KHARKIV_HUBS.map((lm) => (
                      <option key={lm.id} value={lm.name}>
                        {lm.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label htmlFor="radar-to" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Куда
                </label>
                <select
                  id="radar-to"
                  value={toName}
                  onChange={(e) => setToName(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-white dark:bg-[#131822] border border-slate-300 dark:border-slate-800 px-2.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="">Любой район</option>
                  <optgroup label="Районы">
                    {KHARKIV_LANDMARKS.map((lm) => (
                      <option key={lm.id} value={lm.name}>
                        {lm.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Метро и ориентиры">
                    {KHARKIV_HUBS.map((lm) => (
                      <option key={lm.id} value={lm.name}>
                        {lm.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5" role="group" aria-label="Кого отслеживать">
                {[
                  { id: 'driver' as const, label: 'Водителей' },
                  { id: 'passenger' as const, label: 'Пассажиров' },
                  { id: 'all' as const, label: 'Всех' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRole(opt.id)}
                    aria-pressed={role === opt.id}
                    className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                      role === opt.id
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                        : 'bg-white border-slate-200 text-slate-600 dark:bg-[#131822] dark:border-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="min-h-[40px] px-3.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                Отслеживать
              </button>
            </div>

            {formError && (
              <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                {formError}
              </p>
            )}
          </form>

          {notifStatus !== 'unsupported' && notifStatus !== 'granted' && (
            <button
              type="button"
              onClick={() => void handleRequestNotifications()}
              className="w-full min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              Разрешить системные уведомления о новых поездках
            </button>
          )}

          {/* Active watch rules */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Активные направления ({alerts.length})
            </h3>
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                Пока нет отслеживаемых маршрутов.
              </p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => {
                  const roleText =
                    alert.role === 'driver'
                      ? 'Водители'
                      : alert.role === 'passenger'
                        ? 'Пассажиры'
                        : 'Все';
                  return (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E14] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {alert.fromName || 'Любой'} → {alert.toName || 'Любой'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Фильтр: {roleText}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveAlert(alert.id)}
                        aria-label={`Удалить направление ${alert.fromName || 'Любой'} — ${alert.toName || 'Любой'}`}
                        className="min-h-[38px] min-w-[38px] rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-500/15 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live matched rides */}
          {matchedRides.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
                Найдено по радару ({matchedRides.length})
              </h3>
              <div className="space-y-2">
                {matchedRides.map((ride) => (
                  <button
                    key={ride.id}
                    type="button"
                    onClick={() => {
                      onSelectMatchedRide(ride);
                      onClose();
                    }}
                    className="w-full text-left rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3 hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                      <span className="truncate">
                        {ride.fromName} → {ride.toName}
                      </span>
                      <span className="font-mono-tabular shrink-0">
                        {formatPriceUah(ride.priceUah)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                      {ride.role === 'driver' ? 'Водитель' : 'Пассажир'} · {ride.authorName} · Выезд: {ride.departureLabel}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {botUsername && (
            <a
              href={`https://t.me/${botUsername.replace(/^@+/, '')}?start=radar`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Подключить пуш-оповещения в Telegram-боте @{botUsername.replace(/^@+/, '')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
