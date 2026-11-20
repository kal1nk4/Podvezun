import { useEffect, useRef, useState } from 'react';
import { Check, Moon, Palette, Sun } from 'lucide-react';
import type { AccentColorId, ThemeMode } from '../types/ride';
import { ACCENT_THEMES } from '../utils/themeConfig';
import { triggerHaptic } from '../utils/telegram';

interface ThemeCustomizerProps {
  theme: ThemeMode;
  accentColor: AccentColorId;
  onToggleTheme: () => void;
  onChangeAccent: (accent: AccentColorId) => void;
  compact?: boolean;
}

export function ThemeCustomizer({
  theme,
  accentColor,
  onToggleTheme,
  onChangeAccent,
  compact = false,
}: ThemeCustomizerProps) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isPaletteOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsPaletteOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPaletteOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPaletteOpen]);

  const currentAccent = ACCENT_THEMES.find((a) => a.id === accentColor) ?? ACCENT_THEMES[0];
  const btnSize = compact ? 'min-h-[36px] min-w-[36px]' : 'min-h-[40px] min-w-[40px]';

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          setIsPaletteOpen((prev) => !prev);
        }}
        aria-label="Цвет оформления"
        aria-expanded={isPaletteOpen}
        aria-haspopup="menu"
        title={`Цвет оформления: ${currentAccent.label}`}
        className={`${btnSize} ${compact ? 'px-1.5 sm:px-2' : 'px-2'} rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-[#131822] dark:hover:bg-slate-800 dark:border-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer`}
      >
        <Palette className="w-4 h-4 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
        <span
          className="w-2.5 h-2.5 rounded-full border border-white/60 dark:border-slate-950/60 shrink-0"
          style={{ backgroundColor: currentAccent.swatch }}
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        className={`${btnSize} rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-[#131822] dark:hover:bg-slate-800 dark:border-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer`}
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Moon className="w-4 h-4" aria-hidden="true" />
        )}
      </button>

      {isPaletteOpen && (
        <div
          role="menu"
          aria-label="Выбор цвета оформления"
          className="absolute right-0 top-full mt-2 z-[900] w-80 rounded-2xl bg-white dark:bg-[#131822] border border-slate-200 dark:border-slate-700/80 shadow-2xl p-2.5"
        >
          <div
            role="presentation"
            className="px-1.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Цвет акцента
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ACCENT_THEMES.map((option) => {
              const active = option.id === accentColor;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    triggerHaptic('light');
                    onChangeAccent(option.id);
                    setIsPaletteOpen(false);
                  }}
                  className={`min-h-[42px] px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between gap-1 border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-soft)] border-[var(--accent-border)] text-[var(--accent-text)] font-bold'
                      : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100 dark:bg-[#0B0E14] dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/80 font-semibold'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 dark:border-white/20"
                      style={{ backgroundColor: option.swatch }}
                      aria-hidden="true"
                    />
                    <span className="text-xs whitespace-nowrap">{option.label}</span>
                  </span>
                  {active && (
                    <Check className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
