'use client'

import dynamic from 'next/dynamic'
import {
  Ban,
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Flag,
  Info,
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
  arquivarAlertaPerdido,
  arquivarItemProprio,
  atualizarPerfil,
  atualizarStatusCatalogoEmpresa,
  buscarItensAchadosProximos,
  buscarPainelAdmin,
  buscarPainelUsuario,
  criarItemCatalogoEmpresa,
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
  listarCatalogoEmpresa,
  listarEmpresasFoundy,
  marcarNotificacaoLida,
  processarImagemComPrivacidade,
  validarReivindicacao,
  type ChatSummary,
  type ClaimSummary,
  type EmpresaCatalogoItem,
  type EmpresaFoundy,
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
  | 'resposta-enviada'
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
type MainTab = 'feed' | 'mapa' | 'seguranca' | 'usuario' | 'empresas' | 'empresaPainel' | 'admin'

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
  return session?.email?.toLowerCase() === supportEmail
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<MainTab>('feed')
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
  const [claimAtual, setClaimAtual] = useState<ClaimSummary | null>(null)
  const [salaChatId, setSalaChatId] = useState<string | null>(null)
  const [chatAtual, setChatAtual] = useState<ChatSummary | null>(null)
  const [mensagensChat, setMensagensChat] = useState<MensagemChat[]>([])
  const [mensagemChatAtual, setMensagemChatAtual] = useState('')
  const [chatFeedback, setChatFeedback] = useState('')
  const [chatCarregando, setChatCarregando] = useState(false)
  const [denunciaDisponivel, setDenunciaDisponivel] = useState(false)
  const [adminData, setAdminData] = useState<{ usuarios: unknown[]; itens: ItemAchado[]; moderacao: unknown[]; denuncias?: unknown[] } | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaFoundy[]>([])
  const [empresaBusca, setEmpresaBusca] = useState('')
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaFoundy | null>(null)
  const [catalogoEmpresa, setCatalogoEmpresa] = useState<EmpresaCatalogoItem[]>([])
  const [catalogoMensagem, setCatalogoMensagem] = useState('Catálogo empresarial pronto para consulta.')
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

  const carregarEmpresas = useCallback(async (termo?: string) => {
    try {
      const lista = await listarEmpresasFoundy(termo)
      setEmpresas(lista)
      setCatalogoMensagem(lista.length > 0 ? 'Empresas parceiras carregadas.' : 'Nenhuma empresa encontrada ainda.')
    } catch (error) {
      setCatalogoMensagem(error instanceof Error ? error.message : 'Não foi possível carregar as empresas.')
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
    if (activeTab === 'empresas') void carregarEmpresas(empresaBusca)
  }, [activeTab, carregarEmpresas, empresaBusca])

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
    setActiveTab('feed')
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
    setActiveTab('mapa')
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
      setRespostaDesafio('')
      setModalAtivo('resposta-enviada')
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
        setChatAtual(painel?.chats.find((chat) => chat.id === resultado.sala_chat_id) ?? null)
        setChatFeedback('Resposta aprovada. A conversa segura foi liberada para vocês dois.')
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
    setChatFeedback(chat.status === 'encerrado' ? 'Esta conversa foi resolvida e ficou salva no histórico.' : '')
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
      setChatFeedback('Mensagem enviada e registrada na conversa.')
      setDenunciaDisponivel((atual) => atual || enviada.denunciar_extorsao_visivel)
      void listarMensagensChat(salaChatId, sessao.usuario_id).then(setMensagensChat).catch(() => undefined)
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
      let chat = painel?.chats.find((item) => item.id === notificacao.sala_chat_id) ?? null
      if (!chat) {
        const dados = await buscarPainelUsuario(sessao.usuario_id)
        setPainel(dados)
        setNotificacoes(dados.notificacoes)
        chat = dados.chats.find((item) => item.id === notificacao.sala_chat_id) ?? null
      }
      setChatAtual(chat)
      setModalAtivo('chat')
      return
    }
    if (notificacao.reivindicacao_id) {
      let claim = painel?.reivindicacoes_recebidas.find((item) => item.id === notificacao.reivindicacao_id) ?? null
      if (!claim) {
        const dados = await buscarPainelUsuario(sessao.usuario_id)
        setPainel(dados)
        setNotificacoes(dados.notificacoes)
        claim = dados.reivindicacoes_recebidas.find((item) => item.id === notificacao.reivindicacao_id) ?? null
      }
      setClaimAtual(claim)
      setReivindicacaoId(claim?.id ?? notificacao.reivindicacao_id)
      setModalAtivo('aguardando')
      return
    }
    if (notificacao.item_achado_id) {
      const item = itens.find((found) => found.id === notificacao.item_achado_id)
      if (item) selecionarItemNoMapa(item)
      setModalAtivo(null)
    }
  }

  async function abrirEmpresa(empresa: EmpresaFoundy) {
    setEmpresaSelecionada(empresa)
    setCatalogoMensagem('Carregando catálogo da empresa...')
    try {
      const itensCatalogo = await listarCatalogoEmpresa(empresa.id)
      setCatalogoEmpresa(itensCatalogo)
      setCatalogoMensagem(itensCatalogo.length > 0 ? 'Catálogo carregado. A retirada acontece presencialmente na instituição.' : 'Esta empresa ainda não cadastrou itens disponíveis.')
    } catch (error) {
      setCatalogoMensagem(error instanceof Error ? error.message : 'Não foi possível carregar o catálogo.')
    }
  }

  async function apagarMeuItem(itemId: string) {
    if (!sessao || !window.confirm('Apagar este item da área pública do Foundy?')) return
    try {
      await arquivarItemProprio(itemId, sessao.usuario_id)
      setMensagemSistema('Item apagado da área pública. Ele continua no histórico seguro.')
      setItens((atuais) => atuais.filter((item) => item.id !== itemId))
      void carregarPainel(sessao)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível apagar o item.')
    }
  }

  async function apagarMeuAlerta(alertaId: string) {
    if (!sessao || !window.confirm('Arquivar este alerta de perda?')) return
    try {
      await arquivarAlertaPerdido(alertaId, sessao.usuario_id)
      setMensagemSistema('Alerta de perda arquivado com segurança.')
      void carregarPainel(sessao)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível arquivar o alerta.')
    }
  }

  return (
    <main className="foundy-app-shell min-h-dvh bg-foundy-background text-foundy-foreground">
      <nav className="sticky top-0 z-40 border-b border-foundy-border bg-foundy-surface/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-6 lg:px-8">
          <button className="foundy-pressable flex items-center gap-3 text-left" type="button" onClick={() => setActiveTab('feed')}>
            <span className="foundy-logo-mark grid size-10 place-items-center rounded-2xl bg-foundy-blue text-white shadow-lg shadow-foundy-blue/30">
              <MapPin size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-black tracking-wide">FOUNDY.</span>
              <span className="hidden text-xs text-foundy-muted sm:block">Limpo, seguro e rápido</span>
            </span>
          </button>

          <div className="foundy-tabbar order-3 flex w-full max-w-full gap-1 overflow-x-auto rounded-2xl border border-foundy-border bg-foundy-background/70 p-1 md:order-none md:w-auto md:max-w-none">
            {[
              { id: 'feed', label: 'Feed' },
              { id: 'mapa', label: 'Mapa' },
              { id: 'empresas', label: 'Empresas' },
              { id: 'seguranca', label: 'Segurança' },
              { id: 'usuario', label: 'Minha página' },
              ...(sessao?.tipo_conta === 'empresa' ? [{ id: 'empresaPainel', label: 'Meu catálogo' }] : []),
              ...(isAdmin(sessao) ? [{ id: 'admin', label: 'Admin' }] : []),
            ].map((tab) => (
              <button
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black sm:px-4 sm:text-sm ${activeTab === tab.id ? 'bg-foundy-blue text-white' : 'text-foundy-muted'}`}
                key={tab.id}
                type="button"
                onClick={async () => {
                  const id = tab.id as MainTab
                  if ((id === 'usuario' || id === 'empresaPainel' || id === 'admin') && !sessao) return setModalAtivo('auth')
                  if (id === 'admin' && sessao) {
                    const data = await buscarPainelAdmin(sessao.usuario_id)
                    setAdminData(data)
                  }
                  setActiveTab(id)
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button className="foundy-icon-button" type="button" aria-label="Buscar" onClick={() => setModalAtivo('busca')}>
              <Search size={18} />
            </button>
            <button className="foundy-icon-button relative" type="button" aria-label="Notificações" onClick={() => requireSession('notificacoes', 'Entre para ver suas notificações.')}>
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
          <UserSection painel={painel} sessao={sessao} onOpenProfile={() => setModalAtivo('perfil')} onOpenChats={() => setModalAtivo('chats')} onDeleteItem={(id) => void apagarMeuItem(id)} onDeleteAlert={(id) => void apagarMeuAlerta(id)} />
        ) : activeTab === 'empresas' ? (
          <EmpresasSection empresas={empresas} busca={empresaBusca} catalogo={catalogoEmpresa} empresaSelecionada={empresaSelecionada} mensagem={catalogoMensagem} onBuscaChange={setEmpresaBusca} onSelecionarEmpresa={(empresa) => void abrirEmpresa(empresa)} onVoltar={() => { setEmpresaSelecionada(null); setCatalogoEmpresa([]) }} />
        ) : activeTab === 'empresaPainel' && sessao?.tipo_conta === 'empresa' ? (
          <EmpresaPainelSection sessao={sessao} onMensagem={setMensagemSistema} />
        ) : activeTab === 'admin' && sessao && adminData ? (
          <AdminSection data={adminData} adminId={sessao.usuario_id} onRefresh={async () => setAdminData(await buscarPainelAdmin(sessao.usuario_id))} />
        ) : (
          <RadarSection
            viewMode={activeTab === 'mapa' ? 'mapa' : 'feed'}
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
              setClaimAtual(null)
              setModalAtivo('desafio')
              return true
            }}
            onFocusItem={selecionarItemNoMapa}
          />
        )}
      </section>

      <Footer />

      <button className="foundy-fab foundy-pressable fixed bottom-6 left-1/2 z-40 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-foundy-blue text-white shadow-2xl shadow-foundy-blue/35" type="button" aria-label="Abrir ações rápidas" onClick={() => setModalAtivo('acao')}>
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
      {modalAtivo === 'resposta-enviada' ? <ModalRespostaEnviada onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'aguardando' ? <ModalAguardandoValidacao reivindicacaoId={reivindicacaoId} claim={claimAtual} onClose={() => setModalAtivo(null)} onValidar={(aprovada) => void validarRespostaComoEncontrador(aprovada)} /> : null}
      {modalAtivo === 'chat' ? (
        <ModalChatSeguro
          sessao={sessao}
          item={itemSelecionado}
          chat={chatAtual}
          chatCarregando={chatCarregando}
          mensagens={mensagensChat}
          feedback={chatFeedback}
          valorAtual={mensagemChatAtual}
          onChangeValor={setMensagemChatAtual}
          onEnviar={() => void enviarMensagemNoChat()}
          onDenunciar={(motivo, prova, arquivo, mensagemId) => salaChatId && sessao ? void denunciarExtorsao(salaChatId, sessao.usuario_id, motivo, mensagemId, prova, arquivo).then((res) => { setMensagemSistema(res.mensagem); setChatFeedback(res.mensagem) }) : undefined}
          denunciarDisponivel={denunciaDisponivel}
          podeAvaliar={Boolean(sessao && chatAtual?.dono_usuario_id === sessao.usuario_id && chatAtual.encontrador_usuario_id)}
          onConfirmarDevolucao={(nota) => {
            const chatSelecionado = chatAtual
            if (!sessao || !chatSelecionado?.encontrador_usuario_id) return
            return confirmarDevolucaoComAvaliacao({
              item_achado_id: chatSelecionado.item_achado_id,
              encontrador_usuario_id: chatSelecionado.encontrador_usuario_id,
              dono_usuario_id: sessao.usuario_id,
              nota,
            }).then((resposta) => {
              setMensagemSistema(resposta.mensagem)
              setChatAtual((atual) => (atual ? { ...atual, status: 'encerrado' } : atual))
              setItens((atuais) => atuais.filter((item) => item.id !== chatSelecionado.item_achado_id))
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
  viewMode,
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
  viewMode: 'feed' | 'mapa'
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
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-5xl">{viewMode === 'mapa' ? 'Mapa vivo dos achados perto de você.' : 'O que se perdeu, volta com segurança.'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foundy-muted sm:text-base">
              Encontre itens por região aproximada, converse após prova de posse e combine devoluções em locais públicos.
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

        {viewMode === 'mapa' ? <MapaInterativo itens={itens} itemSelecionado={itemSelecionado} onSelecionarItem={onSelectItem} userLocation={localUsuario} /> : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foundy-border bg-foundy-background/70 p-4">
          <p className="text-sm text-foundy-muted" aria-live="polite">{mensagemSistema}</p>
          <button className="foundy-pressable inline-flex h-10 items-center gap-2 rounded-xl border border-foundy-border px-3 text-sm font-semibold" type="button" onClick={onRefresh}>
            <Sparkles size={16} /> Atualizar
          </button>
        </div>
      </div>

      {viewMode === 'feed' ? <section className="grid gap-4" aria-label="Feed de itens achados">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">Itens achados perto de você</h2>
          <span className="text-sm text-foundy-muted">{itens.length} de {totalItens}</span>
        </div>
        {itens.map((item) => <ItemCard item={item} key={item.id} distance={getDistance(item)} onClaim={onClaim} onFocus={onFocusItem} />)}
        {!carregando && itens.length === 0 ? <EmptyState title="Nenhum item encontrado" text="Abra a lupa para ajustar os filtros ou crie um alerta de perda." /> : null}
        {carregando ? <p className="text-sm text-foundy-muted">Atualizando feed...</p> : null}
      </section> : null}
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

function UserSection({
  painel,
  sessao,
  onOpenProfile,
  onOpenChats,
  onDeleteItem,
  onDeleteAlert,
}: {
  painel: UserDashboard | null
  sessao: FoundySession
  onOpenProfile: () => void
  onOpenChats: () => void
  onDeleteItem: (itemId: string) => void
  onDeleteAlert: (alertaId: string) => void
}) {
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
      <PanelList title="Meus itens postados" empty="Você ainda não publicou itens achados.">
        {(painel?.itens_postados ?? []).map((item) => (
          <SimpleRow
            key={item.id}
            title={item.titulo}
            text={`${categorias[item.categoria].label} - ${item.status}`}
            action={item.status !== 'devolvido' && item.status !== 'arquivado' ? <button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-200" type="button" onClick={() => onDeleteItem(item.id)}>Apagar</button> : null}
          />
        ))}
      </PanelList>
      <PanelList title="Notificações de perdas" empty="Nenhum alerta de perda criado ainda.">
        {(painel?.alertas_perdidos ?? []).map((alerta) => (
          <SimpleRow
            key={alerta.id}
            title={alerta.titulo}
            text={alerta.status}
            action={alerta.status !== 'arquivado' ? <button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-200" type="button" onClick={() => onDeleteAlert(alerta.id)}>Arquivar</button> : null}
          />
        ))}
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
        <TrustCard title="Local público" text="Nunca combine retirada em residência, local isolado ou estacionamento vazio." />
        <TrustCard title="Luz do dia" text="Marque entre 8h e 18h, em áreas movimentadas e monitoradas." />
        <TrustCard title="Sem crianças" text="O Foundy é estritamente proibido para menores de 18 anos." />
        <TrustCard title="Empresas como catálogo" text="Instituições organizam itens para retirada presencial no local informado, sem chat ou segredo." />
        <TrustCard title="Sem extorsão" text="PIX, taxa, frete antecipado, cobrança e resgate violam os termos e podem gerar denúncia." />
        <TrustCard title="Dados protegidos" text="Documentos, telefones, e-mails e endereços exatos devem ser ocultados antes de qualquer publicação." />
      </div>
    </section>
  )
}

function EmpresasSection({
  empresas,
  busca,
  catalogo,
  empresaSelecionada,
  mensagem,
  onBuscaChange,
  onSelecionarEmpresa,
  onVoltar,
}: {
  empresas: EmpresaFoundy[]
  busca: string
  catalogo: EmpresaCatalogoItem[]
  empresaSelecionada: EmpresaFoundy | null
  mensagem: string
  onBuscaChange: (value: string) => void
  onSelecionarEmpresa: (empresa: EmpresaFoundy) => void
  onVoltar: () => void
}) {
  if (empresaSelecionada) {
    return (
      <section className="grid gap-4">
        <div className="foundy-hero-panel rounded-3xl border border-foundy-border bg-foundy-surface p-5">
          <button className="mb-4 rounded-xl border border-foundy-border px-3 py-2 text-sm font-bold" type="button" onClick={onVoltar}>Voltar para empresas</button>
          <p className="foundy-eyebrow text-sm font-semibold text-foundy-green">Catálogo institucional</p>
          <h1 className="mt-2 text-3xl font-black">{empresaSelecionada.empresa_nome ?? empresaSelecionada.nome}</h1>
          <p className="mt-2 text-sm leading-6 text-foundy-muted">{empresaSelecionada.empresa_descricao ?? 'Achados e perdidos organizados pela instituição.'}</p>
          <p className="mt-3 rounded-2xl border border-foundy-border bg-foundy-background/75 p-3 text-sm text-foundy-muted">
            Retirada presencial: {empresaSelecionada.empresa_endereco_publico ?? 'endereço informado pela instituição'}.
          </p>
        </div>
        <p className="rounded-2xl border border-foundy-border bg-foundy-surface p-4 text-sm text-foundy-muted">{mensagem}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {catalogo.map((item) => (
            <article className="foundy-item-card overflow-hidden rounded-3xl border border-foundy-border bg-foundy-surface" key={item.id}>
              <img src={item.imagem_url ?? placeholdersPorCategoria[item.categoria]} alt={`Imagem de ${item.titulo}`} className="h-44 w-full object-cover" />
              <div className="grid gap-2 p-4">
                <span className="w-fit rounded-full bg-foundy-blue/15 px-3 py-1 text-xs font-bold text-foundy-blue">{categorias[item.categoria].label}</span>
                <h2 className="text-lg font-black">{item.titulo}</h2>
                <p className="text-sm leading-6 text-foundy-muted">{item.descricao}</p>
                {item.codigo_interno ? <p className="text-xs text-foundy-muted">Código interno: {item.codigo_interno}</p> : null}
                <p className="rounded-xl border border-foundy-green/30 bg-foundy-green/10 p-3 text-sm text-foundy-green">
                  Este catálogo não tem chat nem reivindicação online. A retirada deve ser feita diretamente na instituição.
                </p>
              </div>
            </article>
          ))}
        </div>
        {catalogo.length === 0 ? <EmptyState title="Catálogo vazio" text="A empresa ainda não publicou itens disponíveis." /> : null}
      </section>
    )
  }

  return (
    <section className="grid gap-4">
      <div className="foundy-hero-panel rounded-3xl border border-foundy-border bg-foundy-surface p-5">
        <p className="foundy-eyebrow foundy-attention text-sm font-semibold text-foundy-green">Foundy Empresas</p>
        <h1 className="mt-2 text-3xl font-black">Catálogos de achados e perdidos de instituições.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foundy-muted">Escolas, lojas, shoppings e faculdades podem organizar itens achados sem expor localização pessoal, segredo ou chat.</p>
      </div>
      <div className="foundy-search-input flex items-center gap-3 rounded-2xl border border-foundy-border bg-foundy-surface px-4 py-3">
        <Search size={20} />
        <input className="w-full bg-transparent outline-none" value={busca} onChange={(event) => onBuscaChange(event.target.value)} placeholder="Pesquisar empresa, cidade ou instituição..." />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {empresas.map((empresa) => (
          <button className="foundy-pressable rounded-3xl border border-foundy-border bg-foundy-surface p-5 text-left" key={empresa.id} type="button" onClick={() => onSelecionarEmpresa(empresa)}>
            <div className="flex items-start gap-4">
              {empresa.foto_url ? <img src={empresa.foto_url} alt="" className="size-14 rounded-2xl object-cover" /> : <span className="grid size-14 place-items-center rounded-2xl bg-foundy-blue/20 text-foundy-blue"><Building2 size={24} /></span>}
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-foundy-green">{empresa.empresa_verificada ? 'Empresa verificada' : 'Catálogo empresarial'}</p>
                <h2 className="mt-1 text-xl font-black">{empresa.empresa_nome ?? empresa.nome}</h2>
                <p className="mt-1 text-sm text-foundy-muted">{empresa.empresa_cidade}{empresa.empresa_uf ? `/${empresa.empresa_uf}` : ''}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-foundy-muted">{empresa.empresa_descricao ?? 'Clique para ver o catálogo público de itens disponíveis.'}</p>
          </button>
        ))}
      </div>
      {empresas.length === 0 ? <EmptyState title="Nenhuma empresa encontrada" text="Quando uma instituição criar uma conta empresarial, ela aparecerá aqui." /> : null}
    </section>
  )
}

function EmpresaPainelSection({ sessao, onMensagem }: { sessao: FoundySession; onMensagem: (value: string) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [itens, setItens] = useState<EmpresaCatalogoItem[]>([])
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<ItemCategory>('outros')
  const [codigo, setCodigo] = useState('')
  const [local, setLocal] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [mensagem, setMensagem] = useState('Cadastre itens encontrados para organizar o balcão de achados e perdidos.')

  const carregar = useCallback(async () => {
    const lista = await listarCatalogoEmpresa(sessao.usuario_id, '')
    setItens(lista)
  }, [sessao.usuario_id])

  useEffect(() => {
    void carregar().catch(() => setMensagem('Não foi possível carregar seu catálogo empresarial.'))
  }, [carregar])

  function selecionarImagem(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (categoria === 'documentos') {
      setImagemUrl('')
      setMensagem('Documento selecionado: a foto não será publicada no catálogo.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImagemUrl(String(reader.result))
    reader.readAsDataURL(file)
  }

  async function criar() {
    if (!titulo.trim() || !descricao.trim()) return setMensagem('Preencha título e descrição do item.')
    try {
      await criarItemCatalogoEmpresa(sessao.usuario_id, {
        usuario_id: sessao.usuario_id,
        titulo,
        descricao,
        categoria,
        codigo_interno: codigo,
        local_armazenamento: local,
        imagem_url: categoria === 'documentos' ? null : imagemUrl || null,
      })
      setTitulo('')
      setDescricao('')
      setCodigo('')
      setLocal('')
      setImagemUrl('')
      setMensagem('Item adicionado ao catálogo empresarial.')
      onMensagem('Catálogo empresarial atualizado.')
      await carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível cadastrar o item.')
    }
  }

  async function mudarStatus(itemId: string, statusItem: 'disponivel' | 'retirado' | 'arquivado') {
    try {
      const resposta = await atualizarStatusCatalogoEmpresa(itemId, sessao.usuario_id, statusItem)
      setMensagem(resposta.mensagem)
      await carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível atualizar o item.')
    }
  }

  return (
    <section className="grid gap-4">
      <div className="foundy-hero-panel rounded-3xl border border-foundy-border bg-foundy-surface p-5">
        <p className="foundy-eyebrow text-sm font-semibold text-foundy-green">Painel empresarial</p>
        <h1 className="mt-2 text-3xl font-black">{sessao.empresa_nome || sessao.nome}</h1>
        <p className="mt-2 text-sm leading-6 text-foundy-muted">Catálogo interno para achados e perdidos. Sem chat, sem desafio oculto e sem geolocalização.</p>
      </div>
      <div className="grid gap-4 rounded-3xl border border-foundy-border bg-foundy-surface p-4">
        <h2 className="text-xl font-black">Adicionar item ao catálogo</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título"><input className="foundy-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} /></Field>
          <Field label="Categoria"><select className="foundy-input" value={categoria} onChange={(event) => setCategoria(event.target.value as ItemCategory)}>{Object.entries(categorias).map(([value, data]) => <option key={value} value={value}>{data.label}</option>)}</select></Field>
        </div>
        <Field label="Descrição"><textarea className="foundy-input min-h-24" value={descricao} onChange={(event) => setDescricao(event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Código interno"><input className="foundy-input" value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="Ex.: BALCÃO-042" /></Field>
          <Field label="Local de armazenamento"><input className="foundy-input" value={local} onChange={(event) => setLocal(event.target.value)} placeholder="Ex.: gaveta 2, secretaria" /></Field>
        </div>
        <button className="h-11 rounded-xl border border-foundy-border text-sm font-bold" type="button" onClick={() => fileRef.current?.click()}>{categoria === 'documentos' ? 'Documento: foto bloqueada' : 'Adicionar foto opcional'}</button>
        <input className="sr-only" ref={fileRef} type="file" accept="image/*" onChange={selecionarImagem} />
        {imagemUrl ? <img src={imagemUrl} alt="Prévia do catálogo" className="h-40 rounded-2xl object-cover" /> : null}
        <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
        <button className="h-11 rounded-xl bg-foundy-green text-sm font-black text-slate-950" type="button" onClick={() => void criar()}>Publicar no catálogo</button>
      </div>
      <PanelList title="Itens do catálogo" empty="Nenhum item empresarial cadastrado.">
        {itens.map((item) => (
          <div className="grid gap-2 rounded-2xl border border-foundy-border bg-foundy-background p-3" key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">{item.titulo}</p>
                <p className="text-xs text-foundy-muted">{categorias[item.categoria].label} - {item.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl border border-foundy-border px-3 py-2 text-xs font-bold" type="button" onClick={() => void mudarStatus(item.id, 'retirado')}>Retirado</button>
                <button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-bold text-red-200" type="button" onClick={() => void mudarStatus(item.id, 'arquivado')}>Arquivar</button>
              </div>
            </div>
          </div>
        ))}
      </PanelList>
    </section>
  )
}

function AdminSection({ data, adminId, onRefresh }: { data: { usuarios: unknown[]; itens: ItemAchado[]; moderacao: unknown[]; denuncias?: unknown[] }; adminId: string; onRefresh: () => void }) {
  return (
    <section className="grid gap-4">
      <div className="foundy-hero-panel rounded-3xl border border-red-400/30 bg-foundy-surface p-5">
        <p className="foundy-eyebrow text-sm font-semibold text-red-200">Admin Foundy</p>
        <h1 className="mt-2 text-3xl font-black">Moderação restrita ao e-mail oficial.</h1>
        <p className="mt-2 text-sm text-foundy-muted">Apenas {supportEmail} deve enxergar e operar esta área.</p>
      </div>
      <ModalAdmin data={data} adminId={adminId} onClose={() => undefined} onRefresh={onRefresh} embedded />
    </section>
  )
}

function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-28 sm:px-6 lg:px-8">
      <div className="foundy-footer-card rounded-3xl border border-foundy-border p-5">
        <div className="relative z-10 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="foundy-eyebrow text-xs font-semibold text-foundy-green">Comunidade segura</p>
            <p className="mt-2 text-lg font-black">Foundy protege pessoas antes de proteger objetos.</p>
            <p className="mt-2 text-sm leading-6 text-foundy-muted">Dúvidas, sugestões ou denúncias importantes: <a className="font-bold text-foundy-green underline-offset-4 hover:underline" href={supportMailto}>{supportEmail}</a></p>
          </div>
          <p className="text-sm font-bold text-foundy-muted">Criado por Diego Corazza e Gustavo Alves.</p>
        </div>
      </div>
    </footer>
  )
}

function ModalBase({ titulo, subtitulo, onClose, children, large = false }: { titulo: string; subtitulo?: string; onClose: () => void; children: ReactNode; large?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/65 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true">
      <section className={`foundy-modal-panel max-h-[92dvh] w-full overflow-auto rounded-3xl border border-foundy-border bg-foundy-surface shadow-2xl ${large ? 'max-w-5xl' : 'max-w-2xl'}`}>
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
  const [tipoConta, setTipoConta] = useState<'pessoal' | 'empresa'>('pessoal')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [maior, setMaior] = useState(false)
  const [termos, setTermos] = useState(false)
  const [termosLidos, setTermosLidos] = useState(false)
  const [emailNotificacoes, setEmailNotificacoes] = useState(true)
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaDescricao, setEmpresaDescricao] = useState('')
  const [empresaEndereco, setEmpresaEndereco] = useState('')
  const [empresaCidade, setEmpresaCidade] = useState('')
  const [empresaUf, setEmpresaUf] = useState('')
  const [mensagem, setMensagem] = useState('Crie sua conta para publicar, conversar e receber alertas.')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (!email.includes('@')) return setMensagem('Informe um e-mail valido.')
    if (senha.length < 8) return setMensagem('A senha precisa ter pelo menos 8 caracteres.')
    if (modo === 'cadastrar' && nome.trim().length < 2) return setMensagem('Informe seu nome.')
    if (modo === 'cadastrar' && tipoConta === 'empresa' && (!empresaNome.trim() || !empresaEndereco.trim() || !empresaCidade.trim() || empresaUf.trim().length !== 2)) return setMensagem('Informe os dados públicos da instituição para criar a conta empresarial.')
    if (modo === 'cadastrar' && (!maior || !termos || !termosLidos)) return setMensagem('Leia as diretrizes, confirme maioridade e aceite os termos para continuar.')

    setEnviando(true)
    try {
      if (modo === 'cadastrar') {
        const resposta = await cadastrarUsuario({
          nome,
          email,
          senha,
          maior_de_idade: maior,
          aceitou_termos: termos,
          aceita_notificacoes_email: emailNotificacoes,
          tipo_conta: tipoConta,
          ...(tipoConta === 'empresa'
            ? {
                empresa_nome: empresaNome,
                empresa_descricao: empresaDescricao,
                empresa_endereco_publico: empresaEndereco,
                empresa_cidade: empresaCidade,
                empresa_uf: empresaUf,
              }
            : {}),
        })
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
        {modo === 'cadastrar' ? (
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-foundy-border bg-foundy-background p-1">
            <button className={`rounded-xl px-3 py-2 text-sm font-black ${tipoConta === 'pessoal' ? 'bg-foundy-green text-slate-950' : 'text-foundy-muted'}`} type="button" onClick={() => setTipoConta('pessoal')}>Pessoa física</button>
            <button className={`rounded-xl px-3 py-2 text-sm font-black ${tipoConta === 'empresa' ? 'bg-foundy-green text-slate-950' : 'text-foundy-muted'}`} type="button" onClick={() => setTipoConta('empresa')}>Empresa</button>
          </div>
        ) : null}
        {modo === 'cadastrar' ? <Field label="Nome"><input className="foundy-input" value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Seu nome" autoComplete="name" /></Field> : null}
        {modo === 'cadastrar' && tipoConta === 'empresa' ? (
          <div className="grid gap-3 rounded-3xl border border-foundy-green/30 bg-foundy-green/10 p-4">
            <h3 className="font-black text-foundy-green">Dados públicos da instituição</h3>
            <Field label="Nome da empresa ou instituição"><input className="foundy-input" value={empresaNome} onChange={(event) => setEmpresaNome(event.target.value)} placeholder="Ex.: Faculdade Centro Norte" /></Field>
            <Field label="Descrição curta"><textarea className="foundy-input min-h-20" value={empresaDescricao} onChange={(event) => setEmpresaDescricao(event.target.value)} placeholder="Ex.: Catálogo oficial de achados e perdidos do campus." /></Field>
            <Field label="Endereço público de retirada"><input className="foundy-input" value={empresaEndereco} onChange={(event) => setEmpresaEndereco(event.target.value)} placeholder="Ex.: Secretaria, Bloco A, Rua..." /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cidade"><input className="foundy-input" value={empresaCidade} onChange={(event) => setEmpresaCidade(event.target.value)} /></Field>
              <Field label="UF"><input className="foundy-input uppercase" value={empresaUf} onChange={(event) => setEmpresaUf(event.target.value.toUpperCase().slice(0, 2))} maxLength={2} /></Field>
            </div>
          </div>
        ) : null}
        <Field label="E-mail"><input className="foundy-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" type="email" autoComplete="email" /></Field>
        <Field label="Senha"><input className="foundy-input" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Minimo de 8 caracteres" type="password" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} /></Field>
        {modo === 'cadastrar' ? (
          <div className="grid gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm">
            <div className="rounded-2xl border border-foundy-blue/30 bg-foundy-blue/10 p-3">
              <p className="font-black text-foundy-blue">Diretrizes obrigatórias antes de aceitar</p>
              <p className="mt-2 leading-6 text-foundy-muted">O Foundy é proibido para menores de 18 anos. Não marque encontros em locais isolados, não exponha documentos, não peça pagamento, PIX, frete antecipado ou resgate. Empresas usam a plataforma apenas como catálogo público de retirada presencial.</p>
              <button className="mt-3 rounded-xl bg-foundy-blue px-3 py-2 text-xs font-black text-white" type="button" onClick={() => setTermosLidos(true)}>Li as diretrizes acima</button>
            </div>
            <label className="flex gap-3"><input checked={maior} onChange={(event) => setMaior(event.target.checked)} type="checkbox" /> Confirmo que tenho 18 anos ou mais.</label>
            <label className={`flex gap-3 ${!termosLidos ? 'opacity-50' : ''}`}><input checked={termos} disabled={!termosLidos} onChange={(event) => setTermos(event.target.checked)} type="checkbox" /> Li e aceito os Termos de Uso, LGPD e Protocolo de Segurança.</label>
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
    <ModalBase titulo="Notificações" subtitulo="Clique para ir direto ao chat, item ou validação." onClose={onClose}>
      <div className="grid gap-3 p-4">
        {notificacoes.length === 0 ? <EmptyState title="Sem notificações" text="Quando algo importante acontecer, o sininho avisa." /> : null}
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
    <ModalBase titulo="Meus chats" subtitulo="Conversas liberadas após o desafio do dono." onClose={onClose} large>
      <div className="grid gap-4 p-4">
        {chats.length === 0 ? <EmptyState title="Nenhum chat ainda" text="Quando uma resposta for aprovada, a conversa aparece aqui." /> : null}
        {chats.map((chat) => (
          <button className="foundy-pressable grid gap-3 rounded-3xl border border-foundy-border bg-foundy-background p-4 text-left md:grid-cols-[auto_1fr_auto]" key={chat.id} type="button" onClick={() => onOpen(chat)}>
            {chat.outro_usuario_foto_url ? <img src={chat.outro_usuario_foto_url} alt="" className="size-14 rounded-2xl object-cover" /> : <span className="grid size-14 place-items-center rounded-2xl bg-foundy-blue/20 text-xl font-black text-foundy-blue">{(chat.outro_usuario_nome ?? 'F').charAt(0)}</span>}
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-foundy-green">{chat.status === 'encerrado' ? 'Resolvido' : 'Chat ativo'}</p>
              <p className="font-black">{chat.outro_usuario_nome ?? 'Participante Foundy'} - {chat.item_titulo}</p>
              <p className="mt-1 line-clamp-3 text-sm text-foundy-muted">{chat.ultima_mensagem ?? 'Conversa pronta para iniciar.'}</p>
            </div>
            <span className="h-fit rounded-full bg-foundy-green/20 px-3 py-1 text-xs font-bold text-foundy-green">{chat.ultima_mensagem_em ? new Date(chat.ultima_mensagem_em).toLocaleDateString('pt-BR') : chat.status}</span>
          </button>
        ))}
      </div>
    </ModalBase>
  )
}

function ModalChatSeguro({
  sessao,
  item,
  chat,
  chatCarregando,
  mensagens,
  feedback,
  valorAtual,
  onChangeValor,
  onEnviar,
  onDenunciar,
  denunciarDisponivel,
  podeAvaliar,
  onConfirmarDevolucao,
  onClose,
}: {
  sessao: FoundySession | null
  item: ItemAchado | null
  chat: ChatSummary | null
  chatCarregando: boolean
  mensagens: MensagemChat[]
  feedback: string
  valorAtual: string
  onChangeValor: (value: string) => void
  onEnviar: () => void
  onDenunciar: (motivo: string, prova?: string, arquivo?: string, mensagemId?: string) => void
  denunciarDisponivel: boolean
  podeAvaliar: boolean
  onConfirmarDevolucao: (nota: number) => void | Promise<void>
  onClose: () => void
}) {
  const [nota, setNota] = useState(10)
  const [avaliando, setAvaliando] = useState(false)
  const [perfilAberto, setPerfilAberto] = useState(false)
  const [motivoDenuncia, setMotivoDenuncia] = useState('')
  const [provaDenuncia, setProvaDenuncia] = useState('')
  const [arquivoProva, setArquivoProva] = useState('')
  const [mensagemAvaliacao, setMensagemAvaliacao] = useState('Depois da entrega, avalie o encontrador para atualizar o karma.')
  const chatEncerrado = chat?.status === 'encerrado'
  const outraPessoa = chat?.outro_usuario_nome ?? 'Participante Foundy'
  const outraPessoaInicial = outraPessoa.charAt(0).toUpperCase()
  const hasRisk = denunciarDisponivel || mensagens.some((mensagem) => mensagem.status_moderacao === 'suspeita_extorsao')

  async function confirmarAvaliacao() {
    setAvaliando(true)
    try {
      await onConfirmarDevolucao(nota)
      setMensagemAvaliacao(`Devolução confirmada com nota ${nota}/10. Obrigado por fortalecer a comunidade.`)
    } catch (error) {
      setMensagemAvaliacao(error instanceof Error ? error.message : 'Não foi possível confirmar a devolução.')
    } finally {
      setAvaliando(false)
    }
  }

  return (
    <ModalBase titulo="Chat privado de recuperação" subtitulo={item ? `Item: ${item.titulo}` : chat?.item_titulo ?? 'Conversa segura'} onClose={onClose} large>
      <div className="grid gap-0 md:grid-cols-[320px_1fr]">
        <aside className="border-b border-foundy-border bg-foundy-background/80 p-4 md:border-b-0 md:border-r">
          <div className="flex items-center gap-3">
            {chat?.outro_usuario_foto_url ? <img src={chat.outro_usuario_foto_url} alt="" className="size-14 rounded-2xl object-cover" /> : <span className="grid size-14 place-items-center rounded-2xl bg-foundy-blue/20 text-xl font-black text-foundy-blue">{outraPessoaInicial}</span>}
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-foundy-green">{chatEncerrado ? 'Conversa resolvida' : 'Conversa segura'}</p>
              <h3 className="text-lg font-black">{outraPessoa}</h3>
              <p className="text-xs text-foundy-muted">{chat?.outro_usuario_ocupacao || chat?.outro_usuario_badge || 'Perfil Foundy'}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 rounded-2xl border border-foundy-border bg-foundy-surface p-3 text-sm">
            <p className="font-black">{chat?.item_titulo ?? item?.titulo ?? 'Item em recuperação'}</p>
            <p className="text-foundy-muted">Combine retirada somente em local público, movimentado e durante o dia.</p>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-foundy-border text-sm font-bold" type="button" onClick={() => setPerfilAberto((open) => !open)}>
              <Info size={16} /> Perfil e denúncia
            </button>
          </div>
          {perfilAberto ? (
            <div className="mt-3 grid gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm">
              <p className="font-black text-red-100">Denunciar usuário</p>
              <p className="text-red-100/80">Use quando houver ameaça, pedido de PIX, resgate, pagamento antecipado ou comportamento inseguro.</p>
              <textarea className="foundy-input min-h-20" value={motivoDenuncia} onChange={(event) => setMotivoDenuncia(event.target.value)} placeholder="Explique o motivo da denúncia..." />
              <input className="foundy-input" value={provaDenuncia} onChange={(event) => setProvaDenuncia(event.target.value)} placeholder="Descreva o print/prova. Ex.: print da mensagem com pedido de PIX." />
              <input className="foundy-input" type="file" accept="image/*" onChange={(event) => setArquivoProva(event.target.files?.[0]?.name ?? '')} />
              {arquivoProva ? <p className="text-xs text-red-100/80">Print selecionado: {arquivoProva}</p> : null}
              <button className="h-10 rounded-xl bg-red-500 text-sm font-black text-white" type="button" onClick={() => onDenunciar(motivoDenuncia.trim().length >= 5 ? motivoDenuncia : 'Denúncia enviada pelo perfil do chat.', provaDenuncia, arquivoProva)}>
                Enviar denúncia ao suporte
              </button>
            </div>
          ) : null}
        </aside>
        <section className="grid min-h-[62dvh] grid-rows-[auto_1fr_auto]">
          <div className={`border-b p-4 text-sm ${hasRisk ? 'border-red-400/40 bg-red-500/10 text-red-100' : 'border-foundy-green/30 bg-foundy-green/10 text-foundy-green'}`}>
            <div className="flex items-start gap-3">
              {hasRisk ? <Flag size={18} /> : <CheckCircle2 size={18} />}
              <div>
                <p className="font-black">{hasRisk ? 'Atenção: possível risco detectado' : 'Chat protegido pelo Protocolo Foundy'}</p>
                <p className="mt-1">{hasRisk ? 'O botão de denúncia está disponível no perfil ao lado. Nunca pague resgate, PIX ou taxa antecipada.' : 'As mensagens aparecem em tempo real quando o Supabase Realtime estiver ativo, com atualização automática como reforço.'}</p>
              </div>
            </div>
          </div>
          <div className="foundy-chat-window max-h-[58dvh] space-y-3 overflow-auto bg-foundy-background p-4">
            {chatCarregando ? <p className="text-sm text-foundy-muted">Atualizando mensagens...</p> : null}
            {!chatCarregando && mensagens.length === 0 ? <EmptyState title="Conversa vazia" text="Envie a primeira mensagem. Ela deve aparecer aqui para você e para a outra pessoa." /> : null}
            {mensagens.map((mensagem) => {
              const isMine = mensagem.remetente_usuario_id === sessao?.usuario_id
              const flagged = mensagem.status_moderacao === 'suspeita_extorsao'
              return (
                <article className={`flex ${isMine ? 'justify-end' : 'justify-start'}`} key={mensagem.id}>
                  <div className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm shadow-lg ${isMine ? 'rounded-br-md bg-foundy-blue text-white' : 'rounded-bl-md bg-foundy-surface text-foundy-foreground'} ${flagged ? 'ring-2 ring-red-400/70' : ''}`}>
                    <p className="whitespace-pre-wrap leading-6">{mensagem.mensagem}</p>
                    {flagged ? <p className="mt-2 rounded-xl bg-red-500/20 p-2 text-xs text-red-100">Mensagem sinalizada: {mensagem.motivos_moderacao.join(' ')}</p> : null}
                    <div className="mt-2 flex items-center justify-end gap-1 text-[11px] opacity-75"><Clock size={12} /> {new Date(mensagem.criado_em).toLocaleString('pt-BR')}</div>
                  </div>
                </article>
              )
            })}
          </div>
          <div className="border-t border-foundy-border bg-foundy-surface p-4">
            {feedback ? <p className="mb-3 rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{feedback}</p> : null}
            {chatEncerrado ? (
              <p className="rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-4 text-sm text-foundy-green">Este chat foi resolvido e ficou salvo apenas no histórico.</p>
            ) : (
              <div className="flex gap-2">
                <textarea className="foundy-input min-h-12 flex-1 resize-none" value={valorAtual} onChange={(event) => onChangeValor(event.target.value)} placeholder="Escreva uma mensagem segura..." />
                <button className="grid size-12 shrink-0 place-items-center rounded-2xl bg-foundy-blue text-white" type="button" onClick={onEnviar} aria-label="Enviar mensagem"><Send size={18} /></button>
              </div>
            )}
          </div>
        </section>
        <div className="grid gap-4 p-4 md:col-span-2">
        {podeAvaliar ? (
          <div className="grid gap-3 rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black text-foundy-green">Confirmar devolução e karma</p>
                <p className="mt-1 text-sm text-foundy-muted">{mensagemAvaliacao}</p>
              </div>
              <Star className="text-foundy-green" size={22} />
            </div>
            <Field label={`Nota da entrega: ${nota}/10`}>
              <input type="range" min={0} max={10} value={nota} onChange={(event) => setNota(Number(event.target.value))} />
            </Field>
            <button className="h-11 rounded-xl bg-foundy-green text-sm font-black text-slate-950 disabled:opacity-60" type="button" disabled={avaliando} onClick={() => void confirmarAvaliacao()}>
              {avaliando ? 'Confirmando...' : 'Confirmar devolução'}
            </button>
          </div>
        ) : null}
        </div>
      </div>
    </ModalBase>
  )
}

