import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTelegramLink,
  describePickedCoordinates,
  filterActiveRides,
  formatPriceUah,
  isRideExpired,
  KHARKIV_LANDMARKS,
  RIDE_TTL_MS,
  validateRideInput,
} from './ridesLogic';
import type { Ride } from '../types/ride';

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

test('KHARKIV_LANDMARKS includes all 10 required districts', () => {
  assert.equal(KHARKIV_LANDMARKS.length, 10);
});

test('isRideExpired hides rides older than 3 hours', () => {
  const fresh = new Date(NOW - 2 * 60 * 60 * 1000).toISOString();
  const expired = new Date(NOW - RIDE_TTL_MS - 1000).toISOString();
  assert.equal(isRideExpired(fresh, NOW), false);
  assert.equal(isRideExpired(expired, NOW), true);
  assert.equal(isRideExpired('invalid-date', NOW), true);
});

test('filterActiveRides excludes expired rides, filters by role and author, and sorts newest first', () => {
  const allActive = filterActiveRides(sampleRides, { roleFilter: 'all', nowMs: NOW });
  assert.deepEqual(
    allActive.map((r) => r.id),
    ['1', '2']
  );

  const driversOnly = filterActiveRides(sampleRides, { roleFilter: 'driver', nowMs: NOW });
  assert.deepEqual(
    driversOnly.map((r) => r.id),
    ['1']
  );

  const myRides = filterActiveRides(sampleRides, {
    roleFilter: 'all',
    onlyMineUserId: 'u1',
    nowMs: NOW,
  });
  assert.deepEqual(
    myRides.map((r) => r.id),
    ['1']
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
