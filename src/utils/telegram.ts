import WebApp from '@twa-dev/sdk';
import type { TelegramUserProfile } from '../types/ride';

const GUEST_ID_STORAGE_KEY = 'podveznun_guest_author_id';

function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return 'guest_local';
  const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = `guest_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(GUEST_ID_STORAGE_KEY, generated);
  return generated;
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
    try {
      WebApp.setHeaderColor('#0B0E14');
      WebApp.setBackgroundColor('#0B0E14');
    } catch {
      // Older Telegram clients may not support setHeaderColor
    }

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

export function triggerHaptic(style: 'light' | 'medium' = 'light'): void {
  try {
    WebApp.HapticFeedback?.impactOccurred(style);
  } catch {
    // Ignore outside Telegram
  }
}
