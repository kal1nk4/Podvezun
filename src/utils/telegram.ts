import WebApp from '@twa-dev/sdk';
import type { LatLng, TelegramUserProfile } from '../types/ride';

interface RawTelegramUser {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface WindowWithTelegram {
  Telegram?: {
    WebApp?: {
      initData?: string;
      initDataUnsafe?: {
        user?: RawTelegramUser;
        start_param?: string;
      };
    };
  };
}

export const FALLBACK_PREVIEW_USER: TelegramUserProfile = {
  id: '999999',
  telegramId: 999999,
  firstName: 'Тестовый водитель',
  lastName: '',
  fullName: 'Тестовый водитель',
  username: 'test_driver',
  photoUrl: null,
  isTelegramEnv: false,
  isFallbackDemo: true,
};

export function applyTelegramThemeColors(theme: 'light' | 'dark'): void {
  const color = theme === 'dark' ? '#0B0E14' : '#F8FAFC';
  try {
    WebApp.setHeaderColor(color);
    WebApp.setBackgroundColor(color);
  } catch {
    // Older Telegram clients may not support setHeaderColor
  }
}

export function getTelegramStartParam(): string | null {
  try {
    const winTg =
      typeof window !== 'undefined'
        ? (window as unknown as WindowWithTelegram).Telegram?.WebApp?.initDataUnsafe?.start_param
        : undefined;
    const param = winTg || WebApp.initDataUnsafe?.start_param;
    return typeof param === 'string' && param.trim() ? param.trim() : null;
  } catch {
    return null;
  }
}

export function initTelegramWebApp(): TelegramUserProfile {
  let isTelegramEnv = false;

  const winTgWebApp =
    typeof window !== 'undefined'
      ? (window as unknown as WindowWithTelegram).Telegram?.WebApp
      : undefined;

  let rawUser: RawTelegramUser | undefined =
    winTgWebApp?.initDataUnsafe?.user ?? WebApp.initDataUnsafe?.user;

  if (
    (WebApp.initData && WebApp.initData.length > 0) ||
    (winTgWebApp?.initData && winTgWebApp.initData.length > 0)
  ) {
    isTelegramEnv = true;
  }

  // Fallback parse from URL hash (#tgWebAppData=...) if script initialization hasn't populated initDataUnsafe yet
  if (!rawUser && typeof window !== 'undefined') {
    try {
      const hash = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hash);
      const tgData = hashParams.get('tgWebAppData');
      if (tgData) {
        isTelegramEnv = true;
        const innerParams = new URLSearchParams(tgData);
        const userJson = innerParams.get('user');
        if (userJson) {
          rawUser = JSON.parse(userJson) as RawTelegramUser;
        }
      }
    } catch {
      // Ignore malformed hash payloads
    }
  }

  try {
    WebApp.ready();
  } catch {
    // Ignore outside Telegram
  }

  try {
    WebApp.expand();
  } catch {
    // Ignore outside Telegram
  }

  applyTelegramThemeColors('dark');

  if (rawUser && rawUser.id !== undefined && rawUser.id !== null) {
    const numericId = Number(rawUser.id);
    const telegramId =
      Number.isFinite(numericId) && numericId > 0 ? Math.trunc(numericId) : 999999;
    const firstName = rawUser.first_name?.trim() || 'Попутчик';
    const lastName = rawUser.last_name?.trim() || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    return {
      id: String(telegramId),
      telegramId,
      firstName,
      lastName,
      fullName,
      username: rawUser.username?.trim() || null,
      photoUrl: rawUser.photo_url ?? null,
      isTelegramEnv: true,
      isFallbackDemo: false,
    };
  }

  return {
    ...FALLBACK_PREVIEW_USER,
    isTelegramEnv,
  };
}

export function openTelegramUser(link: string): boolean {
  try {
    if (
      link.startsWith('https://t.me/') &&
      WebApp.initData &&
      WebApp.initData.length > 0
    ) {
      WebApp.openTelegramLink(link);
      return true;
    }
  } catch {
    // Fallback to standard anchor navigation when outside Telegram or using tg://
  }
  return false;
}

export function shareRideToTelegram(shareUrl: string, text: string): boolean {
  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
  try {
    if (WebApp.initData && WebApp.initData.length > 0) {
      WebApp.openTelegramLink(tgShareUrl);
      return true;
    }
  } catch {
    // Fallback to Web Share / clipboard outside Telegram
  }
  return false;
}

export function triggerHaptic(style: 'light' | 'medium' = 'light'): void {
  try {
    WebApp.HapticFeedback?.impactOccurred(style);
  } catch {
    // Ignore outside Telegram
  }
}

export function requestUserGeolocation(timeoutMs: number = 7000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Геолокация недоступна в этом браузере'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Доступ к геолокации запрещён'));
        } else {
          reject(new Error('Не удалось определить местоположение'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 60_000,
      }
    );
  });
}
