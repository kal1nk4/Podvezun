import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOsrmRouteUrl,
  buildRouteCacheKey,
  fetchRoadRoute,
  flipGeoJsonCoordsToLatLng,
  formatRouteStats,
  parseOsrmResponse,
  type RouteGeometryResult,
} from './osrmRoute';

const FROM = { lat: 49.9831, lng: 36.1823 };
const TO = { lat: 49.9935, lng: 36.2304 };

test('buildOsrmRouteUrl formats lng,lat coordinates in OSRM driving endpoint order', () => {
  const url = buildOsrmRouteUrl(FROM, TO);
  assert.equal(
    url,
    'https://router.project-osrm.org/route/v1/driving/36.1823,49.9831;36.2304,49.9935?overview=full&geometries=geojson'
  );
});

test('flipGeoJsonCoordsToLatLng converts [lng, lat] pairs to Leaflet [lat, lng] pairs', () => {
  const flipped = flipGeoJsonCoordsToLatLng([
    [36.18, 49.98],
    [36.2, 49.99],
    [36.23, 49.995],
  ]);
  assert.deepEqual(flipped, [
    [49.98, 36.18],
    [49.99, 36.2],
    [49.995, 36.23],
  ]);
});

test('parseOsrmResponse extracts distance, duration, and road coordinates or falls back on invalid payloads', () => {
  const valid = parseOsrmResponse(
    {
      code: 'Ok',
      routes: [
        {
          distance: 12420,
          duration: 1185,
          geometry: {
            type: 'LineString',
            coordinates: [
              [36.1823, 49.9831],
              [36.205, 49.989],
              [36.2304, 49.9935],
            ],
          },
        },
      ],
    },
    FROM,
    TO
  );

  assert.equal(valid.isFallback, false);
  assert.equal(valid.coordinates.length, 3);
  assert.deepEqual(valid.coordinates[1], [49.989, 36.205]);
  assert.equal(valid.distanceMeters, 12420);
  assert.equal(valid.durationSeconds, 1185);

  const fallback = parseOsrmResponse({ code: 'NoRoute', routes: [] }, FROM, TO);
  assert.equal(fallback.isFallback, true);
  assert.deepEqual(fallback.coordinates, [
    [FROM.lat, FROM.lng],
    [TO.lat, TO.lng],
  ]);
  assert.equal(fallback.distanceMeters, null);
  assert.equal(fallback.durationSeconds, null);
});

test('formatRouteStats renders human-readable km/m and min/h labels', () => {
  assert.equal(formatRouteStats(12420, 1185), '~12.4 км • ~20 мин');
  assert.equal(formatRouteStats(640, 130), '~650 м • ~2 мин');
  assert.equal(formatRouteStats(45200, 4500), '~45.2 км • ~1 ч 15 мин');
  assert.equal(formatRouteStats(null, null), null);
});

test('fetchRoadRoute caches successful responses by start/end coordinates', async () => {
  const cache = new Map<string, RouteGeometryResult>();
  let fetchCalls = 0;

  const mockFetch = (async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({
        code: 'Ok',
        routes: [
          {
            distance: 5200,
            duration: 600,
            geometry: {
              coordinates: [
                [36.1823, 49.9831],
                [36.21, 49.99],
                [36.2304, 49.9935],
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as unknown as typeof fetch;

  const first = await fetchRoadRoute(FROM, TO, { fetchFn: mockFetch, cache });
  const second = await fetchRoadRoute(FROM, TO, { fetchFn: mockFetch, cache });

  assert.equal(fetchCalls, 1);
  assert.equal(first.isFallback, false);
  assert.equal(second.distanceMeters, 5200);
  assert.equal(cache.has(buildRouteCacheKey(FROM, TO)), true);
});

test('fetchRoadRoute falls back to straight dashed coordinates on timeout or error without caching failure', async () => {
  const cache = new Map<string, RouteGeometryResult>();

  const failingFetch = (async () => {
    throw new Error('Network unreachable');
  }) as unknown as typeof fetch;

  const failedResult = await fetchRoadRoute(FROM, TO, {
    fetchFn: failingFetch,
    cache,
  });

  assert.equal(failedResult.isFallback, true);
  assert.deepEqual(failedResult.coordinates, [
    [FROM.lat, FROM.lng],
    [TO.lat, TO.lng],
  ]);
  assert.equal(cache.size, 0);

  const slowFetch = ((_: unknown, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), {
        once: true,
      });
    })) as unknown as typeof fetch;

  const timedOutResult = await fetchRoadRoute(FROM, TO, {
    timeoutMs: 25,
    fetchFn: slowFetch,
    cache,
  });
  assert.equal(timedOutResult.isFallback, true);
});
