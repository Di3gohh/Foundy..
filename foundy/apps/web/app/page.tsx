'use client'

import dynamic from 'next/dynamic'
import {
  Ban,
  Bell,
  Bike,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  Gem,
  Headphones,
  Info,
  Inbox,
  KeyRound,
  Laptop,
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
import type { ChangeEvent, MutableRefObject, ReactNode, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  adminArquivarItem,
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
  type LostAlert,
  type MensagemChat,
  type NotificationItem,
  type UserDashboard,
  abrirChatParaAlertaPerdido,
  listarAlertasPerdidosProximos,
  denunciarPost,
  adminAplicarMedidaUsuario,
  adminAvisarUsuario,
  adminDesbanirUsuario,
  adminDesarquivarItem,
  adminDesfazerModeracaoDenuncia,
  adminExcluirDenuncia,
  adminExcluirRegistroPermanente,
  adminResolverDenuncia,
  adminAtualizarApoioFoundy,
  adminAtualizarBoostAlerta,
  adminAtualizarSolicitacaoMonetizacao,
  atualizarPerfilPublicoEmpresa,
  buscarPerfilEmpresa,
  buscarPlanosMonetizacao,
  buscarQrCodeEmpresa,
  buscarRelatorioEmpresa,
  buscarPontosSegurosFoundy,
  criarApoioFoundy,
  criarEventoEmpresa,
  criarSolicitacaoMonetizacao,
  listarEventosEmpresa,
  marcarItemCatalogoRetirado,
  registrarCliquePontoSeguro,
  solicitarBoostAlerta,
  type CompanyEventPlan,
  type LossAlertBoost,
  type ManualPaymentInfo,
  type MonetizationPlan,
  type MonetizationPlansResponse,
  type MonetizationRequest,
  type SupportContribution,
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
      Carregando mapa do perímetro...
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
  | 'detalhe-item'
  | 'bloqueio-conta'
  | 'monetizacao'
  | 'apoiar'
  | 'solicitar-monetizacao'
  | 'boost-alerta'
  | null

type GeoPoint = { latitude: number; longitude: number }
type MainTab = 'feed' | 'mapa' | 'seguranca' | 'usuario' | 'empresas' | 'empresaPainel' | 'admin' | 'monetizacao'
type FeedMode = 'achados' | 'perdidos'
type ItemFilter =
  | 'todos'
  | 'chaves'
  | 'celulares'
  | 'fones'
  | 'notebooks'
  | 'documentos'
  | 'carteiras'
  | 'mochilas'
  | 'roupas'
  | 'pets'
  | 'bicicletas'
  | 'joias'
  | 'livros'
  | 'outros'

type AdminData = {
  usuarios: unknown[]
  empresas?: unknown[]
  itens: ItemAchado[]
  alertas_perdidos?: unknown[]
  itens_arquivados?: unknown[]
  moderacao: unknown[]
  denuncias?: unknown[]
  denuncias_posts?: unknown[]
  denuncias_resolvidas?: unknown[]
  banidos?: unknown[]
  monetizacao?: {
    solicitacoes?: MonetizationRequest[]
    apoios?: SupportContribution[]
    boosts?: LossAlertBoost[]
    empresas_verificadas?: unknown[]
    pontos_seguros?: unknown[]
  }
}

const defaultPoint: GeoPoint = { latitude: -23.55052, longitude: -46.633308 }
const sessionStorageKey = 'foundy-session-v2'
const firstVisitKey = 'foundy-first-visit-v2'
const onboardingKey = 'foundy-onboarding-v2'
const supportEmail = 'foundy.company@gmail.com'
const supportMailto = `mailto:${supportEmail}?subject=Contato%20Foundy`

function mergeChatMessages(current: MensagemChat[], incoming: MensagemChat[]) {
  const byId = new Map<string, MensagemChat>()
  for (const message of current) byId.set(message.id, message)
  for (const message of incoming) byId.set(message.id, message)
  return Array.from(byId.values()).sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime())
}

const placeholdersPorCategoria: Record<ItemCategory, string> = {
  chaves: 'https://images.unsplash.com/photo-1592887102811-2f9f67f7f05b?auto=format&fit=crop&w=1200&q=80',
  eletronicos: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
  documentos: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
  vestuario: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  outros: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80',
}

const categorias: Record<ItemCategory, { label: string; description: string; Icon: LucideIcon }> = {
  chaves: { label: 'Chaves', description: 'Chaves, chaveiros e controles pequenos.', Icon: KeyRound },
  eletronicos: { label: 'Celulares', description: 'Celulares, fones e acessórios digitais.', Icon: Smartphone },
  documentos: { label: 'Documentos', description: 'Carteiras, RG, CPF e credenciais.', Icon: Wallet },
  vestuario: { label: 'Vestuário', description: 'Jaquetas, bonés, mochilas e peças pessoais.', Icon: Shirt },
  outros: { label: 'Pets e outros', description: 'Pets, coleiras, brinquedos e objetos diversos.', Icon: PawPrint },
}

const filtrosFoundy: Record<ItemFilter, { label: string; description: string; Icon: LucideIcon; categoria?: ItemCategory; keywords: string[] }> = {
  todos: { label: 'Tudo', description: 'Achados e perdas sem filtro.', Icon: Search, keywords: [] },
  chaves: { label: 'Chaves', description: 'Chaves, chaveiros, tags e controles.', Icon: KeyRound, categoria: 'chaves', keywords: ['chave', 'chaveiro', 'controle', 'tag'] },
  celulares: { label: 'Celulares', description: 'Aparelhos, capinhas e carregadores.', Icon: Smartphone, categoria: 'eletronicos', keywords: ['celular', 'iphone', 'samsung', 'motorola', 'capinha', 'carregador'] },
  fones: { label: 'Fones', description: 'Fones Bluetooth, headsets e cases.', Icon: Headphones, categoria: 'eletronicos', keywords: ['fone', 'airpods', 'headset', 'earbud', 'case'] },
  notebooks: { label: 'Notebooks', description: 'Computadores, tablets e acessórios.', Icon: Laptop, categoria: 'eletronicos', keywords: ['notebook', 'tablet', 'ipad', 'laptop', 'computador'] },
  documentos: { label: 'Documentos', description: 'RG, CPF, crachás e cartões protegidos.', Icon: FileText, categoria: 'documentos', keywords: ['documento', 'rg', 'cpf', 'cnh', 'cracha', 'cartao'] },
  carteiras: { label: 'Carteiras', description: 'Carteiras, porta-cartões e bolsas pequenas.', Icon: Wallet, categoria: 'outros', keywords: ['carteira', 'wallet', 'porta cartao', 'porta-cartao'] },
  mochilas: { label: 'Mochilas', description: 'Bolsas, malas, estojos e sacolas.', Icon: Building2, categoria: 'vestuario', keywords: ['mochila', 'bolsa', 'mala', 'estojo', 'sacola'] },
  roupas: { label: 'Roupas', description: 'Casacos, bonés, uniformes e acessórios.', Icon: Shirt, categoria: 'vestuario', keywords: ['casaco', 'jaqueta', 'bone', 'boné', 'camiseta', 'uniforme', 'roupa'] },
  pets: { label: 'Pets', description: 'Animais, coleiras e itens de pets.', Icon: PawPrint, categoria: 'outros', keywords: ['pet', 'cachorro', 'gato', 'coleira', 'animal'] },
  bicicletas: { label: 'Bicicletas', description: 'Bikes, capacetes e acessórios de mobilidade.', Icon: Bike, categoria: 'outros', keywords: ['bicicleta', 'bike', 'capacete', 'patinete'] },
  joias: { label: 'Joias', description: 'Anéis, correntes, relógios e bijuterias.', Icon: Gem, categoria: 'outros', keywords: ['anel', 'corrente', 'colar', 'pulseira', 'relogio', 'relógio', 'joia'] },
  livros: { label: 'Livros', description: 'Livros, cadernos, apostilas e materiais.', Icon: BookOpen, categoria: 'outros', keywords: ['livro', 'caderno', 'apostila', 'material', 'estojo'] },
  outros: { label: 'Outros', description: 'Objetos que não entram nos filtros acima.', Icon: Sparkles, categoria: 'outros', keywords: ['outro', 'diverso', 'objeto'] },
}

const itensDemonstracao: ItemAchado[] = [
  {
    id: 'demo-1',
    titulo: 'Chave Yale com chaveiro azul',
    descricao: 'Encontrada perto da saída principal da estação. O endereço exato foi mascarado.',
    categoria: 'chaves',
    local_descricao: 'Região da estação central',
    latitude_aproximada: -23.5489,
    longitude_aproximada: -46.6372,
    raio_mascara_metros: 500,
    distancia_metros: 620,
    imagem_url: placeholdersPorCategoria.chaves,
    status: 'publicado',
    criado_em: new Date().toISOString(),
    desafio_pergunta: 'Qual detalhe só o dono saberia informar?',
    chat_desbloqueado: false,
    tags_ia: ['chaveyale', 'fitaazul'],
    hashtags_ia: ['#ChaveYale', '#FitaAzul'],
  },
  {
    id: 'demo-2',
    titulo: 'Carteira preta com documento protegido',
    descricao: 'Encontrada em cafeteria local. Dados pessoais devem ser descritos apenas pelo verdadeiro dono.',
    categoria: 'documentos',
    local_descricao: 'Próximo à praça principal',
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

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const supportPlanFallback: MonetizationPlan = {
  id: 'support_foundy',
  category: 'support',
  title: 'Apoie o Foundy',
  price: 'R$ 3, R$ 5, R$ 10, R$ 20 ou livre',
  amount_cents: 0,
  description: 'Contribuição voluntária para manter servidores, moderação, e-mails e melhorias da comunidade.',
  benefits: ['Mantém o Foundy gratuito', 'Ajuda a segurança e a moderação', 'Apoia melhorias sem cobrar para recuperar itens'],
  ethical_notice: 'Apoiar é opcional e não altera suas chances de recuperar ou devolver um item.',
  cta: 'Apoiar o Foundy',
}

const safePointPlanFallback: MonetizationPlan = {
  id: 'safe_point',
  category: 'safe_point',
  title: 'Ponto Seguro Foundy',
  price: 'a partir de R$ 29,90/mês',
  amount_cents: 2990,
  description: 'Locais parceiros para devoluções em ambiente público, movimentado e orientado pelo Protocolo Foundy.',
  benefits: ['Selo Ponto Seguro Foundy', 'Orientação no mapa', 'Página pública com horário', 'QR Code para balcão ou recepção'],
  ethical_notice: 'O Ponto Seguro não substitui cautela: encontros continuam sendo responsabilidade dos usuários.',
  cta: 'Quero ser um Ponto Seguro',
}

const lossAlertBoostPlanFallback: MonetizationPlan = {
  id: 'loss_alert_boost',
  category: 'loss_alert',
  title: 'Alerta Ampliado',
  price: 'R$ 4,90 por 24h; R$ 9,90 por 3 dias; R$ 19,90 por 7 dias',
  amount_cents: 490,
  description: 'Destaque temporário para alertas de perda criados gratuitamente.',
  benefits: ['Mais visibilidade no feed de perdas', 'Badge de Alerta Ampliado', 'Duração limitada e transparente'],
  ethical_notice: 'Não garante recuperação. Apenas aumenta a visibilidade do alerta por tempo limitado.',
  cta: 'Ampliar alcance',
}

const companyPlanFallbacks: MonetizationPlan[] = [
  {
    id: 'company_free',
    category: 'company',
    plan_type: 'free',
    title: 'Empresa Básica',
    price: 'Grátis',
    amount_cents: 0,
    item_limit: 5,
    description: 'Entrada gratuita para pequenos comércios começarem a organizar achados e perdidos no Foundy.',
    benefits: ['Página pública da empresa', 'Até 5 itens ativos no catálogo', 'Badge de empresa cadastrada', 'Sem filtros e pesquisa no catálogo'],
    ethical_notice: 'A conta nasce como Básica. Verificação, destaque e recursos avançados dependem de análise manual.',
    cta: 'Criar conta empresarial grátis',
  },
  {
    id: 'company_verified',
    category: 'company',
    plan_type: 'verified',
    title: 'Empresa Verificada',
    price: 'R$ 49,90/mês',
    amount_cents: 4990,
    item_limit: 200,
    description: 'Plano para comércios locais que querem mais confiança, análise cadastral, QR Code e catálogo completo.',
    benefits: ['Todas as vantagens da Empresa Básica', 'Até 200 itens ativos', 'CNPJ analisado pela moderação Foundy', 'Selo Empresa Verificada', 'QR Code da empresa', 'Escolha entre página pública e privada', 'Filtros e pesquisa liberados no catálogo'],
    ethical_notice: 'O selo não substitui retirada presencial segura nem garante estado de conservação.',
    cta: 'Quero ser Empresa Verificada',
  },
  {
    id: 'company_pro',
    category: 'company',
    plan_type: 'pro',
    title: 'Empresa Pro',
    price: 'R$ 99,90 a R$ 149,90/mês',
    amount_cents: 9990,
    item_limit: null,
    description: 'Para escolas, academias, condomínios e instituições que precisam de operação recorrente e histórico robusto.',
    benefits: ['Todas as vantagens da Empresa Verificada', 'Catálogo sem limite fixo de itens ativos', 'Histórico de retiradas e arquivamentos', 'Relatórios iniciais de operação', 'Painel completo com todas as utilidades Foundy', 'Selo de Empresa Pro dourado', 'Nome dourado na aba Empresas quando pública'],
    ethical_notice: 'Recursos de equipe são ativados com implantação assistida para proteger o catálogo.',
    cta: 'Falar sobre Empresa Pro',
  },
  {
    id: 'event_plan',
    category: 'company',
    plan_type: 'event',
    title: 'Eventos e Instituições',
    price: 'R$ 199 a R$ 499 por evento/mês',
    amount_cents: 19900,
    item_limit: 500,
    description: 'Operação temporária para eventos, feiras, igrejas, clubes e ações com grande circulação de pessoas.',
    benefits: ['Até 500 itens ativos', 'Página temporária do evento', 'QR Code do evento', 'Painel de atendimento', 'Aba exclusiva de eventos com nome, datas, horários e local', 'Chat seguro liberado'],
    ethical_notice: 'Eventos exigem política clara de retirada presencial e atendimento no local.',
    cta: 'Solicitar plano para evento',
  },
]

function getSupportPlan(plans: MonetizationPlansResponse | null) {
  return plans?.support_plan ?? plans?.plans.find((plan) => plan.id === 'support_foundy') ?? supportPlanFallback
}

function getSafePointPlan(plans: MonetizationPlansResponse | null) {
  return plans?.safe_point_plan ?? plans?.plans.find((plan) => plan.id === 'safe_point') ?? safePointPlanFallback
}

function getLossBoostPlan(plans: MonetizationPlansResponse | null) {
  return plans?.loss_alert_boost_plan ?? plans?.plans.find((plan) => plan.id === 'loss_alert_boost') ?? lossAlertBoostPlanFallback
}

function getCompanyPlans(plans: MonetizationPlansResponse | null) {
  const list = plans?.company_plans?.length ? plans.company_plans : plans?.plans.filter((plan) => plan.category === 'company' || plan.id.startsWith('company_') || plan.id === 'event_plan')
  return list?.length ? list : companyPlanFallbacks
}

function textoPesquisavelItem(item: ItemAchado | LostAlert) {
  return `${item.titulo} ${item.descricao} ${'subcategoria' in item ? (item.subcategoria ?? '') : ''} ${'hashtags_ia' in item ? (item.hashtags_ia ?? []).join(' ') : ''}`.toLowerCase()
}

function itemMatchesFilter(item: ItemAchado | LostAlert, filtro: ItemFilter) {
  if (filtro === 'todos') return true
  const config = filtrosFoundy[filtro]
  const categoria = 'categoria' in item ? item.categoria : null
  if (config.categoria && categoria === config.categoria) {
    const texto = textoPesquisavelItem(item)
    if (filtro === 'outros') return true
    return config.keywords.some((keyword) => texto.includes(keyword)) || item.subcategoria === filtro
  }
  const texto = textoPesquisavelItem(item)
  return config.keywords.some((keyword) => texto.includes(keyword)) || item.subcategoria === filtro
}

function alertaParaMapa(alerta: LostAlert): ItemAchado {
  return {
    id: `perda-${alerta.id}`,
    usuario_id: alerta.usuario_id ?? null,
    titulo: alerta.titulo,
    descricao: alerta.descricao,
    categoria: alerta.categoria ?? 'outros',
    subcategoria: alerta.subcategoria ?? null,
    local_descricao: alerta.local_descricao ?? 'Região aproximada da perda',
    latitude_aproximada: alerta.latitude_aproximada ?? defaultPoint.latitude,
    longitude_aproximada: alerta.longitude_aproximada ?? defaultPoint.longitude,
    raio_mascara_metros: alerta.raio_metros ?? 900,
    distancia_metros: alerta.distancia_metros ?? null,
    imagem_url: alerta.imagem_url ?? null,
    status: 'perdido',
    criado_em: alerta.criado_em,
    hashtags_ia: alerta.subcategoria ? [`#${alerta.subcategoria}`] : ['#Perdido'],
  }
}

function isAdmin(session: FoundySession | null) {
  return session?.email?.toLowerCase() === supportEmail
}

function effectiveCompanyPlan(session: FoundySession | null) {
  if (!session || session.plan_status !== 'active') return 'free'
  return session.plan_type === 'verified' || session.plan_type === 'pro' || session.plan_type === 'event' ? session.plan_type : 'free'
}

function companyPlanAllows(session: FoundySession | null, feature: 'catalogSearch' | 'qr' | 'reports' | 'history' | 'team' | 'events' | 'privateCatalog') {
  const plan = effectiveCompanyPlan(session)
  const rules = {
    catalogSearch: ['verified', 'pro', 'event'],
    qr: ['verified', 'pro', 'event'],
    reports: ['pro'],
    history: ['pro', 'event'],
    team: ['pro'],
    events: ['event'],
    privateCatalog: ['verified', 'pro', 'event'],
  }
  return rules[feature].includes(plan)
}

function categoriaFromFiltro(filtro: ItemFilter): ItemCategory {
  return filtrosFoundy[filtro].categoria ?? 'outros'
}

const documentPrivacyHints = ['rg', 'cpf', 'cnh', 'documento', 'identidade', 'passaporte', 'certidão', 'certidao', 'carteira de trabalho', 'cartão do sus', 'cartao do sus']

function normalizeFoundyText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function isDocumentSensitiveFilter(filtro: ItemFilter) {
  return filtro === 'documentos'
}

function hasDocumentPrivacyHint(...values: string[]) {
  const text = normalizeFoundyText(values.join(' '))
  return documentPrivacyHints.some((hint) => text.includes(normalizeFoundyText(hint)))
}

function isFutureDate(value?: string) {
  if (!value) return false
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) && parsed > Date.now()
}

function contaSuspensa(session: FoundySession | null) {
  if (!session) return false
  return session.banido_permanente === 'true' || isFutureDate(session.banido_ate)
}

function chatSuspenso(session: FoundySession | null) {
  if (!session) return false
  return session.chat_banido_permanente === 'true' || isFutureDate(session.chat_banido_ate)
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<MainTab>('feed')
  const [itens, setItens] = useState<ItemAchado[]>([])
  const [itemSelecionado, setItemSelecionado] = useState<ItemAchado | null>(null)
  const [modalAtivo, setModalAtivo] = useState<ModalAtivo>(null)
  const [mensagemSistema, setMensagemSistema] = useState('Carregando o Radar local...')
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<ItemFilter>('todos')
  const [feedMode, setFeedMode] = useState<FeedMode>('achados')
  const [buscaTexto, setBuscaTexto] = useState('')
  const [perdasProximas, setPerdasProximas] = useState<LostAlert[]>([])
  const [detalheItem, setDetalheItem] = useState<ItemAchado | LostAlert | null>(null)
  const [detalheTipo, setDetalheTipo] = useState<'achado' | 'perda'>('achado')
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
  const [adminData, setAdminData] = useState<AdminData | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaFoundy[]>([])
  const [pontosSeguros, setPontosSeguros] = useState<EmpresaFoundy[]>([])
  const [empresaBusca, setEmpresaBusca] = useState('')
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaFoundy | null>(null)
  const [catalogoEmpresa, setCatalogoEmpresa] = useState<EmpresaCatalogoItem[]>([])
  const [catalogoMensagem, setCatalogoMensagem] = useState('Catálogo empresarial pronto para consulta.')
  const [planosMonetizacao, setPlanosMonetizacao] = useState<MonetizationPlansResponse | null>(null)
  const [planoSelecionado, setPlanoSelecionado] = useState<MonetizationPlan | null>(null)
  const [boostAlerta, setBoostAlerta] = useState<LostAlert | null>(null)
  const mapSectionRef = useRef<HTMLDivElement | null>(null)
  const feedItemRefs = useRef<Record<string, HTMLElement | null>>({})

  const carregarPainel = useCallback(async (session: FoundySession) => {
    try {
      const dados = await buscarPainelUsuario(session.usuario_id)
      setPainel(dados)
      setNotificacoes(dados.notificacoes)
      setSessao((atual) => (atual ? { ...atual, ...dados.usuario } : dados.usuario))
      localStorage.setItem(sessionStorageKey, JSON.stringify({ ...session, ...dados.usuario }))
      if (contaSuspensa(dados.usuario)) {
        setModalAtivo('bloqueio-conta')
        setMensagemSistema(dados.usuario.banimento_motivo || 'Sua conta foi suspensa pela moderação.')
      }
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível carregar sua área.')
    }
  }, [])

  const carregarItens = useCallback(async (latitude?: number, longitude?: number, selecionarPrimeiro = true) => {
    setCarregando(true)
    setMensagemSistema('Atualizando itens com privacidade geográfica ativa...')
    try {
      const dados = await buscarItensAchadosProximos({ latitude, longitude })
      const lista = dados.length > 0 ? dados : itensDemonstracao
      setItens(lista)
      setItemSelecionado((atual) => (selecionarPrimeiro ? atual ?? lista[0] ?? null : atual))
      setMensagemSistema(dados.length > 0 ? 'Radar atualizado com sucesso.' : 'Mostrando exemplos até surgirem itens reais na região.')
    } catch (error) {
      setItens(itensDemonstracao)
      setItemSelecionado(itensDemonstracao[0])
      setMensagemSistema(error instanceof Error ? error.message : 'Servidor indisponível. Mostrando modo demonstração.')
    } finally {
      setCarregando(false)
    }
  }, [])

  const carregarPerdas = useCallback(async (latitude?: number, longitude?: number) => {
    try {
      const dados = await listarAlertasPerdidosProximos({ latitude, longitude })
      setPerdasProximas(dados)
    } catch {
      setPerdasProximas([])
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

  const carregarPontosSeguros = useCallback(async (termo?: string) => {
    try {
      const lista = await buscarPontosSegurosFoundy(termo)
      setPontosSeguros(lista)
    } catch {
      setPontosSeguros([])
    }
  }, [])

  const carregarPlanosMonetizacao = useCallback(async () => {
    try {
      const dados = await buscarPlanosMonetizacao()
      setPlanosMonetizacao(dados)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível carregar a monetização responsável.')
    }
  }, [])

  useEffect(() => {
    void carregarItens()
    void carregarPerdas()
    void carregarPontosSeguros()
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
  }, [carregarItens, carregarPainel, carregarPerdas, carregarPontosSeguros])

  useEffect(() => {
    if (activeTab === 'empresas') void carregarEmpresas(empresaBusca)
  }, [activeTab, carregarEmpresas, empresaBusca])

  useEffect(() => {
    if (activeTab === 'mapa' || modalAtivo === 'chat') void carregarPontosSeguros()
  }, [activeTab, carregarPontosSeguros, modalAtivo])

  useEffect(() => {
    if (activeTab === 'monetizacao') void carregarPlanosMonetizacao()
  }, [activeTab, carregarPlanosMonetizacao])

  useEffect(() => {
    if (modalAtivo !== 'chat' || !salaChatId || !painel?.chats?.length) return
    const atualizado = painel.chats.find((chat) => chat.id === salaChatId)
    if (!atualizado) return
    setChatAtual((atual) => {
      if (
        atual?.id === atualizado.id &&
        atual?.atualizado_em === atualizado.atualizado_em &&
        atual?.ultima_mensagem === atualizado.ultima_mensagem &&
        atual?.status === atualizado.status
      ) {
        return atual
      }
      return atualizado
    })
  }, [modalAtivo, painel?.chats, salaChatId])

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
    const usuarioId = sessao.usuario_id

    async function refreshChat(showLoading = false) {
      if (!salaChatId) return
      if (showLoading) setChatCarregando(true)
      try {
        const dados = await listarMensagensChat(salaChatId, usuarioId)
        if (!active) return
        setMensagensChat((atuais) => (showLoading ? dados : mergeChatMessages(atuais, dados)))
        setDenunciaDisponivel(dados.some((item) => item.denunciar_extorsao_visivel))
      } catch (error) {
        setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível carregar o chat seguro.')
      } finally {
        if (active && showLoading) setChatCarregando(false)
      }
    }

    void refreshChat(true)
    const timer = window.setInterval(() => void refreshChat(false), 1500)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [modalAtivo, salaChatId, sessao?.usuario_id])

  useEffect(() => {
    if (modalAtivo !== 'chat' || !salaChatId || !sessao) return
    const usuarioId = sessao.usuario_id
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
              void listarMensagensChat(salaChatId, usuarioId).then((dados) => {
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
        setMensagemSistema('Tempo real indisponível agora. Mantivemos atualização automática por segurança.')
      }
    }

    void startRealtime()
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [carregarPainel, modalAtivo, salaChatId, sessao?.usuario_id])

  const itensFiltrados = useMemo(() => {
    const termo = buscaTexto.trim().toLowerCase()
    return itens.filter((item) => {
      const bateFiltro = itemMatchesFilter(item, filtro)
      if (!bateFiltro) return false
      if (!termo) return true
      return textoPesquisavelItem(item).includes(termo)
    })
  }, [buscaTexto, filtro, itens])

  const perdasFiltradas = useMemo(() => {
    const termo = buscaTexto.trim().toLowerCase()
    return perdasProximas.filter((alerta) => {
      const bateFiltro = itemMatchesFilter(alerta, filtro)
      if (!bateFiltro) return false
      if (!termo) return true
      return textoPesquisavelItem(alerta).includes(termo)
    }).sort((a, b) => {
      const boostOrder = Number(Boolean(b.boost_ativo && isFutureDate(b.boost_expira_em ?? undefined))) - Number(Boolean(a.boost_ativo && isFutureDate(a.boost_expira_em ?? undefined)))
      if (boostOrder !== 0) return boostOrder
      const distanceA = typeof a.distancia_metros === 'number' ? a.distancia_metros : Number.POSITIVE_INFINITY
      const distanceB = typeof b.distancia_metros === 'number' ? b.distancia_metros : Number.POSITIVE_INFINITY
      if (distanceA !== distanceB) return distanceA - distanceB
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
    })
  }, [buscaTexto, filtro, perdasProximas])

  const mapaItens = useMemo(
    () => [...itensFiltrados, ...perdasFiltradas.map(alertaParaMapa)],
    [itensFiltrados, perdasFiltradas],
  )

  const unreadCount = notificacoes.filter((item) => !item.lida_em).length

  function salvarSessao(novaSessao: FoundySession) {
    if (contaSuspensa(novaSessao)) {
      setSessao(novaSessao)
      setMensagemSistema(novaSessao.banimento_motivo || 'Sua conta está suspensa pela moderação.')
      setModalAtivo('bloqueio-conta')
      return
    }
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
      setMensagemSistema('Este navegador não suporta geolocalização.')
      return
    }
    setMensagemSistema('Solicitando sua posição aproximada...')
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        const ponto = { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude }
        setLocalUsuario(ponto)
        setItemSelecionado(null)
        mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        void carregarItens(ponto.latitude, ponto.longitude, false)
        void carregarPerdas(ponto.latitude, ponto.longitude)
      },
      () => setMensagemSistema('Não foi possível acessar sua localização. Mantivemos a busca regional padrão.'),
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
    if (contaSuspensa(sessao)) {
      setModalAtivo('bloqueio-conta')
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

  function verItemNoFeed(item: ItemAchado) {
    setItemSelecionado(item)
    setActiveTab('feed')
    if (item.id.startsWith('perda-')) setFeedMode('perdidos')
    else setFeedMode('achados')
    window.setTimeout(() => {
      feedItemRefs.current[item.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 160)
  }

  function abrirDetalheAchado(item: ItemAchado) {
    setDetalheItem(item)
    setDetalheTipo('achado')
    setModalAtivo('detalhe-item')
  }

  function abrirDetalhePerda(alerta: LostAlert) {
    setDetalheItem(alerta)
    setDetalheTipo('perda')
    setModalAtivo('detalhe-item')
  }

  function selecionarPerdaNoMapa(alerta: LostAlert) {
    const itemMapa = alertaParaMapa(alerta)
    setItemSelecionado(itemMapa)
    setActiveTab('mapa')
    setMensagemSistema(`Mapa aproximado do alerta: ${alerta.titulo}.`)
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function abrirChatDePerda(alerta: LostAlert) {
    if (!sessao) {
      requireSession('auth', 'Entre para avisar que encontrou um item parecido.')
      return
    }
    if (chatSuspenso(sessao)) {
      setMensagemSistema(sessao.chat_banimento_motivo || 'Seu acesso ao chat e aos desafios está suspenso.')
      return
    }
    if (alerta.usuario_id === sessao.usuario_id) {
      setMensagemSistema('Este alerta foi criado por você.')
      return
    }
    try {
      const resultado = await abrirChatParaAlertaPerdido(alerta.id, sessao.usuario_id)
      setSalaChatId(resultado.sala_chat_id)
      setChatAtual(null)
      setItemSelecionado(null)
      setMensagensChat([])
      setChatFeedback(resultado.mensagem)
      setModalAtivo('chat')
      void carregarPainel(sessao)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível abrir o chat deste alerta.')
    }
  }

  async function denunciarPostPublico(item: ItemAchado | LostAlert, tipo: 'item' | 'perda') {
    if (!sessao) {
      requireSession('auth', 'Entre para enviar uma denúncia de segurança.')
      return
    }
    const motivoTipo = window.prompt('Tipo de denúncia: dados pessoais, endereço exato, documento exposto, conteúdo inadequado ou outro?', 'conteudo_inadequado') ?? ''
    const motivo = window.prompt('Explique o motivo da denúncia para a moderação.') ?? ''
    if (motivoTipo.trim().length < 3 || motivo.trim().length < 5) return
    try {
      const resposta = await denunciarPost({
        usuario_id: sessao.usuario_id,
        item_achado_id: tipo === 'item' ? item.id : null,
        alerta_perdido_id: tipo === 'perda' ? item.id : null,
        motivo_tipo: motivoTipo,
        motivo,
      })
      setMensagemSistema(resposta.mensagem)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível enviar a denúncia do post.')
    }
  }

  async function confirmarRespostaDesafio() {
    if (!sessao || !itemSelecionado) return
    if (chatSuspenso(sessao)) {
      setMensagemSistema(sessao.chat_banimento_motivo || 'Seu acesso ao chat e aos desafios está suspenso.')
      return
    }
    if (respostaDesafio.trim().length < 2) {
      setMensagemSistema('Digite uma resposta válida para o desafio.')
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
      setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível enviar a resposta.')
    }
  }

  async function validarRespostaComoEncontrador(aprovada: boolean) {
    if (!sessao || !reivindicacaoId) return
    if (chatSuspenso(sessao)) {
      setMensagemSistema(sessao.chat_banimento_motivo || 'Seu acesso ao chat e aos desafios está suspenso.')
      return
    }
    try {
      const resultado = await validarReivindicacao(reivindicacaoId, { aprovada, encontrador_usuario_id: sessao.usuario_id })
      setMensagemSistema(resultado.mensagem)
      if (resultado.chat_desbloqueado && resultado.sala_chat_id) {
        setSalaChatId(resultado.sala_chat_id)
        setChatAtual(painel?.chats.find((chat) => chat.id === resultado.sala_chat_id) ?? null)
        setMensagensChat([])
        setMensagemChatAtual('')
        setDenunciaDisponivel(false)
        setChatFeedback('Resposta aprovada. A conversa segura foi liberada para vocês dois.')
        setModalAtivo('chat')
      } else {
        setModalAtivo(null)
      }
      void carregarPainel(sessao)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível validar a resposta.')
    }
  }

  async function abrirChat(chat: ChatSummary) {
    setSalaChatId(chat.id)
    setChatAtual(chat)
    setMensagensChat([])
    setMensagemChatAtual('')
    setDenunciaDisponivel(false)
    setChatFeedback(chat.status === 'encerrado' ? 'Esta conversa foi resolvida e ficou salva no histórico.' : '')
    const item = chat.item_achado_id ? itens.find((found) => found.id === chat.item_achado_id) : null
    setItemSelecionado(item ?? null)
    setModalAtivo('chat')
  }

  async function enviarMensagemNoChat() {
    if (!sessao || !salaChatId) {
      setMensagemSistema('Abra uma conversa válida antes de enviar mensagem.')
      return
    }
    const text = mensagemChatAtual.trim()
    if (chatSuspenso(sessao)) {
      setMensagemSistema(sessao.chat_banimento_motivo || 'Seu acesso ao chat está suspenso pela moderação.')
      return
    }
    if (!text) {
      setMensagemSistema('Digite uma mensagem antes de enviar.')
      return
    }
    try {
      setChatFeedback('Enviando mensagem segura...')
      const enviada = await enviarMensagemChat(salaChatId, sessao.usuario_id, text)
      setMensagensChat((atuais) => mergeChatMessages(atuais, [enviada]))
      setMensagemChatAtual('')
      setChatFeedback('Mensagem enviada e registrada na conversa.')
      setDenunciaDisponivel((atual) => atual || enviada.denunciar_extorsao_visivel)
      void listarMensagensChat(salaChatId, sessao.usuario_id)
        .then((dados) => setMensagensChat((atuais) => mergeChatMessages(atuais, dados)))
        .catch(() => undefined)
      void carregarPainel(sessao)
    } catch (error) {
      setMensagemSistema(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.')
    }
  }

  async function clicarNotificacao(notificacao: NotificationItem) {
    if (!sessao) return
    setNotificacoes((atuais) => atuais.filter((item) => item.id !== notificacao.id))
    try {
      await marcarNotificacaoLida(notificacao.id, sessao.usuario_id)
    } catch {
      setNotificacoes((atuais) => atuais.filter((item) => item.id !== notificacao.id))
    }
    if (notificacao.sala_chat_id) {
      setSalaChatId(notificacao.sala_chat_id)
      setMensagensChat([])
      setMensagemChatAtual('')
      setDenunciaDisponivel(false)
      let chat = painel?.chats.find((item) => item.id === notificacao.sala_chat_id) ?? null
      if (!chat) {
        const dados = await buscarPainelUsuario(sessao.usuario_id)
        setPainel(dados)
        setNotificacoes(dados.notificacoes)
        chat = dados.chats.find((item) => item.id === notificacao.sala_chat_id) ?? null
      }
      setChatAtual(chat)
      const itemDoChat = chat?.item_achado_id ? itens.find((found) => found.id === chat.item_achado_id) : null
      setItemSelecionado(itemDoChat ?? null)
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
    if (notificacao.alerta_perdido_id) {
      const alerta = perdasProximas.find((perda) => perda.id === notificacao.alerta_perdido_id)
      if (alerta) selecionarPerdaNoMapa(alerta)
      setModalAtivo(null)
    }
    void carregarPainel(sessao)
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
              { id: 'monetizacao', label: 'Apoiar' },
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
          <UserSection painel={painel} sessao={sessao} onOpenProfile={() => setModalAtivo('perfil')} onOpenChats={() => setModalAtivo('chats')} onDeleteItem={(id) => void apagarMeuItem(id)} onDeleteAlert={(id) => void apagarMeuAlerta(id)} onBoostAlert={(alerta) => { setBoostAlerta(alerta); setModalAtivo('boost-alerta') }} />
        ) : activeTab === 'empresas' ? (
          <EmpresasSection
            empresas={empresas}
            busca={empresaBusca}
            catalogo={catalogoEmpresa}
            empresaSelecionada={empresaSelecionada}
            mensagem={catalogoMensagem}
            planos={planosMonetizacao}
            sessao={sessao}
            onCarregarPlanos={carregarPlanosMonetizacao}
            onBuscaChange={setEmpresaBusca}
            onSelecionarEmpresa={(empresa) => void abrirEmpresa(empresa)}
            onVoltar={() => { setEmpresaSelecionada(null); setCatalogoEmpresa([]) }}
            onCriarEmpresa={() => { setMensagemSistema('Na tela de cadastro, selecione "Empresa" e escolha o plano ideal.'); setModalAtivo('auth') }}
            onSolicitarPlano={(plan) => {
              if (plan.id === 'company_free') {
                setMensagemSistema('Crie uma conta empresarial gratuita e selecione Empresa Básica no cadastro.')
                setModalAtivo('auth')
                return
              }
              if (!sessao || sessao.tipo_conta !== 'empresa') {
                setMensagemSistema('Este plano exige uma conta empresarial. Crie ou entre com uma conta de empresa para solicitar.')
                setModalAtivo('auth')
                return
              }
              setPlanoSelecionado(plan)
              setModalAtivo('solicitar-monetizacao')
            }}
          />
        ) : activeTab === 'monetizacao' ? (
          <MonetizacaoSection
            planos={planosMonetizacao}
            sessao={sessao}
            onCarregar={carregarPlanosMonetizacao}
            onSolicitar={(plan) => {
              if (plan.id === 'loss_alert_boost') {
                setMensagemSistema('Abra um alerta de perda que você criou e clique em "Ampliar alcance". Assim garantimos que só o dono do alerta solicite destaque.')
                setActiveTab('usuario')
                return
              }
              setPlanoSelecionado(plan)
              setModalAtivo(plan.id === 'support_foundy' ? 'apoiar' : 'solicitar-monetizacao')
            }}
          />
        ) : activeTab === 'empresaPainel' && sessao?.tipo_conta === 'empresa' ? (
          <EmpresaPainelSection
            sessao={sessao}
            planos={planosMonetizacao}
            onCarregarPlanos={carregarPlanosMonetizacao}
            onMensagem={setMensagemSistema}
            onSolicitarPlano={(plan) => {
              setPlanoSelecionado(plan)
              setModalAtivo('solicitar-monetizacao')
            }}
          />
        ) : activeTab === 'admin' && sessao && adminData ? (
          <AdminSection data={adminData} adminId={sessao.usuario_id} onRefresh={async () => setAdminData(await buscarPainelAdmin(sessao.usuario_id))} />
        ) : (
          <RadarSection
            viewMode={activeTab === 'mapa' ? 'mapa' : 'feed'}
            itens={activeTab === 'mapa' ? mapaItens : itensFiltrados}
            perdas={perdasFiltradas}
            pontosSeguros={pontosSeguros}
            feedMode={feedMode}
            totalItens={itens.length}
            totalPerdas={perdasProximas.length}
            itemSelecionado={itemSelecionado}
            localUsuario={localUsuario}
            mapRef={mapSectionRef}
            feedItemRefs={feedItemRefs}
            mensagemSistema={mensagemSistema}
            carregando={carregando}
            planos={planosMonetizacao}
            getDistance={getDistance}
            onSelectItem={setItemSelecionado}
            onViewItem={verItemNoFeed}
            onOpenSafePoint={async (empresa) => {
              await registrarCliquePontoSeguro(empresa.id).catch(() => undefined)
              setActiveTab('empresas')
              setEmpresaSelecionada(empresa)
              void abrirEmpresa(empresa)
            }}
            onFeedModeChange={setFeedMode}
            onCarregarPlanos={carregarPlanosMonetizacao}
            onOpenLossPost={() => requireSession('perdi', 'Para criar alerta de perda é necessário entrar.')}
            onRequestSafePoint={() => {
              const plan = getSafePointPlan(planosMonetizacao)
              if (!sessao || sessao.tipo_conta !== 'empresa') {
                setMensagemSistema('Ponto Seguro Foundy agora possui cadastro próprio. Clique em Cadastrar e escolha "Ponto Seguro".')
                setModalAtivo('auth')
                return
              }
              setPlanoSelecionado(plan)
              setModalAtivo('solicitar-monetizacao')
            }}
            onSearch={() => setModalAtivo('busca')}
            onNearby={obterMeuLocal}
            onRefresh={() => { void carregarItens(localUsuario?.latitude, localUsuario?.longitude); void carregarPerdas(localUsuario?.latitude, localUsuario?.longitude) }}
            onClaim={(item) => {
              if (!sessao) return requireSession('auth', 'Entre para reivindicar um item com segurança.')
              if (item.usuario_id === sessao.usuario_id) {
                setMensagemSistema('Este item foi publicado por você, então não aparece como reivindicável.')
                return false
              }
              setItemSelecionado(item)
              setRespostaDesafio('')
              setClaimAtual(null)
              setModalAtivo('desafio')
              return true
            }}
            onFocusItem={selecionarItemNoMapa}
            onFocusLoss={selecionarPerdaNoMapa}
            onOpenItemDetails={abrirDetalheAchado}
            onOpenLossDetails={abrirDetalhePerda}
            onFoundLoss={(alerta) => void abrirChatDePerda(alerta)}
            onReportItem={(item) => void denunciarPostPublico(item, 'item')}
            onReportLoss={(alerta) => void denunciarPostPublico(alerta, 'perda')}
            currentUserId={sessao?.usuario_id ?? null}
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
      {modalAtivo === 'bloqueio-conta' && sessao ? <ModalBloqueioConta sessao={sessao} onLogout={sair} /> : null}
      {modalAtivo === 'acao' ? (
        <ModalAcaoRapida
          onClose={() => setModalAtivo(null)}
          onEscolherAchei={() => requireSession('item', 'Para publicar item achado é necessário entrar.')}
          onEscolherPerdi={() => requireSession('perdi', 'Para criar alerta de perda é necessário entrar.')}
        />
      ) : null}
      {modalAtivo === 'item' && sessao ? <ModalItemAchado sessao={sessao} onClose={() => setModalAtivo(null)} onPublicado={(item) => { setItens((atuais) => [item, ...atuais]); setItemSelecionado(item); setModalAtivo(null); void carregarPainel(sessao) }} /> : null}
      {modalAtivo === 'perdi' && sessao ? <ModalPerdiAlgo sessao={sessao} pontoInicial={localUsuario ?? defaultPoint} onClose={() => setModalAtivo(null)} onCriado={(mensagem, alerta, abrirBoost) => { setMensagemSistema(mensagem); setModalAtivo(null); if (alerta) setPerdasProximas((atuais) => [alerta, ...atuais.filter((item) => item.id !== alerta.id)]); void carregarPainel(sessao); void carregarPerdas(localUsuario?.latitude, localUsuario?.longitude); if (alerta && abrirBoost) { setBoostAlerta(alerta); setModalAtivo('boost-alerta') } }} /> : null}
      {modalAtivo === 'desafio' && itemSelecionado ? <ModalDesafio item={itemSelecionado} resposta={respostaDesafio} onRespostaChange={setRespostaDesafio} onConfirmar={() => void confirmarRespostaDesafio()} onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'resposta-enviada' ? <ModalRespostaEnviada onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'aguardando' ? <ModalAguardandoValidacao reivindicacaoId={reivindicacaoId} claim={claimAtual} onClose={() => setModalAtivo(null)} onValidar={(aprovada) => void validarRespostaComoEncontrador(aprovada)} /> : null}
      {modalAtivo === 'detalhe-item' && detalheItem ? (
        <ModalDetalhePost
          item={detalheItem}
          tipo={detalheTipo}
          currentUserId={sessao?.usuario_id ?? null}
          onClose={() => setModalAtivo(null)}
          onClaim={(item) => {
            if (!sessao) return void requireSession('auth', 'Entre para reivindicar um item com segurança.')
            setModalAtivo(null)
            setItemSelecionado(item)
            setRespostaDesafio('')
            setClaimAtual(null)
            setModalAtivo('desafio')
          }}
          onFound={(alerta) => { setModalAtivo(null); void abrirChatDePerda(alerta) }}
          onMap={(item) => { setModalAtivo(null); if (detalheTipo === 'perda') selecionarPerdaNoMapa(item as LostAlert); else selecionarItemNoMapa(item as ItemAchado) }}
          onBoost={(alerta) => {
            setBoostAlerta(alerta)
            setModalAtivo('boost-alerta')
          }}
        />
      ) : null}
      {modalAtivo === 'chat' ? (
        <ModalChatSeguro
          sessao={sessao}
          item={itemSelecionado}
          chat={chatAtual}
          chatCarregando={chatCarregando}
          mensagens={mensagensChat}
          pontosSeguros={pontosSeguros}
          feedback={chatFeedback}
          valorAtual={mensagemChatAtual}
          onChangeValor={setMensagemChatAtual}
          onSuggestSafePoint={(empresa) => {
            const nome = empresa.empresa_nome ?? empresa.nome
            const endereco = empresa.empresa_endereco_publico ?? 'endereço público informado no perfil'
            setMensagemChatAtual(`Podemos combinar em um Ponto Seguro Foundy? Sugestão: ${nome}, ${endereco}. Horário: ${empresa.public_opening_hours ?? 'consultar perfil'}.`)
          }}
          onEnviar={() => void enviarMensagemNoChat()}
          onDenunciar={(motivo, prova, arquivo, mensagemId) => salaChatId && sessao ? void denunciarExtorsao(salaChatId, sessao.usuario_id, motivo, mensagemId, prova, arquivo).then((res) => { setMensagemSistema(res.mensagem); setChatFeedback(res.mensagem); setChatAtual((atual) => (atual ? { ...atual, status: 'encerrado' } : atual)); setModalAtivo(null); void carregarPainel(sessao) }) : undefined}
          denunciarDisponivel={denunciaDisponivel}
          podeAvaliar={Boolean(sessao && chatAtual?.dono_usuario_id === sessao.usuario_id && chatAtual.encontrador_usuario_id)}
          onConfirmarDevolucao={(nota) => {
            const chatSelecionado = chatAtual
            if (!sessao || !chatSelecionado?.encontrador_usuario_id || !chatSelecionado.item_achado_id) return
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
      {modalAtivo === 'busca' ? <ModalBusca filtro={filtro} buscaTexto={buscaTexto} itensVisiveis={itensFiltrados.length + perdasFiltradas.length} totalItens={itens.length + perdasProximas.length} onFiltroChange={setFiltro} onBuscaChange={setBuscaTexto} onLimpar={() => { setFiltro('todos'); setBuscaTexto('') }} onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'seguranca' ? <ModalManifestoSeguranca onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'termos' ? <ModalTermosLgpd onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'perfil' && sessao ? <ModalPerfil sessao={sessao} painel={painel} onClose={() => setModalAtivo(null)} onLogout={sair} onUpdated={salvarSessao} onOpenAdmin={isAdmin(sessao) ? async () => { const data = await buscarPainelAdmin(sessao.usuario_id); setAdminData(data); setModalAtivo('admin') } : undefined} /> : null}
      {modalAtivo === 'notificacoes' && sessao ? <ModalNotificacoes notificacoes={notificacoes} onClose={() => setModalAtivo(null)} onOpen={(notificacao) => void clicarNotificacao(notificacao)} /> : null}
      {modalAtivo === 'chats' && sessao ? <ModalChats chats={painel?.chats ?? []} onClose={() => setModalAtivo(null)} onOpen={(chat) => void abrirChat(chat)} /> : null}
      {modalAtivo === 'onboarding' && sessao ? <ModalOnboarding onClose={() => { localStorage.setItem(`${onboardingKey}-${sessao.usuario_id}`, '1'); setModalAtivo(null) }} /> : null}
      {modalAtivo === 'admin' && sessao && adminData ? <ModalAdmin data={adminData} adminId={sessao.usuario_id} onClose={() => setModalAtivo(null)} onRefresh={async () => setAdminData(await buscarPainelAdmin(sessao.usuario_id))} /> : null}
      {modalAtivo === 'apoiar' ? <ModalApoiarFoundy sessao={sessao} onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'solicitar-monetizacao' && planoSelecionado ? <ModalSolicitacaoMonetizacao plano={planoSelecionado} sessao={sessao} onClose={() => setModalAtivo(null)} onDone={(mensagem) => { setMensagemSistema(mensagem); setModalAtivo(null) }} /> : null}
      {modalAtivo === 'boost-alerta' && sessao && boostAlerta ? <ModalBoostAlerta alerta={boostAlerta} sessao={sessao} onClose={() => setModalAtivo(null)} onDone={(mensagem) => { setMensagemSistema(mensagem); setModalAtivo(null); void carregarPerdas(localUsuario?.latitude, localUsuario?.longitude); void carregarPainel(sessao) }} /> : null}
    </main>
  )
}

function RadarSection({
  viewMode,
  itens,
  perdas,
  pontosSeguros,
  feedMode,
  totalItens,
  totalPerdas,
  itemSelecionado,
  localUsuario,
  mapRef,
  mensagemSistema,
  carregando,
  planos,
  getDistance,
  onSelectItem,
  onSearch,
  onNearby,
  onRefresh,
  onCarregarPlanos,
  onOpenLossPost,
  onRequestSafePoint,
  onClaim,
  onFocusItem,
  onFocusLoss,
  onOpenItemDetails,
  onOpenLossDetails,
  onFoundLoss,
  onReportItem,
  onReportLoss,
  onViewItem,
  onOpenSafePoint,
  onFeedModeChange,
  feedItemRefs,
  currentUserId,
}: {
  viewMode: 'feed' | 'mapa'
  itens: ItemAchado[]
  perdas: LostAlert[]
  pontosSeguros: EmpresaFoundy[]
  feedMode: FeedMode
  totalItens: number
  totalPerdas: number
  itemSelecionado: ItemAchado | null
  localUsuario: GeoPoint | null
  mapRef: RefObject<HTMLDivElement | null>
  feedItemRefs: MutableRefObject<Record<string, HTMLElement | null>>
  mensagemSistema: string
  carregando: boolean
  planos: MonetizationPlansResponse | null
  getDistance: (item: ItemAchado) => number | null
  onSelectItem: (item: ItemAchado) => void
  onViewItem: (item: ItemAchado) => void
  onOpenSafePoint: (empresa: EmpresaFoundy) => void
  onFeedModeChange: (mode: FeedMode) => void
  onCarregarPlanos: () => void
  onOpenLossPost: () => void
  onRequestSafePoint: () => void
  onSearch: () => void
  onNearby: () => void
  onRefresh: () => void
  onClaim: (item: ItemAchado) => void
  onFocusItem: (item: ItemAchado) => void
  onFocusLoss: (alerta: LostAlert) => void
  onOpenItemDetails: (item: ItemAchado) => void
  onOpenLossDetails: (alerta: LostAlert) => void
  onFoundLoss: (alerta: LostAlert) => void
  onReportItem: (item: ItemAchado) => void
  onReportLoss: (alerta: LostAlert) => void
  currentUserId: string | null
}) {
  useEffect(() => {
    if (!planos) onCarregarPlanos()
  }, [onCarregarPlanos, planos])
  const safePointPlan = getSafePointPlan(planos)
  const boostPlan = getLossBoostPlan(planos)
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

        {viewMode === 'mapa' ? <MapaInterativo itens={itens} pontosSeguros={pontosSeguros} itemSelecionado={itemSelecionado} onSelecionarItem={onSelectItem} onVerItem={onViewItem} onVerPontoSeguro={onOpenSafePoint} userLocation={localUsuario} /> : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foundy-border bg-foundy-background/70 p-4">
          <p className="text-sm text-foundy-muted" aria-live="polite">{mensagemSistema}</p>
          <button className="foundy-pressable inline-flex h-10 items-center gap-2 rounded-xl border border-foundy-border px-3 text-sm font-semibold" type="button" onClick={onRefresh}>
            <Sparkles size={16} /> Atualizar
          </button>
        </div>
      </div>

      {viewMode === 'mapa' ? <SafePointMapOffer plan={safePointPlan} onRequest={onRequestSafePoint} /> : null}

      {viewMode === 'feed' ? <section className="grid gap-4" aria-label="Feed principal Foundy">
        <div className="flex flex-col gap-3 rounded-3xl border border-foundy-border bg-foundy-surface p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">{feedMode === 'achados' ? 'Itens achados perto de você' : 'Pessoas procurando itens perto de você'}</h2>
            <p className="text-sm text-foundy-muted">Feeds separados para reduzir confusão e acelerar a recuperação.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-foundy-background p-1">
            <button className={`rounded-xl px-4 py-2 text-sm font-black ${feedMode === 'achados' ? 'bg-foundy-green text-slate-950' : 'text-foundy-muted'}`} type="button" onClick={() => onFeedModeChange('achados')}>Achados ({itens.length}/{totalItens})</button>
            <button className={`rounded-xl px-4 py-2 text-sm font-black ${feedMode === 'perdidos' ? 'bg-red-500 text-white' : 'text-foundy-muted'}`} type="button" onClick={() => onFeedModeChange('perdidos')}>Perdas ({perdas.length}/{totalPerdas})</button>
          </div>
        </div>
        <LossBoostFeedOffer plan={boostPlan} onOpenLossPost={onOpenLossPost} />
        {feedMode === 'achados' ? itens.map((item) => (
          <ItemCard
            item={item}
            key={item.id}
            distance={getDistance(item)}
            onClaim={onClaim}
            onFocus={onFocusItem}
            onDetails={onOpenItemDetails}
            onReport={onReportItem}
            currentUserId={currentUserId}
            refCallback={(node) => { feedItemRefs.current[item.id] = node }}
          />
        )) : null}
        {feedMode === 'perdidos' ? perdas.map((alerta) => (
          <LostAlertCard
            alerta={alerta}
            key={alerta.id}
            onFocus={onFocusLoss}
            onDetails={onOpenLossDetails}
            onFound={onFoundLoss}
            onReport={onReportLoss}
            currentUserId={currentUserId}
            refCallback={(node) => { feedItemRefs.current[`perda-${alerta.id}`] = node }}
          />
        )) : null}
        {!carregando && feedMode === 'achados' && itens.length === 0 ? <EmptyState title="Nenhum item encontrado" text="Abra a lupa para ajustar os filtros ou crie um alerta de perda." /> : null}
        {!carregando && feedMode === 'perdidos' && perdas.length === 0 ? <EmptyState title="Nenhum alerta de perda" text="Quando alguém perder algo por perto, aparecerá aqui." /> : null}
        {carregando ? <p className="text-sm text-foundy-muted">Atualizando feed...</p> : null}
      </section> : null}
    </>
  )
}

function SafePointMapOffer({ plan, onRequest }: { plan: MonetizationPlan; onRequest: () => void }) {
  return (
    <aside className="foundy-item-card overflow-hidden rounded-3xl border border-foundy-green/30 bg-foundy-surface">
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
        <div>
          <p className="foundy-eyebrow text-sm font-semibold text-foundy-green">Oferta no contexto certo</p>
          <h2 className="mt-1 text-2xl font-black">Seja um Ponto Seguro Foundy</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foundy-muted">{plan.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.benefits.slice(0, 3).map((benefit) => <span className="rounded-full border border-foundy-border bg-foundy-background px-3 py-1 text-xs font-bold text-foundy-muted" key={benefit}>{benefit}</span>)}
          </div>
        </div>
        <div className="rounded-3xl border border-foundy-border bg-foundy-background p-4">
          <p className="text-xs font-black uppercase tracking-wide text-foundy-green">{plan.price}</p>
          <p className="mt-2 text-sm leading-6 text-foundy-muted">{plan.ethical_notice}</p>
          <button className="mt-4 h-11 w-full rounded-xl bg-foundy-green text-sm font-black text-slate-950" type="button" onClick={onRequest}>{plan.cta}</button>
        </div>
      </div>
    </aside>
  )
}

function LossBoostFeedOffer({ plan, onOpenLossPost }: { plan: MonetizationPlan; onOpenLossPost: () => void }) {
  return (
    <aside className="foundy-boost-card rounded-3xl border border-foundy-blue/30 bg-foundy-surface p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="foundy-eyebrow text-sm font-semibold text-foundy-blue">Alcance opcional para quem perdeu</p>
          <h2 className="mt-1 text-2xl font-black">{plan.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foundy-muted">{plan.description}</p>
          <p className="mt-2 text-xs font-bold text-foundy-muted">{plan.price}</p>
        </div>
        <button className="foundy-pressable inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foundy-blue px-5 text-sm font-black text-white" type="button" onClick={onOpenLossPost}>
          <Sparkles size={17} /> Postar perda e ampliar depois
        </button>
      </div>
      <p className="mt-3 rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-3 text-sm text-foundy-green">{plan.ethical_notice}</p>
    </aside>
  )
}

function ItemCard({
  item,
  distance,
  onClaim,
  onFocus,
  onDetails,
  onReport,
  currentUserId,
  refCallback,
}: {
  item: ItemAchado
  distance: number | null
  onClaim: (item: ItemAchado) => void
  onFocus: (item: ItemAchado) => void
  onDetails: (item: ItemAchado) => void
  onReport: (item: ItemAchado) => void
  currentUserId: string | null
  refCallback: (node: HTMLElement | null) => void
}) {
  const CategoriaIcon = categorias[item.categoria].Icon
  const isOwner = Boolean(currentUserId && item.usuario_id === currentUserId)
  return (
    <article ref={refCallback} className="foundy-item-card cursor-pointer overflow-hidden rounded-3xl border border-foundy-border bg-foundy-surface" role="button" tabIndex={0} onClick={() => onDetails(item)} onKeyDown={(event) => { if (event.key === 'Enter') onDetails(item) }}>
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
          <button className="foundy-pressable rounded-xl bg-foundy-blue px-4 py-2 text-sm font-black text-white" type="button" onClick={(event) => { event.stopPropagation(); onDetails(item) }}>Ver detalhes</button>
          {!isOwner ? <button className="foundy-pressable rounded-xl bg-foundy-green px-4 py-2 text-sm font-black text-slate-950" type="button" onClick={(event) => { event.stopPropagation(); onClaim(item) }}>É meu</button> : <span className="rounded-xl border border-foundy-border px-4 py-2 text-sm font-bold text-foundy-muted">Publicado por você</span>}
          <button className="foundy-pressable rounded-xl border border-foundy-border px-4 py-2 text-sm font-semibold" type="button" onClick={(event) => { event.stopPropagation(); onFocus(item) }}>Ver no mapa</button>
          {!isOwner ? <button className="foundy-pressable rounded-xl border border-red-400/50 px-4 py-2 text-sm font-semibold text-red-200" type="button" onClick={(event) => { event.stopPropagation(); onReport(item) }}>Denunciar post</button> : null}
        </div>
      </div>
    </article>
  )
}

function LostAlertCard({
  alerta,
  onFocus,
  onDetails,
  onFound,
  onReport,
  currentUserId,
  refCallback,
}: {
  alerta: LostAlert
  onFocus: (alerta: LostAlert) => void
  onDetails: (alerta: LostAlert) => void
  onFound: (alerta: LostAlert) => void
  onReport: (alerta: LostAlert) => void
  currentUserId: string | null
  refCallback: (node: HTMLElement | null) => void
}) {
  const categoria = alerta.categoria ?? 'outros'
  const CategoriaIcon = categorias[categoria].Icon
  const isOwner = Boolean(currentUserId && alerta.usuario_id === currentUserId)
  const boosted = Boolean(alerta.boost_ativo && isFutureDate(alerta.boost_expira_em ?? undefined))
  return (
    <article ref={refCallback} className={`foundy-item-card cursor-pointer overflow-hidden rounded-3xl border bg-foundy-surface ${boosted ? 'border-foundy-green/50 shadow-foundy-green/10' : 'border-red-400/20'}`} role="button" tabIndex={0} onClick={() => onDetails(alerta)} onKeyDown={(event) => { if (event.key === 'Enter') onDetails(alerta) }}>
      <div className="grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white"><MapPin size={13} /> Procurando</span>
          {boosted ? <span className="inline-flex items-center gap-2 rounded-full bg-foundy-green px-3 py-1 text-xs font-black text-slate-950"><Sparkles size={13} /> Alerta ampliado</span> : null}
          <span className="rounded-full bg-foundy-blue px-3 py-1 text-xs font-bold text-white">{formatDistance(alerta.distancia_metros ?? null)}</span>
        </div>
        <div className="rounded-3xl border border-red-400/20 bg-gradient-to-br from-red-500/15 via-foundy-background to-foundy-blue/10 p-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-foundy-blue/15 px-3 py-1 text-xs font-bold text-foundy-blue"><CategoriaIcon size={14} /> {categorias[categoria].label}</p>
          <h3 className="mt-3 text-2xl font-black">{alerta.titulo}</h3>
          <p className="mt-2 text-sm text-foundy-muted">{alerta.local_descricao ?? 'Região aproximada protegida'}</p>
        </div>
        <p className="text-sm leading-6 text-foundy-muted">{alerta.descricao}</p>
        <div className="flex flex-wrap gap-2">
          {alerta.subcategoria ? <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200">{filtrosFoundy[alerta.subcategoria as ItemFilter]?.label ?? alerta.subcategoria}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="foundy-pressable rounded-xl bg-foundy-blue px-4 py-2 text-sm font-black text-white" type="button" onClick={(event) => { event.stopPropagation(); onDetails(alerta) }}>Ver detalhes</button>
          {!isOwner ? <button className="foundy-pressable rounded-xl bg-foundy-green px-4 py-2 text-sm font-black text-slate-950" type="button" onClick={(event) => { event.stopPropagation(); onFound(alerta) }}>Encontrei</button> : <span className="rounded-xl border border-foundy-border px-4 py-2 text-sm font-bold text-foundy-muted">Seu alerta</span>}
          <button className="foundy-pressable rounded-xl border border-foundy-border px-4 py-2 text-sm font-semibold" type="button" onClick={(event) => { event.stopPropagation(); onFocus(alerta) }}>Ver no mapa</button>
          {!isOwner ? <button className="foundy-pressable rounded-xl border border-red-400/50 px-4 py-2 text-sm font-semibold text-red-200" type="button" onClick={(event) => { event.stopPropagation(); onReport(alerta) }}>Denunciar post</button> : null}
        </div>
      </div>
    </article>
  )
}

function ModalDetalhePost({
  item,
  tipo,
  currentUserId,
  onClose,
  onClaim,
  onFound,
  onMap,
  onBoost,
}: {
  item: ItemAchado | LostAlert
  tipo: 'achado' | 'perda'
  currentUserId: string | null
  onClose: () => void
  onClaim: (item: ItemAchado) => void
  onFound: (alerta: LostAlert) => void
  onMap: (item: ItemAchado | LostAlert) => void
  onBoost: (alerta: LostAlert) => void
}) {
  const categoria = item.categoria ?? 'outros'
  const imageUrl = item.imagem_url ?? (tipo === 'achado' ? placeholdersPorCategoria[categoria] : null)
  const isOwner = Boolean(currentUserId && item.usuario_id === currentUserId)
  const isFound = tipo === 'achado'
  const subcategoria = item.subcategoria ? (filtrosFoundy[item.subcategoria as ItemFilter]?.label ?? item.subcategoria) : null

  return (
    <ModalBase titulo={isFound ? 'Detalhes do item achado' : 'Detalhes do alerta de perda'} subtitulo="Confira a imagem maior, localização aproximada e informações principais." onClose={onClose} large>
      <div className="grid gap-5 p-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-3xl border border-foundy-border bg-foundy-background">
          {imageUrl ? <img src={imageUrl} alt={`Imagem de ${item.titulo}`} className="max-h-[68dvh] w-full object-contain bg-black/20" /> : (
            <div className="grid min-h-72 place-items-center bg-gradient-to-br from-red-500/15 via-foundy-background to-foundy-blue/10 p-6 text-center">
              <div>
                <MapPin className="mx-auto text-red-100" size={42} />
                <h3 className="mt-3 text-xl font-black">Alerta de perda sem foto pública</h3>
                <p className="mt-2 text-sm leading-6 text-foundy-muted">Para evitar exposição indevida, posts de perda priorizam descrição, categoria e região aproximada.</p>
              </div>
            </div>
          )}
        </div>
        <section className="grid content-start gap-4">
          <div className="rounded-3xl border border-foundy-border bg-foundy-background p-5">
            <p className={`w-fit rounded-full px-3 py-1 text-xs font-black ${isFound ? 'bg-foundy-green/20 text-foundy-green' : 'bg-red-500/20 text-red-100'}`}>
              {isFound ? 'Item achado' : 'Alerta de perda'}
            </p>
            <h2 className="mt-3 text-2xl font-black">{item.titulo}</h2>
            <p className="mt-2 leading-7 text-foundy-muted">{item.descricao}</p>
          </div>
          <div className="grid gap-3 rounded-3xl border border-foundy-border bg-foundy-background p-5 text-sm">
            <InfoRow label="Categoria" value={categorias[categoria].label} />
            {subcategoria ? <InfoRow label="Filtro específico" value={subcategoria} /> : null}
            <InfoRow label="Região protegida" value={item.local_descricao ?? 'Localização aproximada protegida'} />
            <InfoRow label="Distância estimada" value={formatDistance(item.distancia_metros ?? null)} />
            <InfoRow label="Publicado em" value={new Date(item.criado_em).toLocaleString('pt-BR')} />
            {'raio_mascara_metros' in item ? <InfoRow label="Raio de privacidade" value={`${item.raio_mascara_metros} m`} /> : null}
            {'raio_metros' in item && item.raio_metros ? <InfoRow label="Raio do alerta" value={`${item.raio_metros} m`} /> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="foundy-pressable rounded-xl border border-foundy-border px-4 py-2 text-sm font-black" type="button" onClick={() => onMap(item)}>Ver no mapa</button>
            {isFound && !isOwner ? <button className="foundy-pressable rounded-xl bg-foundy-green px-4 py-2 text-sm font-black text-slate-950" type="button" onClick={() => onClaim(item as ItemAchado)}>É meu</button> : null}
            {!isFound && !isOwner ? <button className="foundy-pressable rounded-xl bg-foundy-green px-4 py-2 text-sm font-black text-slate-950" type="button" onClick={() => onFound(item as LostAlert)}>Encontrei</button> : null}
            {!isFound && isOwner ? <button className="foundy-pressable rounded-xl bg-foundy-blue px-4 py-2 text-sm font-black text-white" type="button" onClick={() => onBoost(item as LostAlert)}>Ampliar alcance</button> : null}
          </div>
        </section>
      </div>
    </ModalBase>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foundy-border bg-foundy-surface p-3">
      <p className="text-xs font-black uppercase tracking-wide text-foundy-muted">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}

function UserSection({
  painel,
  sessao,
  onOpenProfile,
  onOpenChats,
  onDeleteItem,
  onDeleteAlert,
  onBoostAlert,
}: {
  painel: UserDashboard | null
  sessao: FoundySession
  onOpenProfile: () => void
  onOpenChats: () => void
  onDeleteItem: (itemId: string) => void
  onDeleteAlert: (alertaId: string) => void
  onBoostAlert: (alerta: LostAlert) => void
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
            text={`${alerta.status}${alerta.boost_ativo ? ' - Alerta ampliado ativo' : ''}`}
            action={alerta.status !== 'arquivado' ? <div className="flex flex-wrap gap-2"><button className="rounded-xl bg-foundy-blue px-3 py-2 text-xs font-black text-white" type="button" onClick={() => onBoostAlert(alerta)}>Ampliar alcance</button><button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-200" type="button" onClick={() => onDeleteAlert(alerta.id)}>Arquivar</button></div> : null}
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
        <h1 className="mt-2 text-3xl font-black">Segurança física antes de qualquer encontro.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foundy-muted">O Foundy é uma ponte digital. Encontros devem acontecer em locais públicos, de dia, com prova de posse e preferencialmente acompanhado.</p>
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

function MonetizacaoSection({
  planos,
  sessao,
  onCarregar,
  onSolicitar,
}: {
  planos: MonetizationPlansResponse | null
  sessao: FoundySession | null
  onCarregar: () => void
  onSolicitar: (plan: MonetizationPlan) => void
}) {
  useEffect(() => {
    if (!planos) onCarregar()
  }, [onCarregar, planos])

  const plan = getSupportPlan(planos)

  return (
    <section className="grid gap-5">
      <div className="foundy-hero-panel rounded-3xl border border-foundy-border bg-foundy-surface p-5">
        <p className="foundy-eyebrow foundy-attention text-sm font-semibold text-foundy-green">Apoio voluntário</p>
        <h1 className="mt-2 text-3xl font-black">Apoie o Foundy sem criar paywall para recuperar itens.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-foundy-muted">
          Esta aba fica limpa de propósito: aqui aparece apenas o apoio voluntário, sem misturar ofertas de outros fluxos.
        </p>
      </div>
      <article className="foundy-item-card rounded-3xl border border-foundy-green/30 bg-foundy-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-foundy-green">{plan.price}</p>
            <h2 className="mt-2 text-3xl font-black">{plan.title}</h2>
          </div>
          <span className="grid size-14 place-items-center rounded-2xl bg-foundy-green/15 text-foundy-green">
            <Star size={26} />
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-foundy-muted">{plan.description}</p>
        <ul className="mt-4 grid gap-2 text-sm md:grid-cols-3">
          {plan.benefits.map((benefit) => <li className="rounded-2xl border border-foundy-border bg-foundy-background p-3" key={benefit}>{benefit}</li>)}
        </ul>
        <p className="mt-4 rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-3 text-sm text-foundy-green">{plan.ethical_notice}</p>
        <button className="mt-4 h-11 w-full rounded-xl bg-foundy-green text-sm font-black text-slate-950 sm:w-auto sm:px-6" type="button" onClick={() => onSolicitar(plan)}>
          {plan.cta}
        </button>
        <p className="mt-3 text-xs font-bold text-foundy-muted">{sessao ? `Apoio vinculado à conta de ${sessao.nome}.` : 'Você também pode apoiar sem estar logado, informando um e-mail de contato.'}</p>
      </article>
      <div className="rounded-3xl border border-foundy-border bg-foundy-surface p-5">
        <h2 className="text-xl font-black">Regras éticas da monetização</h2>
        <p className="mt-2 text-sm leading-6 text-foundy-muted">
          Nunca cobramos para recuperar um item, abrir chat, responder desafio ou publicar item achado. Pagamentos da Fase 1 são manuais e confirmados pelo administrador oficial.
        </p>
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
  planos,
  sessao,
  onCarregarPlanos,
  onBuscaChange,
  onSelecionarEmpresa,
  onVoltar,
  onCriarEmpresa,
  onSolicitarPlano,
}: {
  empresas: EmpresaFoundy[]
  busca: string
  catalogo: EmpresaCatalogoItem[]
  empresaSelecionada: EmpresaFoundy | null
  mensagem: string
  planos: MonetizationPlansResponse | null
  sessao: FoundySession | null
  onCarregarPlanos: () => void
  onBuscaChange: (value: string) => void
  onSelecionarEmpresa: (empresa: EmpresaFoundy) => void
  onVoltar: () => void
  onCriarEmpresa: () => void
  onSolicitarPlano: (plan: MonetizationPlan) => void
}) {
  useEffect(() => {
    if (!planos) onCarregarPlanos()
  }, [onCarregarPlanos, planos])

  const companyPlans = getCompanyPlans(planos)

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
                <span className="w-fit rounded-full bg-foundy-blue/15 px-3 py-1 text-xs font-bold text-foundy-blue">{filtrosFoundy[item.subcategoria as ItemFilter]?.label ?? categorias[item.categoria].label}</span>
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
        {empresas.map((empresa) => {
          const pro = empresa.plan_status === 'active' && empresa.plan_type === 'pro'
          const verified = pro || (empresa.plan_status === 'active' && empresa.plan_type === 'verified') || empresa.empresa_verificada
          return (
            <button className={`foundy-pressable rounded-3xl border bg-foundy-surface p-5 text-left ${pro ? 'border-amber-300/60 shadow-lg shadow-amber-950/20' : 'border-foundy-border'}`} key={empresa.id} type="button" onClick={() => onSelecionarEmpresa(empresa)}>
              <div className="flex items-start gap-4">
                {empresa.foto_url ? <img src={empresa.foto_url} alt="" className="size-14 rounded-2xl object-cover" /> : <span className={`grid size-14 place-items-center rounded-2xl ${pro ? 'bg-amber-300/20 text-amber-200' : 'bg-foundy-blue/20 text-foundy-blue'}`}><Building2 size={24} /></span>}
                <div>
                  <p className={`text-xs font-black uppercase tracking-wide ${pro ? 'text-amber-200' : 'text-foundy-green'}`}>{pro ? 'Empresa Pro dourada' : verified ? 'Empresa verificada' : empresa.is_safe_point ? 'Ponto Seguro Foundy' : 'Catálogo empresarial'}</p>
                  <h2 className={`mt-1 text-xl font-black ${pro ? 'text-amber-100' : ''}`}>{empresa.empresa_nome ?? empresa.nome}</h2>
                  <p className="mt-1 text-sm text-foundy-muted">{empresa.empresa_cidade}{empresa.empresa_uf ? `/${empresa.empresa_uf}` : ''}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-foundy-muted">{empresa.empresa_descricao ?? 'Clique para ver o catálogo público de itens disponíveis.'}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                {empresa.is_safe_point ? <span className="rounded-full bg-foundy-green/15 px-3 py-1 text-foundy-green">Ponto Seguro</span> : null}
                {verified ? <span className="rounded-full bg-foundy-blue/15 px-3 py-1 text-foundy-blue">Selo ativo</span> : null}
                {pro ? <span className="rounded-full bg-amber-300 px-3 py-1 text-slate-950">Pro</span> : null}
              </div>
            </button>
          )
        })}
      </div>
      {empresas.length === 0 ? <EmptyState title="Nenhuma empresa encontrada" text="Quando uma instituição criar uma conta empresarial, ela aparecerá aqui." /> : null}
      <CompanyPlansOffer
        title="Leve o Foundy para sua instituição"
        subtitle="A oferta de Empresa Verificada aparece aqui, onde o usuário já está procurando catálogos empresariais."
        plans={companyPlans}
        sessao={sessao}
        onCriarEmpresa={onCriarEmpresa}
        onSolicitarPlano={onSolicitarPlano}
      />
    </section>
  )
}

function CompanyPlansOffer({
  title,
  subtitle,
  plans,
  sessao,
  onCriarEmpresa,
  onSolicitarPlano,
}: {
  title: string
  subtitle: string
  plans: MonetizationPlan[]
  sessao: FoundySession | null
  onCriarEmpresa: () => void
  onSolicitarPlano: (plan: MonetizationPlan) => void
}) {
  return (
    <aside className="rounded-3xl border border-foundy-blue/30 bg-foundy-surface p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="foundy-eyebrow text-sm font-semibold text-foundy-blue">Foundy Empresas</p>
          <h2 className="mt-1 text-2xl font-black">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foundy-muted">{subtitle}</p>
        </div>
        {sessao?.tipo_conta === 'empresa' ? <span className="rounded-full bg-foundy-green/20 px-3 py-1 text-xs font-black text-foundy-green">Conta empresarial detectada</span> : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <article className="rounded-3xl border border-foundy-border bg-foundy-background p-4" key={plan.id}>
            <p className="text-xs font-black uppercase tracking-wide text-foundy-green">{plan.price}</p>
            <h3 className="mt-2 text-lg font-black">{plan.title}</h3>
            <p className="mt-2 min-h-16 text-sm leading-6 text-foundy-muted">{plan.description}</p>
            <p className="mt-3 rounded-2xl border border-foundy-border bg-foundy-surface p-3 text-xs font-bold text-foundy-muted">
              {plan.item_limit === null ? 'Itens ativos: sem limite fixo' : plan.item_limit ? `Itens ativos: até ${plan.item_limit}` : 'Entrada gratuita'}
            </p>
            <ul className="mt-3 grid gap-2 text-xs text-foundy-muted">
              {plan.benefits.map((benefit) => <li className="flex gap-2" key={benefit}><CheckCircle2 className="mt-0.5 shrink-0 text-foundy-green" size={13} /> <span>{benefit}</span></li>)}
            </ul>
            <p className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-100">{plan.ethical_notice}</p>
            <button className="mt-4 h-10 w-full rounded-xl bg-foundy-blue text-xs font-black text-white" type="button" onClick={() => (plan.id === 'company_free' ? onCriarEmpresa() : onSolicitarPlano(plan))}>{plan.cta}</button>
          </article>
        ))}
      </div>
    </aside>
  )
}

function EmpresaPainelSection({
  sessao,
  planos,
  onCarregarPlanos,
  onMensagem,
  onSolicitarPlano,
}: {
  sessao: FoundySession
  planos: MonetizationPlansResponse | null
  onCarregarPlanos: () => void
  onMensagem: (value: string) => void
  onSolicitarPlano: (plan: MonetizationPlan) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [itens, setItens] = useState<EmpresaCatalogoItem[]>([])
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoriaCatalogo, setCategoriaCatalogo] = useState<ItemFilter>('outros')
  const [codigo, setCodigo] = useState('')
  const [local, setLocal] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [mensagem, setMensagem] = useState('Cadastre itens encontrados para organizar o balcão de achados e perdidos.')
  const [formAberto, setFormAberto] = useState(false)
  const [buscaCatalogo, setBuscaCatalogo] = useState('')
  const [statusCatalogo, setStatusCatalogo] = useState<'todos' | 'disponivel' | 'retirado' | 'arquivado'>('disponivel')
  const [categoriaFiltroCatalogo, setCategoriaFiltroCatalogo] = useState<ItemFilter>('todos')
  const [retiradaItemId, setRetiradaItemId] = useState<string | null>(null)
  const [retiradoPor, setRetiradoPor] = useState('')
  const [retiradoEm, setRetiradoEm] = useState(() => new Date().toISOString().slice(0, 16))
  const [monetizacaoMensagem, setMonetizacaoMensagem] = useState('Solicite verificação, Ponto Seguro ou gere materiais da sua empresa.')
  const [publicSlug, setPublicSlug] = useState(sessao.public_slug || '')
  const [publicDescription, setPublicDescription] = useState(sessao.empresa_descricao || '')
  const [publicHours, setPublicHours] = useState('')
  const [safePointDaysPanel, setSafePointDaysPanel] = useState('')
  const [safePointCoordsPanel, setSafePointCoordsPanel] = useState<GeoPoint>({
    latitude: Number(sessao.safe_point_latitude) || defaultPoint.latitude,
    longitude: Number(sessao.safe_point_longitude) || defaultPoint.longitude,
  })
  const [safePointClicks, setSafePointClicks] = useState(Number(sessao.safe_point_clicks) || 0)
  const [publicAddressVisible, setPublicAddressVisible] = useState(false)
  const [qrLink, setQrLink] = useState('')
  const [relatorio, setRelatorio] = useState<{ total_itens: number; total_retirados: number; total_disponiveis: number; taxa_retirada: number } | null>(null)
  const [eventos, setEventos] = useState<CompanyEventPlan[]>([])
  const [eventoTitulo, setEventoTitulo] = useState('')
  const [eventoDescricao, setEventoDescricao] = useState('')
  const [eventoLocal, setEventoLocal] = useState('')
  const [eventoEndereco, setEventoEndereco] = useState('')
  const [eventoInicio, setEventoInicio] = useState('')
  const [eventoFim, setEventoFim] = useState('')
  const [eventosMensagem, setEventosMensagem] = useState('Eventos ficam disponíveis apenas para o plano Eventos e Instituições ativo.')
  const categoriaAtual = categoriaFromFiltro(categoriaCatalogo)
  const companyPlans = getCompanyPlans(planos)
  const plan = effectiveCompanyPlan(sessao)
  const isSafePointAccount = sessao.is_safe_point === 'true'
  const canUseCatalogSearch = companyPlanAllows(sessao, 'catalogSearch')
  const canUseQr = isSafePointAccount || companyPlanAllows(sessao, 'qr')
  const canUseReports = companyPlanAllows(sessao, 'reports')
  const canUseHistory = companyPlanAllows(sessao, 'history')
  const canUseEvents = companyPlanAllows(sessao, 'events')

  const carregar = useCallback(async () => {
      const lista = await listarCatalogoEmpresa(sessao.usuario_id, '')
    setItens(lista)
  }, [sessao.usuario_id])

  useEffect(() => {
    void carregar().catch(() => setMensagem('Não foi possível carregar seu catálogo empresarial.'))
  }, [carregar])

  useEffect(() => {
    void buscarPerfilEmpresa(sessao.usuario_id).then((perfil) => {
      setPublicSlug(perfil.public_slug ?? '')
      setPublicDescription(perfil.public_description ?? perfil.empresa_descricao ?? '')
      setPublicHours(perfil.public_opening_hours ?? '')
      setPublicAddressVisible(Boolean(perfil.public_address_visible))
      setSafePointDaysPanel(perfil.safe_point_service_days ?? '')
      setSafePointClicks(Number(perfil.safe_point_clicks ?? 0))
      if (typeof perfil.safe_point_latitude === 'number' && typeof perfil.safe_point_longitude === 'number') {
        setSafePointCoordsPanel({ latitude: perfil.safe_point_latitude, longitude: perfil.safe_point_longitude })
      }
    }).catch(() => undefined)
  }, [sessao.usuario_id])

  const carregarEventos = useCallback(async () => {
    if (!canUseEvents) {
      setEventos([])
      return
    }
    const lista = await listarEventosEmpresa(sessao.usuario_id, sessao.usuario_id)
    setEventos(lista)
    setEventosMensagem(lista.length ? 'Eventos carregados para operação assistida.' : 'Nenhum evento criado ainda.')
  }, [canUseEvents, sessao.usuario_id])

  useEffect(() => {
    void carregarEventos().catch((error) => {
      setEventosMensagem(error instanceof Error ? error.message : 'Não foi possível carregar os eventos.')
    })
  }, [carregarEventos])

  async function solicitarMonetizacaoEmpresa(requestType: 'company_verified' | 'safe_point' | 'company_pro' | 'event_plan') {
    try {
      const resposta = await criarSolicitacaoMonetizacao({
        user_id: sessao.usuario_id,
        company_id: sessao.usuario_id,
        request_type: requestType,
        contact_name: sessao.empresa_nome || sessao.nome,
        contact_email: sessao.email,
        message: 'Solicitação enviada pelo painel empresarial.',
        desired_plan: requestType,
      })
      setMonetizacaoMensagem(resposta.mensagem ?? 'Solicitação enviada para análise manual.')
    } catch (error) {
      setMonetizacaoMensagem(error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.')
    }
  }

  async function salvarPerfilPublicoEmpresa() {
    try {
      const resposta = await atualizarPerfilPublicoEmpresa(sessao.usuario_id, {
        usuario_id: sessao.usuario_id,
        public_slug: publicSlug,
        public_description: publicDescription,
        public_opening_hours: publicHours,
        public_address_visible: publicAddressVisible,
        ...(isSafePointAccount ? {
          safe_point_latitude: safePointCoordsPanel.latitude,
          safe_point_longitude: safePointCoordsPanel.longitude,
          safe_point_service_days: safePointDaysPanel,
        } : {}),
      })
      setMonetizacaoMensagem(resposta.mensagem)
    } catch (error) {
      setMonetizacaoMensagem(error instanceof Error ? error.message : 'Não foi possível salvar a página pública.')
    }
  }

  async function carregarMateriaisEmpresa() {
    try {
      if (!canUseQr && !canUseReports) {
        setMonetizacaoMensagem('Seu plano atual não libera QR Code nem relatório. Solicite Empresa Verificada para QR Code ou Empresa Pro para relatórios.')
        return
      }
      const qr = canUseQr ? await buscarQrCodeEmpresa(sessao.usuario_id, sessao.usuario_id) : null
      const resumo = canUseReports ? await buscarRelatorioEmpresa(sessao.usuario_id, sessao.usuario_id) : null
      if (qr) setQrLink(qr.url)
      if (resumo) setRelatorio(resumo)
      setMonetizacaoMensagem('Materiais liberados para o seu plano carregados.')
    } catch (error) {
      setMonetizacaoMensagem(error instanceof Error ? error.message : 'Não foi possível carregar materiais empresariais.')
    }
  }

  function selecionarImagem(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (isDocumentSensitiveFilter(categoriaCatalogo)) {
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
        categoria: categoriaAtual,
        subcategoria: categoriaCatalogo,
        codigo_interno: codigo,
        local_armazenamento: local,
        imagem_url: isDocumentSensitiveFilter(categoriaCatalogo) || hasDocumentPrivacyHint(titulo, descricao, filtrosFoundy[categoriaCatalogo].label) ? null : imagemUrl || null,
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

  async function confirmarRetirada() {
    if (!retiradaItemId || retiradoPor.trim().length < 2) return setMensagem('Informe quem retirou o item.')
    try {
      const resposta = await marcarItemCatalogoRetirado(retiradaItemId, sessao.usuario_id, retiradoPor.trim(), new Date(retiradoEm).toISOString())
      setMensagem(resposta.mensagem)
      setRetiradaItemId(null)
      setRetiradoPor('')
      await carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível registrar a retirada.')
    }
  }

  async function criarEvento() {
    if (!canUseEvents) {
      setEventosMensagem('Criação de evento exige o plano Eventos e Instituições ativo.')
      return
    }
    if (eventoTitulo.trim().length < 3) {
      setEventosMensagem('Informe o nome do evento.')
      return
    }
    try {
      const criado = await criarEventoEmpresa(sessao.usuario_id, {
        usuario_id: sessao.usuario_id,
        title: eventoTitulo,
        description: eventoDescricao || null,
        location_name: eventoLocal || null,
        address: eventoEndereco || null,
        starts_at: eventoInicio ? new Date(eventoInicio).toISOString() : null,
        ends_at: eventoFim ? new Date(eventoFim).toISOString() : null,
      })
      setEventosMensagem(criado.mensagem ?? 'Evento criado para operação assistida.')
      setEventoTitulo('')
      setEventoDescricao('')
      setEventoLocal('')
      setEventoEndereco('')
      setEventoInicio('')
      setEventoFim('')
      await carregarEventos()
    } catch (error) {
      setEventosMensagem(error instanceof Error ? error.message : 'Não foi possível criar o evento.')
    }
  }

  const itensVisiveis = itens.filter((item) => {
    const statusOk = !canUseHistory ? item.status === 'disponivel' : statusCatalogo === 'todos' || item.status === statusCatalogo
    const categoriaOk = !canUseCatalogSearch || categoriaFiltroCatalogo === 'todos' || item.subcategoria === categoriaFiltroCatalogo || item.categoria === categoriaFromFiltro(categoriaFiltroCatalogo)
    const termo = canUseCatalogSearch ? buscaCatalogo.trim().toLowerCase() : ''
    const texto = `${item.titulo} ${item.descricao} ${item.categoria} ${item.subcategoria ?? ''} ${item.codigo_interno ?? ''} ${item.local_armazenamento ?? ''}`.toLowerCase()
    return statusOk && categoriaOk && (!termo || texto.includes(termo))
  })

  return (
    <section className="grid gap-4">
      <div className="foundy-hero-panel rounded-3xl border border-foundy-border bg-foundy-surface p-5">
        <p className="foundy-eyebrow text-sm font-semibold text-foundy-green">Painel empresarial</p>
        <h1 className="mt-2 text-3xl font-black">{sessao.empresa_nome || sessao.nome}</h1>
        <p className="mt-2 text-sm leading-6 text-foundy-muted">Catálogo interno para achados e perdidos. Sem chat, sem desafio do dono e sem geolocalização.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {plan === 'pro' ? <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">Empresa Pro Dourada</span> : null}
          {plan === 'verified' ? <span className="rounded-full bg-foundy-green px-3 py-1 text-xs font-black text-slate-950">Empresa Verificada</span> : null}
          {plan === 'event' ? <span className="rounded-full bg-foundy-blue px-3 py-1 text-xs font-black text-white">Eventos e Instituições</span> : null}
          {sessao.is_safe_point === 'true' ? <span className="rounded-full bg-foundy-blue px-3 py-1 text-xs font-black text-white">Ponto Seguro Foundy</span> : null}
          <span className="rounded-full border border-foundy-border px-3 py-1 text-xs font-bold text-foundy-muted">Plano efetivo: {plan}</span>
        </div>
      </div>
      <div className="grid gap-4 rounded-3xl border border-foundy-border bg-foundy-surface p-4 lg:grid-cols-[1fr_1fr]">
        <div className="grid gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-foundy-green">Monetização empresarial</p>
            <h2 className="mt-1 text-xl font-black">Cresça com confiança, sem bloquear usuários comuns.</h2>
            <p className="mt-2 text-sm leading-6 text-foundy-muted">{monetizacaoMensagem}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-foundy-blue px-3 py-2 text-xs font-black text-white" type="button" onClick={() => void solicitarMonetizacaoEmpresa('company_verified')}>Solicitar verificação</button>
            <button className="rounded-xl border border-foundy-green/50 px-3 py-2 text-xs font-black text-foundy-green" type="button" onClick={() => void solicitarMonetizacaoEmpresa('safe_point')}>Quero ser Ponto Seguro</button>
            <button className="rounded-xl border border-amber-300/50 px-3 py-2 text-xs font-black text-amber-100" type="button" onClick={() => void solicitarMonetizacaoEmpresa('company_pro')}>Solicitar Pro</button>
            <button className="rounded-xl border border-foundy-border px-3 py-2 text-xs font-bold" type="button" onClick={() => void solicitarMonetizacaoEmpresa('event_plan')}>Plano Eventos</button>
            <button className="rounded-xl border border-foundy-border px-3 py-2 text-xs font-bold" type="button" onClick={() => void carregarMateriaisEmpresa()}>Materiais liberados</button>
          </div>
          {qrLink ? <div className="rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm"><p className="font-black">Link público/QR</p><a className="mt-1 block break-all text-foundy-blue underline" href={qrLink} target="_blank">{qrLink}</a><p className="mt-2 text-xs text-foundy-muted">Encontrou ou perdeu algo aqui? Acesse o Foundy.</p></div> : null}
          {relatorio ? <div className="grid gap-2 sm:grid-cols-4"><Metric label="Itens" value={String(relatorio.total_itens)} /><Metric label="Disponíveis" value={String(relatorio.total_disponiveis)} /><Metric label="Retirados" value={String(relatorio.total_retirados)} /><Metric label="Taxa" value={`${relatorio.taxa_retirada}%`} /></div> : null}
        </div>
        <div className="grid gap-3">
          <h3 className="font-black">Página pública da empresa</h3>
          <Field label="Slug público"><input className="foundy-input" value={publicSlug} onChange={(event) => setPublicSlug(event.target.value)} placeholder="ex.: faculdade-centro-norte" /></Field>
          <Field label="Descrição pública"><textarea className="foundy-input min-h-20" value={publicDescription} onChange={(event) => setPublicDescription(event.target.value)} /></Field>
          <Field label="Horário de funcionamento"><input className="foundy-input" value={publicHours} onChange={(event) => setPublicHours(event.target.value)} placeholder="Ex.: Seg a Sex, 8h às 18h" /></Field>
          <label className="flex gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm"><input checked={publicAddressVisible} onChange={(event) => setPublicAddressVisible(event.target.checked)} type="checkbox" /> Exibir endereço público de retirada.</label>
          {isSafePointAccount ? (
            <div className="grid gap-3 rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-3">
              <p className="font-black text-foundy-green">Painel Ponto Seguro Foundy</p>
              <Metric label="Cliques recebidos" value={String(safePointClicks)} />
              <Field label="Dias de funcionamento"><input className="foundy-input" value={safePointDaysPanel} onChange={(event) => setSafePointDaysPanel(event.target.value)} placeholder="Ex.: Segunda a sábado" /></Field>
              <MapaPerimetro center={safePointCoordsPanel} radius={70} onCenterChange={setSafePointCoordsPanel} />
              <p className="text-xs text-foundy-muted">Este ponto aparece de forma destacada no mapa e pode ser sugerido no chat seguro.</p>
            </div>
          ) : null}
          <button className="h-11 rounded-xl bg-foundy-green text-sm font-black text-slate-950" type="button" onClick={() => void salvarPerfilPublicoEmpresa()}>Salvar página pública</button>
        </div>
      </div>
      <CompanyPlansOffer
        title="Melhore seu catálogo empresarial"
        subtitle="Escolha um plano de crescimento com recursos que já possuem base funcional no Foundy: limite de itens, selo, QR Code, relatório e implantação assistida."
        plans={companyPlans}
        sessao={sessao}
        onCriarEmpresa={() => setMonetizacaoMensagem('Sua Empresa Básica já está ativa. Ela permite até 5 itens disponíveis no catálogo.')}
        onSolicitarPlano={onSolicitarPlano}
      />
      <div className={`grid gap-4 rounded-3xl border p-4 ${canUseEvents ? 'border-foundy-blue/30 bg-foundy-blue/10' : 'border-foundy-border bg-foundy-surface'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-foundy-blue">Eventos e Instituições</p>
            <h2 className="text-xl font-black">Operação temporária de achados e perdidos</h2>
            <p className="mt-1 text-sm leading-6 text-foundy-muted">{eventosMensagem}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${canUseEvents ? 'bg-foundy-blue text-white' : 'border border-foundy-border text-foundy-muted'}`}>
            {canUseEvents ? 'Liberado no seu plano' : 'Exclusivo do plano Eventos'}
          </span>
        </div>
        {canUseEvents ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-3 rounded-2xl border border-foundy-border bg-foundy-surface p-4">
              <Field label="Nome do evento"><input className="foundy-input" value={eventoTitulo} onChange={(event) => setEventoTitulo(event.target.value)} placeholder="Ex.: Feira Cultural Foundy" /></Field>
              <Field label="Descrição"><textarea className="foundy-input min-h-20" value={eventoDescricao} onChange={(event) => setEventoDescricao(event.target.value)} placeholder="Explique como será a retirada presencial." /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome do local"><input className="foundy-input" value={eventoLocal} onChange={(event) => setEventoLocal(event.target.value)} placeholder="Ex.: Ginásio principal" /></Field>
                <Field label="Endereço público"><input className="foundy-input" value={eventoEndereco} onChange={(event) => setEventoEndereco(event.target.value)} placeholder="Ex.: Rua, número e bairro" /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Início"><input className="foundy-input" type="datetime-local" value={eventoInicio} onChange={(event) => setEventoInicio(event.target.value)} /></Field>
                <Field label="Fim"><input className="foundy-input" type="datetime-local" value={eventoFim} onChange={(event) => setEventoFim(event.target.value)} /></Field>
              </div>
              <button className="h-11 rounded-xl bg-foundy-blue text-sm font-black text-white" type="button" onClick={() => void criarEvento()}>Criar evento assistido</button>
            </div>
            <PanelList title="Eventos cadastrados" empty="Nenhum evento criado ainda.">
              {eventos.map((evento) => (
                <article className="rounded-2xl border border-foundy-border bg-foundy-surface p-4" key={evento.id}>
                  <p className="text-sm font-black">{evento.title}</p>
                  <p className="mt-1 text-xs text-foundy-muted">{evento.location_name || 'Local não informado'} - {evento.status}</p>
                  <p className="mt-2 text-sm leading-6 text-foundy-muted">{evento.description || 'Sem descrição.'}</p>
                  <p className="mt-2 text-xs text-foundy-muted">
                    {evento.starts_at ? new Date(evento.starts_at).toLocaleString('pt-BR') : 'Início não informado'} até {evento.ends_at ? new Date(evento.ends_at).toLocaleString('pt-BR') : 'fim não informado'}
                  </p>
                </article>
              ))}
            </PanelList>
          </div>
        ) : (
          <p className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            O plano Eventos libera página temporária, QR Code do evento, painel de atendimento, até 500 itens ativos e chat seguro operacional. Empresas Básicas, Verificadas e Pro não recebem esta aba funcional.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-3xl border border-foundy-border bg-foundy-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black">Meu catálogo</h2>
          <p className="text-sm text-foundy-muted">Use busca, filtros e abas para checar itens disponíveis, retirados ou arquivados.</p>
        </div>
        <button className="foundy-pressable rounded-xl bg-foundy-green px-4 py-2 text-sm font-black text-slate-950" type="button" onClick={() => setFormAberto((open) => !open)}>{formAberto ? 'Fechar cadastro' : 'Adicionar item'}</button>
      </div>
      {formAberto ? (
        <div className="grid gap-4 rounded-3xl border border-foundy-border bg-foundy-surface p-4">
          <h2 className="text-xl font-black">Adicionar item ao catálogo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título"><input className="foundy-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} /></Field>
            <Field label="Categoria"><select className="foundy-input" value={categoriaCatalogo} onChange={(event) => { const value = event.target.value as ItemFilter; setCategoriaCatalogo(value); if (isDocumentSensitiveFilter(value)) setImagemUrl('') }}>{Object.entries(filtrosFoundy).filter(([value]) => value !== 'todos').map(([value, data]) => <option key={value} value={value}>{data.label}</option>)}</select></Field>
          </div>
          <Field label="Descrição"><textarea className="foundy-input min-h-24" value={descricao} onChange={(event) => setDescricao(event.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código interno"><input className="foundy-input" value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="Ex.: BALCAO-042" /></Field>
            <Field label="Local de armazenamento"><input className="foundy-input" value={local} onChange={(event) => setLocal(event.target.value)} placeholder="Ex.: gaveta 2, secretaria" /></Field>
          </div>
          <button className="h-11 rounded-xl border border-foundy-border text-sm font-bold" type="button" onClick={() => fileRef.current?.click()}>{isDocumentSensitiveFilter(categoriaCatalogo) ? 'Documento: foto bloqueada' : 'Adicionar foto opcional'}</button>
          <input className="sr-only" ref={fileRef} type="file" accept="image/*" onChange={selecionarImagem} />
          {imagemUrl ? <img src={imagemUrl} alt="Prévia do catálogo" className="h-40 rounded-2xl object-cover" /> : null}
          <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
          <button className="h-11 rounded-xl bg-foundy-green text-sm font-black text-slate-950" type="button" onClick={() => void criar()}>Publicar no catálogo</button>
        </div>
      ) : null}
      {canUseCatalogSearch ? <div className="grid gap-3 rounded-3xl border border-foundy-border bg-foundy-surface p-4 md:grid-cols-[1fr_auto]">
        <div className="foundy-search-input flex items-center gap-3 rounded-2xl border border-foundy-border bg-foundy-background px-4 py-3">
          <Search size={18} />
          <input className="w-full bg-transparent outline-none" value={buscaCatalogo} onChange={(event) => setBuscaCatalogo(event.target.value)} placeholder="Buscar por código, título, descrição ou armário..." />
        </div>
        <select className="foundy-input md:w-56" value={statusCatalogo} onChange={(event) => setStatusCatalogo(event.target.value as typeof statusCatalogo)}>
          <option value="disponivel">Disponíveis</option>
          <option value="retirado">Retirados</option>
          <option value="arquivado">Arquivados</option>
          <option value="todos">Todos</option>
        </select>
        <select className="foundy-input md:w-56" value={categoriaFiltroCatalogo} onChange={(event) => setCategoriaFiltroCatalogo(event.target.value as ItemFilter)}>
          {(Object.entries(filtrosFoundy) as [ItemFilter, (typeof filtrosFoundy)[ItemFilter]][]).map(([value, data]) => <option key={value} value={value}>{data.label}</option>)}
        </select>
      </div> : <div className="rounded-3xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100"><strong>Plano Básico:</strong> filtros e pesquisa do catálogo ficam bloqueados. Solicite Empresa Verificada para liberar busca, filtros e QR Code.</div>}
      <PanelList title="Itens do catálogo" empty="Nenhum item encontrado com estes filtros.">
        {itensVisiveis.map((item) => (
          <div className="grid gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 md:grid-cols-[120px_1fr_auto]" key={item.id}>
            <img src={item.imagem_url ?? placeholdersPorCategoria[item.categoria]} alt={`Imagem de ${item.titulo}`} className="h-28 w-full rounded-2xl object-cover md:w-28" />
            <div>
              <p className="text-sm font-black">{item.titulo}</p>
              <p className="mt-1 text-xs text-foundy-muted">{filtrosFoundy[item.subcategoria as ItemFilter]?.label ?? categorias[item.categoria].label} - {item.status}</p>
              <p className="mt-2 text-sm leading-6 text-foundy-muted">{item.descricao}</p>
              <p className="mt-2 text-xs text-foundy-muted">Código: {item.codigo_interno || 'sem código'} | Local: {item.local_armazenamento || 'não informado'}</p>
              {item.status === 'retirado' ? <p className="mt-2 rounded-xl border border-foundy-green/30 bg-foundy-green/10 p-2 text-xs text-foundy-green">Retirado por {item.retirado_por_nome ?? 'não informado'} em {item.retirado_em ? new Date(item.retirado_em).toLocaleString('pt-BR') : 'data não informada'}.</p> : null}
            </div>
            <div className="flex flex-wrap content-start gap-2">
              {canUseHistory && item.status !== 'retirado' ? <button className="rounded-xl border border-foundy-border px-3 py-2 text-xs font-bold" type="button" onClick={() => { setRetiradaItemId(item.id); setRetiradoPor(''); setRetiradoEm(new Date().toISOString().slice(0, 16)) }}>Retirado</button> : null}
              {canUseHistory ? <button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-bold text-red-200" type="button" onClick={() => void mudarStatus(item.id, 'arquivado')}>Arquivar</button> : <span className="rounded-xl border border-foundy-border px-3 py-2 text-xs font-bold text-foundy-muted">Histórico no Pro</span>}
            </div>
          </div>
        ))}
      </PanelList>
      {retiradaItemId ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-3 backdrop-blur-sm sm:place-items-center">
          <div className="w-full max-w-lg rounded-3xl border border-foundy-border bg-foundy-surface p-4 shadow-2xl">
            <h3 className="text-lg font-black">Registrar retirada</h3>
            <div className="mt-4 grid gap-3">
              <Field label="Nome de quem retirou"><input className="foundy-input" value={retiradoPor} onChange={(event) => setRetiradoPor(event.target.value)} /></Field>
              <Field label="Data e horário"><input className="foundy-input" type="datetime-local" value={retiradoEm} onChange={(event) => setRetiradoEm(event.target.value)} /></Field>
              <div className="flex gap-2">
                <button className="h-11 flex-1 rounded-xl bg-foundy-green text-sm font-black text-slate-950" type="button" onClick={() => void confirmarRetirada()}>Confirmar retirada</button>
                <button className="h-11 flex-1 rounded-xl border border-foundy-border text-sm font-bold" type="button" onClick={() => setRetiradaItemId(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AdminSection({ data, adminId, onRefresh }: { data: AdminData; adminId: string; onRefresh: () => void }) {
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
  const [tipoConta, setTipoConta] = useState<'pessoal' | 'empresa' | 'ponto_seguro'>('pessoal')
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
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [empresaCep, setEmpresaCep] = useState('')
  const [empresaCatalogoPublico, setEmpresaCatalogoPublico] = useState(true)
  const [empresaPlanoInteresse, setEmpresaPlanoInteresse] = useState<'company_free' | 'company_verified' | 'company_pro' | 'event_plan'>('company_free')
  const [safePointHours, setSafePointHours] = useState('')
  const [safePointDays, setSafePointDays] = useState('')
  const [safePointCoords, setSafePointCoords] = useState<GeoPoint>(defaultPoint)
  const [mensagem, setMensagem] = useState('Crie sua conta para publicar, conversar e receber alertas.')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (!email.includes('@')) return setMensagem('Informe um e-mail válido.')
    if (senha.length < 8) return setMensagem('A senha precisa ter pelo menos 8 caracteres.')
    if (modo === 'cadastrar' && nome.trim().length < 2) return setMensagem('Informe seu nome.')
    if (modo === 'cadastrar' && tipoConta !== 'pessoal' && (!empresaNome.trim() || !empresaEndereco.trim() || !empresaCidade.trim() || empresaUf.trim().length !== 2 || empresaCnpj.replace(/\D/g, '').length !== 14 || empresaCep.replace(/\D/g, '').length !== 8)) return setMensagem('Informe nome, CNPJ, CEP, endereço público, cidade e UF da instituição.')
    if (modo === 'cadastrar' && tipoConta === 'ponto_seguro' && !safePointHours.trim()) return setMensagem('Informe o horário de funcionamento do Ponto Seguro Foundy.')
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
          tipo_conta: tipoConta === 'ponto_seguro' ? 'empresa' : tipoConta,
          ...(tipoConta !== 'pessoal'
            ? {
                empresa_nome: empresaNome,
                empresa_descricao: empresaDescricao,
                empresa_endereco_publico: empresaEndereco,
                empresa_cidade: empresaCidade,
                empresa_uf: empresaUf,
                empresa_cnpj: empresaCnpj,
                empresa_cep: empresaCep,
                empresa_catalogo_publico: tipoConta === 'ponto_seguro' ? true : empresaCatalogoPublico,
                company_plan_interest: tipoConta === 'ponto_seguro' ? 'safe_point' : empresaPlanoInteresse,
                safe_point_latitude: tipoConta === 'ponto_seguro' ? safePointCoords.latitude : null,
                safe_point_longitude: tipoConta === 'ponto_seguro' ? safePointCoords.longitude : null,
                safe_point_service_days: tipoConta === 'ponto_seguro' ? safePointDays : null,
                public_opening_hours: tipoConta === 'ponto_seguro' ? safePointHours : null,
              }
            : {}),
        })
        setMensagem(resposta.mensagem)
        if (!resposta.login_liberado) return
      }
      const login = await entrarUsuario({ email: email.trim().toLowerCase(), senha })
      onSessaoAtiva(login)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível concluir a autenticação.')
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
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-foundy-border bg-foundy-background p-1">
            <button className={`rounded-xl px-3 py-2 text-xs font-black sm:text-sm ${tipoConta === 'pessoal' ? 'bg-foundy-green text-slate-950' : 'text-foundy-muted'}`} type="button" onClick={() => setTipoConta('pessoal')}>Pessoa física</button>
            <button className={`rounded-xl px-3 py-2 text-xs font-black sm:text-sm ${tipoConta === 'empresa' ? 'bg-foundy-green text-slate-950' : 'text-foundy-muted'}`} type="button" onClick={() => setTipoConta('empresa')}>Empresa</button>
            <button className={`rounded-xl px-3 py-2 text-xs font-black sm:text-sm ${tipoConta === 'ponto_seguro' ? 'bg-foundy-green text-slate-950' : 'text-foundy-muted'}`} type="button" onClick={() => setTipoConta('ponto_seguro')}>Ponto Seguro</button>
          </div>
        ) : null}
        {modo === 'cadastrar' ? <Field label="Nome"><input className="foundy-input" value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Seu nome" autoComplete="name" /></Field> : null}
        {modo === 'cadastrar' && tipoConta !== 'pessoal' ? (
          <div className="grid gap-3 rounded-3xl border border-foundy-green/30 bg-foundy-green/10 p-4">
            <h3 className="font-black text-foundy-green">{tipoConta === 'ponto_seguro' ? 'Cadastro de Ponto Seguro Foundy' : 'Dados públicos da instituição'}</h3>
            {tipoConta === 'empresa' ? (
              <div className="grid gap-2">
                <p className="text-sm font-black">Escolha o ponto de partida empresarial</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {companyPlanFallbacks.map((plan) => (
                    <button
                      className={`rounded-2xl border p-3 text-left text-sm ${empresaPlanoInteresse === plan.id ? 'border-foundy-green bg-foundy-green text-slate-950' : 'border-foundy-border bg-foundy-background text-foundy-muted'}`}
                      key={plan.id}
                      type="button"
                      onClick={() => setEmpresaPlanoInteresse(plan.id as typeof empresaPlanoInteresse)}
                    >
                      <strong className="block">{plan.title}</strong>
                      <span className="mt-1 block text-xs font-bold">{plan.price}</span>
                      <span className="mt-2 block text-xs">{plan.description}</span>
                      <span className="mt-2 block rounded-xl bg-black/10 p-2 text-xs font-bold">{plan.item_limit === null ? 'Itens ativos: sem limite fixo' : plan.item_limit ? `Itens ativos: at? ${plan.item_limit}` : 'Entrada gratuita'}</span>
                    </button>
                  ))}
                </div>
                <p className="rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-xs font-bold text-red-100">A conta nasce Básica. Solicitações pagas vão para análise da moderação antes de liberar os benefícios.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-foundy-blue/30 bg-foundy-blue/10 p-3 text-sm text-foundy-blue">
                Pontos Seguros são locais físicos, públicos e movimentados. Eles aparecem no mapa com ponto exato e podem ser sugeridos no chat como local seguro de encontro.
              </div>
            )}
            <Field label="Nome da empresa ou institui??o"><input className="foundy-input" value={empresaNome} onChange={(event) => setEmpresaNome(event.target.value)} placeholder="Ex.: Faculdade Centro Norte" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="CNPJ"><input className="foundy-input" value={empresaCnpj} onChange={(event) => setEmpresaCnpj(event.target.value)} placeholder="00.000.000/0000-00" /></Field>
              <Field label="CEP"><input className="foundy-input" value={empresaCep} onChange={(event) => setEmpresaCep(event.target.value)} placeholder="00000-000" /></Field>
            </div>
            <Field label="Descrição curta"><textarea className="foundy-input min-h-20" value={empresaDescricao} onChange={(event) => setEmpresaDescricao(event.target.value)} placeholder={tipoConta === 'ponto_seguro' ? 'Ex.: Recepção iluminada, aberta ao público e com equipe durante o dia.' : 'Ex.: Catálogo oficial de achados e perdidos do campus.'} /></Field>
            <Field label="Endereço público de retirada"><input className="foundy-input" value={empresaEndereco} onChange={(event) => setEmpresaEndereco(event.target.value)} placeholder="Ex.: Secretaria, Bloco A, Rua..." /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cidade"><input className="foundy-input" value={empresaCidade} onChange={(event) => setEmpresaCidade(event.target.value)} /></Field>
              <Field label="UF"><input className="foundy-input uppercase" value={empresaUf} onChange={(event) => setEmpresaUf(event.target.value.toUpperCase().slice(0, 2))} maxLength={2} /></Field>
            </div>
            {tipoConta === 'ponto_seguro' ? (
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Dias de funcionamento"><input className="foundy-input" value={safePointDays} onChange={(event) => setSafePointDays(event.target.value)} placeholder="Ex.: Segunda a sábado" /></Field>
                  <Field label="Horário de funcionamento"><input className="foundy-input" value={safePointHours} onChange={(event) => setSafePointHours(event.target.value)} placeholder="Ex.: 8h às 18h" /></Field>
                </div>
                <div className="rounded-2xl border border-foundy-border bg-foundy-background p-3">
                  <p className="mb-2 text-sm font-black">Clique no mapa para marcar o ponto exato do local</p>
                  <MapaPerimetro center={safePointCoords} radius={70} onCenterChange={setSafePointCoords} />
                  <p className="mt-2 text-xs text-foundy-muted">Coordenadas salvas: {safePointCoords.latitude.toFixed(5)}, {safePointCoords.longitude.toFixed(5)}</p>
                </div>
              </div>
            ) : (
              <label className="flex gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm"><input checked={empresaCatalogoPublico} onChange={(event) => setEmpresaCatalogoPublico(event.target.checked)} type="checkbox" /> Catálogo visível para qualquer usuário encontrar pela aba Empresas.</label>
            )}
          </div>
        ) : null}
        <Field label="E-mail"><input className="foundy-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="você@email.com" type="email" autoComplete="email" /></Field>
        <Field label="Senha"><input className="foundy-input" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Mínimo de 8 caracteres" type="password" autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} /></Field>
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

function ModalBloqueioConta({ sessao, onLogout }: { sessao: FoundySession; onLogout: () => void }) {
  const prazo = sessao.banido_permanente === 'true'
    ? 'tempo indeterminado'
    : sessao.banido_ate
      ? `até ${new Date(sessao.banido_ate).toLocaleString('pt-BR')}`
      : 'até revisão da moderação'
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/90 p-4" onClick={onLogout}>
      <section className="max-w-lg rounded-3xl border border-red-400/40 bg-foundy-surface p-6 shadow-2xl shadow-red-950/40" onClick={(event) => event.stopPropagation()}>
        <div className="grid size-14 place-items-center rounded-2xl bg-red-500/20 text-red-100">
          <Ban size={28} />
        </div>
        <h2 className="mt-4 text-2xl font-black text-red-100">Conta suspensa pela moderação</h2>
        <p className="mt-3 leading-7 text-foundy-muted">
          Sua conta está suspensa por {prazo}. Motivo: {sessao.banimento_motivo || 'violação dos Termos de Uso e do Protocolo Foundy.'}
        </p>
        <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          Após sair, não será possível acessar ou criar novas contas neste dispositivo/rede enquanto a suspensão estiver ativa.
        </p>
        <button className="mt-5 h-11 w-full rounded-xl bg-red-500 text-sm font-black text-white" type="button" onClick={onLogout}>
          Entendi e sair da conta
        </button>
      </section>
    </div>
  )
}

function PaymentInstructions({ payment }: { payment?: ManualPaymentInfo | null }) {
  if (!payment) return null
  return (
    <div className="rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-4 text-sm">
      <p className="font-black text-foundy-green">{payment.checkout_url ? 'Checkout automático disponível' : 'Instruções de pagamento manual'}</p>
      <ul className="mt-3 grid gap-2 text-foundy-muted">
        {payment.instructions.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {payment.checkout_url ? (
        <a className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" href={payment.checkout_url} target="_blank" rel="noreferrer">
          Abrir pagamento seguro
        </a>
      ) : null}
      <p className="mt-3 rounded-xl border border-foundy-border bg-foundy-background p-3 text-xs text-foundy-muted">
        Esta janela não fecha automaticamente. Ela só deve ser fechada quando você concluir o pagamento, cancelar a solicitação ou decidir voltar depois.
      </p>
    </div>
  )
}

function ModalApoiarFoundy({ sessao, onClose }: { sessao: FoundySession | null; onClose: () => void }) {
  const [amount, setAmount] = useState(500)
  const [customAmount, setCustomAmount] = useState('')
  const [payerName, setPayerName] = useState(sessao?.nome ?? '')
  const [payerEmail, setPayerEmail] = useState(sessao?.email ?? '')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('Apoiar o Foundy é opcional e não altera suas chances de recuperar ou devolver um item.')
  const [payment, setPayment] = useState<ManualPaymentInfo | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit() {
    const cents = customAmount ? Math.round(Number(customAmount.replace(',', '.')) * 100) : amount
    if (!Number.isFinite(cents) || cents <= 0) return setFeedback('Informe um valor válido para apoiar.')
    if (!sessao && !payerEmail.includes('@')) return setFeedback('Informe um e-mail para receber as instruções.')
    setLoading(true)
    try {
      const resposta = await criarApoioFoundy({
        user_id: sessao?.usuario_id ?? null,
        amount_cents: cents,
        payer_name: payerName || sessao?.nome || null,
        payer_email: payerEmail || sessao?.email || null,
        message,
        payment_method: 'manual_pix',
      })
      setFeedback(resposta.mensagem ?? 'Apoio registrado. Obrigado por fortalecer a comunidade Foundy.')
      setPayment(resposta.payment ?? null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível registrar o apoio.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalBase titulo="Apoie o Foundy" subtitulo="Ajude a manter a plataforma gratuita, segura e ativa." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[300, 500, 1000, 2000].map((value) => <button className={`h-12 rounded-xl border text-sm font-black ${amount === value && !customAmount ? 'border-foundy-green bg-foundy-green text-slate-950' : 'border-foundy-border'}`} key={value} type="button" onClick={() => { setAmount(value); setCustomAmount('') }}>{formatMoney(value)}</button>)}
        </div>
        <Field label="Outro valor em reais"><input className="foundy-input" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="Ex.: 15,00" /></Field>
        {!sessao ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Nome"><input className="foundy-input" value={payerName} onChange={(event) => setPayerName(event.target.value)} /></Field><Field label="E-mail"><input className="foundy-input" value={payerEmail} onChange={(event) => setPayerEmail(event.target.value)} type="email" /></Field></div> : null}
        <Field label="Mensagem opcional"><textarea className="foundy-input min-h-20" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ex.: Estou torcendo pelo Foundy!" /></Field>
        <p className="rounded-xl border border-foundy-blue/30 bg-foundy-blue/10 p-3 text-sm text-foundy-blue">{feedback}</p>
        <PaymentInstructions payment={payment} />
        <button className="h-11 rounded-xl bg-foundy-green text-sm font-black text-slate-950 disabled:opacity-60" type="button" disabled={loading} onClick={() => void submit()}>{loading ? 'Gerando...' : 'Gerar solicitação de apoio'}</button>
      </div>
    </ModalBase>
  )
}

function ModalSolicitacaoMonetizacao({ plano, sessao, onClose, onDone }: { plano: MonetizationPlan; sessao: FoundySession | null; onClose: () => void; onDone: (mensagem: string) => void }) {
  const [name, setName] = useState(sessao?.empresa_nome || sessao?.nome || '')
  const [email, setEmail] = useState(sessao?.email ?? '')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('A solicitação será analisada manualmente pelo Foundy.')
  const [payment, setPayment] = useState<ManualPaymentInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const requestType = plano.id === 'safe_point' ? 'safe_point' : plano.id === 'company_pro' ? 'company_pro' : plano.id === 'event_plan' ? 'event_plan' : 'company_verified'
  const requiresCompany = ['company_verified', 'safe_point', 'company_pro', 'event_plan'].includes(requestType)

  async function submit() {
    if (requiresCompany && sessao?.tipo_conta !== 'empresa') return setFeedback('Este recurso exige uma conta empresarial Foundy.')
    if (!sessao && !email.includes('@')) return setFeedback('Informe um e-mail de contato para a análise.')
    setLoading(true)
    try {
      const resposta = await criarSolicitacaoMonetizacao({
        user_id: sessao?.usuario_id ?? null,
        company_id: requiresCompany ? sessao?.usuario_id ?? null : null,
        request_type: requestType,
        contact_name: name,
        contact_email: email || sessao?.email || null,
        contact_phone: phone,
        message,
        desired_plan: plano.title,
      })
      setPayment(resposta.payment ?? null)
      setFeedback(resposta.mensagem ?? 'Solicitação registrada com sucesso.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalBase titulo={plano.title} subtitulo={plano.ethical_notice} onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-2xl border border-foundy-border bg-foundy-background p-4">
          <p className="text-xs font-black uppercase tracking-wide text-foundy-green">{plano.price}</p>
          <p className="mt-2 text-sm leading-6 text-foundy-muted">{plano.description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome de contato"><input className="foundy-input" value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="E-mail de contato"><input className="foundy-input" value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></Field>
        </div>
        <Field label="Telefone ou WhatsApp opcional"><input className="foundy-input" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Field label="Mensagem para análise"><textarea className="foundy-input min-h-24" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Conte rapidamente como sua empresa quer usar o Foundy." /></Field>
        <p className="rounded-xl border border-foundy-blue/30 bg-foundy-blue/10 p-3 text-sm text-foundy-blue">{feedback}</p>
        <PaymentInstructions payment={payment} />
        <button className="h-11 rounded-xl bg-foundy-blue text-sm font-black text-white disabled:opacity-60" type="button" disabled={loading} onClick={() => void submit()}>{loading ? 'Enviando...' : 'Enviar solicitação manual'}</button>
      </div>
    </ModalBase>
  )
}

function ModalBoostAlerta({ alerta, sessao, onClose, onDone }: { alerta: LostAlert; sessao: FoundySession; onClose: () => void; onDone: (mensagem: string) => void }) {
  const [boostType, setBoostType] = useState<'24h' | '3d' | '7d'>('24h')
  const [feedback, setFeedback] = useState('O alerta gratuito continua ativo. O destaque apenas aumenta a visibilidade por tempo limitado.')
  const [payment, setPayment] = useState<ManualPaymentInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const plans = [
    { id: '24h' as const, label: '24 horas', price: 490 },
    { id: '3d' as const, label: '3 dias', price: 990 },
    { id: '7d' as const, label: '7 dias', price: 1990 },
  ]

  async function submit() {
    setLoading(true)
    try {
      const resposta = await solicitarBoostAlerta(alerta.id, sessao.usuario_id, boostType)
      setPayment(resposta.payment ?? null)
      setFeedback(resposta.mensagem ?? 'Alerta Ampliado solicitado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível solicitar o destaque.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalBase titulo="Ampliar alcance do alerta" subtitulo={`Alerta: ${alerta.titulo}`} onClose={onClose}>
      <div className="grid gap-4 p-4">
        <p className="rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-4 text-sm text-foundy-green">
          Este recurso não garante a recuperação do item. Ele apenas aumenta a visibilidade do alerta por tempo limitado.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => <button className={`rounded-2xl border p-4 text-left ${boostType === plan.id ? 'border-foundy-blue bg-foundy-blue/15' : 'border-foundy-border bg-foundy-background'}`} key={plan.id} type="button" onClick={() => setBoostType(plan.id)}><strong className="block">{plan.label}</strong><span className="text-sm text-foundy-muted">{formatMoney(plan.price)}</span></button>)}
        </div>
        <p className="rounded-xl border border-foundy-blue/30 bg-foundy-blue/10 p-3 text-sm text-foundy-blue">{feedback}</p>
        <PaymentInstructions payment={payment} />
        <button className="h-11 rounded-xl bg-foundy-blue text-sm font-black text-white disabled:opacity-60" type="button" disabled={loading} onClick={() => void submit()}>{loading ? 'Solicitando...' : 'Solicitar Alerta Ampliado'}</button>
      </div>
    </ModalBase>
  )
}

function ModalItemAchado({ sessao, onClose, onPublicado }: { sessao: FoundySession; onClose: () => void; onPublicado: (item: ItemAchado) => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [subcategoriaItem, setSubcategoriaItem] = useState<ItemFilter>('outros')
  const [local, setLocal] = useState('')
  const [desafio, setDesafio] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [imagemArquivo, setImagemArquivo] = useState<File | null>(null)
  const [coords, setCoords] = useState<GeoPoint>(defaultPoint)
  const [tagsImagem, setTagsImagem] = useState<string[]>([])
  const [mensagem, setMensagem] = useState('A imagem será processada com filtro automático de privacidade.')
  const [processando, setProcessando] = useState(false)
  const categoriaAtual = categoriaFromFiltro(subcategoriaItem)

  async function processarImagemSelecionada(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (isDocumentSensitiveFilter(subcategoriaItem)) {
      setImagemUrl('')
      setImagemArquivo(null)
      setTagsImagem(['#DocumentoProtegido'])
      setMensagem('Documento selecionado: por segurança, a foto não será publicada. Descreva apenas dados não sensíveis.')
      return
    }
    setImagemArquivo(file)
    setProcessando(true)
    try {
      const resultado = await processarImagemComPrivacidade(file, `${titulo} ${descricao} ${filtrosFoundy[subcategoriaItem].label}`)
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
    if (!navigator.geolocation) return setMensagem('Geolocalização indisponível neste navegador.')
    navigator.geolocation.getCurrentPosition(
      (posicao) => { setCoords({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude }); setMensagem('Local aproximado capturado.') },
      () => setMensagem('Não foi possível capturar sua localização.'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  async function publicar() {
    if (!titulo.trim() || !descricao.trim() || !desafio.trim()) return setMensagem('Preencha título, descrição e desafio do dono.')
    try {
      let imagemPublica = isDocumentSensitiveFilter(subcategoriaItem) ? null : imagemUrl || null
      let tagsPublicas = tagsImagem
      if (imagemArquivo && !isDocumentSensitiveFilter(subcategoriaItem) && hasDocumentPrivacyHint(titulo, descricao, filtrosFoundy[subcategoriaItem].label, tagsImagem.join(' '))) {
        const resultado = await processarImagemComPrivacidade(imagemArquivo, `${titulo} ${descricao} ${filtrosFoundy[subcategoriaItem].label}`)
        imagemPublica = resultado.imagem_data_url
        tagsPublicas = resultado.hashtags_ia
      }
      const item = await cadastrarItemAchado({
        titulo,
        descricao,
        categoria: categoriaAtual,
        subcategoria: subcategoriaItem,
        latitude: coords.latitude,
        longitude: coords.longitude,
        local_descricao: local,
        desafio_pergunta: desafio,
        detalhe_oculto: desafio,
        imagem_url: imagemPublica,
        tags_ia: tagsPublicas.map((tag) => tag.replace(/^#/, '')),
        usuario_id: sessao.usuario_id,
      })
      onPublicado(item)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível publicar o item.')
    }
  }

  return (
    <ModalBase titulo="Cadastrar item achado" subtitulo="Fotos de documentos nunca são publicadas." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título"><input className="foundy-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex.: Chave com fita azul" /></Field>
          <Field label="Categoria do item"><select className="foundy-input" value={subcategoriaItem} onChange={(event) => { const value = event.target.value as ItemFilter; setSubcategoriaItem(value); if (isDocumentSensitiveFilter(value)) { setImagemUrl(''); setImagemArquivo(null) } }}>{Object.entries(filtrosFoundy).filter(([value]) => value !== 'todos').map(([value, data]) => <option key={value} value={value}>{data.label}</option>)}</select></Field>
        </div>
        <Field label="Descrição pública"><textarea className="foundy-input min-h-24" value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Não informe telefone, e-mail, CPF ou endereço exato." /></Field>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-foundy-border text-sm font-bold disabled:opacity-60" type="button" onClick={() => fileInputRef.current?.click()} disabled={processando}>
          <Camera size={17} /> {isDocumentSensitiveFilter(subcategoriaItem) ? 'Documento: foto bloqueada' : processando ? 'Processando...' : 'Upload com privacidade'}
        </button>
        <input accept="image/*" className="sr-only" ref={fileInputRef} type="file" onChange={(event) => void processarImagemSelecionada(event)} />
        {imagemUrl ? <img src={imagemUrl} alt="Prévia protegida do item" className="h-44 w-full rounded-2xl object-cover" /> : null}
        <Field label="Local aproximado"><input className="foundy-input" value={local} onChange={(event) => setLocal(event.target.value)} placeholder="Ex.: perto da praça" /></Field>
        <Field label="Desafio do dono"><input className="foundy-input" value={desafio} onChange={(event) => setDesafio(event.target.value)} placeholder="Ex.: Qual detalhe interno só o dono conseguiria descrever?" /></Field>
        <button className="h-10 rounded-xl border border-foundy-border text-sm font-bold" type="button" onClick={usarGeolocalizacao}>Usar minha localização</button>
        <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
        <button className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" type="button" onClick={() => void publicar()}>Publicar com desafio do dono</button>
      </div>
    </ModalBase>
  )
}

function ModalPerdiAlgo({ sessao, pontoInicial, onClose, onCriado }: { sessao: FoundySession; pontoInicial: GeoPoint; onClose: () => void; onCriado: (mensagem: string, alerta?: LostAlert, abrirBoost?: boolean) => void }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [subcategoria, setSubcategoria] = useState<ItemFilter>('outros')
  const [localDescricao, setLocalDescricao] = useState('')
  const [ponto, setPonto] = useState<GeoPoint>(pontoInicial)
  const [raio, setRaio] = useState(5000)
  const [queroAmpliarDepois, setQueroAmpliarDepois] = useState(false)
  const [mensagem, setMensagem] = useState('Toque no mapa para posicionar o centro do perímetro.')
  const categoriaAtual = categoriaFromFiltro(subcategoria)
  const boostPlan = lossAlertBoostPlanFallback

  async function criar() {
    if (!titulo.trim() || !descricao.trim()) return setMensagem('Preencha título e descrição.')
    try {
      const resposta = await criarAlertaPerdido({
        usuario_id: sessao.usuario_id,
        titulo,
        descricao,
        categoria: categoriaAtual,
        subcategoria,
        local_descricao: localDescricao,
        hashtags: [subcategoria, categoriaAtual, titulo, descricao].join(' ').split(/[\s,]+/).map((tag) => tag.replace(/^#/, '')).filter(Boolean),
        latitude: ponto.latitude,
        longitude: ponto.longitude,
        raio_metros: raio,
      })
      const alertaCriado: LostAlert = {
        id: resposta.alerta_id,
        usuario_id: sessao.usuario_id,
        titulo,
        descricao,
        categoria: categoriaAtual,
        subcategoria,
        local_descricao: localDescricao,
        latitude_aproximada: ponto.latitude,
        longitude_aproximada: ponto.longitude,
        raio_metros: raio,
        distancia_metros: 0,
        imagem_url: null,
        status: 'ativo',
        criado_em: new Date().toISOString(),
        boost_ativo: false,
        boost_expira_em: null,
        boost_tipo: null,
      }
      onCriado(resposta.mensagem, alertaCriado, queroAmpliarDepois)
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível criar o alerta perdido.')
    }
  }

  return (
    <ModalBase titulo="Perímetro ativo de perda" subtitulo="Receba notificação se surgir item compatível." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-3xl border border-foundy-blue/30 bg-foundy-blue/10 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-foundy-blue">{boostPlan.title}</p>
          <h3 className="mt-1 text-xl font-black">Quer aumentar o alcance depois de publicar?</h3>
          <p className="mt-2 text-sm leading-6 text-foundy-muted">{boostPlan.description}</p>
          <p className="mt-2 text-xs font-bold text-foundy-muted">{boostPlan.price}</p>
          <label className="mt-3 flex gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm">
            <input checked={queroAmpliarDepois} onChange={(event) => setQueroAmpliarDepois(event.target.checked)} type="checkbox" />
            Abrir a solicitação de Alerta Ampliado logo após criar este alerta.
          </label>
          <p className="mt-3 rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-3 text-xs text-foundy-green">{boostPlan.ethical_notice}</p>
        </div>
        <Field label="Título"><input className="foundy-input" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex.: Perdi meu celular preto" /></Field>
        <Field label="Descrição"><textarea className="foundy-input min-h-24" value={descricao} onChange={(event) => setDescricao(event.target.value)} /></Field>
        <Field label="Categoria do item perdido"><select className="foundy-input" value={subcategoria} onChange={(event) => setSubcategoria(event.target.value as ItemFilter)}>{Object.entries(filtrosFoundy).filter(([value]) => value !== 'todos').map(([value, data]) => <option key={value} value={value}>{data.label}</option>)}</select></Field>
        <Field label="Ponto de referência público"><input className="foundy-input" value={localDescricao} onChange={(event) => setLocalDescricao(event.target.value)} placeholder="Ex.: perto da entrada principal do shopping" /></Field>
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
  const [mensagem, setMensagem] = useState('Atualize seu perfil público para gerar mais confiança.')

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
      setMensagem(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.')
    }
  }

  return (
    <ModalBase titulo="Minha página Foundy" subtitulo="Perfil, karma, itens e preferências." onClose={onClose}>
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
        <Field label="Ocupação ou apresentação curta"><input className="foundy-input" value={ocupacao} onChange={(event) => setOcupacao(event.target.value)} placeholder="Ex.: estudante, comerciante, morador do bairro" /></Field>
        <label className="flex gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm"><input checked={emailNotifications} onChange={(event) => setEmailNotifications(event.target.checked)} type="checkbox" /> Receber notificações importantes por e-mail.</label>
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
  pontosSeguros,
  feedback,
  valorAtual,
  onChangeValor,
  onSuggestSafePoint,
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
  pontosSeguros: EmpresaFoundy[]
  feedback: string
  valorAtual: string
  onChangeValor: (value: string) => void
  onSuggestSafePoint: (empresa: EmpresaFoundy) => void
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
                <p className="mt-1">{hasRisk ? 'O botão de denúncia está disponível no perfil ao lado. Nunca pague resgate, PIX ou taxa antecipada.' : 'As mensagens aparecem em poucos segundos e ficam salvas na conversa para os dois participantes.'}</p>
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
              <div className="grid gap-3">
                {pontosSeguros.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {pontosSeguros.slice(0, 6).map((empresa) => (
                      <button className="shrink-0 rounded-xl border border-foundy-green/40 bg-foundy-green/10 px-3 py-2 text-xs font-bold text-foundy-green" type="button" key={empresa.id} onClick={() => onSuggestSafePoint(empresa)}>
                        Sugerir {empresa.empresa_nome ?? empresa.nome}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <textarea
                    className="foundy-input min-h-12 flex-1 resize-none"
                    value={valorAtual}
                    onChange={(event) => onChangeValor(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        onEnviar()
                      }
                    }}
                    placeholder="Escreva uma mensagem segura..."
                    aria-label="Mensagem do chat. Enter envia, Shift Enter quebra linha."
                  />
                  <button className="grid size-12 shrink-0 place-items-center rounded-2xl bg-foundy-blue text-white" type="button" onClick={onEnviar} aria-label="Enviar mensagem"><Send size={18} /></button>
                </div>
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
    ['2', 'Prove que é seu', 'Use o desafio do dono para liberar a conversa apenas para quem realmente conhece o item.'],
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
          Proibido para menores de 18 anos. Nunca vá sozinho e nunca aceite encontros em locais isolados.
        </div>
        <button className="sm:col-span-2 h-11 rounded-xl bg-foundy-green text-sm font-black text-slate-950" type="button" onClick={onClose}>Entendi o protocolo</button>
      </div>
    </ModalBase>
  )
}

function ModalAdmin({ data, adminId, onClose, onRefresh, embedded = false }: { data: AdminData; adminId: string; onClose: () => void; onRefresh: () => void; embedded?: boolean }) {
  const [mensagem, setMensagem] = useState('Painel restrito ao administrador configurado.')
  const [tab, setTab] = useState<'itens' | 'arquivados' | 'usuarios' | 'empresas' | 'monetizacao' | 'denuncias' | 'denunciasResolvidas' | 'banidos'>('itens')
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState<{ titulo: string; dados: Record<string, unknown> } | null>(null)

  const usuarios = data.usuarios as Record<string, unknown>[]
  const empresas = (data.empresas ?? []) as Record<string, unknown>[]
  const itens = data.itens as unknown as Record<string, unknown>[]
  const alertas = (data.alertas_perdidos ?? []) as Record<string, unknown>[]
  const arquivados = (data.itens_arquivados ?? []) as Record<string, unknown>[]
  const denunciasChat = (data.denuncias ?? []) as Record<string, unknown>[]
  const denunciasPosts = (data.denuncias_posts ?? []) as Record<string, unknown>[]
  const denunciasResolvidas = (data.denuncias_resolvidas ?? []) as Record<string, unknown>[]
  const banidos = (data.banidos ?? []) as Record<string, unknown>[]
  const monetizacao = data.monetizacao
  const solicitacoesMonetizacao = (monetizacao?.solicitacoes ?? []) as unknown as Record<string, unknown>[]
  const apoiosMonetizacao = (monetizacao?.apoios ?? []) as unknown as Record<string, unknown>[]
  const boostsMonetizacao = (monetizacao?.boosts ?? []) as unknown as Record<string, unknown>[]
  const termo = busca.trim().toLowerCase()

  function texto(row: Record<string, unknown>) {
    return Object.values(row).filter((value) => ['string', 'number', 'boolean'].includes(typeof value)).join(' ').toLowerCase()
  }

  function filtrar(rows: Record<string, unknown>[]) {
    if (!termo) return rows
    return rows.filter((row) => texto(row).includes(termo))
  }

  async function arquivar(itemId: string) {
    const motivo = window.prompt('Motivo do arquivamento?') ?? ''
    if (motivo.length < 5) return
    const result = await adminArquivarItem(adminId, itemId, motivo)
    setMensagem(result.mensagem)
    onRefresh()
  }

  async function aplicarMedida(usuarioId: string, tipo: 'conta' | 'chat', denuncia?: Record<string, unknown>, denunciaTipo?: 'chat' | 'post') {
    const motivo = window.prompt(tipo === 'chat' ? 'Motivo do bloqueio de chat/desafios?' : 'Motivo da suspensão da conta?') ?? ''
    if (motivo.length < 5) return
    const permanente = window.confirm('Aplicar por tempo indeterminado? Clique em Cancelar para definir dias.')
    const dias = permanente ? null : Number(window.prompt('Quantos dias?', '7') ?? '7')
    if (!permanente && (!Number.isFinite(dias) || Number(dias) < 1)) return
    const result = await adminAplicarMedidaUsuario(adminId, usuarioId, {
      motivo,
      tipo,
      permanente,
      dias: permanente ? null : Number(dias),
      denuncia_id: typeof denuncia?.id === 'string' ? denuncia.id : undefined,
      denuncia_tipo: denunciaTipo,
    })
    setMensagem(result.mensagem)
    onRefresh()
  }

  async function avisar(usuarioId: string, denuncia?: Record<string, unknown>, denunciaTipo?: 'chat' | 'post') {
    const motivo = window.prompt('Texto do aviso ao usuário?') ?? ''
    if (motivo.length < 5) return
    const result = await adminAvisarUsuario(adminId, usuarioId, motivo, typeof denuncia?.id === 'string' ? denuncia.id : undefined, denunciaTipo)
    setMensagem(result.mensagem)
    onRefresh()
  }

  async function desbanir(usuarioId: string) {
    const motivo = window.prompt('Motivo do desbanimento?', 'Revisão administrativa concluída.') ?? ''
    if (motivo.length < 5) return
    const result = await adminDesbanirUsuario(adminId, usuarioId, motivo)
    setMensagem(result.mensagem)
    onRefresh()
  }

  const itemRows = filtrar([...itens, ...alertas])
  const archivedRows = filtrar(arquivados)
  const userRows = filtrar(usuarios)
  const companyRows = filtrar(empresas)
  const reportRows = filtrar([...denunciasChat.map((row) => ({ ...row, origem_denuncia: 'chat' })), ...denunciasPosts.map((row) => ({ ...row, origem_denuncia: 'post' }))])
  const resolvedReportRows = filtrar(denunciasResolvidas)
  const bannedRows = filtrar(banidos)
  const monetizationRows = filtrar([
    ...solicitacoesMonetizacao.map((row) => ({ ...row, origem_monetizacao: 'solicitacao' })),
    ...apoiosMonetizacao.map((row) => ({ ...row, origem_monetizacao: 'apoio' })),
    ...boostsMonetizacao.map((row) => ({ ...row, origem_monetizacao: 'boost' })),
  ])

  function DetailButton({ row, title }: { row: Record<string, unknown>; title: string }) {
    return <button className="rounded-xl border border-foundy-border px-3 py-2 text-xs font-bold" type="button" onClick={() => setDetalhe({ titulo: title, dados: row })}>Ver detalhes</button>
  }

  function resolverDenuncia(row: Record<string, unknown>, denunciaTipo: 'chat' | 'post') {
    const motivo = window.prompt('Resumo da decisão administrativa?', 'Denúncia analisada e marcada como resolvida.') ?? ''
    if (motivo.length < 5 || typeof row.id !== 'string') return
    void adminResolverDenuncia(adminId, row.id, denunciaTipo, motivo).then((resposta) => {
      setMensagem(resposta.mensagem)
      onRefresh()
    })
  }

  function desarquivar(row: Record<string, unknown>) {
    const motivo = window.prompt('Motivo para desarquivar este registro?', 'Registro revisado e liberado novamente.') ?? ''
    if (motivo.length < 5 || typeof row.id !== 'string') return
    const tipo = row.tipo_registro === 'alerta_perdido' || row.raio_metros ? 'alerta' : 'item'
    void adminDesarquivarItem(adminId, row.id, motivo, tipo).then((resposta) => {
      setMensagem(resposta.mensagem)
      onRefresh()
    })
  }

  function excluirPermanente(row: Record<string, unknown>) {
    const confirmacao = window.confirm('Excluir permanentemente este registro e seus vínculos? Esta ação não deve ser usada sem revisão.')
    if (!confirmacao || typeof row.id !== 'string') return
    const motivo = window.prompt('Motivo da exclusão permanente?') ?? ''
    if (motivo.length < 5) return
    const tipo = row.tipo_registro === 'alerta_perdido' || row.raio_metros ? 'alerta' : 'item'
    void adminExcluirRegistroPermanente(adminId, row.id, motivo, tipo).then((resposta) => {
      setMensagem(resposta.mensagem)
      onRefresh()
    })
  }

  function desfazerDenuncia(row: Record<string, unknown>) {
    const origem = row.origem_denuncia === 'chat' ? 'chat' : 'post'
    const motivo = window.prompt('Motivo para desfazer a ação e reabrir a denúncia?', 'Revisão administrativa solicitada.') ?? ''
    if (motivo.length < 5 || typeof row.id !== 'string') return
    void adminDesfazerModeracaoDenuncia(adminId, row.id, origem, motivo).then((resposta) => {
      setMensagem(resposta.mensagem)
      onRefresh()
    })
  }

  function excluirDenuncia(row: Record<string, unknown>) {
    const origem = row.origem_denuncia === 'chat' ? 'chat' : 'post'
    const confirmacao = window.confirm('Excluir permanentemente os dados desta denúncia?')
    if (!confirmacao || typeof row.id !== 'string') return
    const motivo = window.prompt('Motivo da exclusão permanente da denúncia?') ?? ''
    if (motivo.length < 5) return
    void adminExcluirDenuncia(adminId, row.id, origem, motivo).then((resposta) => {
      setMensagem(resposta.mensagem)
      onRefresh()
    })
  }

  function atualizarMonetizacao(row: Record<string, unknown>, action: 'approve' | 'reject' | 'confirm' | 'cancel' | 'activate' | 'expire') {
    const origem = row.origem_monetizacao
    const motivo = window.prompt('Observação administrativa?', action === 'approve' || action === 'confirm' || action === 'activate' ? 'Pagamento manual conferido e benefício liberado.' : 'Solicitação analisada pela administração.') ?? ''
    if (motivo.length < 3 || typeof row.id !== 'string') return
    if (origem === 'solicitacao') {
      const statusValue = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'cancelled'
      void adminAtualizarSolicitacaoMonetizacao(adminId, row.id, statusValue, motivo).then((resposta) => {
        setMensagem(resposta.mensagem)
        onRefresh()
      })
      return
    }
    if (origem === 'apoio') {
      const statusValue = action === 'confirm' ? 'confirmed' : action === 'cancel' ? 'cancelled' : 'pending'
      void adminAtualizarApoioFoundy(adminId, row.id, statusValue, motivo).then((resposta) => {
        setMensagem(resposta.mensagem)
        onRefresh()
      })
      return
    }
    if (origem === 'boost') {
      const statusValue = action === 'activate' ? 'active' : action === 'expire' ? 'expired' : 'cancelled'
      void adminAtualizarBoostAlerta(adminId, row.id, statusValue, motivo).then((resposta) => {
        setMensagem(resposta.mensagem)
        onRefresh()
      })
    }
  }

  const content = (
    <div className="grid gap-4 p-4">
      <p className="rounded-xl border border-foundy-border bg-foundy-background p-3 text-sm text-foundy-muted">{mensagem}</p>
      <div className="grid gap-3 rounded-3xl border border-foundy-border bg-foundy-background p-3 md:grid-cols-[1fr_auto]">
        <div className="foundy-search-input flex items-center gap-3 rounded-2xl border border-foundy-border bg-foundy-surface px-4 py-3">
          <Search size={18} />
          <input className="w-full bg-transparent outline-none" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Pesquisar usuário, item, e-mail, denúncia, empresa..." />
        </div>
        <button className="rounded-xl border border-foundy-border px-4 py-2 text-sm font-bold" type="button" onClick={onRefresh}>Atualizar painel</button>
      </div>
      <div className="foundy-tabbar flex gap-2 overflow-x-auto rounded-2xl border border-foundy-border bg-foundy-background p-1">
        {[
          ['itens', `Itens (${itemRows.length})`],
          ['arquivados', `Arquivados (${archivedRows.length})`],
          ['usuarios', `Usuários (${userRows.length})`],
          ['empresas', `Empresas (${companyRows.length})`],
          ['monetizacao', `Monetização (${monetizationRows.length})`],
          ['denuncias', `Denúncias (${reportRows.length})`],
          ['denunciasResolvidas', `Resolvidas (${resolvedReportRows.length})`],
          ['banidos', `Banidos (${bannedRows.length})`],
        ].map(([id, label]) => <button className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black ${tab === id ? 'bg-foundy-blue text-white' : 'text-foundy-muted'}`} key={id} type="button" onClick={() => setTab(id as typeof tab)}>{label}</button>)}
      </div>

      {tab === 'itens' ? <PanelList title="Itens e alertas recentes" empty="Nenhum item encontrado.">{itemRows.map((row) => {
        const id = String(row.id)
        const isAlert = Boolean(row.raio_metros)
        return <div className="grid gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 md:grid-cols-[1fr_auto]" key={`${isAlert ? 'alerta' : 'item'}-${id}`}><div><p className="text-sm font-black">{String(row.titulo ?? 'Sem título')}</p><p className="mt-1 text-xs text-foundy-muted">{isAlert ? 'Alerta de perda' : 'Item achado'} - {String(row.status ?? 'sem status')} - publicado por {String(row.usuario_nome ?? row.usuario_email ?? row.usuario_id ?? 'não identificado')}</p></div><div className="flex flex-wrap gap-2"><DetailButton row={row} title={String(row.titulo ?? id)} />{!isAlert ? <button className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => void arquivar(id)}><Trash2 size={14} /></button> : null}</div></div>
      })}</PanelList> : null}

      {tab === 'arquivados' ? <PanelList title="Itens arquivados" empty="Nenhum item arquivado.">{archivedRows.map((row) => {
        const id = String(row.id)
        const isAlert = row.tipo_registro === 'alerta_perdido' || Boolean(row.raio_metros)
        return <div className="grid gap-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 md:grid-cols-[1fr_auto]" key={`${isAlert ? 'alerta-arquivado' : 'item-arquivado'}-${id}`}><div><p className="text-sm font-black text-amber-100">{String(row.titulo ?? 'Sem título')}</p><p className="mt-1 text-xs text-amber-100/75">{isAlert ? 'Alerta de perda arquivado' : 'Item achado arquivado'} - publicado por {String(row.usuario_nome ?? row.usuario_email ?? row.usuario_id ?? 'não identificado')}</p></div><div className="flex flex-wrap gap-2"><DetailButton row={row} title={String(row.titulo ?? id)} /><button className="rounded-xl border border-foundy-green/50 px-3 py-2 text-xs font-black text-foundy-green" type="button" onClick={() => desarquivar(row)}>Desarquivar</button><button className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => excluirPermanente(row)}>Excluir para sempre</button></div></div>
      })}</PanelList> : null}

      {tab === 'usuarios' ? <PanelList title="Usuários pessoais" empty="Nenhum usuário encontrado.">{userRows.map((row) => <div className="grid gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 md:grid-cols-[1fr_auto]" key={String(row.id)}><div><p className="text-sm font-black">{String(row.nome ?? row.email ?? row.id)}</p><p className="mt-1 text-xs text-foundy-muted">{String(row.email ?? 'sem e-mail')} | Karma: {String(row.pontos_luz ?? 0)} | Itens: {String(row.total_itens_postados ?? 0)}</p></div><div className="flex flex-wrap gap-2"><DetailButton row={row} title={String(row.nome ?? row.email ?? row.id)} /><button className="rounded-xl border border-amber-300/50 px-3 py-2 text-xs font-black text-amber-100" type="button" onClick={() => void avisar(String(row.id))}>Avisar</button><button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-200" type="button" onClick={() => void aplicarMedida(String(row.id), 'chat')}>Bloquear chat</button><button className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => void aplicarMedida(String(row.id), 'conta')}>Suspender conta</button></div></div>)}</PanelList> : null}

      {tab === 'empresas' ? <PanelList title="Contas empresariais" empty="Nenhuma empresa encontrada.">{companyRows.map((row) => <div className="grid gap-3 rounded-2xl border border-foundy-border bg-foundy-background p-3 md:grid-cols-[1fr_auto]" key={String(row.id)}><div><p className="text-sm font-black">{String(row.empresa_nome ?? row.nome ?? row.email)}</p><p className="mt-1 text-xs text-foundy-muted">{String(row.email ?? 'sem e-mail')} | Catálogo público: {String(row.empresa_catalogo_publico ?? true)} | Itens: {String(row.total_itens_postados ?? 0)}</p></div><div className="flex flex-wrap gap-2"><DetailButton row={row} title={String(row.empresa_nome ?? row.nome ?? row.id)} /><button className="rounded-xl border border-amber-300/50 px-3 py-2 text-xs font-black text-amber-100" type="button" onClick={() => void avisar(String(row.id))}>Avisar</button><button className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => void aplicarMedida(String(row.id), 'conta')}>Suspender</button></div></div>)}</PanelList> : null}

      {tab === 'monetizacao' ? <PanelList title="Monetização manual" empty="Nenhuma solicitação, apoio ou boost registrado.">{monetizationRows.map((row) => {
        const origem = String(row.origem_monetizacao)
        const id = String(row.id)
        const title = origem === 'solicitacao' ? `Solicitação: ${String(row.request_type ?? 'plano')}` : origem === 'apoio' ? `Apoio: ${formatMoney(Number(row.amount_cents ?? 0))}` : `Boost: ${String(row.alerta_titulo ?? row.loss_alert_id ?? 'alerta')}`
        const actor = String(row.empresa_nome ?? row.usuario_nome ?? row.payer_name ?? row.usuario_email ?? row.company_id ?? row.user_id ?? 'não identificado')
        return <div className="grid gap-3 rounded-2xl border border-foundy-blue/30 bg-foundy-blue/10 p-3 md:grid-cols-[1fr_auto]" key={`${origem}-${id}`}><div><p className="text-sm font-black text-white">{title}</p><p className="mt-1 text-xs text-foundy-muted">Origem: {origem} | Status: {String(row.status ?? 'pendente')} | Responsável: {actor}</p><p className="mt-2 text-sm text-foundy-muted">{String(row.message ?? row.admin_notes ?? row.manual_payment_reference ?? 'Sem observação adicional.')}</p></div><div className="flex flex-wrap content-start gap-2"><DetailButton row={row} title={title} />{origem === 'solicitacao' ? <><button className="rounded-xl bg-foundy-green px-3 py-2 text-xs font-black text-slate-950" type="button" onClick={() => atualizarMonetizacao(row, 'approve')}>Aprovar</button><button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-200" type="button" onClick={() => atualizarMonetizacao(row, 'reject')}>Rejeitar</button></> : null}{origem === 'apoio' ? <><button className="rounded-xl bg-foundy-green px-3 py-2 text-xs font-black text-slate-950" type="button" onClick={() => atualizarMonetizacao(row, 'confirm')}>Confirmar</button><button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-200" type="button" onClick={() => atualizarMonetizacao(row, 'cancel')}>Cancelar</button></> : null}{origem === 'boost' ? <><button className="rounded-xl bg-foundy-green px-3 py-2 text-xs font-black text-slate-950" type="button" onClick={() => atualizarMonetizacao(row, 'activate')}>Ativar</button><button className="rounded-xl border border-amber-300/50 px-3 py-2 text-xs font-black text-amber-100" type="button" onClick={() => atualizarMonetizacao(row, 'expire')}>Expirar</button><button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-200" type="button" onClick={() => atualizarMonetizacao(row, 'cancel')}>Cancelar</button></> : null}</div></div>
      })}</PanelList> : null}

      {tab === 'denuncias' ? <PanelList title="Denúncias de chat e posts" empty="Nenhuma denúncia registrada.">{reportRows.map((row) => { const denunciadoId = String(row.usuario_denunciado_id ?? ''); const origem = row.origem_denuncia === 'chat' ? 'chat' : 'post'; return <div className="grid gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3" key={`${origem}-${String(row.id)}`}><div><p className="text-sm font-black text-red-100">{origem === 'chat' ? 'Denúncia de chat' : 'Denúncia de post'}: {String(row.motivo_tipo ?? row.motivo ?? 'sem motivo')}</p><p className="mt-1 text-xs text-red-100/75">Denunciante: {String(row.denunciante_nome ?? row.denunciante_email ?? row.usuario_denunciante_id ?? 'não identificado')} | Denunciado: {String(row.denunciado_nome ?? row.denunciado_email ?? row.usuario_denunciado_id ?? 'não identificado')} | Item: {String(row.item_titulo ?? row.alerta_titulo ?? row.item_achado_id ?? row.alerta_perdido_id ?? 'não informado')}</p><p className="mt-2 text-sm text-red-100/85">{String(row.motivo ?? 'Sem descrição detalhada.')}</p></div><div className="flex flex-wrap gap-2"><DetailButton row={row} title={`Denúncia ${origem}`} /><button className="rounded-xl border border-foundy-green/50 px-3 py-2 text-xs font-black text-foundy-green" type="button" onClick={() => resolverDenuncia(row, origem)}>Resolvida</button>{denunciadoId ? <button className="rounded-xl border border-amber-300/50 px-3 py-2 text-xs font-black text-amber-100" type="button" onClick={() => void avisar(denunciadoId, row, origem)}>Avisar</button> : null}{denunciadoId ? <button className="rounded-xl border border-red-400/50 px-3 py-2 text-xs font-black text-red-100" type="button" onClick={() => void aplicarMedida(denunciadoId, 'chat', row, origem)}>Bloquear chat</button> : null}{denunciadoId ? <button className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => void aplicarMedida(denunciadoId, 'conta', row, origem)}>Suspender conta</button> : null}</div></div> })}</PanelList> : null}

      {tab === 'denunciasResolvidas' ? <PanelList title="Denúncias resolvidas" empty="Nenhuma denúncia resolvida ainda.">{resolvedReportRows.map((row) => { const origem = row.origem_denuncia === 'chat' ? 'chat' : 'post'; return <div className="grid gap-3 rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-3" key={`resolvida-${origem}-${String(row.id)}`}><div><p className="text-sm font-black text-foundy-green">{origem === 'chat' ? 'Denúncia de chat resolvida' : 'Denúncia de post resolvida'}: {String(row.status ?? 'resolvida')}</p><p className="mt-1 text-xs text-foundy-muted">Denunciante: {String(row.denunciante_nome ?? row.denunciante_email ?? row.usuario_denunciante_id ?? 'não identificado')} | Denunciado: {String(row.denunciado_nome ?? row.denunciado_email ?? row.usuario_denunciado_id ?? 'não identificado')}</p><p className="mt-2 text-sm text-foundy-muted">Decisão: {String(row.decisao_admin ?? row.motivo ?? 'sem decisão registrada')}</p></div><div className="flex flex-wrap gap-2"><DetailButton row={row} title={`Denúncia resolvida ${origem}`} /><button className="rounded-xl border border-amber-300/50 px-3 py-2 text-xs font-black text-amber-100" type="button" onClick={() => desfazerDenuncia(row)}>Desfazer ação</button><button className="rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => excluirDenuncia(row)}>Excluir dados</button></div></div> })}</PanelList> : null}

      {tab === 'banidos' ? <PanelList title="Usuários com restrição ativa" empty="Nenhum usuário banido no momento.">{bannedRows.map((row) => <div className="grid gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 md:grid-cols-[1fr_auto]" key={String(row.id)}><div><p className="text-sm font-black text-red-100">{String(row.nome ?? row.email ?? row.id)}</p><p className="mt-1 text-xs text-red-100/75">Conta: {String(row.banimento_motivo ?? 'sem banimento de conta')} | Chat: {String(row.chat_banimento_motivo ?? 'sem banimento de chat')}</p></div><div className="flex flex-wrap gap-2"><DetailButton row={row} title={String(row.nome ?? row.email ?? row.id)} /><button className="rounded-xl bg-foundy-green px-3 py-2 text-xs font-black text-slate-950" type="button" onClick={() => void desbanir(String(row.id))}>Desbanir</button></div></div>)}</PanelList> : null}

      {detalhe ? <div className="rounded-3xl border border-foundy-border bg-foundy-background p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-foundy-green">Detalhes</p><h3 className="text-xl font-black">{detalhe.titulo}</h3></div><button className="rounded-xl border border-foundy-border px-3 py-2 text-sm font-bold" type="button" onClick={() => setDetalhe(null)}>Fechar</button></div><dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">{Object.entries(detalhe.dados).map(([key, value]) => <AdminDetailValue fieldKey={key} value={value} key={key} />)}</dl></div> : null}
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

function ModalBusca({ filtro, buscaTexto, itensVisiveis, totalItens, onFiltroChange, onBuscaChange, onLimpar, onClose }: { filtro: ItemFilter; buscaTexto: string; itensVisiveis: number; totalItens: number; onFiltroChange: (value: ItemFilter) => void; onBuscaChange: (value: string) => void; onLimpar: () => void; onClose: () => void }) {
  return (
    <ModalBase titulo="Lupa Foundy" subtitulo="Filtre por texto, categoria e tags inteligentes." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="foundy-search-input flex items-center gap-3 rounded-2xl border border-foundy-border bg-foundy-background px-4 py-3"><Search size={20} /><input className="w-full bg-transparent outline-none" value={buscaTexto} onChange={(event) => onBuscaChange(event.target.value)} placeholder="Buscar por chaveiro azul, carteira, fone..." /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.entries(filtrosFoundy) as [ItemFilter, (typeof filtrosFoundy)[ItemFilter]][]).map(([value, data]) => <FilterCard active={filtro === value} icon={data.Icon} title={data.label} text={data.description} key={value} onClick={() => onFiltroChange(value)} />)}
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-foundy-border bg-foundy-background p-3 text-sm"><span>{itensVisiveis} de {totalItens} itens visíveis</span><button className="rounded-xl border border-foundy-border px-3 py-2 font-bold" type="button" onClick={onLimpar}>Limpar</button></div>
      </div>
    </ModalBase>
  )
}

function AdminDetailValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? 'não informado')
  const isImage = typeof value === 'string' && (fieldKey.includes('imagem') || fieldKey.includes('foto')) && (value.startsWith('http') || value.startsWith('data:image/'))
  const isHugeBase64Image = typeof value === 'string' && value.startsWith('data:image/') && value.length > 300_000
  return (
    <div className="rounded-2xl border border-foundy-border bg-foundy-surface p-3">
      <dt className="text-xs font-black uppercase tracking-wide text-foundy-muted">{fieldKey}</dt>
      <dd className="mt-2 whitespace-pre-wrap break-words">
        {isHugeBase64Image ? (
          <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-sm text-amber-100">Imagem antiga em base64 ocultada para não travar o painel. Novas imagens são salvas como URL pública do Storage.</div>
        ) : isImage ? (
          <img src={String(value)} alt={`Imagem vinculada a ${fieldKey}`} className="max-h-72 w-full rounded-2xl object-contain bg-black/20" />
        ) : text.length > 320 ? (
          <details>
            <summary className="cursor-pointer font-bold text-foundy-blue">Texto longo oculto para não travar a tela</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-foundy-background p-3 text-xs">{text}</pre>
          </details>
        ) : (
          text
        )}
      </dd>
    </div>
  )
}

function ModalAcaoRapida({ onClose, onEscolherPerdi, onEscolherAchei }: { onClose: () => void; onEscolherPerdi: () => void; onEscolherAchei: () => void }) {
  return (
    <ModalBase titulo="Nova ação rápida" subtitulo="Selecione o fluxo ideal." onClose={onClose}>
      <div className="grid gap-3 p-4">
        <button className="foundy-pressable inline-flex min-h-16 items-center justify-between rounded-2xl bg-red-500 px-4 py-3 text-left text-white" type="button" onClick={onEscolherPerdi}><span><strong className="block">Perdi algo</strong><span className="text-sm opacity-90">Criar alerta com perímetro e opção de Alerta Ampliado</span></span><MapPin size={18} /></button>
        <button className="foundy-pressable inline-flex h-14 items-center justify-between rounded-2xl bg-foundy-green px-4 text-left text-slate-950" type="button" onClick={onEscolherAchei}><span><strong className="block">Achei algo</strong><span className="text-sm opacity-90">Publicar com desafio do dono</span></span><CheckCircle2 size={18} /></button>
      </div>
    </ModalBase>
  )
}

function ModalDesafio({ item, resposta, onRespostaChange, onConfirmar, onClose }: { item: ItemAchado; resposta: string; onRespostaChange: (value: string) => void; onConfirmar: () => void; onClose: () => void }) {
  return (
    <ModalBase titulo="Verificação do dono" subtitulo="O chat só abre após validação." onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-2xl border border-foundy-blue/30 bg-foundy-blue/10 p-4"><p className="text-sm font-bold text-foundy-blue">Desafio</p><p className="mt-1">{item.desafio_pergunta ?? 'Informe um detalhe que só o dono saberia.'}</p></div>
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
    <ModalBase titulo="Validação do desafio do dono" subtitulo="O encontrador decide se a resposta confere." onClose={onClose}>
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
        <button className="h-11 rounded-xl bg-foundy-green px-4 text-sm font-black text-slate-950" type="button" onClick={() => onValidar(true)}>A resposta está correta</button>
        <button className="h-11 rounded-xl bg-red-500 px-4 text-sm font-black text-white" type="button" onClick={() => onValidar(false)}>A resposta está incorreta</button>
      </div>
    </ModalBase>
  )
}

function ModalManifestoSeguranca({ onClose }: { onClose: () => void }) {
  return (
    <ModalBase titulo="Segurança em Primeiro Lugar" subtitulo="O Protocolo Foundy." onClose={onClose}>
      <div className="grid gap-3 p-4">
        <p className="rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-4 text-sm leading-6 text-foundy-green">
          O Foundy conecta a honestidade de quem achou com o alívio de quem perdeu. Mas nenhum objeto vale mais do que a sua segurança física.
        </p>
        <TrustCard title="Encontros apenas em locais públicos" text="Nunca marque em residência, local isolado, estacionamento vazio ou endereço particular. Prefira shoppings, estações, praças movimentadas ou bases policiais." />
        <TrustCard title="Use a luz do dia" text="Combine a retirada entre 8h e 18h, em local iluminado e com fluxo de pessoas." />
        <TrustCard title="Faça o desafio do dono" text="Antes do encontro, confirme a resposta do desafio. A conversa só deve avançar quando a posse estiver minimamente comprovada." />
        <TrustCard title="Não vá sozinho" text="Sempre que possível, leve um amigo ou familiar. Avise alguém de confiança sobre o local e horário." />
        <TrustCard title="Nunca pague resgate" text="PIX, taxa obrigatória, frete antecipado, cobrança ou recompensa como condição de devolução violam o Protocolo Foundy." />
        <TrustCard title="Empresas são catálogo" text="Instituições exibem itens para retirada presencial, sem chat, segredo ou reivindicação online." />
        <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6">
          O Foundy é uma ponte digital de comunicação e comunidade. Não nos responsabilizamos por encontros físicos, por isso siga o protocolo e cuide de si mesmo e do próximo.
        </p>
      </div>
    </ModalBase>
  )
}

function ModalTermosLgpd({ onClose }: { onClose: () => void }) {
  return (
    <ModalBase titulo="Termos de Uso e LGPD" subtitulo="Resumo profissional para uso seguro." onClose={onClose}>
      <div className="grid gap-3 p-4">
        <TrustCard title="Escopo do serviço" text="O Foundy é um mural digital comunitário. A plataforma aproxima pessoas, mas não armazena, transporta, inspeciona ou garante o estado de conservação de itens." />
        <TrustCard title="Privacidade por padrão" text="Localização exata, telefone, e-mail real, CPF, RG, dados bancários e endereço residencial não devem ser exibidos publicamente." />
        <TrustCard title="Imagens e documentos" text="Fotos de documentos não devem ser publicadas. Ao marcar um item como documento, a foto pública é removida e a descrição deve ser censurada." />
        <TrustCard title="Conduta proibida" text="É proibido cobrar resgate, pedir PIX antecipado, ameaçar, insultar, solicitar senhas, publicar itens ilegais ou expor dados sensíveis." />
        <TrustCard title="Moderação progressiva" text="A primeira ocorrência gera aviso; a segunda suspende o chat; a terceira suspende a conta; a quarta pode gerar banimento permanente." />
        <TrustCard title="Contas empresariais" text="Empresas usam o Foundy como catálogo institucional. A retirada é presencial no endereço público informado e a conta pode exigir CNPJ, CEP e aprovação." />
        <TrustCard title="Uso proibido para menores" text="A plataforma é exclusiva para maiores de 18 anos para reduzir riscos de aliciamento, encontros inseguros e exposição indevida." />
        <p className="rounded-2xl border border-foundy-border bg-foundy-background p-4 text-sm leading-6 text-foundy-muted">
          Contato oficial para dúvidas, sugestões e suporte: {supportEmail}. Criado por Diego Corazza e Gustavo Alves.
        </p>
      </div>
    </ModalBase>
  )
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
