'use client'

import dynamic from 'next/dynamic'

import type { FoundyItem } from '@/types/foundy'

const LeafletMap = dynamic<{ items: FoundyItem[] }>(() => import('@/components/LeafletMap'), {
  ssr: false,
  loading: () => <div className="mapLoading">Carregando mapa...</div>,
})

export function MapShell({ items }: { items: FoundyItem[] }) {
  return <LeafletMap items={items} />
}
