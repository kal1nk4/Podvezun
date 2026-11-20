import { supabase } from '../lib/supabaseClient';
import type {
  FeedbackTagId,
  ProfileRole,
  RideFeedback,
  TelegramUserProfile,
  UserProfile,
} from '../types/ride';

const LOCAL_PROFILES_KEY = 'podvezun_profiles_v1';
const LOCAL_FEEDBACK_KEY = 'podvezun_ride_feedback_v1';

interface SupabaseProfileRow {
  telegram_id: number;
  first_name: string | null;
  username: string | null;
  role: string | null;
  car_info: string | null;
  bio: string | null;
  completed_rides: number | null;
  updated_at?: string | null;
}

interface SupabaseFeedbackRow {
  id: string;
  ride_id: string;
  from_telegram_id: number;
  to_telegram_id: number;
  tag: string;
  created_at: string;
}

function normalizeProfileRole(role?: string | null): ProfileRole {
  if (role === 'driver' || role === 'passenger' || role === 'both') {
    return role;
  }
  return 'driver';
}

function mapProfileRow(row: SupabaseProfileRow): UserProfile {
  return {
    telegramId: Number(row.telegram_id),
    firstName: row.first_name?.trim() || 'Попутчик',
    username: row.username ?? null,
    role: normalizeProfileRole(row.role),
    carInfo: row.car_info ?? '',
    bio: row.bio ?? '',
    completedRides: Math.max(0, Number(row.completed_rides ?? 0)),
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapFeedbackRow(row: SupabaseFeedbackRow): RideFeedback {
  return {
    id: row.id,
    rideId: row.ride_id,
    fromTelegramId: Number(row.from_telegram_id),
    toTelegramId: Number(row.to_telegram_id),
    tag: row.tag as FeedbackTagId,
    createdAt: row.created_at,
  };
}

function readLocalProfiles(): Record<number, UserProfile> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_PROFILES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, UserProfile>;
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<number, UserProfile> = {};
    for (const [key, val] of Object.entries(parsed)) {
      const id = Number(key);
      if (Number.isFinite(id) && val) {
        result[id] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeLocalProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readLocalProfiles();
    current[profile.telegramId] = profile;
    window.localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota errors
  }
}

function readLocalFeedback(): RideFeedback[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_FEEDBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RideFeedback[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalFeedback(list: RideFeedback[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

export async function upsertUserProfileOnLogin(
  user: TelegramUserProfile
): Promise<UserProfile> {
  const localMap = readLocalProfiles();
  const cached = localMap[user.telegramId];

  if (supabase) {
    // Upsert only Telegram identity columns on conflict so saved role/car_info/bio/completed_rides are preserved
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          telegram_id: user.telegramId,
          first_name: user.firstName,
          username: user.username,
        },
        { onConflict: 'telegram_id' }
      )
      .select('*')
      .single();

    if (!error && data) {
      const mapped = mapProfileRow(data as SupabaseProfileRow);
      writeLocalProfile(mapped);
      return mapped;
    }

    // Fallback: try direct select if upsert was blocked by policy
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', user.telegramId)
      .maybeSingle();

    if (existing) {
      const mapped = mapProfileRow(existing as SupabaseProfileRow);
      writeLocalProfile(mapped);
      return mapped;
    }
  }

  const fallbackProfile: UserProfile = {
    telegramId: user.telegramId,
    firstName: user.firstName,
    username: user.username,
    role: cached?.role ?? 'driver',
    carInfo: cached?.carInfo ?? '',
    bio: cached?.bio ?? '',
    completedRides: cached?.completedRides ?? 0,
    updatedAt: cached?.updatedAt,
  };
  writeLocalProfile(fallbackProfile);
  return fallbackProfile;
}

export async function saveUserProfile(input: {
  telegramId: number;
  firstName: string;
  username: string | null;
  role: ProfileRole;
  carInfo: string;
  bio: string;
  completedRides: number;
}): Promise<UserProfile> {
  const cleaned: UserProfile = {
    telegramId: input.telegramId,
    firstName: input.firstName.trim() || 'Попутчик',
    username: input.username,
    role: input.role,
    carInfo: input.carInfo.trim().slice(0, 80),
    bio: input.bio.trim().slice(0, 120),
    completedRides: Math.max(0, input.completedRides),
    updatedAt: new Date().toISOString(),
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          telegram_id: cleaned.telegramId,
          first_name: cleaned.firstName,
          username: cleaned.username,
          role: cleaned.role,
          car_info: cleaned.carInfo,
          bio: cleaned.bio,
        },
        { onConflict: 'telegram_id' }
      )
      .select('*')
      .single();

    if (!error && data) {
      const mapped = mapProfileRow(data as SupabaseProfileRow);
      writeLocalProfile(mapped);
      return mapped;
    }
  }

  writeLocalProfile(cleaned);
  return cleaned;
}

export async function fetchProfilesByTelegramIds(
  telegramIds: number[]
): Promise<Record<number, UserProfile>> {
  const uniqueIds = Array.from(
    new Set(telegramIds.filter((id) => Number.isFinite(id) && id > 0))
  );
  const localMap = readLocalProfiles();
  const result: Record<number, UserProfile> = {};

  for (const id of uniqueIds) {
    if (localMap[id]) {
      result[id] = localMap[id];
    }
  }

  if (supabase && uniqueIds.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('telegram_id', uniqueIds);

    if (!error && data) {
      for (const row of data as SupabaseProfileRow[]) {
        const mapped = mapProfileRow(row);
        result[mapped.telegramId] = mapped;
        writeLocalProfile(mapped);
      }
    }
  }

  return result;
}

export async function incrementCompletedRides(telegramId: number): Promise<number> {
  const localMap = readLocalProfiles();
  let currentCount = localMap[telegramId]?.completedRides ?? 0;

  if (supabase) {
    const { data: existing } = await supabase
      .from('profiles')
      .select('completed_rides')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (existing && typeof existing.completed_rides === 'number') {
      currentCount = existing.completed_rides;
    }

    const nextCount = currentCount + 1;
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ completed_rides: nextCount })
      .eq('telegram_id', telegramId)
      .select('*')
      .single();

    if (!error && updated) {
      const mapped = mapProfileRow(updated as SupabaseProfileRow);
      writeLocalProfile(mapped);
      return mapped.completedRides;
    }
  }

  const nextLocalCount = currentCount + 1;
  if (localMap[telegramId]) {
    writeLocalProfile({
      ...localMap[telegramId],
      completedRides: nextLocalCount,
    });
  }
  return nextLocalCount;
}

