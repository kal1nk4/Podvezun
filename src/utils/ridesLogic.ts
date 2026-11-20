import type {
  CompletedRideRecord,
  CreateRidePayload,
  FeedbackTagId,
  KharkivLandmark,
  LatLng,
  ProfileRole,
  Ride,
  RideFeedback,
  RideFilter,
  RideTagId,
  RouteWatchAlert,
  TagCount,
  TelegramUserProfile,
} from '../types/ride';

export const KHARKIV_CENTER: LatLng = {
  lat: 49.9935,
  lng: 36.2304,
};

export const RIDE_TTL_MS = 3 * 60 * 60 * 1000; // 3 часа
export const RIDE_EXTEND_STEP_MS = 60 * 60 * 1000; // +1 час

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

export const KHARKIV_HUBS: KharkivLandmark[] = [
  { id: 'metro-naukova', name: 'м. Научная', lat: 50.0112, lng: 36.2266 },
  { id: 'metro-universytet', name: 'м. Университет / Госпром', lat: 50.0053, lng: 36.2289 },
  { id: 'metro-heroiv-praci', name: 'м. Героев Труда', lat: 50.0252, lng: 36.3347 },
  { id: 'metro-studentska', name: 'м. Студенческая', lat: 50.0177, lng: 36.3338 },
  { id: 'metro-zahysnykiv', name: 'м. Защитников Украины', lat: 49.9882, lng: 36.2591 },
  { id: 'metro-palats-sportu', name: 'м. Дворец Спорта', lat: 49.9675, lng: 36.3168 },
  { id: 'metro-industrialna', name: 'м. Индустриальная', lat: 49.9445, lng: 36.3941 },
  { id: 'trk-ukraina', name: 'ТРК Украина', lat: 50.0091, lng: 36.3229 },
  { id: 'nezlamnist-center', name: 'Пункт незламності (пл. Свободы)', lat: 50.0058, lng: 36.2292 },
];

export const ALL_KHARKIV_POINTS: KharkivLandmark[] = [
  ...KHARKIV_LANDMARKS,
  ...KHARKIV_HUBS,
];

export interface RideTagOption {
  id: RideTagId;
  label: string;
}

export const RIDE_TAGS: RideTagOption[] = [
  { id: 'pets', label: 'С животными' },
  { id: 'luggage', label: 'С багажом' },
  { id: 'card', label: 'На карту' },
  { id: 'courtyard', label: 'Заеду во двор' },
];

export const FEEDBACK_TAGS: FeedbackTagId[] = [
  'Вовремя',
  'По пути',
  'Всё ок',
  'Приятный попутчик',
];

export const PROFILE_BIO_MAX_LENGTH = 120;

export const DEPARTURE_PRESETS = [
  'Сейчас',
  'Через 15 мин',
  'Через 30 мин',
  'Через 1 час',
] as const;

export function isRideExpired(
  createdAtIso: string,
  nowMs: number = Date.now(),
  expiresAtIso?: string
): boolean {
  if (expiresAtIso) {
    const expiresMs = Date.parse(expiresAtIso);
    if (!Number.isNaN(expiresMs)) {
      return nowMs > expiresMs;
    }
  }
  const createdMs = Date.parse(createdAtIso);
  if (Number.isNaN(createdMs)) {
    return true;
  }
  return nowMs - createdMs > RIDE_TTL_MS;
}

export function computeExtendedExpiresAt(
  ride: Pick<Ride, 'createdAt' | 'expiresAt'>,
  nowMs: number = Date.now()
): string {
  const createdMs = Date.parse(ride.createdAt);
  const currentExpiryMs = ride.expiresAt
    ? Date.parse(ride.expiresAt)
    : Number.isNaN(createdMs)
      ? nowMs
      : createdMs + RIDE_TTL_MS;
  const baseMs = Math.max(nowMs, Number.isNaN(currentExpiryMs) ? nowMs : currentExpiryMs);
  return new Date(baseMs + RIDE_EXTEND_STEP_MS).toISOString();
}

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistanceFromUser(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const meters = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `~${meters} м от вас`;
  }
  return `~${km.toFixed(1)} км от вас`;
}

export interface FilterRidesOptions {
  roleFilter?: RideFilter;
  onlyMineUserId?: string | null;
  fromDistrict?: string;
  toDistrict?: string;
  userLocation?: LatLng | null;
  sortByProximity?: boolean;
  nowMs?: number;
}

