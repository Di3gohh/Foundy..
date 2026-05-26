'use client'

import { Circle, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'

import type { ItemAchado } from '@/lib/foundy-api'

const CENTRO_PADRAO: [number, number] = [-23.55052, -46.633308]

function FocoMapa({ item }: { item: ItemAchado | null }) {
  const map = useMap()

  useEffect(() => {
    if (!item) return
    map.flyTo([item.latitude_aproximada, item.longitude_aproximada], 15, { duration: 0.8 })
  }, [item, map])

  return null
}

export default function MapaInterativo({
  itens,
  itemSelecionado,
  onSelecionarItem,
}: {
  itens: ItemAchado[]
  itemSelecionado: ItemAchado | null
  onSelecionarItem: (item: ItemAchado) => void
}) {
  const centro: [number, number] = itemSelecionado
    ?[itemSelecionado.latitude_aproximada, itemSelecionado.longitude_aproximada]
    : CENTRO_PADRAO

  return (
    <MapContainer center={centro} zoom={13} className="foundy-leaflet-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocoMapa item={itemSelecionado} />
      {itens.map((item) => (
        <Circle
          center={[item.latitude_aproximada, item.longitude_aproximada]}
          eventHandlers={{ click: () => onSelecionarItem(item) }}
          key={item.id}
          pathOptions={{
            color: itemSelecionado?.id === item.id ?'#facc15' : '#2dd4bf',
            fillColor: itemSelecionado?.id === item.id ?'#facc15' : '#2dd4bf',
            fillOpacity: 0.18,
            weight: 2,
          }}
          radius={item.raio_mascara_metros}
        >
          <Popup>
            <strong>{item.titulo}</strong>
            <br />
            {item.local_descricao ?'Local aproximado'}
          </Popup>
        </Circle>
      ))}
    </MapContainer>
  )
}
