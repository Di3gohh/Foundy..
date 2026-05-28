'use client'

import dynamic from 'next/dynamic'
import {
  Ban,
  Bell,
  Camera,
  CheckCircle2,
  Flag,
  Inbox,
  KeyRound,
  LocateFixed,
  LogOut,
  MapPin,
  MessageCircle,
  PawPrint,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  Smartphone,
  Trash2,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { ChangeEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  adminArquivarItem,
  adminBanirUsuario,
  atualizarPerfil,
  buscarItensAchadosProximos,
  buscarPainelAdmin,
  buscarPainelUsuario,
  cadastrarItemAchado,
  cadastrarUsuario,
  confirmarDevolucaoComAvaliacao,
  criarAlertaPerdido,
  denunciarExtorsao,
  entrarUsuario,
  enviarMensagemChat,
  enviarRespostaDesafio,
  listarMensagensChat,
  listarNotificacoes,
  marcarNotificacaoLida,
  processarImagemComPrivacidade,
  validarReivindicacao,
  type ChatSummary,
  type FoundySession,
  type ItemAchado,
  type ItemCategory,
  type MensagemChat,
  type NotificationItem,
  type UserDashboard,
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
      Carregando mapa do perimetro...
    </div>
  ),
})

type ModalAtivo =
  | 'auth'
  | 'acao'
  | 'item'
  | 'perdi'
  | 'desafio'
  | 'aguardando'
  | 'chat'
  | 'busca'
  | 'seguranca'
  | 'termos'
  | 'perfil'
  | 'notificacoes'
  | 'chats'
  | 'onboarding'
  | 'admin'
  | null

type GeoPoint = { latitude: number; longitude: number }
type MainTab = 'radar' | 'usuario' | 'seguranca'

const defaultPoint: GeoPoint = { latitude: -23.55052, longitude: -46.633308 }
const sessionStorageKey = 'foundy-session-v2'
const firstVisitKey = 'foundy-first-visit-v2'
const onboardingKey = 'foundy-onboarding-v2'
const supportEmail = 'foundy.company@gmail.com'
const supportMailto = `mailto:${supportEmail}?subject=Contato%20Foundy`

const placeholdersPorCategoria: Record<ItemCategory, string> = {
  chaves: 'https://images.unsplash.com/photo-1592887102811-2f9f67f7f05b?auto=format&fit=crop&w=1200&q=80',
  eletronicos: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
  documentos: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
  vestuario: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  outros: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80',
}

const categorias: Record<ItemCategory, { label: string; description: string; Icon: LucideIcon }> = {
  chaves: { label: 'Chaves', description: 'Chaves, chaveiros e controles pequenos.', Icon: KeyRound },
  eletronicos: { label: 'Celulares', description: 'Celulares, fones e acessorios digitais.', Icon: Smartphone },
  documentos: { label: 'Documentos', description: 'Carteiras, RG, CPF e credenciais.', Icon: Wallet },
  vestuario: { label: 'Vestuario', description: 'Jaquetas, bones, mochilas e pecas pessoais.', Icon: Shirt },
  outros: { label: 'Pets e outros', description: 'Pets, coleiras, brinquedos e objetos diversos.', Icon: PawPrint },
}

const itensDemonstracao: ItemAchado[] = [
  {
    id: 'demo-1',
    titulo: 'Chave Yale com chaveiro azul',
    descricao: 'Encontrada perto da saida principal da estacao. O endereco exato foi mascarado.',
    categoria: 'chaves',
    local_descricao: 'Regiao da estacao central',
    latitude_aproximada: -23.5489,
    longitude_aproximada: -46.6372,
    raio_mascara_metros: 500,
    distancia_metros: 620,
    imagem_url: placeholdersPorCategoria.chaves,
    status: 'publicado',
    criado_em: new Date().toISOString(),
    desafio_pergunta: 'Qual detalhe so o dono saberia informar?',
    chat_desbloqueado: false,
    tags_ia: ['chaveyale', 'fitaazul'],
    hashtags_ia: ['#ChaveYale', '#FitaAzul'],
  },
  {
    id: 'demo-2',
    titulo: 'Carteira preta com documento protegido',
    descricao: 'Encontrada em cafeteria local. Dados pessoais devem ser descritos apenas pelo verdadeiro dono.',
    categoria: 'documentos',
    local_descricao: 'Proximo a praca principal',
    latitude_aproximada: -23.5533,
    longitude_aproximada: -46.6312,
    raio_mascara_metros: 500,
    distancia_metros: 980,
    imagem_url: placeholdersPorCategoria.documentos,
    status: 'publicado',
    criado_em: new Date().toISOString(),
    desafio_pergunta: 'Que documento havia dentro da carteira?',
    chat_desbloqueado: false,
    tags_ia: ['documentopessoal', 'carteirapreta'],
    hashtags_ia: ['#DocumentoPessoal', '#CarteiraPreta'],
  },
]

