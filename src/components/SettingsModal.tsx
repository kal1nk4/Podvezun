import { useEffect } from 'react';
import {
  Check,
  Layers,
  MonitorSmartphone,
  Moon,
  Palette,
  SlidersHorizontal,
  Sun,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  AccentColorId,
  MapStyleId,
  ThemeMode,
  ThemePreference,
} from '../types/ride';
import { triggerHaptic } from '../utils/telegram';
import { ACCENT_THEMES, MAP_STYLES } from '../utils/themeConfig';

interface SettingsModalProps {
  isOpen: boolean;
  themePreference: ThemePreference;
  effectiveTheme: ThemeMode;
  telegramColorScheme: ThemeMode | null;
  mapStyle: MapStyleId;
  accentColor: AccentColorId;
  compactMode: boolean;
  lowDataMode: boolean;
  onChangeThemePreference: (pref: ThemePreference) => void;
  onChangeMapStyle: (style: MapStyleId) => void;
  onChangeAccent: (accent: AccentColorId) => void;
  onToggleCompactMode: () => void;
  onToggleLowDataMode: () => void;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  themePreference,
  effectiveTheme,
  telegramColorScheme,
  mapStyle,
  accentColor,
  compactMode,
  lowDataMode,
  onChangeThemePreference,
  onChangeMapStyle,
  onChangeAccent,
  onToggleCompactMode,
  onToggleLowDataMode,
  onClose,
}: SettingsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const themeOptions: {
    id: ThemePreference;
    label: string;
    icon: typeof MonitorSmartphone;
  }[] = [
    { id: 'auto', label: 'Авто', icon: MonitorSmartphone },
    { id: 'dark', label: 'Тёмная', icon: Moon },
    { id: 'light', label: 'Светлая', icon: Sun },
  ];

  return (
    <div
      className="fixed inset-0 z-[1050] flex items-end sm:items-center justify-center bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      data-testid="settings-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full sm:max-w-md max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800/90 shrink-0">
          <div className="min-w-0">
            <h2
              id="settings-modal-title"
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100"
            >
              Настройки
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Оформление, карта и экономия трафика
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть настройки"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto theme-scroll px-4 sm:px-5 py-4 space-y-5">
          {/* 1. Theme selector (Auto / Dark / Light) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Тема интерфейса
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {themePreference === 'auto'
                  ? telegramColorScheme
                    ? `Telegram: ${telegramColorScheme === 'dark' ? 'тёмная' : 'светлая'}`
                    : `Сейчас: ${effectiveTheme === 'dark' ? 'тёмная' : 'светлая'}`
                  : effectiveTheme === 'dark'
                    ? 'Тёмная'
                    : 'Светлая'}
              </span>
            </div>

            <div
              role="radiogroup"
              aria-label="Тема оформления"
              className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800"
            >
              {themeOptions.map((opt) => {
                const active = themePreference === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`settings-theme-${opt.id}`}
                    onClick={() => {
                      triggerHaptic('light');
                      onChangeThemePreference(opt.id);
                    }}
                    className={`min-h-[42px] px-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm font-bold dark:bg-slate-800 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 font-semibold dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Accent color selector */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Palette className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <span>Акцентный цвет и маршруты</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {ACCENT_THEMES.map((option) => {
                const active = option.id === accentColor;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`settings-accent-${option.id}`}
                    onClick={() => {
                      triggerHaptic('light');
                      onChangeAccent(option.id);
                    }}
                    className={`min-h-[44px] px-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-bold'
                        : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/70 font-semibold'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                        style={{ backgroundColor: option.swatch }}
                        aria-hidden="true"
                      />
                      <span className="text-xs truncate">{option.label}</span>
                    </span>
                    {active && (
                      <Check className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Map style selector */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Layers className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
              <span>Стиль карты</span>
            </div>

            <div className="space-y-1.5">
              {MAP_STYLES.map((option) => {
                const active = option.id === mapStyle;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`settings-map-${option.id}`}
                    onClick={() => {
                      triggerHaptic('light');
                      onChangeMapStyle(option.id);
                    }}
                    className={`w-full min-h-[46px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)]'
                        : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-md border border-slate-300 dark:border-slate-600 shrink-0"
                        style={{ backgroundColor: option.swatchColor }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold leading-tight truncate">
                          {option.label}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                          {option.description}
                        </div>
                      </div>
                    </div>
                    {active && (
                      <Check className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. Compact & Low-Data Economy Switches */}
          <section className="space-y-2 pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">
              Производительность и трафик
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={compactMode}
              data-testid="settings-compact-toggle"
              onClick={() => {
                triggerHaptic('light');
                onToggleCompactMode();
              }}
              className={`w-full min-h-[52px] px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                compactMode
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                  : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100 dark:bg-[#0B0E14] dark:border-slate-800 dark:hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <SlidersHorizontal
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    compactMode ? 'text-[var(--accent-text)]' : 'text-slate-500 dark:text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    Компактный режим и экономия
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Меньше отступы карточек, без лишних анимаций
                  </div>
                </div>
              </div>
              <span
                aria-hidden="true"
                className={`w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors ${
                  compactMode
                    ? 'bg-[var(--accent-primary)] justify-end'
                    : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={lowDataMode}
              data-testid="settings-lowdata-toggle"
              onClick={() => {
                triggerHaptic('light');
                onToggleLowDataMode();
              }}
              className={`w-full min-h-[52px] px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                lowDataMode
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-border)]'
                  : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100 dark:bg-[#0B0E14] dark:border-slate-800 dark:hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <WifiOff
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    lowDataMode ? 'text-[var(--accent-text)]' : 'text-slate-500 dark:text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    Скрыть карту (минимум трафика)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Только быстрый текстовый список при слабой сети
                  </div>
                </div>
              </div>
              <span
                aria-hidden="true"
                className={`w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors ${
                  lowDataMode
                    ? 'bg-[var(--accent-primary)] justify-end'
                    : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </span>
            </button>
          </section>
        </div>

        {/* Sticky Done Footer with safe area */}
        <div className="px-4 sm:px-5 pt-3 pb-safe border-t border-slate-200 dark:border-slate-800/90 bg-slate-50/70 dark:bg-[#0B0E14]/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-bold text-sm transition-colors cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
