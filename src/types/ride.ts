export type RideRole = 'driver' | 'passenger';

export type ProfileRole = 'driver' | 'passenger' | 'both';

export type RideFilter = 'all' | 'driver' | 'passenger';

export type RideTagId = 'pets' | 'luggage' | 'card' | 'courtyard';

export type FeedbackTagId = 'Вовремя' | 'По пути' | 'Всё ок' | 'Приятный попутчик';

export type AppView = 'feed' | 'mine' | 'profile';

export type ThemeMode = 'light' | 'dark';

export type AccentColorId = 'emerald' | 'sky' | 'indigo' | 'amber' | 'rose' | 'violet';

export type MapStyleId = 'twilight' | 'aurora' | 'graphite' | 'ambernight' | 'osm';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface KharkivLandmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Ride {
  id: string;
  role: RideRole;
  authorId: string;
  creatorTelegramId?: number | null;
  authorName: string;
  authorUsername: string | null;
  authorPhotoUrl: string | null;
  fromName: string;
  fromLat: number;
  fromLng: number;
  toName: string;
  toLat: number;
  toLng: number;
  departureLabel: string;
  priceUah: number;
  seats: number;
  comment: string;
  tags?: RideTagId[];
  expiresAt?: string;
  createdAt: string;
}

export interface CreateRidePayload {
  role: RideRole;
  fromName: string;
  fromLat: number | null;
  fromLng: number | null;
  toName: string;
  toLat: number | null;
  toLng: number | null;
  departureLabel: string;
  priceUah: number;
  seats: number;
  comment: string;
  tags?: RideTagId[];
}

export interface RouteWatchAlert {
  id: string;
  fromName: string;
  toName: string;
  role: RideFilter;
  createdAt: string;
}

export interface TelegramUserProfile {
  id: string;
  telegramId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string | null;
  photoUrl: string | null;
  isTelegramEnv: boolean;
  isFallbackDemo: boolean;
}

export interface UserProfile {
  telegramId: number;
  firstName: string;
  username: string | null;
  role: ProfileRole;
  carInfo: string;
  bio: string;
  completedRides: number;
  updatedAt?: string;
}

export interface RideFeedback {
  id: string;
  rideId: string;
  fromTelegramId: number;
  toTelegramId: number;
  tag: FeedbackTagId;
  createdAt: string;
}

export interface TagCount {
  tag: FeedbackTagId;
  count: number;
}

export type ProfileTab = 'settings' | 'trips';

export type CompletedRideParticipation = 'created' | 'participated';

export interface CompletedRideRecord {
  id: string;
  ride: Ride;
  participation: CompletedRideParticipation;
  completedAt: string;
  originalCreatedAt?: string;
  myFeedbackTag?: FeedbackTagId | null;
  receivedFeedbackTags?: FeedbackTagId[];
}
