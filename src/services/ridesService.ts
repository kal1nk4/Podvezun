import { supabase } from '../lib/supabaseClient';
import type { CreateRidePayload, Ride, TelegramUserProfile } from '../types/ride';
import { filterActiveRides, RIDE_TTL_MS } from '../utils/ridesLogic';

const LOCAL_RIDES_KEY = 'podveznun_rides_v1';

interface SupabaseRideRow {
  id: string;
  role: 'driver' | 'passenger';
  author_id: string;
  author_name: string;
  author_username: string | null;
  author_photo_url: string | null;
  from_name: string;
  from_lat: number;
  from_lng: number;
  to_name: string;
  to_lat: number;
  to_lng: number;
  departure_label: string;
  price_uah: number;
  seats: number;
  comment: string;
  created_at: string;
}

function mapRowToRide(row: SupabaseRideRow): Ride {
  return {
    id: row.id,
    role: row.role,
    authorId: row.author_id,
    authorName: row.author_name,
    authorUsername: row.author_username,
    authorPhotoUrl: row.author_photo_url,
    fromName: row.from_name,
    fromLat: row.from_lat,
    fromLng: row.from_lng,
    toName: row.to_name,
    toLat: row.to_lat,
    toLng: row.to_lng,
    departureLabel: row.departure_label,
    priceUah: row.price_uah,
    seats: row.seats,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

function buildInitialSeedRides(): Ride[] {
  const now = Date.now();
  return [
    {
      id: 'seed-1',
      role: 'driver',
      authorId: 'tg_10042',
      authorName: 'Дмитрий К.',
      authorUsername: 'dmitry_kh_drive',
      authorPhotoUrl: null,
      fromName: 'Холодная Гора',
      fromLat: 49.9818,
      fromLng: 36.1820,
      toName: 'Центр',
      toLat: 49.9935,
      toLng: 36.2304,
      departureLabel: 'Через 15 мин',
      priceUah: 50,
      seats: 3,
      comment: 'Серый Lanos, еду по Полтавскому Шляху, возьму до пл. Конституции.',
      createdAt: new Date(now - 9 * 60 * 1000).toISOString(),
    },
    {
      id: 'seed-2',
      role: 'passenger',
      authorId: 'tg_20891',
      authorName: 'Анна М.',
      authorUsername: 'anna_kharkiv',
      authorPhotoUrl: null,
      fromName: 'Салтовка',
      fromLat: 50.0226,
      fromLng: 36.3340,
      toName: 'Павлово Поле',
      toLat: 50.0308,
      toLng: 36.2194,
      departureLabel: 'Сейчас',
      priceUah: 70,
      seats: 1,
      comment: 'Стою возле ТРК Украина, с фонариком. Нужно до м. 23 Августа.',
      createdAt: new Date(now - 18 * 60 * 1000).toISOString(),
    },
    {
      id: 'seed-3',
      role: 'driver',
      authorId: 'tg_33104',
      authorName: 'Олег С.',
      authorUsername: 'oleg_saltovka',
      authorPhotoUrl: null,
      fromName: 'Алексеевка',
      fromLat: 50.0525,
      fromLng: 36.2035,
      toName: 'ЮЖД',
      toLat: 49.9896,
      toLng: 36.2045,
      departureLabel: 'Через 30 мин',
      priceUah: 0,
      seats: 2,
      comment: 'Белый Octavia, подвезу по пути через Научную. Денег не беру.',
      createdAt: new Date(now - 27 * 60 * 1000).toISOString(),
    },
    {
      id: 'seed-4',
      role: 'passenger',
      authorId: 'tg_44510',
      authorName: 'Максим В.',
      authorUsername: 'max_htz',
      authorPhotoUrl: null,
      fromName: 'Новые Дома',
      fromLat: 49.9635,
      fromLng: 36.3145,
      toName: 'Гагарина',
      toLat: 49.9794,
      toLng: 36.2452,
      departureLabel: 'Через 15 мин',
      priceUah: 60,
      seats: 2,
      comment: 'Двое с рюкзаками на пр. Героев Сталинграда, выручите в блэкаут.',
      createdAt: new Date(now - 42 * 60 * 1000).toISOString(),
    },
    {
      id: 'seed-5',
      role: 'driver',
      authorId: 'tg_55920',
      authorName: 'Сергей Л.',
      authorUsername: 'sergey_kh_car',
      authorPhotoUrl: null,
      fromName: 'ХТЗ',
      fromLat: 49.9465,
      fromLng: 36.3705,
      toName: 'Одесская',
      toLat: 49.9428,
      toLng: 36.2562,
      departureLabel: 'Через 1 час',
      priceUah: 50,
      seats: 4,
      comment: 'Еду по Героев Харькова и далее на Одесскую, есть 4 места.',
      createdAt: new Date(now - 64 * 60 * 1000).toISOString(),
    },
  ];
}

function readLocalRides(): Ride[] {
  if (typeof window === 'undefined') return buildInitialSeedRides();
  try {
    const raw = window.localStorage.getItem(LOCAL_RIDES_KEY);
    if (!raw) {
      const seed = buildInitialSeedRides();
      window.localStorage.setItem(LOCAL_RIDES_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as Ride[];
    if (!Array.isArray(parsed)) {
      const seed = buildInitialSeedRides();
      window.localStorage.setItem(LOCAL_RIDES_KEY, JSON.stringify(seed));
      return seed;
    }
    return parsed;
  } catch {
    return buildInitialSeedRides();
  }
}

function writeLocalRides(rides: Ride[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_RIDES_KEY, JSON.stringify(rides));
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchActiveRides(): Promise<{ rides: Ride[]; source: 'supabase' | 'local' }> {
  if (supabase) {
    const threeHoursAgo = new Date(Date.now() - RIDE_TTL_MS).toISOString();
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .gte('created_at', threeHoursAgo)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = (data as SupabaseRideRow[]).map(mapRowToRide);
      return { rides: filterActiveRides(mapped), source: 'supabase' };
    }
  }

  const localRides = filterActiveRides(readLocalRides());
  writeLocalRides(localRides);
  return { rides: localRides, source: 'local' };
}

export async function createRide(
  payload: CreateRidePayload,
  user: TelegramUserProfile
): Promise<Ride> {
  const newRideData = {
    role: payload.role,
    author_id: user.id,
    author_name: user.fullName || 'Харьковчанин',
    author_username: user.username,
    author_photo_url: user.photoUrl,
    from_name: payload.fromName.trim(),
    from_lat: payload.fromLat!,
    from_lng: payload.fromLng!,
    to_name: payload.toName.trim(),
    to_lat: payload.toLat!,
    to_lng: payload.toLng!,
    departure_label: payload.departureLabel.trim(),
    price_uah: Math.max(0, Math.round(payload.priceUah)),
    seats: Math.max(1, Math.min(4, Math.round(payload.seats))),
    comment: payload.comment.trim(),
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('rides')
      .insert(newRideData)
      .select('*')
      .single();

    if (!error && data) {
      return mapRowToRide(data as SupabaseRideRow);
    }
    if (error) {
      throw new Error(`Ошибка сохранения в Supabase: ${error.message}`);
    }
  }

  const localCreated: Ride = {
    id: `ride_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role: newRideData.role,
    authorId: newRideData.author_id,
    authorName: newRideData.author_name,
    authorUsername: newRideData.author_username,
    authorPhotoUrl: newRideData.author_photo_url,
    fromName: newRideData.from_name,
    fromLat: newRideData.from_lat,
    fromLng: newRideData.from_lng,
    toName: newRideData.to_name,
    toLat: newRideData.to_lat,
    toLng: newRideData.to_lng,
    departureLabel: newRideData.departure_label,
    priceUah: newRideData.price_uah,
    seats: newRideData.seats,
    comment: newRideData.comment,
    createdAt: new Date().toISOString(),
  };

  const current = readLocalRides();
  const next = filterActiveRides([localCreated, ...current]);
  writeLocalRides(next);
  return localCreated;
}

export async function deleteRideById(rideId: string, authorId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase
      .from('rides')
      .delete()
      .eq('id', rideId)
      .eq('author_id', authorId);

    if (error) {
      throw new Error(`Ошибка удаления заявки: ${error.message}`);
    }
    return;
  }

  const current = readLocalRides();
  const next = current.filter((r) => !(r.id === rideId && r.authorId === authorId));
  writeLocalRides(next);
}

export function subscribeToRideUpdates(onChange: () => void): () => void {
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('public:rides')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rides' },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    void supabase?.removeChannel(channel);
  };
}
