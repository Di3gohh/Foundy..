'use client'

import dynamic from 'next/dynamic'
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Flag,
  LocateFixed,
  MapPin,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import type { ChangeEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buscarItensAchadosProximos,
  cadastrarItemAchado,
  cadastrarUsuario,
  criarAlertaPerdido,
  denunciarExtorsao,
  entrarUsuario,
  enviarMensagemChat,
  enviarRespostaDesafio,
  listarMensagensChat,
  processarImagemComPrivacidade,
  validarReivindicacao,
  type FoundySession,
  type ItemAchado,
  type MensagemChat,
} from '@/lib/foundy-api'

const MapaInterativo = dynamic(() => import('@/components/MapaInterativo'), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-[430px] place-items-center rounded-3xl border border-white/10 bg-slate-900 text-sm text-slate-300">
      Carregando mapa seguro...
    </div>
  ),
})

const MapaPerimetro = dynamic(() => import('@/components/MapaPerimetro'), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-[260px] place-items-center rounded-2xl border border-white/10 bg-slate-900 text-sm text-slate-300">
      Carregando mapa do perÃ­metro...
    </div>
  ),
})

type ModalAtivo = 'auth' | 'acao' | 'item' | 'perdi' | 'desafio' | 'aguardando' | 'chat' | null
type CategoriaItem = ItemAchado['categoria']
type GeoPoint = { latitude: number; longitude: number }

const defaultPoint: GeoPoint = { latitude: -23.55052, longitude: -46.633308 }

const placeholdersPorCategoria: Record<CategoriaItem, string> = {
  chaves: 'https://images.unsplash.com/photo-1592887102811-2f9f67f7f05b?auto=format&fit=crop&w=1200&q=80',
  eletronicos: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
  documentos: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
  vestuario: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  outros: 'https://images.unsplash.com/photo-1528962914676-134849a727f0?auto=format&fit=crop&w=1200&q=80',
}

const itensDemonstracao: ItemAchado[] = [
  {
    id: 'demo-1',
    titulo: 'Chave Yale com chaveiro azul',
    descricao: 'Encontrada perto da saÃ­da principal da estaÃ§Ã£o. O endereÃ§o exato foi mascarado por seguranÃ§a.',
    categoria: 'chaves',
    local_descricao: 'RegiÃ£o da estaÃ§Ã£o central',
    latitude_aproximada: -23.5489,
    longitude_aproximada: -46.6372,
    raio_mascara_metros: 500,
    distancia_metros: 620,
    imagem_url: placeholdersPorCategoria.chaves,
    status: 'publicado',
    criado_em: new Date().toISOString(),
    desafio_pergunta: 'Qual detalhe sÃ³ o dono saberia informar?',
    chat_desbloqueado: false,
    tags_ia: ['chaveyale', 'fitaazul'],
    hashtags_ia: ['#ChaveYale', '#FitaAzul'],
    premium_ativo: true,
    premium_expira_em: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-2',
    titulo: 'Carteira preta com documento parcial',
    descricao: 'Encontrada em cafeteria local. Dados pessoais foram automaticamente ocultados.',
    categoria: 'documentos',
    local_descricao: 'PrÃ³ximo Ã  praÃ§a principal',
    latitude_aproximada: -23.5533,
    longitude_aproximada: -46.6312,
    raio_mascara_metros: 500,
    distancia_metros: 980,
    imagem_url: placeholdersPorCategoria.documentos,
    status: 'publicado',
    criado_em: new Date().toISOString(),
    desafio_pergunta: 'Que figurinha havia dentro da carteira?',
    chat_desbloqueado: false,
    tags_ia: ['documentopessoal', 'carteirapreta'],
    hashtags_ia: ['#DocumentoPessoal', '#CarteiraPreta'],
  },
  {
    id: 'demo-3',
    titulo: 'Fone bluetooth no banco pÃºblico',
    descricao: 'Estojo branco encontrado na Ã¡rea comercial. A prova de posse Ã© exigida antes de liberar o chat.',
    categoria: 'eletronicos',
    local_descricao: 'Ãrea comercial do bairro',
    latitude_aproximada: -23.5561,
    longitude_aproximada: -46.642,
    raio_mascara_metros: 500,
    distancia_metros: 1430,
    imagem_url: placeholdersPorCategoria.eletronicos,
    status: 'publicado',
    criado_em: new Date().toISOString(),
    desafio_pergunta: 'Qual marca estÃ¡ gravada no estojo?',
    chat_desbloqueado: false,
    tags_ia: ['celular'],
    hashtags_ia: ['#Celular'],
  },
]

const categorias: Record<CategoriaItem, { label: string; icon: string }> = {
  chaves: { label: 'Chaves', icon: 'ðŸ”‘' },
  eletronicos: { label: 'Celulares', icon: 'ðŸ“±' },
  documentos: { label: 'Documentos', icon: 'ðŸ‘›' },
  vestuario: { label: 'VestuÃ¡rio', icon: 'ðŸ§¥' },
  outros: { label: 'Pets e outros', icon: 'ðŸ¶' },
}