export async function fetchFeedbackForUsers(
  telegramIds: number[]
): Promise<{
  byRecipient: Record<number, RideFeedback[]>;
  allVisible: RideFeedback[];
}> {
  const uniqueIds = Array.from(
    new Set(telegramIds.filter((id) => Number.isFinite(id) && id > 0))
  );
  const localAll = readLocalFeedback();

  let combined = localAll;
  if (supabase && uniqueIds.length > 0) {
    const { data, error } = await supabase
      .from('ride_feedback')
      .select('*')
      .in('to_telegram_id', uniqueIds)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const remoteRows = (data as SupabaseFeedbackRow[]).map(mapFeedbackRow);
      const remoteKeys = new Set(
        remoteRows.map((f) => `${f.rideId}:${f.fromTelegramId}`)
      );
      const localUnsynced = localAll.filter(
        (f) => !remoteKeys.has(`${f.rideId}:${f.fromTelegramId}`) && !uniqueIds.includes(f.toTelegramId)
      );
      combined = [...remoteRows, ...localUnsynced];
      writeLocalFeedback(combined);
    }
  }

  const byRecipient: Record<number, RideFeedback[]> = {};
  for (const fb of combined) {
    if (!byRecipient[fb.toTelegramId]) {
      byRecipient[fb.toTelegramId] = [];
    }
    byRecipient[fb.toTelegramId].push(fb);
  }

  return { byRecipient, allVisible: combined };
}

export async function submitRideFeedback(params: {
  rideId: string;
  fromTelegramId: number;
  toTelegramId: number;
  tag: FeedbackTagId;
}): Promise<RideFeedback> {
  const existingLocal = readLocalFeedback().find(
    (f) => f.rideId === params.rideId && f.fromTelegramId === params.fromTelegramId
  );
  if (existingLocal) {
    return existingLocal;
  }

  if (supabase) {
    const { data: existingRemote } = await supabase
      .from('ride_feedback')
      .select('*')
      .eq('ride_id', params.rideId)
      .eq('from_telegram_id', params.fromTelegramId)
      .maybeSingle();

    if (existingRemote) {
      return mapFeedbackRow(existingRemote as SupabaseFeedbackRow);
    }

    const { data, error } = await supabase
      .from('ride_feedback')
      .insert({
        ride_id: params.rideId,
        from_telegram_id: params.fromTelegramId,
        to_telegram_id: params.toTelegramId,
        tag: params.tag,
      })
      .select('*')
      .single();

    if (!error && data) {
      const mapped = mapFeedbackRow(data as SupabaseFeedbackRow);
      const nextLocal = [mapped, ...readLocalFeedback()];
      writeLocalFeedback(nextLocal);
      return mapped;
    }
  }

  const localCreated: RideFeedback = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    rideId: params.rideId,
    fromTelegramId: params.fromTelegramId,
    toTelegramId: params.toTelegramId,
    tag: params.tag,
    createdAt: new Date().toISOString(),
  };
  writeLocalFeedback([localCreated, ...readLocalFeedback()]);
  return localCreated;
}
