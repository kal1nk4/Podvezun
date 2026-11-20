import WebApp from '@twa-dev/sdk';
import type { LatLng, TelegramUserProfile } from '../types/ride';

const GUEST_ID_STORAGE_KEY = 'podveznun_guest_author_id';

function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'guest_local';
  const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = `guest_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(GUEST_ID_STORAGE_KEY, generated);
  return generated;
}

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
    const param = WebApp.initDataUnsafe?.start_param;
    return typeof param === 'string' && param.trim() ? param.trim() : null;
  } catch {
    return null;
  }
}

export function initTelegramWebApp(): TelegramUserProfile {
  let isTelegramEnv = false;

  try {
    const rawUser = WebApp.initDataUnsafe?.user;
    if (WebApp.initData && WebApp.initData.length > 0) {
      isTelegramEnv = true;
    } else if (typeof window !== 'undefined' && (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData) {
      isTelegramEnv = true;
    }

    WebApp.ready();
    WebApp.expand();
    applyTelegramThemeColors('dark');

    if (rawUser) {
      const firstName = rawUser.first_name || 'Попутчик';
      const lastName = rawUser.last_name || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      return {
        id: String(rawUser.id),
        firstName,
        lastName,
        fullName,
        username: rawUser.username ?? null,
        photoUrl: rawUser.photo_url ?? null,
        isTelegramEnv: true,
      };
    }
  } catch {
    // Fallback gracefully when running in standard browser
  }

  return {
    id: getOrCreateGuestId(),
    firstName: 'Харьковчанин',
    lastName: '',
    fullName: 'Харьковчанин',
    username: null,
    photoUrl: null,
    isTelegramEnv,
  };
}

export function openTelegramUser(link: string): boolean {
  try {
    if (WebApp.initData && WebApp.initData.length > 0) {
      WebApp.openTelegramLink(link);
      return true;
    }
  } catch {
    // Fallback to standard anchor navigation when outside Telegram
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
