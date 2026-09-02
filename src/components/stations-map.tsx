'use client';

import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef } from 'react';
import { GasStation } from '@/lib/types';

export function StationsMap({
  stations,
  onSelect,
}: {
  stations: GasStation[];
  onSelect: (id: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!container.current || !stations.length) return;
    let cancelled = false;

    void import('leaflet').then(L => {
      if (cancelled || !container.current) return;
      const instance = L.map(container.current, { zoomControl: true });
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
      const bounds = L.latLngBounds([]);

      for (const station of stations) {
        const position = L.latLng(station.latitude, station.longitude);
        bounds.extend(position);
        const marker = L.marker(position, { icon }).addTo(instance);
        const popup = document.createElement('button');
        popup.type = 'button';
        popup.className = 'min-w-48 p-1 text-left';
        const name = document.createElement('strong');
        name.className = 'block text-sm';
        name.textContent = station.name;
        const address = document.createElement('span');
        address.className = 'mt-1 block text-xs text-slate-600';
        address.textContent = station.address;
        const action = document.createElement('span');
        action.className = 'mt-2 block text-xs font-semibold text-blue';
        action.textContent = 'Ver detalhes do posto';
        popup.append(name, address, action);
        popup.addEventListener('click', () => onSelect(station.id));
        marker.bindPopup(popup);
        marker.on('click', () => onSelect(station.id));
      }

      if (stations.length === 1) instance.setView(bounds.getCenter(), 15);
      else instance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      map.current = instance;
      setTimeout(() => instance.invalidateSize(), 0);
    });

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [stations, onSelect]);

  if (!stations.length) {
    return (
      <div className="grid h-[460px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Nenhum posto cadastrado para exibir no mapa.
      </div>
    );
  }

  return <div ref={container} className="h-[460px] w-full rounded-2xl border border-slate-200" />;
}
