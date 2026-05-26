'use client'

import { Bell, LocateFixed, LogIn, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { FeedList } from '@/components/FeedList'
import { ItemComposer } from '@/components/ItemComposer'
import { MapShell } from '@/components/MapShell'
import { mockItems } from '@/lib/mock-data'
import type { ItemCategoryFilter } from '@/types/foundy'

const filters: Array<{ value: ItemCategoryFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'chaves', label: 'Chaves' },
  { value: 'documentos', label: 'Documentos' },
  { value: 'eletronicos', label: 'Eletrônicos' },
  { value: 'vestuario', label: 'Vestuário' },
  { value: 'outros', label: 'Outros' },
]

export function MainScreen() {
  const [activeFilter, setActiveFilter] = useState<ItemCategoryFilter>('todos')
  const [nearMe, setNearMe] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)

  const visibleItems = useMemo(() => {
    if (activeFilter === 'todos') return mockItems
    return mockItems.filter((item) => item.category === activeFilter)
  }, [activeFilter])

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand" aria-label="Foundy">
          <span className="brandMark">FOUNDY.</span>
          <span className="brandTagline">O que se perdeu, volta.</span>
        </div>

        <div className="topActions">
          <button className="iconButton" type="button" aria-label="Notificações">
            <Bell size={18} aria-hidden="true" />
          </button>
          <button className="ghostButton hideMobile" type="button">
            Entrar
          </button>
          <button className="primaryButton" type="button" onClick={() => setComposerOpen(true)}>
            <Plus size={18} aria-hidden="true" /> Achei algo
          </button>
        </div>
      </header>

      <section className="contentGrid" aria-label="Mapa e feed de itens encontrados">
        <div className="mapPanel">
          <MapShell items={visibleItems} />
        </div>

        <div className="feedPanel">
          <div className="feedHeader">
            <h1 className="headline">O que se perdeu, volta.</h1>
            <p className="subhead">A tecnologia conectando pessoas e devolvendo sorrisos à comunidade.</p>

            <div className="filters" aria-label="Filtros">
              {filters.map((filter) => (
                <button
                  className={`filterChip ${activeFilter === filter.value ? 'filterChipActive' : ''}`}
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="itemActions">
              <button
                className={`ghostButton ${nearMe ? 'filterChipActive' : ''}`}
                type="button"
                onClick={() => setNearMe((value) => !value)}
              >
                <LocateFixed size={17} aria-hidden="true" /> Perto de mim
              </button>
              <button className="ghostButton" type="button">
                <Search size={17} aria-hidden="true" /> Buscar
              </button>
            </div>
          </div>

          <FeedList items={visibleItems} nearMe={nearMe} />
        </div>
      </section>

      {composerOpen ? <ItemComposer onClose={() => setComposerOpen(false)} /> : null}
    </main>
  )
}
