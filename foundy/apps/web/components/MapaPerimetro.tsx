'use client'

import { Circle, MapContainer, TileLayer, useMapEvents } from 'react-leaflet'

type MapPoint = { latitude: number; longitude: number }

function AreaPicker({
  onPick,
}: {
  onPick: (point: MapPoint) => void
}) {
  useMapEvents({
    click(event) {
      onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })

  return null
}

export default function MapaPerimetro({
  center,
  radius,
  onCenterChange,
}: {
  center: MapPoint
  radius: number
  onCenterChange: (point: MapPoint) => void
}) {
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={14}
      className="h-[260px] w-full overflow-hidden rounded-2xl"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AreaPicker onPick={onCenterChange} />
      <Circle
        center={[center.latitude, center.longitude]}
        pathOptions={{ color: '#3b82f6', fillColor: '#22c55e', fillOpacity: 0.2, weight: 2 }}
        radius={radius}
      />
    </MapContainer>
  )
}
