import type { LatLng } from '../types/ride';

export interface RouteGeometryResult {
  coordinates: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
  isFallback: boolean;
}

const DEFAULT_OSRM_TIMEOUT_MS = 5000;
const roadRouteCache = new Map<string, RouteGeometryResult>();

export function buildRouteCacheKey(from: LatLng, to: LatLng): string {
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}->${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
}

export function buildOsrmRouteUrl(from: LatLng, to: LatLng): string {
  return `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
}

export function createFallbackRoute(from: LatLng, to: LatLng): RouteGeometryResult {
  return {
    coordinates: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distanceMeters: null,
    durationSeconds: null,
    isFallback: true,
  };
}

export function flipGeoJsonCoordsToLatLng(coords: unknown): [number, number][] {
  if (!Array.isArray(coords)) return [];
  const result: [number, number][] = [];
  for (const point of coords) {
    if (
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number' &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1])
    ) {
      // OSRM GeoJSON returns [longitude, latitude]; Leaflet expects [latitude, longitude]
      result.push([point[1], point[0]]);
    }
  }
  return result;
}

export function parseOsrmResponse(
  data: unknown,
  from: LatLng,
  to: LatLng
): RouteGeometryResult {
  if (!data || typeof data !== 'object') {
    return createFallbackRoute(from, to);
  }

  const routes = (data as { routes?: unknown[] }).routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    return createFallbackRoute(from, to);
  }

  const primary = routes[0] as {
    geometry?: { coordinates?: unknown };
    distance?: unknown;
    duration?: unknown;
  };

  const coordinates = flipGeoJsonCoordsToLatLng(primary?.geometry?.coordinates);
  if (coordinates.length < 2) {
    return createFallbackRoute(from, to);
  }

  const distanceMeters =
    typeof primary.distance === 'number' && Number.isFinite(primary.distance) && primary.distance >= 0
      ? primary.distance
      : null;
  const durationSeconds =
    typeof primary.duration === 'number' && Number.isFinite(primary.duration) && primary.duration >= 0
      ? primary.duration
      : null;

  return {
    coordinates,
    distanceMeters,
    durationSeconds,
    isFallback: false,
  };
}

export function formatRouteStats(
  distanceMeters: number | null,
  durationSeconds: number | null
): string | null {
  const parts: string[] = [];

  if (distanceMeters !== null && Number.isFinite(distanceMeters)) {
    if (distanceMeters < 1000) {
      const roundedMeters = Math.max(50, Math.round(distanceMeters / 50) * 50);
      parts.push(`~${roundedMeters} м`);
    } else {
      parts.push(`~${(distanceMeters / 1000).toFixed(1)} км`);
    }
  }

  if (durationSeconds !== null && Number.isFinite(durationSeconds)) {
    const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
    if (totalMinutes < 60) {
      parts.push(`~${totalMinutes} мин`);
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      parts.push(mins === 0 ? `~${hours} ч` : `~${hours} ч ${mins} мин`);
    }
  }

  return parts.length > 0 ? parts.join(' • ') : null;
}

export function getCachedRoadRoute(
  from: LatLng,
  to: LatLng,
  cache: Map<string, RouteGeometryResult> = roadRouteCache
): RouteGeometryResult | null {
  return cache.get(buildRouteCacheKey(from, to)) ?? null;
}

export function clearRoadRouteCache(
  cache: Map<string, RouteGeometryResult> = roadRouteCache
): void {
  cache.clear();
}

export interface FetchRoadRouteOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchFn?: typeof fetch;
  cache?: Map<string, RouteGeometryResult>;
}

export async function fetchRoadRoute(
  from: LatLng,
  to: LatLng,
  options: FetchRoadRouteOptions = {}
): Promise<RouteGeometryResult> {
  const cache = options.cache ?? roadRouteCache;
  const cacheKey = buildRouteCacheKey(from, to);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_OSRM_TIMEOUT_MS;
  const fetchImpl = options.fetchFn ?? fetch;
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => {
    controller.abort();
  };
  if (options.signal) {
    if (options.signal.aborted) {
      return createFallbackRoute(from, to);
    }
    options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(buildOsrmRouteUrl(from, to), {
      signal: controller.signal,
    });
    if (!response.ok) {
      return createFallbackRoute(from, to);
    }
    const json = (await response.json()) as unknown;
    const parsed = parseOsrmResponse(json, from, to);
    if (!parsed.isFallback) {
      cache.set(cacheKey, parsed);
    }
    return parsed;
  } catch {
    // Both network errors and 5s OSRM timeouts fall back cleanly to dashed A->B line
    if (timedOut || !options.signal?.aborted) {
      return createFallbackRoute(from, to);
    }
    return createFallbackRoute(from, to);
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}