function haversineDistanceMeters(from: GeoPoint, to: GeoPoint) {
  const earthRadius = 6_371_000
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180
  const lat1 = (from.latitude * Math.PI) / 180
  const lat2 = (to.latitude * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number | null) {
  if (meters === null || Number.isNaN(meters)) return 'Distancia protegida'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

function isAdmin(session: FoundySession | null) {
  return session?.is_admin === 'true'
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<MainTab>('radar')
  const [itens, setItens] = useState<ItemAchado[]>([])
  const [itemSelecionado, setItemSelecionado] = useState<ItemAchado | null>(null)
  const [modalAtivo, setModalAtivo] = useState<ModalAtivo>(null)
  const [mensagemSistema, setMensagemSistema] = useState('Carregando o Radar local...')
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<ItemCategory | 'todos'>('todos')
  const [buscaTexto, setBuscaTexto] = useState('')
  const [localUsuario, setLocalUsuario] = useState<GeoPoint | null>(null)
  const [sessao, setSessao] = useState<FoundySession | null>(null)
  const [painel, setPainel] = useState<UserDashboard | null>(null)
  const [notificacoes, setNotificacoes] = useState<NotificationItem[]>([])
  const [respostaDesafio, setRespostaDesafio] = useState('')
  const [reivindicacaoId, setReivindicacaoId] = useState<string | null>(null)
  const [salaChatId, setSalaChatId] = useState<string | null>(null)
  const [chatAtual, setChatAtual] = useState<ChatSummary | null>(null)
  const [mensagensChat, setMensagensChat] = useState<MensagemChat[]>([])
  const [mensagemChatAtual, setMensagemChatAtual] = useState('')
  const [chatCarregando, setChatCarregando] = useState(false)
  const [denunciaDisponivel, setDenunciaDisponivel] = useState(false)
  const [adminData, setAdminData] = useState<{ usuarios: unknown[]; itens: ItemAchado[]; moderacao: unknown[] } | null>(null)
  const mapSectionRef = useRef<HTMLDivElement | null>(null)

  const carregarPainel = useCallback(async (session: FoundySession) => {
    try {
      const dados = await buscarPainelUsuario(session.usuario_id)
      setPainel(dados)
      setNotificacoes(dados.notificacoes)
      setSessao((atual) => (atual ? { ...atual, ...dados.usuario } : dados.usuario))
      localStorage.setItem(sessionStorageKey, JSON.stringify({ ...session, ...dados.usuario }))
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Nao foi possivel carregar sua area.')
    }
  }, [])

  const carregarItens = useCallback(async (latitude?: number, longitude?: number, selecionarPrimeiro = true) => {
    setCarregando(true)
    setMensagemSistema('Atualizando itens com privacidade geografica ativa...')
    try {
      const dados = await buscarItensAchadosProximos({ latitude, longitude })
      const lista = dados.length > 0 ? dados : itensDemonstracao
      setItens(lista)
      setItemSelecionado((atual) => (selecionarPrimeiro ? atual ?? lista[0] ?? null : atual))
      setMensagemSistema(dados.length > 0 ? 'Radar atualizado com sucesso.' : 'Mostrando exemplos ate surgirem itens reais na regiao.')
    } catch (error) {
      setItens(itensDemonstracao)
      setItemSelecionado(itensDemonstracao[0])
      setMensagemSistema(error instanceof Error ? error.message : 'Servidor indisponivel. Mostrando modo demonstracao.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarItens()
    const stored = localStorage.getItem(sessionStorageKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FoundySession
        setSessao(parsed)
        void carregarPainel(parsed)
      } catch {
        localStorage.removeItem(sessionStorageKey)
      }
      return
    }

    if (!localStorage.getItem(firstVisitKey)) {
      localStorage.setItem(firstVisitKey, '1')
      setModalAtivo('auth')
    }
  }, [carregarItens, carregarPainel])

  useEffect(() => {
    if (!sessao) return
    const timer = window.setInterval(() => {
      void carregarPainel(sessao)
      void listarNotificacoes(sessao.usuario_id).then(setNotificacoes).catch(() => undefined)
    }, 7000)
    return () => window.clearInterval(timer)
  }, [carregarPainel, sessao])

  useEffect(() => {
    if (modalAtivo !== 'chat' || !salaChatId || !sessao) return
    let active = true

    async function refreshChat() {
      if (!salaChatId || !sessao) return
      setChatCarregando(true)
      try {
        const dados = await listarMensagensChat(salaChatId, sessao.usuario_id)
        if (!active) return
        setMensagensChat(dados)
        setDenunciaDisponivel(dados.some((item) => item.denunciar_extorsao_visivel))
      } catch (error) {
        setMensagemSistema(error instanceof Error ? error.message : 'Nao foi possivel carregar o chat seguro.')
      } finally {
        if (active) setChatCarregando(false)
      }
    }

    void refreshChat()
    const timer = window.setInterval(refreshChat, 2500)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [modalAtivo, salaChatId, sessao])

  useEffect(() => {
    if (modalAtivo !== 'chat' || !salaChatId || !sessao) return
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return
    const realtimeSupabaseUrl: string = supabaseUrl
    const realtimeSupabaseKey: string = supabaseKey

    let cleanup: (() => void) | undefined
    let cancelled = false

    async function startRealtime() {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        if (cancelled || !salaChatId || !sessao) return
        const client = createClient(realtimeSupabaseUrl, realtimeSupabaseKey)
        const channel = client
          .channel(`foundy-chat-${salaChatId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'mensagens_chat', filter: `sala_chat_id=eq.${salaChatId}` },
            () => {
              void listarMensagensChat(salaChatId, sessao.usuario_id).then((dados) => {
                setMensagensChat(dados)
                setDenunciaDisponivel(dados.some((item) => item.denunciar_extorsao_visivel))
              })
              void carregarPainel(sessao)
            },
          )
          .subscribe()

        cleanup = () => {
          void client.removeChannel(channel)
        }
      } catch {
        setMensagemSistema('Tempo real indisponivel agora. Mantivemos atualizacao automatica por seguranca.')
      }
    }

    void startRealtime()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [carregarPainel, modalAtivo, salaChatId, sessao])

  const itensFiltrados = useMemo(() => {
    const termo = buscaTexto.trim().toLowerCase()
    return itens.filter((item) => {
      const bateFiltro = filtro === 'todos' || item.categoria === filtro
      if (!bateFiltro) return false
      if (!termo) return true
      return `${item.titulo} ${item.descricao} ${(item.hashtags_ia ?? []).join(' ')}`.toLowerCase().includes(termo)
    })
  }, [buscaTexto, filtro, itens])

  const unreadCount = notificacoes.filter((item) => !item.lida_em).length

  function salvarSessao(novaSessao: FoundySession) {
    setSessao(novaSessao)
    localStorage.setItem(sessionStorageKey, JSON.stringify(novaSessao))
    setMensagemSistema(`Login confirmado. Bem-vindo, ${novaSessao.nome}.`)
    void carregarPainel(novaSessao)
    if (!localStorage.getItem(`${onboardingKey}-${novaSessao.usuario_id}`)) {
      setModalAtivo('onboarding')
    } else {
      setModalAtivo(null)
    }
  }

  function sair() {
    localStorage.removeItem(sessionStorageKey)
    setSessao(null)
    setPainel(null)
    setNotificacoes([])
    setModalAtivo('auth')
  }

  function obterMeuLocal() {
    if (!navigator.geolocation) {
      setMensagemSistema('Este navegador nao suporta geolocalizacao.')
      return
    }
    setMensagemSistema('Solicitando sua posicao aproximada...')
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        const ponto = { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude }
        setLocalUsuario(ponto)
        setItemSelecionado(null)
        mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        void carregarItens(ponto.latitude, ponto.longitude, false)
      },
      () => setMensagemSistema('Nao foi possivel acessar sua localizacao. Mantivemos a busca regional padrao.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }

  function getDistance(item: ItemAchado) {
    if (item.distancia_metros !== null) return item.distancia_metros
    if (!localUsuario) return null
    return haversineDistanceMeters(localUsuario, {
      latitude: item.latitude_aproximada,
      longitude: item.longitude_aproximada,
    })
  }

  function requireSession(nextModal: ModalAtivo, message: string) {
    if (!sessao) {
      setMensagemSistema(message)
      setModalAtivo('auth')
      return false
    }
    setModalAtivo(nextModal)
    return true
  }

  function selecionarItemNoMapa(item: ItemAchado) {
    setItemSelecionado(item)
    setActiveTab('radar')
    setMensagemSistema(`Mapa focado em ${item.titulo}.`)
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function confirmarRespostaDesafio() {
    if (!sessao || !itemSelecionado) return
    if (respostaDesafio.trim().length < 2) {
      setMensagemSistema('Digite uma resposta valida para o desafio.')
      return
    }
    try {
      const resultado = await enviarRespostaDesafio(itemSelecionado.id, sessao.usuario_id, respostaDesafio.trim())
      setReivindicacaoId(resultado.reivindicacao_id ?? null)
      setMensagemSistema(resultado.mensagem)
      setModalAtivo('aguardando')
      void carregarPainel(sessao)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Nao foi possivel enviar a resposta.')
    }
  }

  async function validarRespostaComoEncontrador(aprovada: boolean) {
    if (!sessao || !reivindicacaoId) return
    try {
      const resultado = await validarReivindicacao(reivindicacaoId, { aprovada, encontrador_usuario_id: sessao.usuario_id })
      setMensagemSistema(resultado.mensagem)
      if (resultado.chat_desbloqueado && resultado.sala_chat_id) {
        setSalaChatId(resultado.sala_chat_id)
        setModalAtivo('chat')
      } else {
        setModalAtivo(null)
      }
      void carregarPainel(sessao)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Nao foi possivel validar a resposta.')
    }
  }

  async function abrirChat(chat: ChatSummary) {
    setSalaChatId(chat.id)
    setChatAtual(chat)
    const item = itens.find((found) => found.id === chat.item_achado_id)
    if (item) setItemSelecionado(item)
    setModalAtivo('chat')
  }

  async function enviarMensagemNoChat() {
    if (!sessao || !salaChatId) {
      setMensagemSistema('Abra uma conversa valida antes de enviar mensagem.')
      return
    }
    const text = mensagemChatAtual.trim()
    if (!text) {
      setMensagemSistema('Digite uma mensagem antes de enviar.')
      return
    }
    try {
      const enviada = await enviarMensagemChat(salaChatId, sessao.usuario_id, text)
      setMensagensChat((atuais) => [...atuais, enviada])
      setMensagemChatAtual('')
      setDenunciaDisponivel((atual) => atual || enviada.denunciar_extorsao_visivel)
      void carregarPainel(sessao)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Nao foi possivel enviar a mensagem.')
    }
  }

  async function clicarNotificacao(notificacao: NotificationItem) {
    if (!sessao) return
    if (!notificacao.lida_em) {
      void marcarNotificacaoLida(notificacao.id, sessao.usuario_id).then(() => carregarPainel(sessao))
    }
    if (notificacao.sala_chat_id) {
      setSalaChatId(notificacao.sala_chat_id)
      setChatAtual(painel?.chats.find((chat) => chat.id === notificacao.sala_chat_id) ?? null)
      setModalAtivo('chat')
      return
    }
    if (notificacao.reivindicacao_id) {
      setReivindicacaoId(notificacao.reivindicacao_id)
      setModalAtivo('aguardando')
      return
    }
    if (notificacao.item_achado_id) {
      const item = itens.find((found) => found.id === notificacao.item_achado_id)
      if (item) selecionarItemNoMapa(item)
      setModalAtivo(null)
    }
  }

  return (
    <main className="foundy-app-shell min-h-dvh bg-foundy-background text-foundy-foreground">
      <nav className="sticky top-0 z-40 border-b border-foundy-border bg-foundy-surface/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-6 lg:px-8">
          <button className="foundy-pressable flex items-center gap-3 text-left" type="button" onClick={() => setActiveTab('radar')}>
            <span className="foundy-logo-mark grid size-10 place-items-center rounded-2xl bg-foundy-blue text-white shadow-lg shadow-foundy-blue/30">
              <MapPin size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-black tracking-wide">FOUNDY.</span>
              <span className="hidden text-xs text-foundy-muted sm:block">Limpo, seguro e rapido</span>
            </span>
          </button>

          <div className="hidden rounded-2xl border border-foundy-border bg-foundy-background/70 p-1 md:flex">
            {(['radar', 'usuario', 'seguranca'] as MainTab[]).map((tab) => (
              <button
                className={`rounded-xl px-4 py-2 text-sm font-black ${activeTab === tab ? 'bg-foundy-blue text-white' : 'text-foundy-muted'}`}
                key={tab}
                type="button"
                onClick={() => (tab === 'usuario' && !sessao ? setModalAtivo('auth') : setActiveTab(tab))}
              >
                {tab === 'radar' ? 'Radar' : tab === 'usuario' ? 'Minha pagina' : 'Seguranca'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button className="foundy-icon-button" type="button" aria-label="Buscar" onClick={() => setModalAtivo('busca')}>
              <Search size={18} />
            </button>
            <button className="foundy-icon-button relative" type="button" aria-label="Notificacoes" onClick={() => requireSession('notificacoes', 'Entre para ver suas notificacoes.')}>
              <Bell size={18} />
              {unreadCount > 0 ? <span className="foundy-badge">{unreadCount}</span> : null}
            </button>
            <button className="foundy-user-button foundy-pressable inline-flex min-h-10 items-center gap-2 rounded-xl border border-foundy-border px-3 text-sm font-black" type="button" onClick={() => (sessao ? setModalAtivo('perfil') : setModalAtivo('auth'))}>
              {sessao?.foto_url ? <img src={sessao.foto_url} alt="" className="size-7 rounded-full object-cover" /> : <UserRound size={18} />}
              <span className="max-w-[90px] truncate sm:max-w-[160px]">{sessao ? sessao.nome : 'Entrar'}</span>
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 pb-32 sm:px-6 lg:px-8">
        {activeTab === 'seguranca' ? (
          <SecuritySection />
        ) : activeTab === 'usuario' && sessao ? (
          <UserSection painel={painel} sessao={sessao} onOpenProfile={() => setModalAtivo('perfil')} onOpenChats={() => setModalAtivo('chats')} />
        ) : (
          <RadarSection
            itens={itensFiltrados}
            totalItens={itens.length}
            itemSelecionado={itemSelecionado}
            localUsuario={localUsuario}
            mapRef={mapSectionRef}
            mensagemSistema={mensagemSistema}
            carregando={carregando}
            getDistance={getDistance}
            onSelectItem={setItemSelecionado}
            onSearch={() => setModalAtivo('busca')}
            onNearby={obterMeuLocal}
            onRefresh={() => void carregarItens(localUsuario?.latitude, localUsuario?.longitude)}
            onClaim={(item) => {
              if (!sessao) return requireSession('auth', 'Entre para reivindicar um item com seguranca.')
              setItemSelecionado(item)
              setRespostaDesafio('')
              setModalAtivo('desafio')
              return true
            }}
            onFocusItem={selecionarItemNoMapa}
          />
        )}
      </section>

      <Footer />

      <button className="foundy-fab foundy-pressable fixed bottom-6 left-1/2 z-40 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-foundy-blue text-white shadow-2xl shadow-foundy-blue/35" type="button" aria-label="Abrir acoes rapidas" onClick={() => setModalAtivo('acao')}>
        <Plus size={28} />
      </button>
      <button className="foundy-chat-fab foundy-pressable fixed bottom-7 right-5 z-40 grid size-14 place-items-center rounded-full bg-foundy-green text-slate-950 shadow-2xl shadow-foundy-green/30" type="button" aria-label="Abrir meus chats" onClick={() => requireSession('chats', 'Entre para acessar seus chats seguros.')}>
        <MessageCircle size={24} />
      </button>

      {modalAtivo === 'auth' ? <ModalAutenticacao onClose={() => setModalAtivo(null)} onSessaoAtiva={salvarSessao} /> : null}
      {modalAtivo === 'acao' ? (
        <ModalAcaoRapida
          onClose={() => setModalAtivo(null)}
          onEscolherAchei={() => requireSession('item', 'Para publicar item achado e necessario entrar.')}
          onEscolherPerdi={() => requireSession('perdi', 'Para criar alerta de perda e necessario entrar.')}
        />
      ) : null}
      {modalAtivo === 'item' && sessao ? <ModalItemAchado sessao={sessao} onClose={() => setModalAtivo(null)} onPublicado={(item) => { setItens((atuais) => [item, ...atuais]); setItemSelecionado(item); setModalAtivo(null); void carregarPainel(sessao) }} /> : null}
      {modalAtivo === 'perdi' && sessao ? <ModalPerdiAlgo sessao={sessao} pontoInicial={localUsuario ?? defaultPoint} onClose={() => setModalAtivo(null)} onCriado={(mensagem) => { setMensagemSistema(mensagem); setModalAtivo(null); void carregarPainel(sessao) }} /> : null}
      {modalAtivo === 'desafio' && itemSelecionado ? <ModalDesafio item={itemSelecionado} resposta={respostaDesafio} onRespostaChange={setRespostaDesafio} onConfirmar={() => void confirmarRespostaDesafio()} onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'aguardando' ? <ModalAguardandoValidacao reivindicacaoId={reivindicacaoId} onClose={() => setModalAtivo(null)} onValidar={(aprovada) => void validarRespostaComoEncontrador(aprovada)} /> : null}
      {modalAtivo === 'chat' ? (
        <ModalChatSeguro
          item={itemSelecionado}
          chat={chatAtual}
          chatCarregando={chatCarregando}
          mensagens={mensagensChat}
          valorAtual={mensagemChatAtual}
          onChangeValor={setMensagemChatAtual}
          onEnviar={() => void enviarMensagemNoChat()}
          onDenunciar={() => salaChatId && sessao ? void denunciarExtorsao(salaChatId, sessao.usuario_id, 'Solicitacao indevida de pagamento para devolucao do item.').then((res) => setMensagemSistema(res.mensagem)) : undefined}
          denunciarDisponivel={denunciaDisponivel}
          podeAvaliar={Boolean(sessao && chatAtual?.dono_usuario_id === sessao.usuario_id && chatAtual.encontrador_usuario_id)}
          onConfirmarDevolucao={(nota) => {
            if (!sessao || !chatAtual?.encontrador_usuario_id) return
            return confirmarDevolucaoComAvaliacao({
              item_achado_id: chatAtual.item_achado_id,
              encontrador_usuario_id: chatAtual.encontrador_usuario_id,
              dono_usuario_id: sessao.usuario_id,
              nota,
            }).then((resposta) => {
              setMensagemSistema(resposta.mensagem)
              void carregarPainel(sessao)
            })
          }}
          onClose={() => setModalAtivo(null)}
        />
      ) : null}
      {modalAtivo === 'busca' ? <ModalBusca filtro={filtro} buscaTexto={buscaTexto} itensVisiveis={itensFiltrados.length} totalItens={itens.length} onFiltroChange={setFiltro} onBuscaChange={setBuscaTexto} onLimpar={() => { setFiltro('todos'); setBuscaTexto('') }} onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'seguranca' ? <ModalManifestoSeguranca onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'termos' ? <ModalTermosLgpd onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'perfil' && sessao ? <ModalPerfil sessao={sessao} painel={painel} onClose={() => setModalAtivo(null)} onLogout={sair} onUpdated={salvarSessao} onOpenAdmin={isAdmin(sessao) ? async () => { const data = await buscarPainelAdmin(sessao.usuario_id); setAdminData(data); setModalAtivo('admin') } : undefined} /> : null}
      {modalAtivo === 'notificacoes' && sessao ? <ModalNotificacoes notificacoes={notificacoes} onClose={() => setModalAtivo(null)} onOpen={(notificacao) => void clicarNotificacao(notificacao)} /> : null}
      {modalAtivo === 'chats' && sessao ? <ModalChats chats={painel?.chats ?? []} onClose={() => setModalAtivo(null)} onOpen={(chat) => void abrirChat(chat)} /> : null}
      {modalAtivo === 'onboarding' && sessao ? <ModalOnboarding onClose={() => { localStorage.setItem(`${onboardingKey}-${sessao.usuario_id}`, '1'); setModalAtivo(null) }} /> : null}
      {modalAtivo === 'admin' && sessao && adminData ? <ModalAdmin data={adminData} adminId={sessao.usuario_id} onClose={() => setModalAtivo(null)} onRefresh={async () => setAdminData(await buscarPainelAdmin(sessao.usuario_id))} /> : null}
    </main>
  )
}

function RadarSection({
  itens,
  totalItens,
  itemSelecionado,
  localUsuario,
  mapRef,
  mensagemSistema,
  carregando,
  getDistance,
  onSelectItem,
  onSearch,
  onNearby,
  onRefresh,
  onClaim,
  onFocusItem,
}: {
  itens: ItemAchado[]
  totalItens: number
  itemSelecionado: ItemAchado | null
  localUsuario: GeoPoint | null
  mapRef: React.RefObject<HTMLDivElement | null>
  mensagemSistema: string
  carregando: boolean
  getDistance: (item: ItemAchado) => number | null
  onSelectItem: (item: ItemAchado) => void
  onSearch: () => void
  onNearby: () => void
  onRefresh: () => void
  onClaim: (item: ItemAchado) => void
  onFocusItem: (item: ItemAchado) => void
}) {
  return (
    <>
      <div ref={mapRef} className="foundy-hero-panel relative overflow-hidden rounded-3xl border border-foundy-border bg-foundy-surface p-4 shadow-2xl shadow-black/25 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-3xl">
            <p className="foundy-eyebrow foundy-attention text-sm font-semibold text-foundy-blue">O Radar hiperlocal</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-5xl">O que se perdeu, volta com seguranca.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foundy-muted sm:text-base">
              Encontre itens por regiao aproximada, converse apos prova de posse e combine devolucoes em locais publicos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="foundy-pressable inline-flex h-11 items-center gap-2 rounded-xl bg-foundy-blue px-4 text-sm font-black text-white" type="button" onClick={onSearch}>
              <Search size={17} /> Buscar
            </button>
            <button className="foundy-pressable inline-flex h-11 items-center gap-2 rounded-xl border border-foundy-border px-4 text-sm font-semibold" type="button" onClick={onNearby}>
              <LocateFixed size={17} /> Perto de mim
            </button>
          </div>
        </div>

        <MapaInterativo itens={itens} itemSelecionado={itemSelecionado} onSelecionarItem={onSelectItem} userLocation={localUsuario} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foundy-border bg-foundy-background/70 p-4">
          <p className="text-sm text-foundy-muted" aria-live="polite">{mensagemSistema}</p>
          <button className="foundy-pressable inline-flex h-10 items-center gap-2 rounded-xl border border-foundy-border px-3 text-sm font-semibold" type="button" onClick={onRefresh}>
            <Sparkles size={16} /> Atualizar
          </button>
        </div>
      </div>

      <section className="grid gap-4" aria-label="Feed de itens achados">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">Itens achados perto de voce</h2>
          <span className="text-sm text-foundy-muted">{itens.length} de {totalItens}</span>
        </div>
        {itens.map((item) => <ItemCard item={item} key={item.id} distance={getDistance(item)} onClaim={onClaim} onFocus={onFocusItem} />)}
        {!carregando && itens.length === 0 ? <EmptyState title="Nenhum item encontrado" text="Abra a lupa para ajustar os filtros ou crie um alerta de perda." /> : null}
        {carregando ? <p className="text-sm text-foundy-muted">Atualizando feed...</p> : null}
      </section>
    </>
  )
}

function ItemCard({ item, distance, onClaim, onFocus }: { item: ItemAchado; distance: number | null; onClaim: (item: ItemAchado) => void; onFocus: (item: ItemAchado) => void }) {
  const CategoriaIcon = categorias[item.categoria].Icon
  return (
    <article className="foundy-item-card overflow-hidden rounded-3xl border border-foundy-border bg-foundy-surface">
      <div className="relative h-52 overflow-hidden">
        <img src={item.imagem_url ?? placeholdersPorCategoria[item.categoria]} alt={`Imagem do item ${item.titulo}`} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
          <CategoriaIcon size={14} /> {categorias[item.categoria].label}
        </div>
        <div className="absolute bottom-3 right-3 rounded-full bg-foundy-blue px-3 py-1 text-xs font-bold text-white">{formatDistance(distance)}</div>
      </div>
      <div className="grid gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">{item.titulo}</h3>
            <p className="text-sm text-foundy-muted">{item.local_descricao ?? 'Local aproximado protegido'}</p>
          </div>
          {item.premium_ativo ? <span className="rounded-full bg-foundy-green/20 px-3 py-1 text-xs font-bold text-foundy-green">Boost</span> : null}
        </div>
        <p className="text-sm leading-6 text-foundy-muted">{item.descricao}</p>
        <div className="flex flex-wrap gap-2">
          {(item.hashtags_ia ?? []).map((tag) => <span className="rounded-full bg-foundy-blue/15 px-3 py-1 text-xs font-semibold text-foundy-blue" key={`${item.id}-${tag}`}>{tag}</span>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="foundy-pressable rounded-xl bg-foundy-green px-4 py-2 text-sm font-black text-slate-950" type="button" onClick={() => onClaim(item)}>E meu</button>
          <button className="foundy-pressable rounded-xl border border-foundy-border px-4 py-2 text-sm font-semibold" type="button" onClick={() => onFocus(item)}>Ver no mapa</button>
        </div>
      </div>
    </article>
  )
}

function UserSection({ painel, sessao, onOpenProfile, onOpenChats }: { painel: UserDashboard | null; sessao: FoundySession; onOpenProfile: () => void; onOpenChats: () => void }) {
  return (
    <section className="grid gap-4">
      <div className="foundy-hero-panel rounded-3xl border border-foundy-border bg-foundy-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {sessao.foto_url ? <img src={sessao.foto_url} alt="" className="size-16 rounded-2xl object-cover" /> : <span className="grid size-16 place-items-center rounded-2xl bg-foundy-blue/20 text-foundy-blue"><UserRound size={28} /></span>}
            <div>
              <p className="text-sm font-bold text-foundy-green">{sessao.badge_publica ?? sessao.nivel_perfil}</p>
              <h1 className="text-2xl font-black">{sessao.nome}</h1>
              <p className="text-sm text-foundy-muted">{sessao.ocupacao || 'Perfil seguro Foundy'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="foundy-pressable rounded-xl border border-foundy-border px-4 py-2 text-sm font-bold" type="button" onClick={onOpenProfile}>Editar perfil</button>
            <button className="foundy-pressable rounded-xl bg-foundy-green px-4 py-2 text-sm font-black text-slate-950" type="button" onClick={onOpenChats}>Chats</button>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Pontos de Luz" value={sessao.pontos_luz} />
        <Metric label="Itens postados" value={String(painel?.itens_postados.length ?? 0)} />
        <Metric label="Alertas de perda" value={String(painel?.alertas_perdidos.length ?? 0)} />
        <Metric label="Chats seguros" value={String(painel?.chats.length ?? 0)} />
      </div>
      <PanelList title="Meus itens postados" empty="Voce ainda nao publicou itens achados.">
        {(painel?.itens_postados ?? []).map((item) => <SimpleRow key={item.id} title={item.titulo} text={`${categorias[item.categoria].label} - ${item.status}`} />)}
      </PanelList>
      <PanelList title="Notificacoes de perdas" empty="Nenhum alerta de perda criado ainda.">
        {(painel?.alertas_perdidos ?? []).map((alerta) => <SimpleRow key={alerta.id} title={alerta.titulo} text={alerta.status} />)}
      </PanelList>
    </section>
  )
}

function SecuritySection() {
  return (
    <section className="grid gap-4">
      <div className="foundy-hero-panel rounded-3xl border border-foundy-border bg-foundy-surface p-5">
        <p className="foundy-eyebrow foundy-attention text-sm font-semibold text-foundy-green">Protocolo Foundy</p>
        <h1 className="mt-2 text-3xl font-black">Seguranca fisica antes de qualquer encontro.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foundy-muted">O Foundy e uma ponte digital. Encontros devem acontecer em locais publicos, de dia, com prova de posse e preferencialmente acompanhado.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <TrustCard title="Local publico" text="Nunca combine retirada em residencia, local isolado ou estacionamento vazio." />
        <TrustCard title="Luz do dia" text="Marque entre 8h e 18h, em areas movimentadas e monitoradas." />
        <TrustCard title="Sem criancas" text="O Foundy e estritamente proibido para menores de 18 anos." />
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-28 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-foundy-border bg-foundy-surface/75 p-4">
        <p className="text-sm font-black text-foundy-green">Foundy protege pessoas antes de proteger objetos.</p>
        <p className="mt-1 text-sm text-foundy-muted">Contato: <a className="font-bold text-foundy-green underline-offset-4 hover:underline" href={supportMailto}>{supportEmail}</a></p>
        <p className="mt-1 text-sm text-foundy-muted">Criado por Diego Corazza e Gustavo Alves.</p>
      </div>
    </footer>
  )
}

function ModalBase({ titulo, subtitulo, onClose, children }: { titulo: string; subtitulo?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/65 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true">
      <section className="foundy-modal-panel max-h-[92dvh] w-full max-w-2xl overflow-auto rounded-3xl border border-foundy-border bg-foundy-surface shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-foundy-border bg-foundy-surface/95 p-4 backdrop-blur">
          <div>
            <h2 className="text-lg font-black">{titulo}</h2>
            {subtitulo ? <p className="mt-1 text-sm text-foundy-muted">{subtitulo}</p> : null}
          </div>
          <button className="grid size-10 shrink-0 place-items-center rounded-xl border border-foundy-border" type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function ModalAutenticacao({ onSessaoAtiva, onClose }: { onSessaoAtiva: (sessao: FoundySession) => void; onClose: () => void }) {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('cadastrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [maior, setMaior] = useState(false)
  const [termos, setTermos] = useState(false)
  const [emailNotificacoes, setEmailNotificacoes] = useState(true)
  const [mensagem, setMensagem] = useState('Crie sua conta para publicar, conversar e receber alertas.')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (!email.includes('@')) return setMensagem('Informe um e-mail valido.')
    if (senha.length < 8) return setMensagem('A senha precisa ter pelo menos 8 caracteres.')
    if (modo === 'cadastrar' && nome.trim().length < 2) return setMensagem('Informe seu nome.')
    if (modo === 'cadastrar' && (!maior || !termos)) return setMensagem('Confirme maioridade e aceite os termos para continuar.')

    setEnviando(true)
    try {
      if (modo === 'cadastrar') {
        const resposta = await cadastrarUsuario({ nome, email, senha, maior_de_idade: maior, aceitou_termos: termos, aceita_notificacoes_email: emailNotificacoes })
        setMensagem(resposta.mensagem)
        if (!resposta.login_liberado) return
      }
      const login = await entrarUsuario({ email: email.trim().toLowerCase(), senha })
      onSessaoAtiva(login)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Nao foi possivel concluir a autenticacao.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalBase titulo={modo === 'entrar' ? 'Entrar na Foundy' : 'Criar conta segura'} subtitulo="Uso permitido apenas para maiores de 18 anos." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-foundy-background p-1">
          <button className={`rounded-xl px-3 py-2 text-sm font-bold ${modo === 'entrar' ? 'bg-foundy-blue text-white' : 'text-foundy-muted'}`} type="button" onClick={() => setModo('entrar')}>Entrar</button>
          <button className={`rounded-xl px-3 py-2 text-sm font-bold ${modo === 'cadastrar' ? 'bg-foundy-blue text-white' : 'text-foundy-muted'}`} type="button" onClick={() => setModo('cadastrar')}>Cadastrar</button>
        </div>
        {modo === 'cadastrar' ? <Field label="Nome"><input className="foundy-input" value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Seu nome" autoComplete="name" /></Field> : null}
        <Field label="E-mail"><input className="foundy-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" type="email" autoComplete="email" /></Field>
        <Field label="Senha"><input className="foundy-input" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Minimo de 8 caracteres" type="password" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} /></Field>
        {modo === 'cadastrar' ? (
          <div className="grid gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm">
            <label className="flex gap-3"><input checked={maior} onChange={(event) => setMaior(event.target.checked)} type="checkbox" /> Confirmo que tenho 18 anos ou mais.</label>
            <label className="flex gap-3"><input checked={termos} onChange={(event) => setTermos(event.target.checked)} type="checkbox" /> Li e aceito os Termos de Uso, LGPD e Protocolo de Seguranca.</label>
            <label className="flex gap-3"><input checked={emailNotificacoes} onChange={(event) => setEmailNotificacoes(event.target.checked)} type="checkbox" /> Quero receber alertas importantes por e-mail.</label>
          </div>
        ) : null}
        <p className="rounded-xl border border-foundy-blue/30 bg-foundy-blue/10 p-3 text-sm text-foundy-blue" aria-live="polite">{mensagem}</p>
        <button className="h-12 rounded-xl bg-foundy-blue px-4 text-sm font-black text-white" type="button" disabled={enviando} onClick={() => void enviar()}>{enviando ? 'Enviando...' : modo === 'entrar' ? 'Entrar' : 'Criar conta e continuar'}</button>
      </div>
    </ModalBase>
  )
}

function ModalItemAchado({ sessao, onClose, onPublicado }: { sessao: FoundySession; onClose: () => void; onPublicado: (item: ItemAchado) => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<ItemCategory>('outros')
  const [local, setLocal] = useState('')
  const [desafio, setDesafio] = useState('')
  const [detalheOculto, setDetalheOculto] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [coords, setCoords] = useState<GeoPoint>(defaultPoint)
  const [tagsImagem, setTagsImagem] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('A imagem sera processada com filtro automatico de privacidade.')
  const [processando, setProcessando] = useState(false)

  async function processarImagemSelecionada(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (categoria === 'documentos') {
      setImagemUrl('')
      setTagsImagem(['#DocumentoProtegido'])
      setMensagem('Documento selecionado: por seguranca, a foto nao sera publicada. Descreva apenas dados nao sensiveis.')
      return
    }
    setProcessando(true)
    try {
      const resultado = await processarImagemComPrivacidade(file, `${titulo} ${descricao}`)
      setImagemUrl(resultado.imagem_data_url)
      setTagsImagem(resultado.hashtags_ia)
      setMensagem('Imagem processada com filtros de privacidade.')
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Falha ao processar a imagem.')
    } finally {
      setProcessando(false)
    }
  }

  function usarGeolocalizacao() {
    if (!navigator.geolocation) return setMensagem('Geolocalizacao indisponivel neste navegador.')
    navigator.geolocation.getCurrentPosition(
      (posicao) => { setCoords({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude }); setMensagem('Local aproximado capturado.') },
      () => setMensagem('Nao foi possivel capturar sua localizacao.'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  async function publicar() {
    if (!titulo.trim() || !descricao.trim() || !desafio.trim() || !detalheOculto.trim()) return setMensagem('Preencha titulo, descricao, desafio e detalhe oculto.')
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
        imagem_url: categoria === 'documentos' ? null : imagemUrl || null,
        tags_ia: tagsImagem.map((tag) => tag.replace(/^#/, '')),
        usuario_id: sessao.usuario_id,
      })
      onPublicado(item)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Nao foi possivel publicar o item.')
    }
  }

  return (
    <ModalBase titulo="Cadastrar item achado" subtitulo="Fotos de documentos nunca sao publicadas." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Titulo"><input className="foundy-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex.: Chave com fita azul" /></Field>
          <Field label="Categoria"><select className="foundy-input" value={categoria} onChange={(event) => { const value = event.target.value as ItemCategory; setCategoria(value); if (value === 'documentos') setImagemUrl('') }}>{Object.entries(categorias).map(([value, data]) => <option key={value} value={value}>{data.label}</option>)}</select></Field>
        </div>
        <Field label="Descricao publica"><textarea className="foundy-input min-h-24" value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Nao informe telefone, e-mail, CPF ou endereco exato." /></Field>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-foundy-border text-sm font-bold disabled:opacity-60" type="button" onClick={() => fileInputRef.current?.click()} disabled={processando}>
          <Camera size={17} /> {categoria === 'documentos' ? 'Documento: foto bloqueada' : processando ? 'Processando...' : 'Upload com privacidade'}
        </button>
        <input accept="image/*" className="sr-only" ref={fileInputRef} type="file" onChange={(event) => void processarImagemSelecionada(event)} />
        {imagemUrl ? <img src={imagemUrl} alt="Previa protegida do item" className="h-44 w-full rounded-2xl object-cover" /> : null}
        <Field label="Local aproximado"><input className="foundy-input" value={local} onChange={(event) => setLocal(event.target.value)} placeholder="Ex.: perto da praca" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Desafio do dono"><input className="foundy-input" value={desafio} onChange={(event) => setDesafio(event.target.value)} placeholder="Ex.: Qual detalhe interno?" /></Field>
          <Field label="Detalhe oculto"><input className="foundy-input" value={detalheOculto} onChange={(event) => setDetalheOculto(event.target.value)} placeholder="Resposta que so o dono sabe" /></Field>
        </div>
        <button className="h-10 rounded-xl border border-foundy-border text-sm font-bold" type="button" onClick={usarGeolocalizacao}>Usar minha localizacao</button>
        <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
        <button className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" type="button" onClick={() => void publicar()}>Publicar com detalhe oculto</button>
      </div>
    </ModalBase>
  )
}

function ModalPerdiAlgo({ sessao, pontoInicial, onClose, onCriado }: { sessao: FoundySession; pontoInicial: GeoPoint; onClose: () => void; onCriado: (mensagem: string) => void }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [hashtags, setHashtags] = useState('#chave #fitaazul')
  const [ponto, setPonto] = useState<GeoPoint>(pontoInicial)
  const [raio, setRaio] = useState(5000)
  const [mensagem, setMensagem] = useState('Toque no mapa para posicionar o centro do perimetro.')

  async function criar() {
    if (!titulo.trim() || !descricao.trim()) return setMensagem('Preencha titulo e descricao.')
    try {
      const resposta = await criarAlertaPerdido({ usuario_id: sessao.usuario_id, titulo, descricao, hashtags: hashtags.split(/[\s,]+/).map((tag) => tag.replace(/^#/, '')).filter(Boolean), latitude: ponto.latitude, longitude: ponto.longitude, raio_metros: raio })
      onCriado(resposta.mensagem)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Nao foi possivel criar o alerta perdido.')
    }
  }

  return (
    <ModalBase titulo="Perimetro ativo de perda" subtitulo="Receba notificacao se surgir item compativel." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <Field label="Titulo"><input className="foundy-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex.: Perdi meu celular preto" /></Field>
        <Field label="Descricao"><textarea className="foundy-input min-h-24" value={descricao} onChange={(event) => setDescricao(event.target.value)} /></Field>
        <Field label="Hashtags"><input className="foundy-input" value={hashtags} onChange={(event) => setHashtags(event.target.value)} /></Field>
        <MapaPerimetro center={ponto} radius={raio} onCenterChange={setPonto} />
        <Field label={`Raio (${Math.round(raio / 1000)} km)`}><input type="range" min={500} max={50000} step={500} value={raio} onChange={(event) => setRaio(Number(event.target.value))} /></Field>
        <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
        <button className="h-11 rounded-xl bg-red-500 px-4 text-sm font-black text-white" type="button" onClick={() => void criar()}>Ativar alerta de perda</button>
      </div>
    </ModalBase>
  )
}

function ModalPerfil({ sessao, painel, onClose, onLogout, onUpdated, onOpenAdmin }: { sessao: FoundySession; painel: UserDashboard | null; onClose: () => void; onLogout: () => void; onUpdated: (sessao: FoundySession) => void; onOpenAdmin?: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [nome, setNome] = useState(sessao.nome)
  const [ocupacao, setOcupacao] = useState(sessao.ocupacao ?? '')
  const [fotoUrl, setFotoUrl] = useState(sessao.foto_url ?? '')
  const [emailNotifications, setEmailNotifications] = useState(sessao.aceita_notificacoes_email !== 'false')
  const [mensagem, setMensagem] = useState('Atualize seu perfil publico para gerar mais confianca.')

  function selecionarFoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setFotoUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  async function salvar() {
    try {
      const atualizado = await atualizarPerfil(sessao.usuario_id, { nome, ocupacao, foto_url: fotoUrl, aceita_notificacoes_email: emailNotifications })
      onUpdated(atualizado)
      setMensagem(atualizado.mensagem)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Nao foi possivel atualizar o perfil.')
    }
  }

  return (
    <ModalBase titulo="Minha pagina Foundy" subtitulo="Perfil, karma, itens e preferencias." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="flex items-center gap-4 rounded-2xl border border-foundy-border bg-foundy-background p-4">
          {fotoUrl ? <img src={fotoUrl} alt="" className="size-20 rounded-2xl object-cover" /> : <span className="grid size-20 place-items-center rounded-2xl bg-foundy-blue/20"><UserRound size={30} /></span>}
          <div>
            <p className="font-black">{sessao.badge_publica}</p>
            <p className="text-sm text-foundy-muted">{sessao.pontos_luz} Pontos de Luz</p>
            <button className="mt-2 rounded-xl border border-foundy-border px-3 py-1 text-xs font-bold" type="button" onClick={() => fileRef.current?.click()}>Trocar foto</button>
            <input className="sr-only" ref={fileRef} type="file" accept="image/*" onChange={selecionarFoto} />
          </div>
        </div>
        <Field label="Nome"><input className="foundy-input" value={nome} onChange={(event) => setNome(event.target.value)} /></Field>
        <Field label="Ocupacao ou apresentacao curta"><input className="foundy-input" value={ocupacao} onChange={(event) => setOcupacao(event.target.value)} placeholder="Ex.: estudante, comerciante, morador do bairro" /></Field>
        <label className="flex gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm"><input checked={emailNotifications} onChange={(event) => setEmailNotifications(event.target.checked)} type="checkbox" /> Receber notificacoes importantes por e-mail.</label>
        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label="Itens" value={String(painel?.itens_postados.length ?? 0)} />
          <Metric label="Alertas" value={String(painel?.alertas_perdidos.length ?? 0)} />
          <Metric label="Chats" value={String(painel?.chats.length ?? 0)} />
        </div>
        <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
        <button className="h-11 rounded-xl bg-foundy-blue text-sm font-black text-white" type="button" onClick={() => void salvar()}>Salvar perfil</button>
        {onOpenAdmin ? <button className="h-11 rounded-xl border border-red-400/50 text-sm font-black text-red-200" type="button" onClick={onOpenAdmin}>Abrir painel administrativo</button> : null}
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-foundy-border text-sm font-bold" type="button" onClick={onLogout}><LogOut size={16} /> Sair</button>
      </div>
    </ModalBase>
  )
}

function ModalNotificacoes({ notificacoes, onClose, onOpen }: { notificacoes: NotificationItem[]; onClose: () => void; onOpen: (notificacao: NotificationItem) => void }) {
  return (
    <ModalBase titulo="Notificacoes" subtitulo="Clique para ir direto ao chat, item ou validacao." onClose={onClose}>
      <div className="grid gap-3 p-4">
        {notificacoes.length === 0 ? <EmptyState title="Sem notificacoes" text="Quando algo importante acontecer, o sininho avisa." /> : null}
        {notificacoes.map((notificacao) => (
          <button className={`rounded-2xl border p-4 text-left ${notificacao.lida_em ? 'border-foundy-border bg-foundy-background' : 'border-foundy-green/40 bg-foundy-green/10'}`} key={notificacao.id} type="button" onClick={() => onOpen(notificacao)}>
            <p className="font-black">{notificacao.titulo}</p>
            <p className="mt-1 text-sm text-foundy-muted">{notificacao.mensagem}</p>
            <p className="mt-2 text-xs text-foundy-muted">{new Date(notificacao.criado_em).toLocaleString('pt-BR')}</p>
          </button>
        ))}
      </div>
    </ModalBase>
  )
}

function ModalChats({ chats, onClose, onOpen }: { chats: ChatSummary[]; onClose: () => void; onOpen: (chat: ChatSummary) => void }) {
  return (
    <ModalBase titulo="Meus chats" subtitulo="Conversas liberadas apos o desafio do dono." onClose={onClose}>
      <div className="grid gap-3 p-4">
        {chats.length === 0 ? <EmptyState title="Nenhum chat ainda" text="Quando uma resposta for aprovada, a conversa aparece aqui." /> : null}
        {chats.map((chat) => (
          <button className="rounded-2xl border border-foundy-border bg-foundy-background p-4 text-left" key={chat.id} type="button" onClick={() => onOpen(chat)}>
            <p className="font-black">{chat.item_titulo}</p>
            <p className="mt-1 text-sm text-foundy-muted">{chat.ultima_mensagem ?? 'Conversa pronta para iniciar.'}</p>
            <span className="mt-3 inline-flex rounded-full bg-foundy-green/20 px-3 py-1 text-xs font-bold text-foundy-green">{chat.status}</span>
          </button>
        ))}
      </div>
    </ModalBase>
  )
}

function ModalChatSeguro({
  item,
  chat,
  chatCarregando,
  mensagens,
  valorAtual,
  onChangeValor,
  onEnviar,
  onDenunciar,
  denunciarDisponivel,
  podeAvaliar,
  onConfirmarDevolucao,
  onClose,
}: {
  item: ItemAchado | null
  chat: ChatSummary | null
  chatCarregando: boolean
  mensagens: MensagemChat[]
  valorAtual: string
  onChangeValor: (value: string) => void
  onEnviar: () => void
  onDenunciar: () => void
  denunciarDisponivel: boolean
  podeAvaliar: boolean
  onConfirmarDevolucao: (nota: number) => void | Promise<void>
  onClose: () => void
}) {
  const [nota, setNota] = useState(10)
  const [avaliando, setAvaliando] = useState(false)
  const [mensagemAvaliacao, setMensagemAvaliacao] = useState('Depois da entrega, avalie o encontrador para atualizar o karma.')

  async function confirmarAvaliacao() {
    setAvaliando(true)
    try {
      await onConfirmarDevolucao(nota)
      setMensagemAvaliacao(`Devolucao confirmada com nota ${nota}/10. Obrigado por fortalecer a comunidade.`)
    } catch (error) {
      setMensagemAvaliacao(error instanceof Error ? error.message : 'Nao foi possivel confirmar a devolucao.')
    } finally {
      setAvaliando(false)
    }
  }

  return (
    <ModalBase titulo="Chat privado de recuperacao" subtitulo={item ? `Item: ${item.titulo}` : chat?.item_titulo ?? 'Conversa segura'} onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-2xl border border-foundy-green/30 bg-foundy-green/15 p-4 text-sm text-foundy-green"><CheckCircle2 className="mb-2" size={18} /> Chat protegido. Combine entrega em local publico e de dia.</div>
        <div className="max-h-72 space-y-2 overflow-auto rounded-2xl border border-foundy-border bg-foundy-background p-3">
          {chatCarregando ? <p className="text-sm text-foundy-muted">Atualizando mensagens...</p> : null}
          {!chatCarregando && mensagens.length === 0 ? <p className="text-sm text-foundy-muted">Nenhuma mensagem ainda. Envie a primeira mensagem segura.</p> : null}
          {mensagens.map((mensagem) => (
            <article className={`rounded-xl p-3 text-sm ${mensagem.status_moderacao === 'suspeita_extorsao' ? 'border border-red-500/40 bg-red-500/10' : 'bg-foundy-surface'}`} key={mensagem.id}>
              <p>{mensagem.mensagem}</p>
              <p className="mt-1 text-xs text-foundy-muted">{new Date(mensagem.criado_em).toLocaleString('pt-BR')}</p>
            </article>
          ))}
        </div>
        <Field label="Mensagem"><textarea className="foundy-input min-h-24" value={valorAtual} onChange={(event) => onChangeValor(event.target.value)} placeholder="Digite uma mensagem respeitosa e sem pedir pagamento." /></Field>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foundy-blue px-4 text-sm font-black text-white" type="button" onClick={onEnviar}><Send size={16} /> Enviar mensagem</button>
        {denunciarDisponivel ? <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-black text-white" type="button" onClick={onDenunciar}><Flag size={16} /> Denunciar extorsao</button> : <p className="rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">Se alguem pedir PIX, pagamento ou resgate, o botao de denuncia sera ativado.</p>}
        {podeAvaliar ? (
          <div className="grid gap-3 rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black text-foundy-green">Confirmar devolucao e karma</p>
                <p className="mt-1 text-sm text-foundy-muted">{mensagemAvaliacao}</p>
              </div>
              <Star className="text-foundy-green" size={22} />
            </div>
            <Field label={`Nota da entrega: ${nota}/10`}>
              <input type="range" min={0} max={10} value={nota} onChange={(event) => setNota(Number(event.target.value))} />
            </Field>
            <button className="h-11 rounded-xl bg-foundy-green text-sm font-black text-slate-950 disabled:opacity-60" type="button" disabled={avaliando} onClick={() => void confirmarAvaliacao()}>
              {avaliando ? 'Confirmando...' : 'Confirmar devolucao'}
            </button>
          </div>
        ) : null}
      </div>
    </ModalBase>
  )
}

function ModalOnboarding({ onClose }: { onClose: () => void }) {
  const steps = [
    ['1', 'Publique ou busque', 'Escolha Perdi algo ou Achei algo e descreva sem dados sensiveis.'],
    ['2', 'Prove que e seu', 'Use o detalhe oculto para liberar a conversa apenas para quem realmente conhece o item.'],
    ['3', 'Combine com seguranca', 'Encontro publico, de dia, acompanhado e sem pagamento antecipado.'],
    ['4', 'Avalie a entrega', 'Depois da devolucao, a nota vira Pontos de Luz para o encontrador.'],
  ]
  return (
    <ModalBase titulo="Como usar o Foundy com seguranca" subtitulo="Um guia rapido em quadrinhos para evitar riscos." onClose={onClose}>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {steps.map(([number, title, text]) => (
          <article className="foundy-comic-card rounded-3xl border border-foundy-border bg-foundy-background p-4" key={number}>
            <span className="grid size-10 place-items-center rounded-2xl bg-foundy-green text-lg font-black text-slate-950">{number}</span>
            <h3 className="mt-3 text-lg font-black">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-foundy-muted">{text}</p>
          </article>
        ))}
        <div className="sm:col-span-2 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          Proibido para menores de 18 anos. Nunca va sozinho e nunca aceite encontros em locais isolados.
        </div>
        <button className="sm:col-span-2 h-11 rounded-xl bg-foundy-green text-sm font-black text-slate-950" type="button" onClick={onClose}>Entendi o protocolo</button>
      </div>
    </ModalBase>
  )
}

function ModalAdmin({ data, adminId, onClose, onRefresh }: { data: { usuarios: unknown[]; itens: ItemAchado[]; moderacao: unknown[] }; adminId: string; onClose: () => void; onRefresh: () => void }) {
  const [mensagem, setMensagem] = useState('Painel restrito ao administrador configurado.')
  async function arquivar(itemId: string) {
    const motivo = window.prompt('Motivo do arquivamento?') ?? ''
    if (motivo.length < 5) return
    const result = await adminArquivarItem(adminId, itemId, motivo)
    setMensagem(result.mensagem)
    onRefresh()
  }
  async function banir(usuario: unknown) {
    const user = usuario as { id: string }
    const motivo = window.prompt('Motivo do banimento?') ?? ''
    const dias = Number(window.prompt('Quantos dias?', '7') ?? '7')
    if (motivo.length < 5 || !Number.isFinite(dias)) return
    const result = await adminBanirUsuario(adminId, user.id, motivo, dias)
    setMensagem(result.mensagem)
    onRefresh()
  }
  return (
    <ModalBase titulo="Painel administrativo" subtitulo="Apagar itens, banir usuarios e acompanhar moderacao." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
        <PanelList title="Itens recentes" empty="Nenhum item.">{data.itens.map((item) => <div className="flex items-center justify-between gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3" key={item.id}><span className="text-sm font-bold">{item.titulo}</span><button className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => void arquivar(item.id)}><Trash2 size={14} /></button></div>)}</PanelList>
        <PanelList title="Usuarios" empty="Nenhum usuario.">{data.usuarios.map((usuario) => { const user = usuario as { id: string; nome?: string; email?: string }; return <div className="flex items-center justify-between gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3" key={user.id}><span className="text-sm font-bold">{user.nome ?? user.email ?? user.id}</span><button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-200" type="button" onClick={() => void banir(user)}><Ban size={14} /></button></div> })}</PanelList>
      </div>
    </ModalBase>
  )
}

function ModalBusca({ filtro, buscaTexto, itensVisiveis, totalItens, onFiltroChange, onBuscaChange, onLimpar, onClose }: { filtro: ItemCategory | 'todos'; buscaTexto: string; itensVisiveis: number; totalItens: number; onFiltroChange: (value: ItemCategory | 'todos') => void; onBuscaChange: (value: string) => void; onLimpar: () => void; onClose: () => void }) {
  return (
    <ModalBase titulo="Lupa Foundy" subtitulo="Filtre por texto, categoria e tags inteligentes." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="foundy-search-input flex items-center gap-3 rounded-2xl border border-foundy-border bg-foundy-background px-4 py-3"><Search size={20} /><input className="w-full bg-transparent outline-none" value={buscaTexto} onChange={(event) => onBuscaChange(event.target.value)} placeholder="Buscar por chaveiro azul, carteira, fone..." /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FilterCard active={filtro === 'todos'} icon={Search} title="Todos" text="Mostrar tudo" onClick={() => onFiltroChange('todos')} />
          {(Object.entries(categorias) as [ItemCategory, (typeof categorias)[ItemCategory]][]).map(([value, data]) => <FilterCard active={filtro === value} icon={data.Icon} title={data.label} text={data.description} key={value} onClick={() => onFiltroChange(value)} />)}
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm"><span>{itensVisiveis} de {totalItens} itens visiveis</span><button className="rounded-xl border border-foundy-border px-3 py-2 font-bold" type="button" onClick={onLimpar}>Limpar</button></div>
      </div>
    </ModalBase>
  )
}

function ModalAcaoRapida({ onClose, onEscolherPerdi, onEscolherAchei }: { onClose: () => void; onEscolherPerdi: () => void; onEscolherAchei: () => void }) {
  return (
    <ModalBase titulo="Nova acao rapida" subtitulo="Selecione o fluxo ideal." onClose={onClose}>
      <div className="grid gap-3 p-4">
        <button className="foundy-pressable inline-flex h-14 items-center justify-between rounded-2xl bg-red-500 px-4 text-left text-white" type="button" onClick={onEscolherPerdi}><span><strong className="block">Perdi algo</strong><span className="text-sm opacity-90">Criar alerta com perimetro</span></span><MapPin size={18} /></button>
        <button className="foundy-pressable inline-flex h-14 items-center justify-between rounded-2xl bg-foundy-green px-4 text-left text-slate-950" type="button" onClick={onEscolherAchei}><span><strong className="block">Achei algo</strong><span className="text-sm opacity-90">Publicar com desafio oculto</span></span><CheckCircle2 size={18} /></button>
      </div>
    </ModalBase>
  )
}

function ModalDesafio({ item, resposta, onRespostaChange, onConfirmar, onClose }: { item: ItemAchado; resposta: string; onRespostaChange: (value: string) => void; onConfirmar: () => void; onClose: () => void }) {
  return (
    <ModalBase titulo="Verificacao do dono" subtitulo="O chat so abre apos validacao." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-2xl border border-foundy-blue/30 bg-foundy-blue/10 p-4"><p className="text-sm font-bold text-foundy-blue">Desafio</p><p className="mt-1">{item.desafio_pergunta ?? 'Informe um detalhe que so o dono saberia.'}</p></div>
        <Field label="Sua resposta"><input className="foundy-input" value={resposta} onChange={(event) => onRespostaChange(event.target.value)} /></Field>
        <button className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" type="button" onClick={onConfirmar}>Enviar resposta</button>
      </div>
    </ModalBase>
  )
}

function ModalAguardandoValidacao({ reivindicacaoId, onClose, onValidar }: { reivindicacaoId: string | null; onClose: () => void; onValidar: (aprovada: boolean) => void }) {
  return (
    <ModalBase titulo="Validacao do detalhe oculto" subtitulo="O encontrador decide se a resposta confere." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <p className="text-sm text-foundy-muted">Reivindicacao atual: <strong>{reivindicacaoId ?? 'nao identificada'}</strong>.</p>
        <button className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" type="button" onClick={() => onValidar(true)}>A resposta esta correta</button>
        <button className="h-11 rounded-xl bg-red-500 px-4 text-sm font-black text-white" type="button" onClick={() => onValidar(false)}>A resposta esta incorreta</button>
      </div>
    </ModalBase>
  )
}

function ModalManifestoSeguranca({ onClose }: { onClose: () => void }) {
  return <ModalBase titulo="Seguranca em Primeiro Lugar" subtitulo="O Protocolo Foundy." onClose={onClose}><div className="grid gap-3 p-4"><TrustCard title="Encontros apenas em locais publicos" text="Nunca marque em residencia, local isolado ou estacionamento vazio." /><TrustCard title="Use a luz do dia" text="Marque entre 8h e 18h, em local movimentado." /><TrustCard title="Faca a pergunta secreta" text="Comprove posse antes do encontro." /><TrustCard title="Nao va sozinho" text="Leve um amigo ou familiar sempre que possivel." /><p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm">O Foundy e uma ponte digital. Nao nos responsabilizamos por encontros fisicos.</p></div></ModalBase>
}

function ModalTermosLgpd({ onClose }: { onClose: () => void }) {
  return <ModalBase titulo="Termos de Uso e LGPD" subtitulo="Resumo operacional." onClose={onClose}><div className="grid gap-3 p-4"><TrustCard title="Escopo do servico" text="O Foundy aproxima pessoas que perderam e encontraram objetos. Nao armazenamos, transportamos ou garantimos itens." /><TrustCard title="Privacidade" text="Localizacao exata, telefone, e-mail real e endereco residencial nao devem ser exibidos publicamente." /><TrustCard title="Conduta proibida" text="E proibido cobrar resgate, pedir PIX antecipado, publicar itens ilegais ou expor dados sensiveis." /><TrustCard title="Uso proibido para menores" text="A plataforma e exclusiva para maiores de 18 anos." /></div></ModalBase>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}{children}</label>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-2xl border border-foundy-border bg-foundy-surface p-4"><p className="text-2xl font-black text-foundy-green">{value}</p><p className="text-sm text-foundy-muted">{label}</p></article>
}

function TrustCard({ title, text }: { title: string; text: string }) {
  return <article className="foundy-trust-card rounded-3xl border border-foundy-border bg-foundy-surface/80 p-4"><ShieldCheck className="mb-3 text-foundy-green" size={20} /><h3 className="font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-foundy-muted">{text}</p></article>
}

function FilterCard({ active, icon: Icon, title, text, onClick }: { active: boolean; icon: LucideIcon; title: string; text: string; onClick: () => void }) {
  return <button className={`foundy-filter-card rounded-3xl border p-4 text-left ${active ? 'border-foundy-green bg-foundy-green/15' : 'border-foundy-border bg-foundy-surface/70'}`} type="button" onClick={onClick}><Icon className="mb-3 text-foundy-green" size={20} /><h3 className="font-black">{title}</h3><p className="mt-1 text-sm text-foundy-muted">{text}</p></button>
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <article className="rounded-3xl border border-dashed border-foundy-border bg-foundy-surface/70 p-6 text-center"><Inbox className="mx-auto mb-3 text-foundy-muted" size={24} /><p className="font-black">{title}</p><p className="mt-2 text-sm text-foundy-muted">{text}</p></article>
}

function PanelList({ title, empty, children }: { title: string; empty: string; children: ReactNode[] | ReactNode }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children
  const isEmpty = Array.isArray(list) ? list.length === 0 : !list
  return <section className="grid gap-3 rounded-3xl border border-foundy-border bg-foundy-surface p-4"><h2 className="font-black">{title}</h2>{isEmpty ? <p className="text-sm text-foundy-muted">{empty}</p> : list}</section>
}

function SimpleRow({ title, text }: { title: string; text: string }) {
  return <article className="rounded-2xl border border-foundy-border bg-foundy-background p-3"><p className="text-sm font-black">{title}</p><p className="text-xs text-foundy-muted">{text}</p></article>
}
