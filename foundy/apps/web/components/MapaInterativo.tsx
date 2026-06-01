'use client'

import { Circle, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'

import type { EmpresaFoundy, ItemAchado } from '@/lib/foundy-api'

const CENTRO_PADRAO: [number, number] = [-23.55052, -46.633308]
type GeoPoint = { latitude: number; longitude: number }

function FocoMapa({ item }: { item: ItemAchado | null }) {
  const map = useMap()

  useEffect(() => {
    if (!item) return
    map.flyTo([item.latitude_aproximada, item.longitude_aproximada], 15, { duration: 0.8 })
  }, [item, map])

  return null
}

function FocoUsuario({ userLocation }: { userLocation: GeoPoint | null }) {
  const map = useMap()

  useEffect(() => {
    if (!userLocation) return
    map.flyTo([userLocation.latitude, userLocation.longitude], 14, { duration: 0.8 })
  }, [map, userLocation])

  return null
}

export default function MapaInterativo({
  itens,
  pontosSeguros = [],
  itemSelecionado,
  onSelecionarItem,
  onVerItem,
  onVerPontoSeguro,
  userLocation,
}: {
  itens: ItemAchado[]
  pontosSeguros?: EmpresaFoundy[]
  itemSelecionado: ItemAchado | null
  onSelecionarItem: (item: ItemAchado) => void
  onVerItem?: (item: ItemAchado) => void
  onVerPontoSeguro?: (empresa: EmpresaFoundy) => void
  userLocation?: GeoPoint | null
}) {
  const centro: [number, number] = itemSelecionado
    ? [itemSelecionado.latitude_aproximada, itemSelecionado.longitude_aproximada]
    : userLocation
      ? [userLocation.latitude, userLocation.longitude]
    : CENTRO_PADRAO

  return (
    <MapContainer center={centro} zoom={13} className="foundy-leaflet-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FocoMapa item={itemSelecionado} />
      <FocoUsuario userLocation={userLocation ?? null} />
      {userLocation ? (
        <Circle
          center={[userLocation.latitude, userLocation.longitude]}
          pathOptions={{ color: '#3fd18f', fillColor: '#3fd18f', fillOpacity: 0.14, weight: 2 }}
          radius={350}
        >
          <Popup>Sua regiao aproximada</Popup>
        </Circle>
      ) : null}
      {itens.map((item) => (
        <Circle
          center={[item.latitude_aproximada, item.longitude_aproximada]}
          eventHandlers={{ click: () => onSelecionarItem(item) }}
          key={item.id}
          pathOptions={{
            color: itemSelecionado?.id === item.id ? '#facc15' : '#3b82f6',
            fillColor: itemSelecionado?.id === item.id ? '#facc15' : '#22c55e',
            fillOpacity: 0.18,
            weight: 2,
          }}
          radius={item.raio_mascara_metros}
        >
          <Popup>
            <div className="grid min-w-40 gap-2">
              <strong>{item.titulo}</strong>
              <span>{item.local_descricao ?? 'Local aproximado'}</span>
              <button
                className="rounded-lg bg-[#2d7ff9] px-3 py-1 text-xs font-bold text-white"
                type="button"
                onClick={() => onVerItem?.(item)}
              >
                Ver item
              </button>
            </div>
          </Popup>
        </Circle>
      ))}
      {pontosSeguros
        .filter((empresa) => typeof empresa.safe_point_latitude === 'number' && typeof empresa.safe_point_longitude === 'number')
        .map((empresa) => (
          <Circle
            center={[empresa.safe_point_latitude as number, empresa.safe_point_longitude as number]}
            key={`safe-${empresa.id}`}
            pathOptions={{ color: '#facc15', fillColor: '#22c55e', fillOpacity: 0.34, weight: 4 }}
            radius={95}
          >
            <Popup>
              <div className="grid min-w-52 gap-2">
                <strong>Ponto Seguro Foundy</strong>
                <span>{empresa.empresa_nome ?? empresa.nome}</span>
                <span>{empresa.public_opening_hours ?? empresa.safe_point_service_days ?? 'Horário informado no perfil'}</span>
                <button
                  className="rounded-lg bg-[#22c55e] px-3 py-1 text-xs font-bold text-slate-950"
                  type="button"
                  onClick={() => onVerPontoSeguro?.(empresa)}
                >
                  Ver Ponto Seguro
                </button>
              </div>
            </Popup>
          </Circle>
        ))}
    </MapContainer>
  )
}
