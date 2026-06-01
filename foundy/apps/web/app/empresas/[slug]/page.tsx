'use client'

import Link from 'next/link'
import { Building2, Clock, MapPin, ShieldCheck } from 'lucide-react'
import { use, useEffect, useState } from 'react'

import { buscarPerfilPublicoEmpresa, type CompanyPublicProfile, type EmpresaCatalogoItem, type ItemCategory } from '@/lib/foundy-api'

const placeholdersPorCategoria: Record<ItemCategory, string> = {
  chaves: 'https://images.unsplash.com/photo-1592887102811-2f9f67f7f05b?auto=format&fit=crop&w=1200&q=80',
  eletronicos: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
  documentos: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
  vestuario: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  outros: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80',
}

export default function EmpresaPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [empresa, setEmpresa] = useState<CompanyPublicProfile | null>(null)
  const [mensagem, setMensagem] = useState('Carregando catálogo institucional...')

  useEffect(() => {
    if (!slug) return
    void buscarPerfilPublicoEmpresa(slug)
      .then((data) => {
        setEmpresa(data)
        setMensagem('Catálogo carregado. A retirada acontece diretamente na instituição.')
      })
      .catch((error) => setMensagem(error instanceof Error ? error.message : 'Não foi possível carregar a empresa.'))
  }, [slug])

  const catalogo = (empresa?.catalogo ?? []) as EmpresaCatalogoItem[]

  return (
    <main className="foundy-app-shell min-h-dvh bg-foundy-background px-4 py-6 text-foundy-foreground sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-6">
        <div className="foundy-hero-panel overflow-hidden rounded-3xl border border-foundy-border bg-foundy-surface">
          {empresa?.custom_cover_url ? <img src={empresa.custom_cover_url} alt="" className="h-56 w-full object-cover" /> : null}
          <div className="p-6">
            <Link className="text-sm font-black text-foundy-green underline-offset-4 hover:underline" href="/">Voltar ao Foundy</Link>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              {empresa?.custom_logo_url || empresa?.foto_url ? <img src={empresa.custom_logo_url ?? empresa.foto_url ?? ''} alt="" className="size-20 rounded-3xl object-cover" /> : <span className="grid size-20 place-items-center rounded-3xl bg-foundy-blue/15 text-foundy-blue"><Building2 size={34} /></span>}
              <div>
                <p className="foundy-eyebrow text-sm font-semibold text-foundy-green">Catálogo institucional</p>
                <h1 className="mt-2 text-4xl font-black">{empresa?.empresa_nome ?? empresa?.nome ?? 'Empresa Foundy'}</h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  {empresa?.empresa_verificada || empresa?.verified_badge ? <span className="inline-flex items-center gap-2 rounded-full bg-foundy-green px-3 py-1 text-xs font-black text-slate-950"><ShieldCheck size={14} /> Empresa Verificada</span> : null}
                  {empresa?.is_safe_point ? <span className="inline-flex items-center gap-2 rounded-full bg-foundy-blue px-3 py-1 text-xs font-black text-white"><MapPin size={14} /> Ponto Seguro Foundy</span> : null}
                </div>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-foundy-muted">{empresa?.public_description ?? empresa?.empresa_descricao ?? 'Achados e perdidos organizados pela instituição.'}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {empresa?.public_address_visible ? <p className="rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm"><MapPin className="mb-2" size={18} />{empresa.empresa_endereco_publico ?? 'Endereço público de retirada não informado.'}</p> : null}
              {empresa?.public_opening_hours ? <p className="rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm"><Clock className="mb-2" size={18} />{empresa.public_opening_hours}</p> : null}
            </div>
          </div>
        </div>

        <p className="rounded-2xl border border-foundy-blue/30 bg-foundy-blue/10 p-4 text-sm text-foundy-blue">{mensagem}</p>

        <div className="grid gap-4 md:grid-cols-2">
          {catalogo.map((item) => (
            <article className="foundy-item-card overflow-hidden rounded-3xl border border-foundy-border bg-foundy-surface" key={item.id}>
              <img src={item.imagem_url ?? placeholdersPorCategoria[item.categoria]} alt={`Imagem de ${item.titulo}`} className="h-56 w-full object-cover" />
              <div className="grid gap-3 p-4">
                <span className="w-fit rounded-full bg-foundy-blue/15 px-3 py-1 text-xs font-black text-foundy-blue">{item.status === 'retirado' ? 'Retirado' : 'Disponível'}</span>
                <h2 className="text-xl font-black">{item.titulo}</h2>
                <p className="text-sm leading-6 text-foundy-muted">{item.descricao}</p>
                <p className="rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-3 text-sm text-foundy-green">
                  Este catálogo não tem chat nem reivindicação online. A retirada deve ser feita diretamente na instituição indicada.
                </p>
              </div>
            </article>
          ))}
        </div>
        {catalogo.length === 0 ? <div className="rounded-3xl border border-foundy-border bg-foundy-surface p-6 text-center text-foundy-muted">Nenhum item disponível no catálogo público.</div> : null}
      </section>
    </main>
  )
}
