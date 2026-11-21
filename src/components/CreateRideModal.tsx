import { useState } from 'react';
import { ArrowUpDown, Car, Hand, Loader2, LocateFixed, MapPin, X } from 'lucide-react';
import type { CreateRidePayload, RideRole, RideTagId } from '../types/ride';
import {
  ALL_KHARKIV_POINTS,
  DEPARTURE_PRESETS,
  describePickedCoordinates,
  findLandmarkByName,
  KHARKIV_HUBS,
  KHARKIV_LANDMARKS,
  RIDE_TAGS,
  validateRideInput,
} from '../utils/ridesLogic';
import { requestUserGeolocation, triggerHaptic } from '../utils/telegram';
import type { MapPickerTarget } from './KharkivMap';

export interface CreateRideDraft {
  role: RideRole;
  fromName: string;
  fromLat: number | null;
  fromLng: number | null;
  toName: string;
  toLat: number | null;
  toLng: number | null;
  departurePreset: string;
  customTime: string;
  priceUah: string;
  seats: number;
  comment: string;
  tags: RideTagId[];
}

interface CreateRideModalProps {
  isOpen: boolean;
  isPickingOnMap: boolean;
  draft: CreateRideDraft;
  savedCarInfo?: string;
  onChangeDraft: (updater: (prev: CreateRideDraft) => CreateRideDraft) => void;
  onStartMapPick: (target: Exclude<MapPickerTarget, null>) => void;
  onClose: () => void;
  onSubmit: (payload: CreateRidePayload) => Promise<void>;
}