function ModalOnboarding({ onClose }: { onClose: () => void }) {
  const steps = [
    ['1', 'Publique ou busque', 'Escolha Perdi algo ou Achei algo e descreva sem dados sensíveis.'],
    ['2', 'Prove que é seu', 'Use o detalhe oculto para liberar a conversa apenas para quem realmente conhece o item.'],
    ['3', 'Combine com segurança', 'Encontro público, de dia, acompanhado e sem pagamento antecipado.'],
    ['4', 'Avalie a entrega', 'Depois da devolução, a nota vira Pontos de Luz para o encontrador.'],
  ]
  return (
    <ModalBase titulo="Como usar o Foundy com segurança" subtitulo="Um guia rápido em quadrinhos para evitar riscos." onClose={onClose}>
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

function ModalAdmin({ data, adminId, onClose, onRefresh, embedded = false }: { data: { usuarios: unknown[]; itens: ItemAchado[]; moderacao: unknown[]; denuncias?: unknown[] }; adminId: string; onClose: () => void; onRefresh: () => void; embedded?: boolean }) {
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
  const content = (
      <div className="grid gap-4 p-4">
        <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
        <PanelList title="Itens recentes" empty="Nenhum item.">{data.itens.map((item) => <div className="flex items-center justify-between gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3" key={item.id}><span className="text-sm font-bold">{item.titulo}</span><button className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => void arquivar(item.id)}><Trash2 size={14} /></button></div>)}</PanelList>
        <PanelList title="Denúncias de chat" empty="Nenhuma denúncia registrada.">{(data.denuncias ?? []).map((denuncia) => { const item = denuncia as { id: string; motivo?: string; prova_descricao?: string; status?: string }; return <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3" key={item.id}><p className="text-sm font-black text-red-100">{item.motivo ?? 'Denúncia sem motivo detalhado'}</p><p className="mt-1 text-xs text-red-100/75">{item.prova_descricao ?? 'Sem descrição de prova.'} - {item.status ?? 'pendente'}</p></div> })}</PanelList>
        <PanelList title="Usuários" empty="Nenhum usuário.">{data.usuarios.map((usuario) => { const user = usuario as { id: string; nome?: string; email?: string }; return <div className="flex items-center justify-between gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3" key={user.id}><span className="text-sm font-bold">{user.nome ?? user.email ?? user.id}</span><button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-200" type="button" onClick={() => void banir(user)}><Ban size={14} /></button></div> })}</PanelList>
      </div>
  )
  if (embedded) {
    return <section className="rounded-3xl border border-foundy-border bg-foundy-surface">{content}</section>
  }
  return (
    <ModalBase titulo="Painel administrativo" subtitulo="Apagar itens, banir usuários e acompanhar moderação." onClose={onClose} large>
      {content}
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
    <ModalBase titulo="Nova ação rápida" subtitulo="Selecione o fluxo ideal." onClose={onClose}>
      <div className="grid gap-3 p-4">
        <button className="foundy-pressable inline-flex h-14 items-center justify-between rounded-2xl bg-red-500 px-4 text-left text-white" type="button" onClick={onEscolherPerdi}><span><strong className="block">Perdi algo</strong><span className="text-sm opacity-90">Criar alerta com perímetro</span></span><MapPin size={18} /></button>
        <button className="foundy-pressable inline-flex h-14 items-center justify-between rounded-2xl bg-foundy-green px-4 text-left text-slate-950" type="button" onClick={onEscolherAchei}><span><strong className="block">Achei algo</strong><span className="text-sm opacity-90">Publicar com desafio oculto</span></span><CheckCircle2 size={18} /></button>
      </div>
    </ModalBase>
  )
}

function ModalDesafio({ item, resposta, onRespostaChange, onConfirmar, onClose }: { item: ItemAchado; resposta: string; onRespostaChange: (value: string) => void; onConfirmar: () => void; onClose: () => void }) {
  return (
    <ModalBase titulo="Verificação do dono" subtitulo="O chat só abre após validação." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-2xl border border-foundy-blue/30 bg-foundy-blue/10 p-4"><p className="text-sm font-bold text-foundy-blue">Desafio</p><p className="mt-1">{item.desafio_pergunta ?? 'Informe um detalhe que so o dono saberia.'}</p></div>
        <Field label="Sua resposta"><input className="foundy-input" value={resposta} onChange={(event) => onRespostaChange(event.target.value)} /></Field>
        <button className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" type="button" onClick={onConfirmar}>Enviar resposta ao publicador</button>
      </div>
    </ModalBase>
  )
}

function ModalRespostaEnviada({ onClose }: { onClose: () => void }) {
  return (
    <ModalBase titulo="Resposta enviada" subtitulo="Agora é com quem publicou o item." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-3xl border border-foundy-green/30 bg-foundy-green/10 p-5">
          <CheckCircle2 className="mb-3 text-foundy-green" size={28} />
          <h3 className="text-xl font-black">Seu pedido foi enviado com segurança.</h3>
          <p className="mt-2 text-sm leading-6 text-foundy-muted">Você não precisa aprovar a própria resposta. Quem encontrou o item verá o texto que você escreveu e decidirá se o detalhe confere. Se aprovar, o chat aparece no seu sininho e no botão de conversas.</p>
        </div>
        <button className="h-11 rounded-xl bg-foundy-blue text-sm font-black text-white" type="button" onClick={onClose}>Entendi</button>
      </div>
    </ModalBase>
  )
}

function ModalAguardandoValidacao({ reivindicacaoId, claim, onClose, onValidar }: { reivindicacaoId: string | null; claim: ClaimSummary | null; onClose: () => void; onValidar: (aprovada: boolean) => void }) {
  return (
    <ModalBase titulo="Validacao do detalhe oculto" subtitulo="O encontrador decide se a resposta confere." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <p className="text-sm text-foundy-muted">Reivindicação atual: <strong>{reivindicacaoId ?? 'não identificada'}</strong>.</p>
        {claim ? (
          <div className="rounded-3xl border border-foundy-blue/30 bg-foundy-blue/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-foundy-blue">Resposta recebida de {claim.usuario_reivindicante_nome ?? 'um usuário'}</p>
            <h3 className="mt-2 font-black">{claim.item_titulo}</h3>
            <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-foundy-border bg-foundy-background p-4 text-sm leading-6">{claim.resposta_desafio}</p>
            {claim.usuario_reivindicante_ocupacao ? <p className="mt-2 text-xs text-foundy-muted">Perfil: {claim.usuario_reivindicante_ocupacao}</p> : null}
          </div>
        ) : (
          <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">Não consegui carregar os detalhes completos desta resposta agora. Abra novamente pelo sininho ou pela sua página.</p>
        )}
        <button className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" type="button" onClick={() => onValidar(true)}>A resposta esta correta</button>
        <button className="h-11 rounded-xl bg-red-500 px-4 text-sm font-black text-white" type="button" onClick={() => onValidar(false)}>A resposta esta incorreta</button>
      </div>
    </ModalBase>
  )
}

function ModalManifestoSeguranca({ onClose }: { onClose: () => void }) {
  return <ModalBase titulo="Segurança em Primeiro Lugar" subtitulo="O Protocolo Foundy." onClose={onClose}><div className="grid gap-3 p-4"><TrustCard title="Encontros apenas em locais públicos" text="Nunca marque em residência, local isolado ou estacionamento vazio." /><TrustCard title="Use a luz do dia" text="Marque entre 8h e 18h, em local movimentado." /><TrustCard title="Faça a pergunta secreta" text="Comprove posse antes do encontro." /><TrustCard title="Não vá sozinho" text="Leve um amigo ou familiar sempre que possível." /><TrustCard title="Empresas são catálogo" text="Instituições exibem itens para retirada presencial, sem chat, segredo ou reivindicação online." /><p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm">O Foundy é uma ponte digital. Não nos responsabilizamos por encontros físicos.</p></div></ModalBase>
}

function ModalTermosLgpd({ onClose }: { onClose: () => void }) {
  return <ModalBase titulo="Termos de Uso e LGPD" subtitulo="Resumo operacional." onClose={onClose}><div className="grid gap-3 p-4"><TrustCard title="Escopo do serviço" text="O Foundy aproxima pessoas que perderam e encontraram objetos. Não armazenamos, transportamos ou garantimos itens." /><TrustCard title="Privacidade" text="Localização exata, telefone, e-mail real e endereço residencial não devem ser exibidos publicamente." /><TrustCard title="Conduta proibida" text="É proibido cobrar resgate, pedir PIX antecipado, publicar itens ilegais ou expor dados sensíveis." /><TrustCard title="Contas empresariais" text="Empresas usam o Foundy como catálogo institucional. A retirada é presencial no endereço público informado pela instituição." /><TrustCard title="Uso proibido para menores" text="A plataforma é exclusiva para maiores de 18 anos." /></div></ModalBase>
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

function SimpleRow({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <article className="flex items-center justify-between gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3"><div><p className="text-sm font-black">{title}</p><p className="text-xs text-foundy-muted">{text}</p></div>{action}</article>
}
