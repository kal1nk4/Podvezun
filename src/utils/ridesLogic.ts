import type {
  CreateRidePayload,
  KharkivLandmark,
  LatLng,
  Ride,
  RideFilter,
} from '../types/ride';

export const KHARKIV_CENTER: LatLng = {
  lat: 49.9935,
  lng: 36.2304,
};

export const RIDE_TTL_MS = 3 * 60 * 60 * 1000; // 3 часа

export const KHARKIV_LANDMARKS: KharkivLandmark[] = [
  { id: 'center', name: 'Центр', lat: 49.9935, lng: 36.2304 },
  { id: 'kholodna-hora', name: 'Холодная Гора', lat: 49.9818, lng: 36.1820 },
  { id: 'saltivka', name: 'Салтовка', lat: 50.0226, lng: 36.3340 },
  { id: 'oleksiivka', name: 'Алексеевка', lat: 50.0525, lng: 36.2035 },
  { id: 'pavlovo-pole', name: 'Павлово Поле', lat: 50.0308, lng: 36.2194 },
  { id: 'novi-doma', name: 'Новые Дома', lat: 49.9635, lng: 36.3145 },
  { id: 'htz', name: 'ХТЗ', lat: 49.9465, lng: 36.3705 },
  { id: 'odeska', name: 'Одесская', lat: 49.9428, lng: 36.2562 },
  { id: 'gagarina', name: 'Гагарина', lat: 49.9794, lng: 36.2452 },
  { id: 'yuzhd', name: 'ЮЖД', lat: 49.9896, lng: 36.2045 },
];

export const DEPARTURE_PRESETS = [
  'Сейчас',
  'Через 15 мин',
  'Через 30 мин',
  'Через 1 час',
] as const;

export function isRideExpired(createdAtIso: string, nowMs: number = Date.now()): boolean {
  const createdMs = Date.parse(createdAtIso);
  if (Number.isNaN(createdMs)) {
    return true;
  }
  return nowMs - createdMs > RIDE_TTL_MS;
}

export interface FilterRidesOptions {
  roleFilter?: RideFilter;
  onlyMineUserId?: string | null;
  nowMs?: number;
}

export function filterActiveRides(
  rides: Ride[],
  options: FilterRidesOptions = {}
): Ride[] {
  const { roleFilter = 'all', onlyMineUserId = null, nowMs = Date.now() } = options;

  return rides
    .filter((ride) => !isRideExpired(ride.createdAt, nowMs))
    .filter((ride) => (roleFilter === 'all' ? true : ride.role === roleFilter))
    .filter((ride) => (onlyMineUserId ? ride.authorId === onlyMineUserId : true))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function formatPriceUah(priceUah: number): string {
  if (!Number.isFinite(priceUah) || priceUah <= 0) {
    return 'Бесплатно';
  }
  return `${Math.round(priceUah)} ₴`;
}

export function formatSeatsLabel(seats: number, role: Ride['role']): string {
  const safeSeats = Math.max(1, Math.min(4, Math.round(seats)));
  if (role === 'driver') {
    if (safeSeats === 1) return '1 место';
    return `${safeSeats} места`;
  }
  if (safeSeats === 1) return '1 чел.';
  return `${safeSeats} чел.`;
}

export function formatTimeAgo(createdAtIso: string, nowMs: number = Date.now()): string {
  const createdMs = Date.parse(createdAtIso);
  if (Number.isNaN(createdMs)) return 'недавно';

  const diffMin = Math.max(0, Math.floor((nowMs - createdMs) / 60000));
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours === 1) return '1 ч назад';
  return `${diffHours} ч назад`;
}

export function buildTelegramLink(username?: string | null): string | null {
  if (!username) return null;
  const cleaned = username.trim().replace(/^@+/, '');
  if (!/^[a-zA-Z0-9_]{3,64}$/.test(cleaned)) {
    return null;
  }
  return `https://t.me/${cleaned}`;
}

export function findLandmarkByName(name: string): KharkivLandmark | undefined {
  return KHARKIV_LANDMARKS.find((item) => item.name === name);
}

export function describePickedCoordinates(lat: number, lng: number): string {
  let closest: KharkivLandmark | null = null;
  let minDistanceSq = Infinity;

  for (const lm of KHARKIV_LANDMARKS) {
    const dLat = lm.lat - lat;
    const dLng = lm.lng - lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closest = lm;
    }
  }

  // ~0.015 deg is roughly 1.2 - 1.5 km in Kharkiv
  if (closest && minDistanceSq <= 0.015 * 0.015) {
    return `р-н ${closest.name} (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
  }
  return `Метка (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
}

export interface RideValidationResult {
  valid: boolean;
  errors: Partial<Record<'from' | 'to' | 'departureLabel' | 'priceUah' | 'seats' | 'comment', string>>;
}

export function validateRideInput(input: CreateRidePayload): RideValidationResult {
  const errors: RideValidationResult['errors'] = {};

  if (
    !input.fromName.trim() ||
    input.fromLat === null ||
    input.fromLng === null ||
    !Number.isFinite(input.fromLat) ||
    !Number.isFinite(input.fromLng)
  ) {
    errors.from = 'Выберите точку отправления или отметьте её на карте';
  }

  if (
    !input.toName.trim() ||
    input.toLat === null ||
    input.toLng === null ||
    !Number.isFinite(input.toLat) ||
    !Number.isFinite(input.toLng)
  ) {
    errors.to = 'Выберите точку назначения или отметьте её на карте';
  }

  if (
    !errors.from &&
    !errors.to &&
    input.fromLat !== null &&
    input.toLat !== null &&
    input.fromLng !== null &&
    input.toLng !== null
  ) {
    const sameCoords =
      Math.abs(input.fromLat - input.toLat) < 0.0005 &&
      Math.abs(input.fromLng - input.toLng) < 0.0005;
    if (sameCoords) {
      errors.to = 'Точка Б должна отличаться от точки А';
    }
  }

  if (!input.departureLabel.trim()) {
    errors.departureLabel = 'Укажите время выезда';
  }

  if (!Number.isFinite(input.priceUah) || input.priceUah < 0 || input.priceUah > 5000) {
    errors.priceUah = 'Укажите цену от 0 до 5000 ₴';
  }

  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 4) {
    errors.seats = 'Количество мест от 1 до 4';
  }

  if (input.comment.trim().length > 160) {
    errors.comment = 'Комментарий не длиннее 160 символов';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