export function matchesDistrictQuery(pointName: string, filterDistrict?: string): boolean {
  if (!filterDistrict || !filterDistrict.trim()) return true;
  const needle = filterDistrict.trim().toLowerCase();
  const hay = pointName.toLowerCase();
  if (hay.includes(needle)) return true;

  // Also match if coordinates sit within ~2.2 km of the selected district landmark
  return false;
}

export function matchesPointOrRadius(
  pointName: string,
  lat: number,
  lng: number,
  filterDistrict?: string
): boolean {
  if (!filterDistrict || !filterDistrict.trim()) return true;
  if (matchesDistrictQuery(pointName, filterDistrict)) return true;
  const landmark = findLandmarkByName(filterDistrict);
  if (!landmark) return false;
  return haversineDistanceKm({ lat, lng }, landmark) <= 2.3;
}

export function filterActiveRides(
  rides: Ride[],
  options: FilterRidesOptions = {}
): Ride[] {
  const {
    roleFilter = 'all',
    onlyMineUserId = null,
    fromDistrict = '',
    toDistrict = '',
    userLocation = null,
    sortByProximity = false,
    nowMs = Date.now(),
  } = options;

  const filtered = rides
    .filter((ride) => !isRideExpired(ride.createdAt, nowMs, ride.expiresAt))
    .filter((ride) => (roleFilter === 'all' ? true : ride.role === roleFilter))
    .filter((ride) => (onlyMineUserId ? ride.authorId === onlyMineUserId : true))
    .filter((ride) =>
      matchesPointOrRadius(ride.fromName, ride.fromLat, ride.fromLng, fromDistrict)
    )
    .filter((ride) =>
      matchesPointOrRadius(ride.toName, ride.toLat, ride.toLng, toDistrict)
    );

  if (sortByProximity && userLocation) {
    return filtered.sort((a, b) => {
      const distA = haversineDistanceKm(userLocation, { lat: a.fromLat, lng: a.fromLng });
      const distB = haversineDistanceKm(userLocation, { lat: b.fromLat, lng: b.fromLng });
      if (Math.abs(distA - distB) > 0.05) {
        return distA - distB;
      }
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }

  return filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function findMatchingWatchedRides(
  activeRides: Ride[],
  alerts: RouteWatchAlert[]
): Ride[] {
  if (alerts.length === 0 || activeRides.length === 0) return [];
  const matchedIds = new Set<string>();
  const matches: Ride[] = [];

  for (const ride of activeRides) {
    const isHit = alerts.some((alert) => {
      if (alert.role !== 'all' && ride.role !== alert.role) return false;
      const fromMatch = matchesPointOrRadius(
        ride.fromName,
        ride.fromLat,
        ride.fromLng,
        alert.fromName
      );
      const toMatch = matchesPointOrRadius(
        ride.toName,
        ride.toLat,
        ride.toLng,
        alert.toName
      );
      return fromMatch && toMatch;
    });
    if (isHit && !matchedIds.has(ride.id)) {
      matchedIds.add(ride.id);
      matches.push(ride);
    }
  }
  return matches;
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

export function formatRemainingTime(
  createdAtIso: string,
  expiresAtIso?: string,
  nowMs: number = Date.now()
): string {
  const createdMs = Date.parse(createdAtIso);
  const expiryMs = expiresAtIso
    ? Date.parse(expiresAtIso)
    : Number.isNaN(createdMs)
      ? nowMs
      : createdMs + RIDE_TTL_MS;
  if (Number.isNaN(expiryMs)) return '';
  const diffMin = Math.max(0, Math.round((expiryMs - nowMs) / 60000));
  if (diffMin < 60) return `ещё ${diffMin} мин`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins === 0 ? `ещё ${hours} ч` : `ещё ${hours} ч ${mins} мин`;
}

export function buildTelegramLink(
  username?: string | null,
  telegramId?: number | null
): string | null {
  if (username) {
    const cleaned = username.trim().replace(/^@+/, '');
    if (/^[a-zA-Z0-9_]{3,64}$/.test(cleaned)) {
      return `https://t.me/${cleaned}`;
    }
  }
  if (typeof telegramId === 'number' && Number.isFinite(telegramId) && telegramId > 0) {
    return `tg://user?id=${Math.trunc(telegramId)}`;
  }
  return null;
}

export function buildShareRideLink(
  rideId: string,
  originUrl?: string,
  botUsername?: string | null
): string {
  if (botUsername && botUsername.trim()) {
    const cleanBot = botUsername.trim().replace(/^@+/, '');
    return `https://t.me/${cleanBot}?startapp=ride_${encodeURIComponent(rideId)}`;
  }
  const base =
    originUrl ||
    (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://t.me');
  const url = new URL(base);
  url.searchParams.set('ride', rideId);
  return url.toString();
}

export function buildShareRideText(ride: Ride): string {
  const roleLabel = ride.role === 'driver' ? 'Подвезу (водитель)' : 'Ищу авто (пассажир)';
  return `Подвезун Харьков · ${roleLabel}: ${ride.fromName} → ${ride.toName}, выезд: ${ride.departureLabel}, ${formatPriceUah(ride.priceUah)}, ${formatSeatsLabel(ride.seats, ride.role)}`;
}

export function parseSharedRideId(search: string, startParam?: string | null): string | null {
  if (startParam && startParam.startsWith('ride_')) {
    const id = startParam.slice('ride_'.length).trim();
    if (id) return id;
  }
  try {
    const params = new URLSearchParams(search);
    const fromQuery = params.get('ride') || params.get('tgWebAppStartParam');
    if (!fromQuery) return null;
    if (fromQuery.startsWith('ride_')) {
      return fromQuery.slice('ride_'.length).trim() || null;
    }
    return fromQuery.trim() || null;
  } catch {
    return null;
  }
}

export function findLandmarkByName(name: string): KharkivLandmark | undefined {
  return ALL_KHARKIV_POINTS.find((item) => item.name === name);
}

export function describePickedCoordinates(lat: number, lng: number): string {
  let closest: KharkivLandmark | null = null;
  let minDistanceSq = Infinity;

  for (const lm of ALL_KHARKIV_POINTS) {
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

export function getTagLabel(tagId: RideTagId): string {
  return RIDE_TAGS.find((t) => t.id === tagId)?.label ?? tagId;
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

export function isRideCreatedByUser(
  ride: Pick<Ride, 'authorId' | 'creatorTelegramId'>,
  user: Pick<TelegramUserProfile, 'id' | 'telegramId'>
): boolean {
  if (
    typeof ride.creatorTelegramId === 'number' &&
    ride.creatorTelegramId === user.telegramId
  ) {
    return true;
  }
  return ride.authorId === user.id || ride.authorId === String(user.telegramId);
}

export function aggregateFeedbackTags(
  feedbackList: Pick<RideFeedback, 'tag'>[]
): TagCount[] {
  const counts = new Map<FeedbackTagId, number>();
  for (const item of feedbackList) {
    if (!FEEDBACK_TAGS.includes(item.tag)) continue;
    counts.set(item.tag, (counts.get(item.tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return FEEDBACK_TAGS.indexOf(a.tag) - FEEDBACK_TAGS.indexOf(b.tag);
    });
}

export function getTopFeedbackTags(
  feedbackList: Pick<RideFeedback, 'tag'>[],
  limit: number = 2
): TagCount[] {
  return aggregateFeedbackTags(feedbackList).slice(0, Math.max(0, limit));
}

export function validateProfileInput(input: {
  role: ProfileRole;
  carInfo: string;
  bio: string;
}): { valid: boolean; error?: string } {
  if (!['driver', 'passenger', 'both'].includes(input.role)) {
    return { valid: false, error: 'Выберите основную роль' };
  }
  if (input.carInfo.trim().length > 80) {
    return { valid: false, error: 'Информация об авто не длиннее 80 символов' };
  }
  if (input.bio.trim().length > PROFILE_BIO_MAX_LENGTH) {
    return { valid: false, error: `Заметка о себе не длиннее ${PROFILE_BIO_MAX_LENGTH} символов` };
  }
  return { valid: true };
}

const RUSSIAN_MONTHS_SHORT = [
  'янв.',
  'фев.',
  'мар.',
  'апр.',
  'мая',
  'июн.',
  'июл.',
  'авг.',
  'сен.',
  'окт.',
  'нояб.',
  'дек.',
];

export function formatHistoryDateTime(
  iso: string,
  nowMs: number = Date.now()
): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Недавно';

  const date = new Date(ts);
  const now = new Date(nowMs);

  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfTarget) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return `Сегодня, ${timeStr}`;
  if (dayDiff === 1) return `Вчера, ${timeStr}`;

  const month = RUSSIAN_MONTHS_SHORT[date.getMonth()] ?? '';
  return `${date.getDate()} ${month}, ${timeStr}`;
}

export interface MergeCompletedHistoryParams {
  user: Pick<TelegramUserProfile, 'id' | 'telegramId'>;
  remoteRides: Ride[];
  localEntries: CompletedRideRecord[];
  authoredFeedback: RideFeedback[];
  receivedFeedback: RideFeedback[];
  participatedRideIds?: string[];
  nowMs?: number;
}

export function mergeCompletedRideHistory(
  params: MergeCompletedHistoryParams
): CompletedRideRecord[] {
  const {
    user,
    remoteRides,
    localEntries,
    authoredFeedback,
    receivedFeedback,
    participatedRideIds = [],
    nowMs = Date.now(),
  } = params;

  const authoredByRideId = new Map<string, RideFeedback>();
  for (const fb of authoredFeedback) {
    if (fb.fromTelegramId === user.telegramId && !authoredByRideId.has(fb.rideId)) {
      authoredByRideId.set(fb.rideId, fb);
    }
  }

  const receivedByRideId = new Map<string, FeedbackTagId[]>();
  for (const fb of receivedFeedback) {
    if (fb.toTelegramId === user.telegramId) {
      const list = receivedByRideId.get(fb.rideId) ?? [];
      list.push(fb.tag);
      receivedByRideId.set(fb.rideId, list);
    }
  }

  const participatedSet = new Set<string>(participatedRideIds);
  for (const fb of authoredFeedback) {
    if (fb.fromTelegramId === user.telegramId) {
      participatedSet.add(fb.rideId);
    }
  }

  const byId = new Map<string, import('../types/ride').CompletedRideRecord>();

  // Seed with local snapshots first (preserves real completedAt & originalCreatedAt)
  for (const entry of localEntries) {
    if (!entry?.ride?.id) continue;
    const isCreator = isRideCreatedByUser(entry.ride, user);
    const myFb = authoredByRideId.get(entry.ride.id)?.tag ?? entry.myFeedbackTag ?? null;
    const recFb = receivedByRideId.get(entry.ride.id) ?? entry.receivedFeedbackTags ?? [];
    byId.set(entry.ride.id, {
      ...entry,
      id: entry.ride.id,
      participation: isCreator ? 'created' : 'participated',
      myFeedbackTag: myFb,
      receivedFeedbackTags: recFb,
    });
  }

  // Merge remote rides that are completed/expired (or explicitly participated + archived)
  for (const ride of remoteRides) {
    const isCreator = isRideCreatedByUser(ride, user);
    const isParticipated = !isCreator && participatedSet.has(ride.id);
    if (!isCreator && !isParticipated) continue;

    const expired = isRideExpired(ride.createdAt, nowMs, ride.expiresAt);
    const existing = byId.get(ride.id);

    // Created rides must be expired/archived to show in completed history (active ones live in "Мои")
    // Participated rides appear once expired/archived OR if explicitly recorded in localEntries
    if (!expired && !existing) {
      continue;
    }

    const myFb = authoredByRideId.get(ride.id)?.tag ?? existing?.myFeedbackTag ?? null;
    const recFb = receivedByRideId.get(ride.id) ?? existing?.receivedFeedbackTags ?? [];

    const fallbackCompletedAt =
      existing?.completedAt ??
      authoredByRideId.get(ride.id)?.createdAt ??
      ride.expiresAt ??
      ride.createdAt;

    byId.set(ride.id, {
      id: ride.id,
      ride: {
        ...ride,
        tags: ride.tags && ride.tags.length > 0 ? ride.tags : (existing?.ride.tags ?? []),
      },
      participation: isCreator ? 'created' : 'participated',
      completedAt: fallbackCompletedAt,
      originalCreatedAt: existing?.originalCreatedAt,
      myFeedbackTag: myFb,
      receivedFeedbackTags: recFb,
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const tA = Date.parse(a.completedAt) || Date.parse(a.ride.createdAt) || 0;
    const tB = Date.parse(b.completedAt) || Date.parse(b.ride.createdAt) || 0;
    return tB - tA;
  });
}

