import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateFeedbackTags,
  ALL_KHARKIV_POINTS,
  buildShareRideLink,
  buildShareRideText,
  buildTelegramLink,
  computeExtendedExpiresAt,
  describePickedCoordinates,
  FEEDBACK_TAGS,
  filterActiveRides,
  findMatchingWatchedRides,
  formatDistanceFromUser,
  formatHistoryDateTime,
  formatPriceUah,
  getTopFeedbackTags,
  haversineDistanceKm,
  isRideCreatedByUser,
  isRideExpired,
  KHARKIV_HUBS,
  KHARKIV_LANDMARKS,
  mergeCompletedRideHistory,
  parseSharedRideId,
  RIDE_EXTEND_STEP_MS,
  RIDE_TTL_MS,
  validateProfileInput,
  validateRideInput,
} from './ridesLogic';
import type { CompletedRideRecord, Ride, RideFeedback, RouteWatchAlert } from '../types/ride';

const NOW = Date.parse('2026-11-19T18:00:00.000Z');

const sampleRides: Ride[] = [
  {
    id: '1',
    role: 'driver',
    authorId: 'u1',
    authorName: 'Андрей',
    authorUsername: 'andrey_kh',
    authorPhotoUrl: null,
    fromName: 'Холодная Гора',
    fromLat: 49.9818,
    fromLng: 36.182,
    toName: 'Центр',
    toLat: 49.9935,
    toLng: 36.2304,
    departureLabel: 'Через 15 мин',
    priceUah: 50,
    seats: 3,
    comment: 'Серый Lanos',
    tags: ['luggage', 'card'],
    createdAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    role: 'passenger',
    authorId: 'u2',
    authorName: 'Елена',
    authorUsername: 'elena_k',
    authorPhotoUrl: null,
    fromName: 'Салтовка',
    fromLat: 50.0226,
    fromLng: 36.334,
    toName: 'ЮЖД',
    toLat: 49.9896,
    toLng: 36.2045,
    departureLabel: 'Сейчас',
    priceUah: 0,
    seats: 1,
    comment: 'На перекрестке Тракторостроителей',
    tags: ['pets'],
    createdAt: new Date(NOW - 45 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    role: 'driver',
    authorId: 'u1',
    authorName: 'Андрей',
    authorUsername: 'andrey_kh',
    authorPhotoUrl: null,
    fromName: 'ХТЗ',
    fromLat: 49.9465,
    fromLng: 36.3705,
    toName: 'Гагарина',
    toLat: 49.9794,
    toLng: 36.2452,
    departureLabel: '14:00',
    priceUah: 60,
    seats: 2,
    comment: 'Старая заявка',
    createdAt: new Date(NOW - RIDE_TTL_MS - 60000).toISOString(),
  },
];

test('KHARKIV_LANDMARKS includes all 10 required districts and KHARKIV_HUBS expands landmarks', () => {
  assert.equal(KHARKIV_LANDMARKS.length, 10);
  assert.ok(KHARKIV_HUBS.length >= 8);
  assert.equal(ALL_KHARKIV_POINTS.length, KHARKIV_LANDMARKS.length + KHARKIV_HUBS.length);
});

test('isRideExpired hides rides older than 3 hours unless extended via expiresAt', () => {
  const fresh = new Date(NOW - 2 * 60 * 60 * 1000).toISOString();
  const expired = new Date(NOW - RIDE_TTL_MS - 1000).toISOString();
  const extendedFuture = new Date(NOW + 45 * 60 * 1000).toISOString();
  assert.equal(isRideExpired(fresh, NOW), false);
  assert.equal(isRideExpired(expired, NOW), true);
  assert.equal(isRideExpired(expired, NOW, extendedFuture), false);
  assert.equal(isRideExpired('invalid-date', NOW), true);
});

test('computeExtendedExpiresAt adds 1 hour from current expiry or now', () => {
  const ride = sampleRides[0];
  const nextIso = computeExtendedExpiresAt(ride, NOW);
  const createdMs = Date.parse(ride.createdAt);
  assert.equal(Date.parse(nextIso), createdMs + RIDE_TTL_MS + RIDE_EXTEND_STEP_MS);
});

test('filterActiveRides filters by role, author, district, and sorts by proximity', () => {
  const allActive = filterActiveRides(sampleRides, { roleFilter: 'all', nowMs: NOW });
  assert.deepEqual(
    allActive.map((r) => r.id),
    ['1', '2']
  );

  const byFrom = filterActiveRides(sampleRides, {
    fromDistrict: 'Салтовка',
    nowMs: NOW,
  });
  assert.deepEqual(
    byFrom.map((r) => r.id),
    ['2']
  );

  // Near Saltivka -> ride 2 should come first when sorting by proximity
  const nearSaltivka = filterActiveRides(sampleRides, {
    userLocation: { lat: 50.023, lng: 36.332 },
    sortByProximity: true,
    nowMs: NOW,
  });
  assert.deepEqual(
    nearSaltivka.map((r) => r.id),
    ['2', '1']
  );
});

test('haversineDistanceKm and formatDistanceFromUser compute realistic Kharkiv distances', () => {
  const dist = haversineDistanceKm(
    { lat: 49.9935, lng: 36.2304 },
    { lat: 50.0226, lng: 36.334 }
  );
  assert.ok(dist > 6 && dist < 10);
  assert.equal(formatDistanceFromUser(0.42), '~400 м от вас');
  assert.equal(formatDistanceFromUser(3.45), '~3.5 км от вас');
});

test('buildShareRideLink, buildShareRideText, and parseSharedRideId handle web and Telegram deep links', () => {
  const webLink = buildShareRideLink('seed-1', 'https://podvezun.app/');
  assert.equal(webLink, 'https://podvezun.app/?ride=seed-1');

  const botLink = buildShareRideLink('seed-1', 'https://podvezun.app/', '@podvezun_bot');
  assert.equal(botLink, 'https://t.me/podvezun_bot?startapp=ride_seed-1');

  assert.equal(parseSharedRideId('?ride=seed-1'), 'seed-1');
  assert.equal(parseSharedRideId('', 'ride_seed-2'), 'seed-2');
  assert.match(buildShareRideText(sampleRides[0]), /Холодная Гора → Центр/);
});

test('findMatchingWatchedRides finds rides matching user RouteWatchAlert rules', () => {
  const active = filterActiveRides(sampleRides, { nowMs: NOW });
  const alerts: RouteWatchAlert[] = [
    {
      id: 'a1',
      fromName: 'Салтовка',
      toName: 'ЮЖД',
      role: 'all',
      createdAt: new Date(NOW).toISOString(),
    },
  ];
  const matches = findMatchingWatchedRides(active, alerts);
  assert.deepEqual(
    matches.map((r) => r.id),
    ['2']
  );
});

test('formatPriceUah renders 0 as Бесплатно and positive numbers with ₴', () => {
  assert.equal(formatPriceUah(0), 'Бесплатно');
  assert.equal(formatPriceUah(-10), 'Бесплатно');
  assert.equal(formatPriceUah(75), '75 ₴');
});

test('buildTelegramLink sanitizes @ prefix and rejects invalid usernames', () => {
  assert.equal(buildTelegramLink('@kharkiv_driver'), 'https://t.me/kharkiv_driver');
  assert.equal(buildTelegramLink('elena_k'), 'https://t.me/elena_k');
  assert.equal(buildTelegramLink(''), null);
  assert.equal(buildTelegramLink('bad user!'), null);
  assert.equal(buildTelegramLink(null), null);
});

test('validateRideInput catches missing endpoints, identical endpoints, and out-of-range values', () => {
  const invalid = validateRideInput({
    role: 'driver',
    fromName: '',
    fromLat: null,
    fromLng: null,
    toName: '',
    toLat: null,
    toLng: null,
    departureLabel: '',
    priceUah: -5,
    seats: 5,
    comment: 'ok',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.from);
  assert.ok(invalid.errors.to);
  assert.ok(invalid.errors.departureLabel);
  assert.ok(invalid.errors.priceUah);
  assert.ok(invalid.errors.seats);

  const samePoint = validateRideInput({
    role: 'passenger',
    fromName: 'Центр',
    fromLat: 49.9935,
    fromLng: 36.2304,
    toName: 'Центр',
    toLat: 49.9935,
    toLng: 36.2304,
    departureLabel: 'Сейчас',
    priceUah: 0,
    seats: 1,
    comment: '',
  });
  assert.equal(samePoint.valid, false);
  assert.ok(samePoint.errors.to);

  const valid = validateRideInput({
    role: 'driver',
    fromName: 'Холодная Гора',
    fromLat: 49.9818,
    fromLng: 36.182,
    toName: 'Центр',
    toLat: 49.9935,
    toLng: 36.2304,
    departureLabel: 'Через 15 мин',
    priceUah: 50,
    seats: 3,
    comment: 'Серый Lanos, еду по Полтавскому Шляху',
  });
  assert.equal(valid.valid, true);
});

test('describePickedCoordinates recognizes nearby Kharkiv landmarks', () => {
  const nearCenter = describePickedCoordinates(49.994, 36.231);
  assert.match(nearCenter, /Центр/);
  const farAway = describePickedCoordinates(50.11, 36.55);
  assert.match(farAway, /Метка/);
});

test('buildTelegramLink supports tg://user?id fallback when username is absent', () => {
  assert.equal(buildTelegramLink(null, 999999), 'tg://user?id=999999');
  assert.equal(buildTelegramLink('test_driver', 999999), 'https://t.me/test_driver');
  assert.equal(buildTelegramLink(null, null), null);
});

test('isRideCreatedByUser matches both creatorTelegramId and authorId', () => {
  assert.equal(
    isRideCreatedByUser(
      { authorId: '999999', creatorTelegramId: 999999 },
      { id: '999999', telegramId: 999999 }
    ),
    true
  );
  assert.equal(
    isRideCreatedByUser(
      { authorId: 'other', creatorTelegramId: 999999 },
      { id: '999999', telegramId: 999999 }
    ),
    true
  );
  assert.equal(
    isRideCreatedByUser(
      { authorId: '10042', creatorTelegramId: 10042 },
      { id: '999999', telegramId: 999999 }
    ),
    false
  );
});

test('aggregateFeedbackTags and getTopFeedbackTags count and sort trust tags cleanly', () => {
  assert.equal(FEEDBACK_TAGS.length, 4);
  const sampleFeedback: Pick<RideFeedback, 'tag'>[] = [
    { tag: 'По пути' },
    { tag: 'Вовремя' },
    { tag: 'Вовремя' },
    { tag: 'Вовремя' },
    { tag: 'Всё ок' },
    { tag: 'По пути' },
    { tag: 'Приятный попутчик' },
  ];
  const all = aggregateFeedbackTags(sampleFeedback);
  assert.deepEqual(all, [
    { tag: 'Вовремя', count: 3 },
    { tag: 'По пути', count: 2 },
    { tag: 'Всё ок', count: 1 },
    { tag: 'Приятный попутчик', count: 1 },
  ]);
  const top2 = getTopFeedbackTags(sampleFeedback, 2);
  assert.deepEqual(top2, [
    { tag: 'Вовремя', count: 3 },
    { tag: 'По пути', count: 2 },
  ]);
});

test('validateProfileInput enforces 120 char bio limit and valid roles', () => {
  assert.equal(
    validateProfileInput({ role: 'both', carInfo: 'Серый Ланос', bio: 'Езжу утром на работу' })
      .valid,
    true
  );
  assert.equal(
    validateProfileInput({ role: 'passenger', carInfo: '', bio: 'a'.repeat(121) }).valid,
    false
  );
});

test('formatHistoryDateTime formats today, yesterday, and older Russian dates', () => {
  const refNow = new Date(2026, 10, 20, 18, 0, 0).getTime();
  const todayIso = new Date(2026, 10, 20, 14, 5, 0).toISOString();
  const yesterdayIso = new Date(2026, 10, 19, 9, 30, 0).toISOString();
  const olderIso = new Date(2026, 10, 10, 12, 15, 0).toISOString();

  assert.equal(formatHistoryDateTime(todayIso, refNow), 'Сегодня, 14:05');
  assert.equal(formatHistoryDateTime(yesterdayIso, refNow), 'Вчера, 09:30');
  assert.equal(formatHistoryDateTime(olderIso, refNow), '10 нояб., 12:15');
  assert.equal(formatHistoryDateTime('bad-date', refNow), 'Недавно');
});

test('mergeCompletedRideHistory merges created and participated rides, excludes active unconfirmed rides, and sorts newest first', () => {
  const user = { id: '999999', telegramId: 999999 };
  const activeOwnRide: Ride = {
    ...sampleRides[0],
    id: 'active-own',
    authorId: '999999',
    creatorTelegramId: 999999,
    createdAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
  };
  const archivedOwnRide: Ride = {
    ...sampleRides[0],
    id: 'archived-own',
    authorId: '999999',
    creatorTelegramId: 999999,
    createdAt: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(),
  };
  const participatedRide: Ride = {
    ...sampleRides[1],
    id: 'participated-1',
    authorId: '777777',
    creatorTelegramId: 777777,
    createdAt: new Date(NOW - 5 * 60 * 60 * 1000).toISOString(),
  };

  const localEntries: CompletedRideRecord[] = [
    {
      id: 'archived-own',
      ride: { ...archivedOwnRide, createdAt: new Date(NOW - 45 * 60 * 1000).toISOString() },
      participation: 'created',
      completedAt: new Date(NOW - 5 * 60 * 1000).toISOString(),
      originalCreatedAt: new Date(NOW - 45 * 60 * 1000).toISOString(),
    },
  ];

  const authoredFeedback: RideFeedback[] = [
    {
      id: 'fb1',
      rideId: 'participated-1',
      fromTelegramId: 999999,
      toTelegramId: 777777,
      tag: 'Вовремя',
      createdAt: new Date(NOW - 60 * 60 * 1000).toISOString(),
    },
  ];

  const receivedFeedback: RideFeedback[] = [
    {
      id: 'fb2',
      rideId: 'archived-own',
      fromTelegramId: 777777,
      toTelegramId: 999999,
      tag: 'По пути',
      createdAt: new Date(NOW - 15 * 60 * 1000).toISOString(),
    },
  ];

  const merged = mergeCompletedRideHistory({
    user,
    remoteRides: [activeOwnRide, archivedOwnRide, participatedRide],
    localEntries,
    authoredFeedback,
    receivedFeedback,
    nowMs: NOW,
  });

  assert.deepEqual(
    merged.map((m) => m.id),
    ['archived-own', 'participated-1']
  );
  assert.equal(merged[0].participation, 'created');
  assert.equal(merged[0].originalCreatedAt, new Date(NOW - 45 * 60 * 1000).toISOString());
  assert.deepEqual(merged[0].receivedFeedbackTags, ['По пути']);
  assert.equal(merged[1].participation, 'participated');
  assert.equal(merged[1].myFeedbackTag, 'Вовремя');
});


