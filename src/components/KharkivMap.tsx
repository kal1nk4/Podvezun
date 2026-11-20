import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MessageCircle, Navigation, X } from 'lucide-react';
import type { LatLng, Ride } from '../types/ride';
import {
  buildTelegramLink,
  formatPriceUah,
  formatSeatsLabel,
  KHARKIV_CENTER,
} from '../utils/ridesLogic';
import { openTelegramUser } from '../utils/telegram';

export type MapPickerTarget = 'from' | 'to' | null;

interface KharkivMapProps {
  rides: Ride[];
  selectedRide: Ride | null;
  onSelectRide: (ride: Ride | null) => void;
  pickerTarget: MapPickerTarget;
  draftFrom: { name: string; lat: number | null; lng: number | null };
  draftTo: { name: string; lat: number | null; lng: number | null };
  onPickPoint: (coords: LatLng) => void;
  onCancelPicker: () => void;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createRidePinIcon(role: Ride['role'], isSelected: boolean): L.DivIcon {
  const isDriver = role === 'driver';
  const bg = isDriver ? '#10B981' : '#FBBF24';
  const ring = isSelected ? 'box-shadow: 0 0 0 4px rgba(248,250,252,0.85), 0 8px 20px rgba(0,0,0,0.65); transform: scale(1.16);' : 'box-shadow: 0 4px 12px rgba(0,0,0,0.6);';
  const borderRadius = isDriver ? '9999px' : '8px';
  const innerSvg = isDriver
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B0E14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0B0E14" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>';

  return L.divIcon({
    className: 'podveznun-marker-wrapper',
    html: `<div style="width:32px;height:32px;border-radius:${borderRadius};background:${bg};border:2px solid #0B0E14;display:flex;align-items:center;justify-content:center;transition:transform 150ms ease;${ring}">${innerSvg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createEndpointIcon(label: 'А' | 'Б', color: string): L.DivIcon {
  return L.divIcon({
    className: 'podveznun-endpoint-wrapper',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:#0B0E14;border:2.5px solid ${color};color:#F8FAFC;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.7);">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export function KharkivMap({
  rides,
  selectedRide,
  onSelectRide,
  pickerTarget,
  draftFrom,
  draftTo,
  onPickPoint,
  onCancelPicker,
}: KharkivMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const pickerRef = useRef<MapPickerTarget>(pickerTarget);
  const onPickRef = useRef(onPickPoint);
  const onSelectRef = useRef(onSelectRide);

  pickerRef.current = pickerTarget;
  onPickRef.current = onPickPoint;
  onSelectRef.current = onSelectRide;

  // Initialize Leaflet map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const initialZoom = window.innerWidth < 640 ? 11 : 12;

    const map = L.map(el, {
      center: [KHARKIV_CENTER.lat, KHARKIV_CENTER.lng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pickerRef.current) {
        onPickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(el);

    mapRef.current = map;
    markersLayerRef.current = markersLayer;
    routeLayerRef.current = routeLayer;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  // Update cursor style when in map-picker mode
  useEffect(() => {
    const container = mapRef.current?.getContainer();
    if (!container) return;
    container.style.cursor = pickerTarget ? 'crosshair' : '';
  }, [pickerTarget]);

  // Render active ride pins + draft pins
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const map = mapRef.current;
    if (!markersLayer || !map) return;

    markersLayer.clearLayers();

    if (pickerTarget) {
      if (draftFrom.lat !== null && draftFrom.lng !== null) {
        L.marker([draftFrom.lat, draftFrom.lng], {
          icon: createEndpointIcon('А', '#10B981'),
        })
          .bindTooltip(`А: ${escapeHtml(draftFrom.name)}`, {
            direction: 'top',
            offset: [0, -12],
            className: 'podveznun-tooltip',
          })
          .addTo(markersLayer);
      }
      if (draftTo.lat !== null && draftTo.lng !== null) {
        L.marker([draftTo.lat, draftTo.lng], {
          icon: createEndpointIcon('Б', '#FBBF24'),
        })
          .bindTooltip(`Б: ${escapeHtml(draftTo.name)}`, {
            direction: 'top',
            offset: [0, -12],
            className: 'podveznun-tooltip',
          })
          .addTo(markersLayer);
      }
      return;
    }

    for (const ride of rides) {
      const isSelected = selectedRide?.id === ride.id;
      const roleWord = ride.role === 'driver' ? 'Водитель' : 'Пассажир';
      const marker = L.marker([ride.fromLat, ride.fromLng], {
        icon: createRidePinIcon(ride.role, isSelected),
        title: `${roleWord}: ${ride.fromName} → ${ride.toName}`,
        zIndexOffset: isSelected ? 500 : 0,
      });

      marker.bindTooltip(
        `${escapeHtml(ride.fromName)} → ${escapeHtml(ride.toName)} · ${escapeHtml(formatPriceUah(ride.priceUah))}`,
        {
          direction: 'top',
          offset: [0, -14],
          className: 'podveznun-tooltip',
        }
      );

      marker.on('click', () => {
        onSelectRef.current(ride);
      });

      marker.addTo(markersLayer);
    }
  }, [rides, selectedRide, pickerTarget, draftFrom, draftTo]);

  // Render selected ride A -> B route line & fit bounds
  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    const map = mapRef.current;
    if (!routeLayer || !map) return;

    routeLayer.clearLayers();

    if (!selectedRide || pickerTarget) return;

    const routeColor = selectedRide.role === 'driver' ? '#10B981' : '#FBBF24';
    const points: [number, number][] = [
      [selectedRide.fromLat, selectedRide.fromLng],
      [selectedRide.toLat, selectedRide.toLng],
    ];

    // Subtle outer glow
    L.polyline(points, {
      color: routeColor,
      weight: 8,
      opacity: 0.22,
      lineCap: 'round',
    }).addTo(routeLayer);

    // Crisp dashed route vector
    L.polyline(points, {
      color: routeColor,
      weight: 3.5,
      opacity: 0.95,
      dashArray: '8, 8',
      lineCap: 'round',
    }).addTo(routeLayer);

    L.marker(points[0], {
      icon: createEndpointIcon('А', routeColor),
      interactive: false,
      zIndexOffset: 600,
    })
      .bindTooltip(`Откуда: ${escapeHtml(selectedRide.fromName)}`, {
        permanent: false,
        direction: 'top',
        className: 'podveznun-tooltip',
      })
      .addTo(routeLayer);

    L.marker(points[1], {
      icon: createEndpointIcon('Б', routeColor),
      interactive: false,
      zIndexOffset: 600,
    })
      .bindTooltip(`Куда: ${escapeHtml(selectedRide.toName)}`, {
        permanent: false,
        direction: 'top',
        className: 'podveznun-tooltip',
      })
      .addTo(routeLayer);

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, {
      paddingTopLeft: [44, 64],
      paddingBottomRight: [44, 145],
      maxZoom: 14,
      animate: true,
    });
  }, [selectedRide, pickerTarget]);

  const telegramHref = selectedRide ? buildTelegramLink(selectedRide.authorUsername) : null;

  return (
    <div className="relative w-full h-full bg-[#0B0E14] overflow-hidden podveznun-dark-tiles" data-testid="kharkiv-map-container">
      <div ref={containerRef} className="w-full h-full z-0" />

      {/* Map point-picking prompt banner */}
      {pickerTarget && (
        <div
          className="absolute top-3 left-3 right-3 z-[500] flex items-center justify-between gap-3 rounded-2xl bg-[#131822]/95 border border-emerald-500/50 px-4 py-3 shadow-2xl backdrop-blur-md"
          role="status"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Crosshair className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-100 leading-tight">
              {pickerTarget === 'from'
                ? 'Нажмите на карту: Точка А (Откуда)'
                : 'Нажмите на карту: Точка Б (Куда)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelPicker}
            className="min-h-[40px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            Отмена
          </button>
        </div>
      )}

      {/* Compact selected ride route card overlaid on map */}
      {selectedRide && !pickerTarget && (
        <div
          className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-[500] rounded-2xl bg-[#131822]/95 border border-slate-700/80 p-3.5 shadow-2xl backdrop-blur-md"
          data-testid="map-selected-ride-card"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span
                  className={
                    selectedRide.role === 'driver'
                      ? 'font-semibold text-emerald-400'
                      : 'font-semibold text-amber-300'
                  }
                >
                  {selectedRide.role === 'driver' ? 'Водитель' : 'Пассажир'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{selectedRide.authorName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-slate-300">
                  {formatPriceUah(selectedRide.priceUah)}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-100 truncate">
                {selectedRide.fromName} → {selectedRide.toName}
              </p>
              <p className="mt-0.5 text-xs text-slate-400 font-mono-tabular">
                Выезд: {selectedRide.departureLabel} · {formatSeatsLabel(selectedRide.seats, selectedRide.role)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectRide(null)}
              aria-label="Скрыть маршрут"
              className="min-h-[44px] min-w-[44px] -mt-1.5 -mr-1.5 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedRide.comment && (
            <p className="mt-1.5 text-xs text-slate-300 line-clamp-2 leading-relaxed">
              {selectedRide.comment}
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            {telegramHref ? (
              <a
                href={telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (openTelegramUser(telegramHref)) {
                    e.preventDefault();
                  }
                }}
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                Написать в Telegram
              </a>
            ) : (
              <span className="flex-1 min-h-[40px] px-3 rounded-xl bg-slate-800/80 text-slate-400 text-xs font-medium flex items-center justify-center">
                Telegram @username не указан
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (mapRef.current) {
                  const bounds = L.latLngBounds([
                    [selectedRide.fromLat, selectedRide.fromLng],
                    [selectedRide.toLat, selectedRide.toLng],
                  ]);
                  mapRef.current.fitBounds(bounds, { padding: [50, 80], maxZoom: 14 });
                }
              }}
              aria-label="Центрировать маршрут на карте"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Navigation className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
