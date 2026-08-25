'use client';

import type { Map as LeafletMap, Marker } from 'leaflet';
import { useEffect, useRef } from 'react';

export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number;
  longitude: number;
  onChange: (position: { latitude: number; longitude: number }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);

  useEffect(() => {
    if (!container.current || map.current || !latitude || !longitude) return;
    let cancelled = false;
    void import('leaflet').then(L => {
      if (cancelled || !container.current) return;
      const instance = L.map(container.current, { zoomControl: true }).setView(
        [latitude, longitude],
        17,
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(instance);
      const icon = L.divIcon({
        className: '',
        html: '<span class="location-picker-marker"><span></span></span>',
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      });
      const point = L.marker([latitude, longitude], { draggable: true, icon }).addTo(instance);
      point.on('dragend', () => {
        const position = point.getLatLng();
        onChange({ latitude: position.lat, longitude: position.lng });
      });
      instance.on('click', event => {
        point.setLatLng(event.latlng);
        onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
      map.current = instance;
      marker.current = point;
      setTimeout(() => instance.invalidateSize(), 0);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!latitude || !longitude || !map.current || !marker.current) return;
    marker.current.setLatLng([latitude, longitude]);
    map.current.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  return (
    <div className="mt-4">
      <div
        ref={container}
        className="h-72 w-full overflow-hidden rounded-2xl border border-slate-300"
      />
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Arraste o marcador ou toque em outro ponto do mapa para ajustar a localização exata.
      </p>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-blue hover:bg-slate-50"
      >
        Abrir localização no Google Maps
      </a>
    </div>
  );
}
