'use client'

import { MessageCircle } from 'lucide-react'

import type { FoundyItem } from '@/types/foundy'

const categoryLabels: Record<FoundyItem['category'], string> = {
  documentos: 'Documentos',
  eletronicos: 'Eletrônicos',
  chaves: 'Chaves',
  vestuario: 'Vestuário',
  outros: 'Outros',
}

export function FeedList({ items, nearMe }: { items: FoundyItem[]; nearMe: boolean }) {
  return (
    <div className="itemList" aria-live="polite">
      {nearMe ?<p className="itemMeta">Mostrando itens próximos ao seu local.</p> : null}

      {items.map((item) => (
        <article className="itemCard" key={item.id}>
          <div className="itemCardHeader">
            <div>
              <h2 className="itemTitle">{item.title}</h2>
              <p className="itemMeta">
                {categoryLabels[item.category]} · {item.locationLabel}
              </p>
            </div>
            {item.isPremium ?<span className="badge">Impulsionado</span> : null}
          </div>

          <p className="itemDescription">{item.description}</p>

          <div className="itemActions">
            <button className="primaryButton" type="button">
              <MessageCircle size={17} aria-hidden="true" /> É meu
            </button>
            <button className="ghostButton" type="button">
              Ver no mapa
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