export function CreateRideModal({
  isOpen,
  isPickingOnMap,
  draft,
  savedCarInfo = '',
  onChangeDraft,
  onStartMapPick,
  onClose,
  onSubmit,
}: CreateRideModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locatingFrom, setLocatingFrom] = useState(false);

  if (!isOpen || isPickingOnMap) return null;

  const isCustomFrom =
    Boolean(draft.fromName) && !ALL_KHARKIV_POINTS.some((lm) => lm.name === draft.fromName);
  const isCustomTo =
    Boolean(draft.toName) && !ALL_KHARKIV_POINTS.some((lm) => lm.name === draft.toName);

  const handleUseMyLocationForFrom = async () => {
    triggerHaptic('light');
    setLocatingFrom(true);
    setErrors((prev) => ({ ...prev, from: '' }));
    try {
      const coords = await requestUserGeolocation();
      const label = describePickedCoordinates(coords.lat, coords.lng);
      onChangeDraft((prev) => ({
        ...prev,
        fromName: label,
        fromLat: coords.lat,
        fromLng: coords.lng,
      }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        from: err instanceof Error ? err.message : 'Не удалось определить геопозицию',
      }));
    } finally {
      setLocatingFrom(false);
    }
  };

  const toggleTag = (tagId: RideTagId) => {
    triggerHaptic('light');
    onChangeDraft((prev) => {
      const exists = prev.tags.includes(tagId);
      return {
        ...prev,
        tags: exists ? prev.tags.filter((t) => t !== tagId) : [...prev.tags, tagId],
      };
    });
  };

  const handleSelectLandmark = (field: 'from' | 'to', value: string) => {
    const landmark = findLandmarkByName(value);
    onChangeDraft((prev) => {
      if (field === 'from') {
        return {
          ...prev,
          fromName: landmark ? landmark.name : '',
          fromLat: landmark ? landmark.lat : null,
          fromLng: landmark ? landmark.lng : null,
        };
      }
      return {
        ...prev,
        toName: landmark ? landmark.name : '',
        toLat: landmark ? landmark.lat : null,
        toLng: landmark ? landmark.lng : null,
      };
    });
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSwapEndpoints = () => {
    triggerHaptic('light');
    onChangeDraft((prev) => ({
      ...prev,
      fromName: prev.toName,
      fromLat: prev.toLat,
      fromLng: prev.toLng,
      toName: prev.fromName,
      toLat: prev.fromLat,
      toLng: prev.fromLng,
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const departureLabel =
      draft.departurePreset === 'custom'
        ? draft.customTime.trim()
        : draft.departurePreset;

    const numericPrice = draft.priceUah.trim() === '' ? 0 : Number(draft.priceUah);

    const payload: CreateRidePayload = {
      role: draft.role,
      fromName: draft.fromName,
      fromLat: draft.fromLat,
      fromLng: draft.fromLng,
      toName: draft.toName,
      toLat: draft.toLat,
      toLng: draft.toLng,
      departureLabel,
      priceUah: Number.isNaN(numericPrice) ? -1 : numericPrice,
      seats: draft.seats,
      comment: draft.comment,
      tags: draft.tags,
    };

    const validation = validateRideInput(payload);
    if (!validation.valid) {
      setErrors(validation.errors as Record<string, string>);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Не удалось опубликовать заявку'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-ride-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Grab handle on mobile */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/90 shrink-0">
          <h2 id="create-ride-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Разместить маршрут
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно создания заявки"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto theme-scroll p-5 space-y-5">
          {/* Role selector */}
          <fieldset>
            <legend className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Ваша роль в поездке
            </legend>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onChangeDraft((prev) => ({
                    ...prev,
                    role: 'driver',
                    comment: !prev.comment.trim() && savedCarInfo ? savedCarInfo : prev.comment,
                  }));
                }}
                aria-pressed={draft.role === 'driver'}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  draft.role === 'driver'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500 dark:text-emerald-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Car className="w-5 h-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight">Я водитель</div>
                  <div className="text-[11px] opacity-80 leading-tight">Подвезу</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onChangeDraft((prev) => ({
                    ...prev,
                    role: 'passenger',
                    comment:
                      savedCarInfo && prev.comment.trim() === savedCarInfo.trim()
                        ? ''
                        : prev.comment,
                  }));
                }}
                aria-pressed={draft.role === 'passenger'}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  draft.role === 'passenger'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 dark:bg-amber-400/15 dark:border-amber-400 dark:text-amber-200'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Hand className="w-5 h-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight">Я пассажир</div>
                  <div className="text-[11px] opacity-80 leading-tight">Ищу авто</div>
                </div>
              </button>
            </div>
          </fieldset>

          {/* Point A & Point B */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="ride-from-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Точка А — Откуда
                </label>
                <button
                  type="button"
                  onClick={handleSwapEndpoints}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 py-1 px-2 rounded-lg transition-colors cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                  Поменять
                </button>
              </div>
              <div className="flex gap-1.5">
                <select
                  id="ride-from-select"
                  value={draft.fromName}
                  onChange={(e) => handleSelectLandmark('from', e.target.value)}
                  className="flex-1 min-w-0 min-h-[46px] rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="">Выберите район или ориентир</option>
                  {isCustomFrom && (
                    <option value={draft.fromName}>{draft.fromName}</option>
                  )}
                  <optgroup label="Районы Харькова">
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
                <button
                  type="button"
                  onClick={() => void handleUseMyLocationForFrom()}
                  disabled={locatingFrom}
                  aria-label="Определить мою геопозицию для точки А"
                  title="Моё местоположение"
                  className="min-h-[46px] min-w-[46px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-100 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {locatingFrom ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
                  ) : (
                    <LocateFixed className="w-4 h-4 text-[var(--accent-text)]" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onStartMapPick('from')}
                  aria-label="Выбрать точку А на карте"
                  className="min-h-[46px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  На карте
                </button>
              </div>
              {errors.from && (
                <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {errors.from}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="ride-to-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Точка Б — Куда
              </label>
              <div className="flex gap-1.5">
                <select
                  id="ride-to-select"
                  value={draft.toName}
                  onChange={(e) => handleSelectLandmark('to', e.target.value)}
                  className="flex-1 min-w-0 min-h-[46px] rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="">Выберите район или ориентир</option>
                  {isCustomTo && (
                    <option value={draft.toName}>{draft.toName}</option>
                  )}
                  <optgroup label="Районы Харькова">
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
                <button
                  type="button"
                  onClick={() => onStartMapPick('to')}
                  aria-label="Выбрать точку Б на карте"
                  className="min-h-[46px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" aria-hidden="true" />
                  На карте
                </button>
              </div>
              {errors.to && (
                <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {errors.to}
                </p>
              )}
            </div>
          </div>

          {/* Departure time */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Время выезда
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEPARTURE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    onChangeDraft((prev) => ({ ...prev, departurePreset: preset }));
                    setErrors((prev) => ({ ...prev, departureLabel: '' }));
                  }}
                  className={`min-h-[42px] px-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    draft.departurePreset === preset
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 dark:bg-[#0B0E14] dark:text-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  onChangeDraft((prev) => ({ ...prev, departurePreset: 'custom' }))
                }
                className={`min-h-[42px] px-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  draft.departurePreset === 'custom'
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 dark:bg-[#0B0E14] dark:text-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                }`}
              >
                Указать время
              </button>
            </div>
            {draft.departurePreset === 'custom' && (
              <input
                type="time"
                aria-label="Точное время выезда"
                value={draft.customTime}
                onChange={(e) => {
                  onChangeDraft((prev) => ({ ...prev, customTime: e.target.value }));
                  setErrors((prev) => ({ ...prev, departureLabel: '' }));
                }}
                className="mt-2 w-full min-h-[44px] rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 font-mono-tabular focus:outline-none focus:border-[var(--accent-primary)]"
              />
            )}
            {errors.departureLabel && (
              <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {errors.departureLabel}
              </p>
            )}
          </div>

          {/* Price & Seats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ride-price-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Компенсация за место (₴)
              </label>
              <input
                id="ride-price-input"
                type="number"
                min={0}
                max={5000}
                inputMode="numeric"
                value={draft.priceUah}
                onChange={(e) => {
                  onChangeDraft((prev) => ({ ...prev, priceUah: e.target.value }));
                  setErrors((prev) => ({ ...prev, priceUah: '' }));
                }}
                placeholder="0 = бесплатно"
                className="w-full min-h-[46px] rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 font-mono-tabular focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <div className="mt-1.5 flex gap-1.5">
                {[0, 50, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      onChangeDraft((prev) => ({ ...prev, priceUah: String(val) }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-mono-tabular dark:text-slate-300 cursor-pointer"
                  >
                    {val === 0 ? 'Бесплатно' : `${val} ₴`}
                  </button>
                ))}
              </div>
              {errors.priceUah && (
                <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {errors.priceUah}
                </p>
              )}
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {draft.role === 'driver' ? 'Свободных мест' : 'Сколько человек'}
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      onChangeDraft((prev) => ({ ...prev, seats: num }));
                    }}
                    aria-pressed={draft.seats === num}
                    className={`min-h-[46px] rounded-xl border font-mono-tabular text-sm font-bold transition-colors cursor-pointer ${
                      draft.seats === num
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--accent-fg)]'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick condition tags */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Условия поездки (необязательно)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {RIDE_TAGS.map((tag) => {
                const active = draft.tags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    aria-pressed={active}
                    className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="ride-comment-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Короткий комментарий
              </label>
              {draft.role === 'driver' && savedCarInfo && (
                <span className="text-[11px] text-[var(--accent-text)] font-medium truncate">
                  Авто из профиля
                </span>
              )}
            </div>
            <textarea
              id="ride-comment-input"
              rows={2}
              maxLength={160}
              value={draft.comment}
              onChange={(e) =>
                onChangeDraft((prev) => ({ ...prev, comment: e.target.value }))
              }
              placeholder={
                draft.role === 'driver'
                  ? 'Серый Lanos, еду по Полтавскому Шляху'
                  : 'Стою у входа в метро, с рюкзаком'
              }
              className="w-full rounded-xl bg-slate-50 dark:bg-[#0B0E14] border border-slate-300 dark:border-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[var(--accent-primary)] resize-none"
            />
            {errors.comment && (
              <p role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {errors.comment}
              </p>
            )}
          </div>

          {submitError && (
            <p role="alert" className="text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-3 py-2">
              {submitError}
            </p>
          )}

          {/* Submit CTA */}
          <div className="pt-1 pb-safe">
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] disabled:opacity-60 active:scale-[0.99] font-bold text-sm transition-all cursor-pointer"
            >
              {submitting ? 'Публикуем...' : 'Опубликовать маршрут'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
