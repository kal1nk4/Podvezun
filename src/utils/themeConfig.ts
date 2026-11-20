import type { AccentColorId, MapStyleId, ThemeMode } from '../types/ride';

export interface AccentThemeOption {
  id: AccentColorId;
  label: string;
  swatch: string;
  light: {
    primary: string;
    hover: string;
    fg: string;
    text: string;
    softBg: string;
    border: string;
  };
  dark: {
    primary: string;
    hover: string;
    fg: string;
    text: string;
    softBg: string;
    border: string;
  };
}

export interface MapStyleOption {
  id: MapStyleId;
  label: string;
  description: string;
  url: string;
  attribution: string;
  swatchColor: string;
  isDark: boolean;
}

export const THEME_STORAGE_KEY = 'podvezun_theme';
export const MAP_STYLE_STORAGE_KEY = 'podvezun_map_style';
export const ACCENT_STORAGE_KEY = 'podvezun_accent_color';

export const ACCENT_THEMES: AccentThemeOption[] = [
  {
    id: 'emerald',
    label: 'Изумрудный',
    swatch: '#10B981',
    light: {
      primary: '#059669',
      hover: '#047857',
      fg: '#FFFFFF',
      text: '#047857',
      softBg: 'rgba(16, 185, 129, 0.10)',
      border: 'rgba(5, 150, 105, 0.55)',
    },
    dark: {
      primary: '#10B981',
      hover: '#34D399',
      fg: '#052E16',
      text: '#34D399',
      softBg: 'rgba(16, 185, 129, 0.14)',
      border: 'rgba(16, 185, 129, 0.65)',
    },
  },
  {
    id: 'sky',
    label: 'Небесный',
    swatch: '#0EA5E9',
    light: {
      primary: '#0284C7',
      hover: '#0369A1',
      fg: '#FFFFFF',
      text: '#0369A1',
      softBg: 'rgba(14, 165, 233, 0.10)',
      border: 'rgba(2, 132, 199, 0.55)',
    },
    dark: {
      primary: '#38BDF8',
      hover: '#7DD3FC',
      fg: '#082F49',
      text: '#38BDF8',
      softBg: 'rgba(56, 189, 248, 0.14)',
      border: 'rgba(56, 189, 248, 0.65)',
    },
  },
  {
    id: 'indigo',
    label: 'Индиго',
    swatch: '#6366F1',
    light: {
      primary: '#4F46E5',
      hover: '#4338CA',
      fg: '#FFFFFF',
      text: '#4338CA',
      softBg: 'rgba(99, 102, 241, 0.10)',
      border: 'rgba(79, 70, 229, 0.55)',
    },
    dark: {
      primary: '#818CF8',
      hover: '#A5B4FC',
      fg: '#1E1B4B',
      text: '#A5B4FC',
      softBg: 'rgba(129, 140, 248, 0.16)',
      border: 'rgba(129, 140, 248, 0.65)',
    },
  },
  {
    id: 'amber',
    label: 'Янтарный',
    swatch: '#F59E0B',
    light: {
      primary: '#D97706',
      hover: '#B45309',
      fg: '#FFFFFF',
      text: '#B45309',
      softBg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(217, 119, 6, 0.55)',
    },
    dark: {
      primary: '#FBBF24',
      hover: '#FCD34D',
      fg: '#1C1917',
      text: '#FCD34D',
      softBg: 'rgba(251, 191, 36, 0.15)',
      border: 'rgba(251, 191, 36, 0.65)',
    },
  },
  {
    id: 'rose',
    label: 'Коралловый',
    swatch: '#F43F5E',
    light: {
      primary: '#E11D48',
      hover: '#BE123C',
      fg: '#FFFFFF',
      text: '#BE123C',
      softBg: 'rgba(244, 63, 94, 0.10)',
      border: 'rgba(225, 29, 72, 0.55)',
    },
    dark: {
      primary: '#FB7185',
      hover: '#FDA4AF',
      fg: '#4C0519',
      text: '#FDA4AF',
      softBg: 'rgba(251, 113, 133, 0.15)',
      border: 'rgba(251, 113, 133, 0.65)',
    },
  },
  {
    id: 'violet',
    label: 'Фиалковый',
    swatch: '#8B5CF6',
    light: {
      primary: '#7C3AED',
      hover: '#6D28D9',
      fg: '#FFFFFF',
      text: '#6D28D9',
      softBg: 'rgba(139, 92, 246, 0.10)',
      border: 'rgba(124, 58, 237, 0.55)',
    },
    dark: {
      primary: '#A78BFA',
      hover: '#C4B5FD',
      fg: '#2E1065',
      text: '#C4B5FD',
      softBg: 'rgba(167, 139, 250, 0.15)',
      border: 'rgba(167, 139, 250, 0.65)',
    },
  },
];

export const MAP_STYLES: MapStyleOption[] = [
  {
    id: 'twilight',
    label: 'Ночной синий',
    description: 'Глубокий индиго для ночи',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    swatchColor: '#1E293B',
    isDark: true,
  },
  {
    id: 'aurora',
    label: 'Тёмный изумруд',
    description: 'Хвойно-бирюзовый ночной тон',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    swatchColor: '#132A26',
    isDark: true,
  },
  {
    id: 'graphite',
    label: 'Ночной графит',
    description: 'Спокойный сланцевый монохром',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    swatchColor: '#272B33',
    isDark: true,
  },
  {
    id: 'ambernight',
    label: 'Тёплая ночь',
    description: 'Мягкий угольно-янтарный тон',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    swatchColor: '#2B241E',
    isDark: true,
  },
  {
    id: 'osm',
    label: 'Классическая OSM',
    description: 'Светлая дневная карта',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    swatchColor: '#D9EBD4',
    isDark: false,
  },
];

export function isValidMapStyle(value: string | null): value is MapStyleId {
  return MAP_STYLES.some((s) => s.id === value);
}

export function isValidAccentColor(value: string | null): value is AccentColorId {
  return ACCENT_THEMES.some((a) => a.id === value);
}

export function getAccentOption(id: AccentColorId): AccentThemeOption {
  return ACCENT_THEMES.find((a) => a.id === id) ?? ACCENT_THEMES[0];
}

export function getMapStyleOption(id: MapStyleId): MapStyleOption {
  return MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0];
}

export function resolveCssAccentVars(
  accentId: AccentColorId,
  theme: ThemeMode
): Record<string, string> {
  const option = getAccentOption(accentId);
  const tokens = theme === 'dark' ? option.dark : option.light;
  return {
    '--accent-primary': tokens.primary,
    '--accent-hover': tokens.hover,
    '--accent-fg': tokens.fg,
    '--accent-text': tokens.text,
    '--accent-soft': tokens.softBg,
    '--accent-border': tokens.border,
  };
}
