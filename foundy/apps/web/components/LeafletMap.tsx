'use client'

import { Circle, MapContainer, Popup, TileLayer } from 'react-leaflet'

import type { FoundyItem } from '@/types/foundy'

const SAO_PAULO_CENTER: [number, number] = [-23.55052, -46.633308]

export default function LeafletMap({ items }: { items: FoundyItem[] }) {
  return (
    <MapContainer center={SAO_PAULO_CENTER} zoom={13} className="foundyMap" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {items.map((item) => (
        <Circle
          center={[item.latitude, item.longitude]}
          key={item.id}
          pathOptions={{ color: item.isPremium ? '#f59e0b' : '#0f766e', fillOpacity: 0.18 }}
          radius={item.locationRadiusMeters}
        >
          <Popup>
            <strong>{item.title}</strong>
            <br />
            {item.locationLabel}
          </Popup>
        </Circle>
      ))}
    </MapContainer>
  )
}