function haversineDistanceMeters(from: GeoPoint, to: GeoPoint) {
  const earthRadius = 6_371_000
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180
  const lat1 = (from.latitude * Math.PI) / 180
  const lat2 = (to.latitude * Math.PI) / 180

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

function formatDistance(meters: number | null) {
  if (meters === null || Number.isNaN(meters)) return 'DistÃ¢ncia protegida'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

export default function Home() {
  const [itens, setItens] = useState<ItemAchado[]>([])
  const [itemSelecionado, setItemSelecionado] = useState<ItemAchado | null>(null)
  const [modalAtivo, setModalAtivo] = useState<ModalAtivo>(null)
  const [mensagemSistema, setMensagemSistema] = useState('Carregando o Radar local...')
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<CategoriaItem | 'todos'>('todos')
  const [buscaTexto, setBuscaTexto] = useState('')
  const [localUsuario, setLocalUsuario] = useState<GeoPoint | null>(null)
  const [sessao, setSessao] = useState<FoundySession | null>(null)
  const [respostaDesafio, setRespostaDesafio] = useState('')
  const [reivindicacaoId, setReivindicacaoId] = useState<string | null>(null)
  const [salaChatId, setSalaChatId] = useState<string | null>(null)
  const [mensagensChat, setMensagensChat] = useState<MensagemChat[]>([])
  const [mensagemChatAtual, setMensagemChatAtual] = useState('')
  const [chatCarregando, setChatCarregando] = useState(false)
  const [denunciaDisponivel, setDenunciaDisponivel] = useState(false)
  const mapSectionRef = useRef<HTMLDivElement | null>(null)

  const itensFiltrados = useMemo(() => {
    const termo = buscaTexto.trim().toLowerCase()
    return itens.filter((item) => {
      const bateFiltro = filtro === 'todos' || item.categoria === filtro
      if (!bateFiltro) return false
      if (!termo) return true
      const base = `${item.titulo} ${item.descricao} ${(item.hashtags_ia ?? []).join(' ')}`.toLowerCase()
      return base.includes(termo)
    })
  }, [buscaTexto, filtro, itens])

  const getDistance = useCallback(
    (item: ItemAchado) => {
      if (item.distancia_metros !== null) return item.distancia_metros
      if (!localUsuario) return null
      return haversineDistanceMeters(localUsuario, {
        latitude: item.latitude_aproximada,
        longitude: item.longitude_aproximada,
      })
    },
    [localUsuario],
  )

  const carregarItens = useCallback(
    async (latitude?: number, longitude?: number) => {
      setCarregando(true)
      setMensagemSistema('Atualizando itens com privacidade geogrÃ¡fica ativa...')
      try {
        const dados = await buscarItensAchadosProximos({ latitude, longitude })
        const lista = dados
        setItens(lista)
        setItemSelecionado(lista[0] ?? null)
        setMensagemSistema(dados.length > 0 ? 'Radar atualizado com sucesso.' : 'Sem novos itens na sua regiÃ£o por enquanto.')
      } catch (error) {
        setItens([])
        setItemSelecionado(null)
        setMensagemSistema(
          error instanceof Error
            ? error.message
            : 'Servidor indisponível no momento. Tente atualizar novamente em instantes.',
        )
      } finally {
        setCarregando(false)
      }
    },
    [],
  )

  const obterMeuLocal = useCallback(() => {
    if (!navigator.geolocation) {
      setMensagemSistema('Este navegador nÃ£o suporta geolocalizaÃ§Ã£o.')
      return
    }

    setMensagemSistema('Solicitando sua posiÃ§Ã£o para calcular distÃ¢ncias exatas...')
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        const ponto = { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude }
        setLocalUsuario(ponto)
        void carregarItens(ponto.latitude, ponto.longitude)
      },
      () => {
        setMensagemSistema('NÃ£o foi possÃ­vel acessar sua localizaÃ§Ã£o. Mantivemos a busca regional padrÃ£o.')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }, [carregarItens])

  useEffect(() => {
    void carregarItens()
  }, [carregarItens])

  useEffect(() => {
    if (modalAtivo !== 'chat' || !salaChatId || !sessao) return
    setChatCarregando(true)
    void listarMensagensChat(salaChatId, sessao.usuario_id)
      .then((dados) => {
        setMensagensChat(dados)
        setDenunciaDisponivel(dados.some((item) => item.denunciar_extorsao_visivel))
      })
      .catch((error) => {
        setMensagemSistema(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel carregar o chat seguro.')
      })
      .finally(() => setChatCarregando(false))
  }, [modalAtivo, salaChatId, sessao])

  function abrirAcaoRapida() {
    setModalAtivo('acao')
  }

  function selecionarItemNoMapa(item: ItemAchado) {
    setItemSelecionado(item)
    setMensagemSistema(`Mapa focado em ${item.titulo}.`)
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function iniciarFluxoReivindicacao(item: ItemAchado) {
    if (!sessao) {
      setMensagemSistema('VocÃª pode navegar livremente, mas para reivindicar um item Ã© preciso login com e-mail verificado.')
      setModalAtivo('auth')
      return
    }
    setItemSelecionado(item)
    setRespostaDesafio('')
    setReivindicacaoId(null)
    setModalAtivo('desafio')
  }

  async function confirmarRespostaDesafio() {
    if (!sessao || !itemSelecionado) {
      setModalAtivo('auth')
      return
    }
    if (respostaDesafio.trim().length < 2) {
      setMensagemSistema('Digite uma resposta vÃ¡lida para o desafio do dono.')
      return
    }

    try {
      const resultado = await enviarRespostaDesafio(itemSelecionado.id, sessao.usuario_id, respostaDesafio.trim())
      setReivindicacaoId(resultado.reivindicacao_id ?? null)
      setMensagemSistema(resultado.mensagem)
      setModalAtivo('aguardando')
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel enviar a resposta.')
    }
  }

  async function validarRespostaComoEncontrador(aprovada: boolean) {
    if (!sessao || !reivindicacaoId) {
      setMensagemSistema('ReivindicaÃ§Ã£o invÃ¡lida para validaÃ§Ã£o.')
      return
    }

    try {
      const resultado = await validarReivindicacao(reivindicacaoId, {
        aprovada,
        encontrador_usuario_id: sessao.usuario_id,
      })
      setMensagemSistema(resultado.mensagem)
      if (resultado.chat_desbloqueado && resultado.sala_chat_id) {
        setSalaChatId(resultado.sala_chat_id)
        setModalAtivo('chat')
      } else {
        setModalAtivo(null)
      }
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel validar a resposta.')
    }
  }

  async function enviarMensagemNoChat() {
    if (!sessao || !salaChatId || !mensagemChatAtual.trim()) return
    try {
      const enviada = await enviarMensagemChat(salaChatId, sessao.usuario_id, mensagemChatAtual.trim())
      setMensagensChat((atuais) => [...atuais, enviada])
      setMensagemChatAtual('')
      if (enviada.denunciar_extorsao_visivel) {
        setDenunciaDisponivel(true)
      }
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel enviar a mensagem.')
    }
  }

  async function denunciarNoChat() {
    if (!sessao || !salaChatId) return
    try {
      const resposta = await denunciarExtorsao(
        salaChatId,
        sessao.usuario_id,
        'SolicitaÃ§Ã£o indevida de pagamento para devoluÃ§Ã£o do item.',
      )
      setMensagemSistema(resposta.mensagem)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel enviar a denÃºncia.')
    }
  }

  return (
    <main className="min-h-dvh bg-foundy-background text-foundy-foreground">
      <nav className="sticky top-0 z-40 border-b border-foundy-border bg-foundy-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <button className="flex items-center gap-3 text-left" type="button" onClick={() => void carregarItens()}>
            <span className="grid size-10 place-items-center rounded-2xl bg-foundy-blue text-white shadow-lg shadow-foundy-blue/30">
              <MapPin size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-black tracking-wide">FOUNDY.</span>
              <span className="hidden text-xs text-foundy-muted sm:block">Limpo, Seguro e RÃ¡pido</span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              className="hidden h-10 items-center rounded-xl border border-foundy-border px-4 text-sm font-semibold text-foundy-foreground transition hover:border-foundy-blue/60 sm:inline-flex"
              type="button"
              onClick={() => setModalAtivo('auth')}
            >
              {sessao ? `OlÃ¡, ${sessao.nome}` : 'Entrar'}
            </button>
            <button
              className="grid size-10 place-items-center rounded-xl border border-foundy-border text-foundy-foreground transition hover:border-foundy-blue/60"
              type="button"
              aria-label="NotificaÃ§Ãµes"
              onClick={() => setMensagemSistema('As notificaÃ§Ãµes de perÃ­metro ativo aparecerÃ£o aqui em tempo real.')}
            >
              <Bell size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div ref={mapSectionRef} className="relative rounded-3xl border border-foundy-border bg-foundy-surface p-4 shadow-2xl shadow-black/25 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foundy-blue">O Radar hiperlocal</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Mapa com Ã¡rea aproximada e recuperaÃ§Ã£o segura</h1>
            </div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-foundy-border px-4 text-sm font-semibold text-foundy-foreground transition hover:border-foundy-blue/60"
              type="button"
              onClick={obterMeuLocal}
            >
              <LocateFixed size={17} aria-hidden="true" />
              Perto de mim
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-x-3 top-3 z-20 rounded-2xl border border-foundy-border bg-foundy-surface/95 p-3 shadow-xl backdrop-blur">
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-foundy-border bg-foundy-background px-3">
                <Search size={16} aria-hidden="true" className="text-foundy-muted" />
                <input
                  className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-foundy-muted"
                  placeholder="Buscar por tÃ­tulo, descriÃ§Ã£o ou hashtag..."
                  value={buscaTexto}
                  onChange={(event) => setBuscaTexto(event.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    filtro === 'todos'
                      ? 'border-foundy-blue bg-foundy-blue text-white'
                      : 'border-foundy-border text-foundy-foreground'
                  }`}
                  type="button"
                  onClick={() => setFiltro('todos')}
                >
                  Todos
                </button>
                {(Object.keys(categorias) as CategoriaItem[]).map((categoria) => (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      filtro === categoria
                        ? 'border-foundy-blue bg-foundy-blue text-white'
                        : 'border-foundy-border text-foundy-foreground'
                    }`}
                    key={categoria}
                    type="button"
                    onClick={() => setFiltro(categoria)}
                  >
                    <span className="mr-1">{categorias[categoria].icon}</span>
                    {categorias[categoria].label}
                  </button>
                ))}
              </div>
            </div>

            <MapaInterativo itens={itensFiltrados} itemSelecionado={itemSelecionado} onSelecionarItem={setItemSelecionado} />
          </div>

          <div className="mt-4 rounded-2xl border border-foundy-border bg-foundy-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Escudo de privacidade geogrÃ¡fica ativo</p>
                <p className="mt-1 text-sm text-foundy-muted">
                  O mapa revela somente raio aproximado. Telefone, e-mail e endereÃ§o exato ficam protegidos.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-foundy-green/20 px-3 py-2 text-xs font-bold text-foundy-green">
                <ShieldCheck size={15} aria-hidden="true" />
                SeguranÃ§a aplicada
              </span>
            </div>
          </div>
        </div>

        <section className="grid gap-4" aria-label="Feed de itens achados">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black tracking-tight">Itens achados perto de vocÃª</h2>
              <p className="text-sm text-foundy-muted" aria-live="polite">
                {mensagemSistema}
              </p>
            </div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-foundy-border px-3 text-sm font-semibold text-foundy-foreground transition hover:border-foundy-blue/60"
              type="button"
              onClick={() => void carregarItens(localUsuario?.latitude, localUsuario?.longitude)}
            >
              <Sparkles size={16} aria-hidden="true" />
              Atualizar
            </button>
          </div>

          {itensFiltrados.map((item) => (
            <article className="overflow-hidden rounded-3xl border border-foundy-border bg-foundy-surface" key={item.id}>
              <div className="relative h-52 overflow-hidden">
                <img
                  src={item.imagem_url ?? placeholdersPorCategoria[item.categoria]}
                  alt={`Imagem do item ${item.titulo}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
                  {categorias[item.categoria].icon} {categorias[item.categoria].label}
                </div>
                <div className="absolute bottom-3 right-3 rounded-full bg-foundy-blue px-3 py-1 text-xs font-bold text-white">
                  {formatDistance(getDistance(item))}
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">{item.titulo}</h3>
                    <p className="text-sm text-foundy-muted">{item.local_descricao ?? 'Local aproximado protegido'}</p>
                  </div>
                  {item.premium_ativo ? (
                    <span className="rounded-full bg-foundy-green/20 px-3 py-1 text-xs font-bold text-foundy-green">Boost ativo</span>
                  ) : null}
                </div>

                <p className="text-sm leading-6 text-foundy-muted">{item.descricao}</p>

                {(item.hashtags_ia ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(item.hashtags_ia ?? []).map((tag) => (
                      <span className="rounded-full bg-foundy-blue/15 px-3 py-1 text-xs font-semibold text-foundy-blue" key={`${item.id}-${tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-xl bg-foundy-green px-4 py-2 text-sm font-black text-slate-950 transition hover:brightness-110"
                    type="button"
                    onClick={() => iniciarFluxoReivindicacao(item)}
                  >
                    Ã‰ meu
                  </button>
                  <button
                    className="rounded-xl border border-foundy-border px-4 py-2 text-sm font-semibold text-foundy-foreground"
                    type="button"
                    onClick={() => selecionarItemNoMapa(item)}
                  >
                    Ver no mapa
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!carregando && itensFiltrados.length === 0 ? (
            <article className="rounded-3xl border border-dashed border-foundy-border bg-foundy-surface/70 p-6 text-center">
              <p className="text-base font-black text-foundy-foreground">Nenhum item encontrado por enquanto</p>
              <p className="mt-2 text-sm text-foundy-muted">
                Assim que um novo item compatível aparecer na sua região, ele será exibido aqui com localização aproximada.
              </p>
            </article>
          ) : null}

          {carregando ? <p className="text-sm text-foundy-muted">Atualizando feed em tempo real...</p> : null}
        </section>
      </section>

      <button
        className="fixed bottom-6 left-1/2 z-40 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-foundy-blue text-white shadow-2xl shadow-foundy-blue/35 transition hover:scale-105"
        type="button"
        aria-label="Abrir aÃ§Ãµes rÃ¡pidas"
        onClick={abrirAcaoRapida}
      >
        <Plus size={28} aria-hidden="true" />
      </button>

      {modalAtivo === 'auth' ? (
        <ModalAutenticacao
          onClose={() => setModalAtivo(null)}
          onSessaoAtiva={(novaSessao) => {
            setSessao(novaSessao)
            setMensagemSistema(`Login confirmado. Bem-vindo, ${novaSessao.nome}.`)
            setModalAtivo(null)
          }}
        />
      ) : null}

      {modalAtivo === 'acao' ? (
        <ModalAcaoRapida
          onClose={() => setModalAtivo(null)}
          onEscolherAchei={() => {
            if (!sessao) {
              setMensagemSistema('Para publicar item achado Ã© necessÃ¡rio login com e-mail verificado.')
              setModalAtivo('auth')
              return
            }
            setModalAtivo('item')
          }}
          onEscolherPerdi={() => {
            if (!sessao) {
              setMensagemSistema('Para criar perÃ­metro de perda Ã© necessÃ¡rio login com e-mail verificado.')
              setModalAtivo('auth')
              return
            }
            setModalAtivo('perdi')
          }}
        />
      ) : null}

      {modalAtivo === 'item' && sessao ? (
        <ModalItemAchado
          sessao={sessao}
          onClose={() => setModalAtivo(null)}
          onPublicado={(item) => {
            setItens((atuais) => [item, ...atuais])
            setItemSelecionado(item)
            setMensagemSistema('Item publicado com seguranÃ§a. O desafio oculto foi salvo.')
            setModalAtivo(null)
          }}
        />
      ) : null}

      {modalAtivo === 'perdi' && sessao ? (
        <ModalPerdiAlgo
          sessao={sessao}
          pontoInicial={localUsuario ?? defaultPoint}
          onClose={() => setModalAtivo(null)}
          onCriado={(mensagem) => {
            setMensagemSistema(mensagem)
            setModalAtivo(null)
          }}
        />
      ) : null}

      {modalAtivo === 'desafio' && itemSelecionado ? (
        <ModalDesafio
          item={itemSelecionado}
          resposta={respostaDesafio}
          onRespostaChange={setRespostaDesafio}
          onConfirmar={() => void confirmarRespostaDesafio()}
          onClose={() => setModalAtivo(null)}
        />
      ) : null}

      {modalAtivo === 'aguardando' ? (
        <ModalAguardandoValidacao
          reivindicacaoId={reivindicacaoId}
          onClose={() => setModalAtivo(null)}
          onValidar={(aprovada) => void validarRespostaComoEncontrador(aprovada)}
        />
      ) : null}

      {modalAtivo === 'chat' && itemSelecionado ? (
        <ModalChatSeguro
          item={itemSelecionado}
          chatCarregando={chatCarregando}
          mensagens={mensagensChat}
          valorAtual={mensagemChatAtual}
          onChangeValor={setMensagemChatAtual}
          onEnviar={() => void enviarMensagemNoChat()}
          onDenunciar={() => void denunciarNoChat()}
          denunciarDisponivel={denunciaDisponivel}
          onClose={() => setModalAtivo(null)}
        />
      ) : null}
    </main>
  )
}

function ModalBase({
  titulo,
  subtitulo,
  children,
  onClose,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-3 backdrop-blur sm:place-items-center" role="presentation">
      <section
        className="max-h-[92dvh] w-full max-w-2xl overflow-auto rounded-3xl border border-foundy-border bg-foundy-surface text-foundy-foreground shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
      >
        <header className="flex items-start justify-between gap-3 border-b border-foundy-border p-4">
          <div>
            <h2 className="text-lg font-black tracking-tight" id="modal-titulo">
              {titulo}
            </h2>
            {subtitulo ? <p className="mt-1 text-sm text-foundy-muted">{subtitulo}</p> : null}
          </div>
          <button
            className="grid size-9 place-items-center rounded-xl border border-foundy-border text-foundy-foreground"
            type="button"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function ModalAutenticacao({
  onSessaoAtiva,
  onClose,
}: {
  onSessaoAtiva: (sessao: FoundySession) => void
  onClose: () => void
}) {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState('Confirme seu e-mail para publicar, criar alertas e usar o chat.')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setEnviando(true)
    try {
      if (modo === 'cadastrar') {
        const resposta = await cadastrarUsuario({ nome, email, senha })
        setMensagem(resposta.mensagem)
      } else {
        const resposta = await entrarUsuario({ email, senha })
        setMensagem(`SessÃ£o iniciada. Badge atual: ${resposta.badge_publica}.`)
        onSessaoAtiva(resposta)
      }
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel concluir a autenticaÃ§Ã£o.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalBase titulo={modo === 'entrar' ? 'Entrar na Foundy' : 'Criar conta segura'} onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-foundy-background p-1">
          <button
            className={`rounded-xl px-3 py-2 text-sm font-bold ${modo === 'entrar' ? 'bg-foundy-blue text-white' : 'text-foundy-muted'}`}
            type="button"
            onClick={() => setModo('entrar')}
          >
            Entrar
          </button>
          <button
            className={`rounded-xl px-3 py-2 text-sm font-bold ${modo === 'cadastrar' ? 'bg-foundy-blue text-white' : 'text-foundy-muted'}`}
            type="button"
            onClick={() => setModo('cadastrar')}
          >
            Cadastrar
          </button>
        </div>

        {modo === 'cadastrar' ? (
          <label className="grid gap-2 text-sm font-semibold">
            Nome
            <input
              className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
              placeholder="Seu nome"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
            />
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-semibold">
          E-mail
          <input
            className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
            placeholder="voce@email.com"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Senha
          <input
            className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
            placeholder="Sua senha segura"
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
          />
        </label>

        <p className="rounded-xl border border-foundy-blue/30 bg-foundy-blue/10 p-3 text-sm text-foundy-blue" aria-live="polite">
          {mensagem}
        </p>
        <button
          className="h-11 rounded-xl bg-foundy-blue px-4 text-sm font-black text-white"
          type="button"
          disabled={enviando}
          onClick={() => void enviar()}
        >
          {enviando ? 'Enviando...' : modo === 'entrar' ? 'Entrar com e-mail verificado' : 'Criar conta e receber verificaÃ§Ã£o'}
        </button>
      </div>
    </ModalBase>
  )
}

function ModalAcaoRapida({
  onClose,
  onEscolherPerdi,
  onEscolherAchei,
}: {
  onClose: () => void
  onEscolherPerdi: () => void
  onEscolherAchei: () => void
}) {
  return (
    <ModalBase titulo="Nova aÃ§Ã£o rÃ¡pida" subtitulo="Selecione o fluxo ideal para seu caso." onClose={onClose}>
      <div className="grid gap-3 p-4">
        <button
          className="inline-flex h-14 items-center justify-between rounded-2xl bg-red-500 px-4 text-left text-white"
          type="button"
          onClick={onEscolherPerdi}
        >
          <span>
            <strong className="block">Perdi algo</strong>
            <span className="text-sm opacity-90">Criar perÃ­metro ativo de busca</span>
          </span>
          <MapPin size={18} aria-hidden="true" />
        </button>
        <button
          className="inline-flex h-14 items-center justify-between rounded-2xl bg-foundy-green px-4 text-left text-slate-950"
          type="button"
          onClick={onEscolherAchei}
        >
          <span>
            <strong className="block">Achei algo</strong>
            <span className="text-sm opacity-90">Publicar item com desafio oculto</span>
          </span>
          <CheckCircle2 size={18} aria-hidden="true" />
        </button>
      </div>
    </ModalBase>
  )
}

function ModalItemAchado({
  sessao,
  onClose,
  onPublicado,
}: {
  sessao: FoundySession
  onClose: () => void
  onPublicado: (item: ItemAchado) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<CategoriaItem>('outros')
  const [local, setLocal] = useState('')
  const [desafio, setDesafio] = useState('')
  const [detalheOculto, setDetalheOculto] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [coords, setCoords] = useState<GeoPoint>(defaultPoint)
  const [processandoImagem, setProcessandoImagem] = useState(false)
  const [tagsImagem, setTagsImagem] = useState<string[]>([])
  const [textoPadronizado, setTextoPadronizado] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('A imagem serÃ¡ processada com filtro automÃ¡tico de privacidade.')

  function usarGeolocalizacao() {
    if (!navigator.geolocation) {
      setMensagem('GeolocalizaÃ§Ã£o indisponÃ­vel neste navegador.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setCoords({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude })
        setMensagem('Local capturado. O sistema armazenarÃ¡ apenas uma Ã¡rea aproximada.')
      },
      () => setMensagem('NÃ£o foi possÃ­vel capturar sua localizaÃ§Ã£o. Informe um ponto de referÃªncia.'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  async function publicar() {
    if (!titulo.trim() || !descricao.trim() || !desafio.trim() || !detalheOculto.trim()) {
      setMensagem('Preencha tÃ­tulo, descriÃ§Ã£o, desafio e detalhe oculto para continuar.')
      return
    }
    try {
      const item = await cadastrarItemAchado({
        titulo,
        descricao,
        categoria,
        latitude: coords.latitude,
        longitude: coords.longitude,
        local_descricao: local,
        desafio_pergunta: desafio,
        detalhe_oculto: detalheOculto,
        imagem_url: imagemUrl || null,
        tags_ia: tagsImagem.map((tag) => tag.replace(/^#/, '')),
        usuario_id: sessao.usuario_id,
      })
      onPublicado(item)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel publicar o item.')
    }
  }

  async function processarImagemSelecionada(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setProcessandoImagem(true)
    try {
      const resultado = await processarImagemComPrivacidade(file, `${titulo} ${descricao}`)
      setImagemUrl(resultado.imagem_data_url)
      setTagsImagem(resultado.hashtags_ia)
      setTextoPadronizado(resultado.texto_publico_padronizado)
      setMensagem('Imagem processada: faces e documentos foram protegidos antes da publicaÃ§Ã£o.')
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha ao processar a imagem.')
    } finally {
      setProcessandoImagem(false)
    }
  }

  return (
    <ModalBase titulo="Cadastrar item achado" subtitulo="Somente usuÃ¡rios verificados podem publicar." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            TÃ­tulo
            <input
              className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ex.: Chave com fita azul"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Categoria
            <select
              className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
              value={categoria}
              onChange={(event) => setCategoria(event.target.value as CategoriaItem)}
            >
              <option value="documentos">Documentos</option>
              <option value="eletronicos">EletrÃ´nicos</option>
              <option value="chaves">Chaves</option>
              <option value="vestuario">VestuÃ¡rio</option>
              <option value="outros">Outros</option>
            </select>
          </label>
        </div>

        <label className="grid gap-2 text-sm font-semibold">
          DescriÃ§Ã£o pÃºblica
          <textarea
            className="min-h-24 rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            placeholder="Descreva sem expor telefone, e-mail ou endereÃ§o exato."
          />
        </label>
        <div className="grid gap-2">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-foundy-border text-sm font-bold"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={17} aria-hidden="true" />
            {processandoImagem ? 'Processando imagem...' : 'Upload de imagem com filtro de privacidade'}
          </button>
          <input
            accept="image/*"
            className="sr-only"
            ref={fileInputRef}
            type="file"
            onChange={(event) => void processarImagemSelecionada(event)}
          />
          {imagemUrl ? <img src={imagemUrl} alt="PrÃ©via protegida do item" className="h-44 w-full rounded-2xl object-cover" /> : null}
          {textoPadronizado ? (
            <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">
              Texto pÃºblico padronizado: <strong>{textoPadronizado}</strong>
            </p>
          ) : null}
          {tagsImagem.length > 0 ? (
            <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">
              Tags sugeridas automaticamente: {tagsImagem.join(' ')}
            </p>
          ) : null}
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          Local aproximado
          <input
            className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
            value={local}
            onChange={(event) => setLocal(event.target.value)}
            placeholder="Ex.: perto da praÃ§a ou estaÃ§Ã£o"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Desafio do dono
            <input
              className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
              value={desafio}
              onChange={(event) => setDesafio(event.target.value)}
              placeholder="Ex.: Qual detalhe interno?"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Detalhe oculto
            <input
              className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
              value={detalheOculto}
              onChange={(event) => setDetalheOculto(event.target.value)}
              placeholder="Resposta que sÃ³ o dono sabe"
            />
          </label>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-foundy-border text-sm font-bold"
          type="button"
          onClick={usarGeolocalizacao}
        >
          <Camera size={17} aria-hidden="true" />
          Usar minha localizaÃ§Ã£o
        </button>
        <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
        <button className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" type="button" onClick={() => void publicar()}>
          Publicar com detalhe oculto
        </button>
      </div>
    </ModalBase>
  )
}

function ModalPerdiAlgo({
  sessao,
  pontoInicial,
  onClose,
  onCriado,
}: {
  sessao: FoundySession
  pontoInicial: GeoPoint
  onClose: () => void
  onCriado: (mensagem: string) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [hashtags, setHashtags] = useState('#chave #fitaazul')
  const [ponto, setPonto] = useState<GeoPoint>(pontoInicial)
  const [raio, setRaio] = useState(5000)
  const [mensagem, setMensagem] = useState('Toque no mapa para posicionar o centro do perÃ­metro de perda.')

  function usarMeuLocal() {
    if (!navigator.geolocation) {
      setMensagem('GeolocalizaÃ§Ã£o indisponÃ­vel neste navegador.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setPonto({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude })
        setMensagem('Centro do perÃ­metro ajustado para sua posiÃ§Ã£o atual.')
      },
      () => setMensagem('NÃ£o foi possÃ­vel obter sua posiÃ§Ã£o. VocÃª pode tocar no mapa para escolher outro ponto.'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  async function criar() {
    if (!titulo.trim() || !descricao.trim()) {
      setMensagem('Preencha tÃ­tulo e descriÃ§Ã£o para ativar o perÃ­metro.')
      return
    }
    const parsedHashtags = hashtags
      .split(/[\s,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => tag.replace(/^#/, ''))
    try {
      const resposta = await criarAlertaPerdido({
        usuario_id: sessao.usuario_id,
        titulo,
        descricao,
        hashtags: parsedHashtags,
        latitude: ponto.latitude,
        longitude: ponto.longitude,
        raio_metros: raio,
      })
      onCriado(resposta.mensagem)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel criar o alerta perdido.')
    }
  }

  return (
    <ModalBase
      titulo="PerÃ­metro ativo de perda"
      subtitulo="Se um item compatÃ­vel entrar nesta Ã¡rea, vocÃª recebe alerta instantÃ¢neo."
      onClose={onClose}
    >
      <div className="grid gap-4 p-4">
        <label className="grid gap-2 text-sm font-semibold">
          TÃ­tulo do item perdido
          <input
            className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder="Ex.: Perdi meu celular preto"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          DescriÃ§Ã£o
          <textarea
            className="min-h-24 rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            placeholder="Detalhes importantes para matching seguro"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Hashtags
          <input
            className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
            value={hashtags}
            onChange={(event) => setHashtags(event.target.value)}
            placeholder="#chave #mickey #fitaazul"
          />
        </label>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-foundy-border text-sm font-semibold"
          type="button"
          onClick={usarMeuLocal}
        >
          <LocateFixed size={16} aria-hidden="true" />
          Usar minha posiÃ§Ã£o atual
        </button>

        <MapaPerimetro center={ponto} radius={raio} onCenterChange={setPonto} />

        <label className="grid gap-2 text-sm font-semibold">
          Raio do perÃ­metro ({Math.round(raio / 1000)} km)
          <input
            type="range"
            min={500}
            max={50000}
            step={500}
            value={raio}
            onChange={(event) => setRaio(Number(event.target.value))}
          />
        </label>

        <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
        <button className="h-11 rounded-xl bg-red-500 px-4 text-sm font-black text-white" type="button" onClick={() => void criar()}>
          Ativar perÃ­metro de perda
        </button>
      </div>
    </ModalBase>
  )
}

function ModalDesafio({
  item,
  resposta,
  onRespostaChange,
  onConfirmar,
  onClose,
}: {
  item: ItemAchado
  resposta: string
  onRespostaChange: (value: string) => void
  onConfirmar: () => void
  onClose: () => void
}) {
  return (
    <ModalBase titulo="VerificaÃ§Ã£o do dono" subtitulo="O chat sÃ³ abre apÃ³s validaÃ§Ã£o do detalhe oculto." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-2xl border border-foundy-blue/30 bg-foundy-blue/10 p-4">
          <p className="text-sm font-bold text-foundy-blue">Desafio do dono</p>
          <p className="mt-1">{item.desafio_pergunta ?? 'Informe um detalhe que sÃ³ o dono saberia.'}</p>
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          Sua resposta
          <input
            className="rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
            value={resposta}
            onChange={(event) => onRespostaChange(event.target.value)}
            placeholder="Digite o detalhe oculto"
          />
        </label>
        <button className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" type="button" onClick={onConfirmar}>
          Enviar resposta
        </button>
      </div>
    </ModalBase>
  )
}

function ModalAguardandoValidacao({
  reivindicacaoId,
  onClose,
  onValidar,
}: {
  reivindicacaoId: string | null
  onClose: () => void
  onValidar: (aprovada: boolean) => void
}) {
  return (
    <ModalBase titulo="Aguardando validaÃ§Ã£o do encontrador" onClose={onClose}>
      <div className="grid gap-4 p-4">
        <p className="text-sm text-foundy-muted">
          O encontrador precisa confirmar se a resposta estÃ¡ correta. ReivindicaÃ§Ã£o atual: <strong>{reivindicacaoId ?? 'nÃ£o identificada'}</strong>.
        </p>
        <div className="rounded-2xl border border-amber-300/30 bg-amber-200/10 p-4 text-sm text-amber-100">
          Fluxo de teste: para simular o papel do encontrador neste protÃ³tipo, use os botÃµes abaixo.
        </div>
        <button
          className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950"
          type="button"
          onClick={() => onValidar(true)}
        >
          A resposta estÃ¡ correta
        </button>
        <button className="h-11 rounded-xl bg-red-500 px-4 text-sm font-black text-white" type="button" onClick={() => onValidar(false)}>
          A resposta estÃ¡ incorreta
        </button>
      </div>
    </ModalBase>
  )
}

function ModalChatSeguro({
  item,
  chatCarregando,
  mensagens,
  valorAtual,
  onChangeValor,
  onEnviar,
  onDenunciar,
  denunciarDisponivel,
  onClose,
}: {
  item: ItemAchado
  chatCarregando: boolean
  mensagens: MensagemChat[]
  valorAtual: string
  onChangeValor: (value: string) => void
  onEnviar: () => void
  onDenunciar: () => void
  denunciarDisponivel: boolean
  onClose: () => void
}) {
  return (
    <ModalBase titulo="Chat privado de recuperaÃ§Ã£o" subtitulo={`Item: ${item.titulo}`} onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-2xl border border-foundy-green/30 bg-foundy-green/15 p-4 text-sm text-foundy-green">
          <CheckCircle2 className="mb-2" size={18} aria-hidden="true" />
          Chat desbloqueado com protocolo de seguranÃ§a. Combine a devoluÃ§Ã£o em local pÃºblico e monitorado.
        </div>

        <div className="max-h-64 space-y-2 overflow-auto rounded-2xl border border-foundy-border bg-foundy-background p-3">
          {chatCarregando ? <p className="text-sm text-foundy-muted">Carregando mensagens...</p> : null}
          {!chatCarregando && mensagens.length === 0 ? (
            <p className="text-sm text-foundy-muted">Nenhuma mensagem ainda. Envie a primeira mensagem segura.</p>
          ) : null}
          {mensagens.map((mensagem) => (
            <article
              className={`rounded-xl p-3 text-sm ${
                mensagem.status_moderacao === 'suspeita_extorsao' ? 'border border-red-500/40 bg-red-500/10' : 'bg-foundy-surface'
              }`}
              key={mensagem.id}
            >
              <p>{mensagem.mensagem}</p>
              <p className="mt-1 text-xs text-foundy-muted">{new Date(mensagem.criado_em).toLocaleString('pt-BR')}</p>
            </article>
          ))}
        </div>

        <label className="grid gap-2 text-sm font-semibold">
          Mensagem
          <textarea
            className="min-h-24 rounded-xl border border-foundy-border bg-foundy-background px-3 py-3 outline-none focus:border-foundy-blue"
            placeholder="Digite uma mensagem respeitosa e sem solicitar pagamento."
            value={valorAtual}
            onChange={(event) => onChangeValor(event.target.value)}
          />
        </label>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foundy-blue px-4 text-sm font-black text-white" type="button" onClick={onEnviar}>
          <Send size={16} aria-hidden="true" />
          Enviar mensagem
        </button>

        {denunciarDisponivel ? (
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-black text-white" type="button" onClick={onDenunciar}>
            <Flag size={16} aria-hidden="true" />
            Denunciar ExtorsÃ£o
          </button>
        ) : (
          <div className="rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">
            O botÃ£o de denÃºncia Ã© ativado automaticamente se houver tentativa de cobranÃ§a indevida.
          </div>
        )}

        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">
          <AlertTriangle className="mb-2" size={16} aria-hidden="true" />
          Se alguÃ©m pedir PIX, pagamento, cobranÃ§a ou resgate para devolver o item, denuncie imediatamente.
        </div>
      </div>
    </ModalBase>
  )
}

