export type ItemCategory = 'documentos' | 'eletronicos' | 'chaves' | 'vestuario' | 'outros'

export type ItemAchado = {
  id: string
  usuario_id?: string | null
  titulo: string
  descricao: string
  categoria: ItemCategory
  subcategoria?: string | null
  local_descricao: string | null
  latitude_aproximada: number
  longitude_aproximada: number
  raio_mascara_metros: number
  distancia_metros: number | null
  imagem_url: string | null
  status: string
  criado_em: string
  desafio_pergunta?: string | null
  chat_desbloqueado?: boolean
  tags_ia?: string[]
  hashtags_ia?: string[]
  premium_ativo?: boolean
  premium_expira_em?: string | null
}

export type FoundySession = {
  usuario_id: string
  nome: string
  email?: string
  nivel_perfil: string
  pontos_luz: string
  badge_publica?: string
  foto_url?: string
  ocupacao?: string
  aceita_notificacoes_email?: string
  is_admin?: string
  tipo_conta?: 'pessoal' | 'empresa'
  empresa_catalogo_publico?: string
  empresa_nome?: string
  empresa_descricao?: string
  empresa_endereco_publico?: string
  empresa_cidade?: string
  empresa_uf?: string
  plan_type?: string
  plan_status?: string
  verified_badge?: string
  is_safe_point?: string
  safe_point_status?: string
  safe_point_latitude?: string
  safe_point_longitude?: string
  safe_point_service_days?: string
  safe_point_clicks?: string
  public_opening_hours?: string
  public_slug?: string
  banido_permanente?: string
  banido_ate?: string
  banimento_motivo?: string
  chat_banido_permanente?: string
  chat_banido_ate?: string
  chat_banimento_motivo?: string
}

export type NotificationItem = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  lida_em: string | null
  criado_em: string
  item_achado_id?: string | null
  alerta_perdido_id?: string | null
  sala_chat_id?: string | null
  reivindicacao_id?: string | null
}

export type ChatSummary = {
  id: string
  item_achado_id: string | null
  alerta_perdido_id?: string | null
  encontrador_usuario_id?: string | null
  dono_usuario_id?: string | null
  item_titulo: string
  status: string
  criado_em: string
  atualizado_em: string
  ultima_mensagem_em?: string | null
  ultimo_remetente_id?: string | null
  outro_usuario_id?: string | null
  outro_usuario_nome?: string | null
  outro_usuario_foto_url?: string | null
  outro_usuario_ocupacao?: string | null
  outro_usuario_badge?: string | null
  outro_usuario_pontos_luz?: number | null
  ultima_mensagem?: string | null
}

export type LostAlert = {
  id: string
  usuario_id?: string | null
  titulo: string
  descricao: string
  categoria?: ItemCategory | null
  subcategoria?: string | null
  local_descricao?: string | null
  latitude_aproximada?: number | null
  longitude_aproximada?: number | null
  raio_metros?: number | null
  distancia_metros?: number | null
  imagem_url?: string | null
  status: string
  criado_em: string
  atualizado_em?: string
  boost_ativo?: boolean
  boost_expira_em?: string | null
  boost_tipo?: string | null
}

export type ClaimSummary = {
  id: string
  item_achado_id: string
  item_titulo: string
  usuario_reivindicante_id: string | null
  usuario_reivindicante_nome?: string | null
  usuario_reivindicante_foto_url?: string | null
  usuario_reivindicante_ocupacao?: string | null
  status: string
  resposta_desafio: string
  criado_em: string
}

export type EmpresaFoundy = {
  id: string
  nome: string
  foto_url?: string | null
  ocupacao?: string | null
  tipo_conta: 'empresa'
  empresa_nome?: string | null
  empresa_descricao?: string | null
  empresa_endereco_publico?: string | null
  empresa_cidade?: string | null
  empresa_uf?: string | null
  empresa_verificada?: boolean
  empresa_catalogo_publico?: boolean
  plan_type?: string | null
  plan_status?: string | null
  verified_badge?: boolean
  is_safe_point?: boolean
  safe_point_status?: string | null
  public_slug?: string | null
  public_description?: string | null
  public_opening_hours?: string | null
  public_address_visible?: boolean
  custom_logo_url?: string | null
  safe_point_latitude?: number | null
  safe_point_longitude?: number | null
  safe_point_service_days?: string | null
  safe_point_clicks?: number | null
}

export type EmpresaCatalogoItem = {
  id: string
  empresa_usuario_id: string
  titulo: string
  descricao: string
  categoria: ItemCategory
  subcategoria?: string | null
  codigo_interno?: string | null
  local_armazenamento?: string | null
  imagem_url?: string | null
  status: 'disponivel' | 'retirado' | 'arquivado'
  retirado_por_nome?: string | null
  retirado_em?: string | null
  criado_em: string
  atualizado_em?: string
}

export type CompanyMember = {
  id: string
  company_id: string
  user_id?: string | null
  role: 'owner' | 'manager' | 'staff'
  status: 'active' | 'invited' | 'removed'
  invited_email?: string | null
  created_at: string
  updated_at?: string
}

export type CompanyEventPlan = {
  id: string
  company_id: string
  title: string
  slug?: string | null
  description?: string | null
  location_name?: string | null
  address?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status: 'draft' | 'active' | 'finished' | 'cancelled'
  plan_status: 'pending_payment' | 'active' | 'expired' | 'cancelled'
  created_at: string
  updated_at?: string
}

export type UserDashboard = {
  usuario: FoundySession
  itens_postados: ItemAchado[]
  alertas_perdidos: LostAlert[]
  chats: ChatSummary[]
  reivindicacoes_recebidas: ClaimSummary[]
  notificacoes: NotificationItem[]
}

export type MensagemChat = {
  id: string
  sala_chat_id: string | null
  item_achado_id: string | null
  alerta_perdido_id?: string | null
  remetente_usuario_id: string | null
  destinatario_usuario_id: string | null
  mensagem: string
  status_moderacao: string
  motivos_moderacao: string[]
  denunciar_extorsao_visivel: boolean
  criado_em: string
}

export type MonetizationPlan = {
  id: string
  category?: 'support' | 'company' | 'safe_point' | 'loss_alert'
  plan_type?: 'free' | 'verified' | 'pro' | 'event'
  title: string
  price: string
  amount_cents: number
  item_limit?: number | null
  description: string
  benefits: string[]
  ethical_notice: string
  cta: string
}

export type MonetizationPlansResponse = {
  titulo: string
  subtitulo: string
  support_email: string
  plans: MonetizationPlan[]
  support_plan?: MonetizationPlan
  safe_point_plan?: MonetizationPlan
  loss_alert_boost_plan?: MonetizationPlan
  company_plans?: MonetizationPlan[]
}

export type ManualPaymentInfo = {
  provider?: 'manual_pix' | 'mercado_pago' | string
  checkout_url?: string | null
  provider_preference_id?: string | null
  manual_payment_reference: string
  support_email: string
  support_pix_key?: string | null
  instructions: string[]
  message: string
}

export type MonetizationRequest = {
  id: string
  user_id?: string | null
  company_id?: string | null
  request_type: string
  status: string
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  message?: string | null
  desired_plan?: string | null
  created_at: string
  updated_at?: string
  reviewed_at?: string | null
  admin_notes?: string | null
  payment_provider?: string | null
  provider_preference_id?: string | null
  provider_payment_id?: string | null
  checkout_url?: string | null
  payment_status?: string | null
  usuario_nome?: string | null
  usuario_email?: string | null
  empresa_nome?: string | null
  empresa_email?: string | null
  payment?: ManualPaymentInfo
  mensagem?: string
}

export type SupportContribution = {
  id: string
  user_id?: string | null
  amount_cents: number
  currency: string
  status: string
  payment_method: string
  manual_payment_reference?: string | null
  payer_name?: string | null
  payer_email?: string | null
  message?: string | null
  created_at: string
  confirmed_at?: string | null
  admin_notes?: string | null
  payment_provider?: string | null
  provider_preference_id?: string | null
  provider_payment_id?: string | null
  checkout_url?: string | null
  payment_status?: string | null
  usuario_nome?: string | null
  usuario_email?: string | null
  payment?: ManualPaymentInfo
  mensagem?: string
}

export type LossAlertBoost = {
  id: string
  loss_alert_id: string
  user_id?: string | null
  boost_type: string
  status: string
  starts_at?: string | null
  ends_at?: string | null
  amount_cents: number
  payment_method: string
  manual_payment_reference?: string | null
  created_at: string
  admin_notes?: string | null
  payment_provider?: string | null
  provider_preference_id?: string | null
  provider_payment_id?: string | null
  checkout_url?: string | null
  payment_status?: string | null
  usuario_nome?: string | null
  usuario_email?: string | null
  alerta_titulo?: string | null
  payment?: ManualPaymentInfo
  mensagem?: string
}

export type CompanyPublicProfile = EmpresaFoundy & {
  public_whatsapp?: string | null
  public_email?: string | null
  custom_cover_url?: string | null
  catalogo?: EmpresaCatalogoItem[]
}

type ApiErrorPayload = {
  detail?: unknown
  message?: unknown
  error?: unknown
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function validationMessage(message: string, location?: string) {
  const normalizedMessage = message.toLowerCase()
  const normalizedLocation = location?.toLowerCase() ?? ''

  if (normalizedLocation.includes('senha')) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (normalizedLocation.includes('email')) return 'Informe um e-mail válido para continuar.'
  if (normalizedLocation.includes('nome')) return 'Informe seu nome com pelo menos 2 caracteres.'
  if (normalizedMessage.includes('json decode')) return 'Não foi possível entender os dados enviados. Atualize a página.'
  return message
}

function errorDetailToText(detail: unknown): string | null {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => errorDetailToText(item)).filter((item): item is string => Boolean(item))
    return messages.length > 0 ? messages.join(' ') : null
  }
  if (typeof detail === 'object') {
    const value = detail as Record<string, unknown>
    const location = Array.isArray(value.loc) ? value.loc.join('.') : undefined
    if (typeof value.msg === 'string') return validationMessage(value.msg, location)
    if (typeof value.message === 'string') return validationMessage(value.message, location)
    if (typeof value.error === 'string') return validationMessage(value.error, location)
    if (value.detail) return errorDetailToText(value.detail)
  }
  return null
}

async function parseError(response: Response, fallbackMessage: string): Promise<never> {
  let message = fallbackMessage
  try {
    const payload = (await response.json()) as ApiErrorPayload
    message =
      errorDetailToText(payload.detail) ??
      errorDetailToText(payload.message) ??
      errorDetailToText(payload.error) ??
      fallbackMessage
  } catch {
    message = fallbackMessage
  }
  throw new Error(message === '[object Object]' ? fallbackMessage : message)
}

async function requestJson<T>(path: string, init: RequestInit, fallbackMessage: string) {
  const response = await fetch(`${API_URL}${path}`, init)
  if (!response.ok) await parseError(response, fallbackMessage)
  return (await response.json()) as T
}

async function requestVoid(path: string, init: RequestInit, fallbackMessage: string) {
  const response = await fetch(`${API_URL}${path}`, init)
  if (!response.ok) await parseError(response, fallbackMessage)
}

export async function buscarItensAchadosProximos(params?: { latitude?: number; longitude?: number; raioMetros?: number }) {
  const query = new URLSearchParams({
    latitude: String(params?.latitude ?? -23.55052),
    longitude: String(params?.longitude ?? -46.633308),
    raio_metros: String(params?.raioMetros ?? 8000),
    limite: '20',
  })

  return requestJson<ItemAchado[]>(
    `/itens-achados/proximos?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar os itens achados.',
  )
}

export async function cadastrarItemAchado(payload: {
  titulo: string
  descricao: string
  categoria: ItemCategory
  subcategoria?: string | null
  latitude: number
  longitude: number
  local_descricao?: string
  desafio_pergunta: string
  detalhe_oculto?: string | null
  imagem_url?: string | null
  tags_ia?: string[]
  usuario_id: string
}) {
  return requestJson<ItemAchado>(
    '/itens-achados',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível cadastrar o item achado.',
  )
}

export async function processarImagemComPrivacidade(file: File, textoExtraido = '') {
  const formData = new FormData()
  formData.append('imagem', file)
  formData.append('texto_extraido', textoExtraido)

  const response = await fetch(`${API_URL}/processamento/imagem`, { method: 'POST', body: formData })
  if (!response.ok) await parseError(response, 'Não foi possível processar a imagem com filtros de privacidade.')

  const payload = (await response.json()) as {
    imagem_webp_base64: string
    tags_ia?: string[]
    hashtags_ia?: string[]
    texto_publico_padronizado?: string | null
    motivos_privacidade?: string[]
  }
  const tags = payload.tags_ia ?? []
  const hashtags = payload.hashtags_ia ?? tags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))

  return {
    ...payload,
    tags_ia: tags,
    hashtags_ia: hashtags,
    motivos_privacidade: payload.motivos_privacidade ?? [],
    imagem_data_url: `data:image/webp;base64,${payload.imagem_webp_base64}`,
  }
}

export async function enviarRespostaDesafio(itemId: string, usuarioId: string, resposta: string) {
  return requestJson<{ mensagem: string; reivindicacao_id?: string }>(
    `/itens-achados/${itemId}/reivindicar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, resposta_desafio: resposta }),
    },
    'Não foi possível enviar a resposta do desafio.',
  )
}

export async function validarReivindicacao(
  reivindicacaoId: string,
  payload: { aprovada: boolean; encontrador_usuario_id: string; observacao?: string },
) {
  return requestJson<{ mensagem: string; chat_desbloqueado: boolean; sala_chat_id: string | null }>(
    `/itens-achados/reivindicacoes/${reivindicacaoId}/validar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível validar a resposta do desafio.',
  )
}

export async function listarMensagensChat(salaChatId: string, usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId })
  return requestJson<MensagemChat[]>(
    `/itens-achados/salas/${salaChatId}/mensagens?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar as mensagens do chat seguro.',
  )
}

export async function enviarMensagemChat(salaChatId: string, usuarioId: string, mensagem: string) {
  return requestJson<MensagemChat>(
    `/itens-achados/salas/${salaChatId}/mensagens`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, mensagem }),
    },
    'Não foi possível enviar a mensagem.',
  )
}

export async function denunciarExtorsao(salaChatId: string, usuarioId: string, motivo: string, mensagemId?: string, provaDescricao?: string, provaArquivoNome?: string) {
  return requestJson<{ mensagem: string }>(
    `/itens-achados/salas/${salaChatId}/denunciar-extorsao`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, motivo, mensagem_chat_id: mensagemId ?? null, prova_descricao: provaDescricao ?? null, prova_arquivo_nome: provaArquivoNome ?? null }),
    },
    'Não foi possível enviar a denúncia de extorsão.',
  )
}

export async function criarAlertaPerdido(payload: {
  usuario_id: string
  titulo: string
  descricao: string
  categoria?: ItemCategory
  subcategoria?: string
  local_descricao?: string
  imagem_url?: string | null
  hashtags: string[]
  latitude: number
  longitude: number
  raio_metros: number
}) {
  return requestJson<{ mensagem: string; alerta_id: string }>(
    '/notificacoes/alertas-perdidos',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível criar o alerta perdido.',
  )
}

export async function listarAlertasPerdidosProximos(params?: { latitude?: number; longitude?: number; raioMetros?: number }) {
  const query = new URLSearchParams({
    latitude: String(params?.latitude ?? -23.55052),
    longitude: String(params?.longitude ?? -46.633308),
    raio_metros: String(params?.raioMetros ?? 8000),
    limite: '30',
  })

  return requestJson<LostAlert[]>(
    `/notificacoes/alertas-perdidos/proximos?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar os alertas de perda próximos.',
  )
}

export async function abrirChatParaAlertaPerdido(alertaId: string, usuarioId: string) {
  return requestJson<{ mensagem: string; sala_chat_id: string }>(
    `/notificacoes/alertas-perdidos/${alertaId}/encontrei`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId }),
    },
    'Não foi possível abrir o chat com a pessoa que perdeu o item.',
  )
}

export async function arquivarItemProprio(itemId: string, usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId })
  return requestVoid(
    `/itens-achados/${itemId}?${query.toString()}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
    'Não foi possível apagar este item.',
  )
}

export async function arquivarAlertaPerdido(alertaId: string, usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId })
  return requestVoid(
    `/notificacoes/alertas-perdidos/${alertaId}?${query.toString()}`,
    { method: 'DELETE', headers: { Accept: 'application/json' } },
    'Não foi possível apagar este alerta.',
  )
}

export async function listarNotificacoes(usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId, limite: '50' })
  return requestJson<NotificationItem[]>(
    `/notificacoes?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar as notificações.',
  )
}

export async function marcarNotificacaoLida(notificacaoId: string, usuarioId: string) {
  return requestJson<{ mensagem: string }>(
    `/notificacoes/${notificacaoId}/lida`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId }),
    },
    'Não foi possível marcar a notificação como lida.',
  )
}

export async function cadastrarUsuario(payload: {
  nome: string
  email: string
  senha: string
  maior_de_idade: boolean
  aceitou_termos: boolean
  aceita_notificacoes_email: boolean
  tipo_conta?: 'pessoal' | 'empresa'
  empresa_nome?: string
  empresa_descricao?: string
  empresa_endereco_publico?: string
  empresa_cidade?: string
  empresa_uf?: string
  empresa_catalogo_publico?: boolean
  empresa_cnpj?: string
  empresa_cep?: string
  company_plan_interest?: 'company_free' | 'company_verified' | 'company_pro' | 'event_plan' | 'safe_point'
  safe_point_latitude?: number | null
  safe_point_longitude?: number | null
  safe_point_service_days?: string | null
  public_opening_hours?: string | null
}) {
  return requestJson<{ mensagem: string; email_verificado?: boolean; login_liberado?: boolean }>(
    '/usuarios/cadastrar',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível criar a conta. Confira os dados e tente novamente.',
  )
}

export async function listarEmpresasFoundy(q?: string) {
  const query = new URLSearchParams()
  if (q) query.set('q', q)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return requestJson<EmpresaFoundy[]>(
    `/empresas${suffix}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar empresas parceiras.',
  )
}

export async function listarCatalogoEmpresa(empresaId: string, statusItem: 'disponivel' | 'retirado' | 'arquivado' | '' = 'disponivel') {
  const query = new URLSearchParams()
  if (statusItem) query.set('status_item', statusItem)
  return requestJson<EmpresaCatalogoItem[]>(
    `/empresas/${empresaId}/catalogo?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar o catálogo empresarial.',
  )
}

export async function criarItemCatalogoEmpresa(empresaId: string, payload: {
  usuario_id: string
  titulo: string
  descricao: string
  categoria: ItemCategory
  subcategoria?: string | null
  codigo_interno?: string
  local_armazenamento?: string
  imagem_url?: string | null
}) {
  return requestJson<EmpresaCatalogoItem>(
    `/empresas/${empresaId}/catalogo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível cadastrar o item no catálogo empresarial.',
  )
}

export async function atualizarStatusCatalogoEmpresa(itemId: string, usuarioId: string, statusItem: 'disponivel' | 'retirado' | 'arquivado') {
  return requestJson<{ mensagem: string }>(
    `/empresas/catalogo/${itemId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, status: statusItem }),
    },
    'Não foi possível atualizar o item empresarial.',
  )
}

export async function marcarItemCatalogoRetirado(itemId: string, usuarioId: string, retiradoPorNome: string, retiradoEm: string) {
  return requestJson<{ mensagem: string }>(
    `/empresas/catalogo/${itemId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        usuario_id: usuarioId,
        status: 'retirado',
        retirado_por_nome: retiradoPorNome,
        retirado_em: retiradoEm,
      }),
    },
    'Não foi possível registrar a retirada do item empresarial.',
  )
}

export async function entrarUsuario(payload: { email: string; senha: string }) {
  return requestJson<FoundySession>(
    '/usuarios/entrar',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível entrar.',
  )
}

export async function atualizarPerfil(usuarioId: string, payload: { nome?: string; foto_url?: string; ocupacao?: string; aceita_notificacoes_email?: boolean }) {
  return requestJson<FoundySession & { mensagem: string }>(
    `/usuarios/${usuarioId}/perfil`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível atualizar o perfil.',
  )
}

export async function buscarPainelUsuario(usuarioId: string) {
  return requestJson<UserDashboard>(
    `/painel/usuarios/${usuarioId}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar sua página de usuário.',
  )
}

export async function confirmarDevolucaoComAvaliacao(payload: {
  item_achado_id: string
  encontrador_usuario_id: string
  dono_usuario_id?: string | null
  nota: number
}) {
  return requestJson<{ mensagem: string; pontos_delta: number }>(
    '/karma/confirmar-devolucao',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível confirmar a devolução.',
  )
}

export async function buscarPainelAdmin(usuarioId: string) {
  const query = new URLSearchParams({ admin_usuario_id: usuarioId })
  return requestJson<{
    usuarios: unknown[]
    empresas?: unknown[]
    itens: ItemAchado[]
    alertas_perdidos?: unknown[]
    moderacao: unknown[]
    denuncias?: unknown[]
    denuncias_posts?: unknown[]
    denuncias_resolvidas?: unknown[]
    itens_arquivados?: unknown[]
    banidos?: unknown[]
    monetizacao?: {
      solicitacoes?: MonetizationRequest[]
      apoios?: SupportContribution[]
      boosts?: LossAlertBoost[]
      empresas_verificadas?: unknown[]
      pontos_seguros?: unknown[]
    }
  }>(
    `/admin/painel?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar o painel administrativo.',
  )
}

export async function adminArquivarItem(adminUsuarioId: string, itemId: string, motivo: string) {
  return requestJson<{ mensagem: string }>(
    `/admin/itens/${itemId}/arquivar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, motivo }),
    },
    'Não foi possível arquivar o item.',
  )
}

export async function adminDesarquivarItem(adminUsuarioId: string, itemId: string, motivo: string, tipo: 'item' | 'alerta' = 'item') {
  const path = tipo === 'alerta' ? `/admin/alertas-perdidos/${itemId}/desarquivar` : `/admin/itens/${itemId}/desarquivar`
  return requestJson<{ mensagem: string }>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, motivo }),
    },
    'Não foi possível desarquivar o registro.',
  )
}

export async function adminExcluirRegistroPermanente(adminUsuarioId: string, itemId: string, motivo: string, tipo: 'item' | 'alerta' = 'item') {
  const path = tipo === 'alerta' ? `/admin/alertas-perdidos/${itemId}/excluir-permanente` : `/admin/itens/${itemId}/excluir-permanente`
  return requestJson<{ mensagem: string }>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, motivo }),
    },
    'Não foi possível excluir permanentemente o registro.',
  )
}

export async function adminBanirUsuario(adminUsuarioId: string, usuarioId: string, motivo: string, dias: number) {
  return requestJson<{ mensagem: string }>(
    `/admin/usuarios/${usuarioId}/banir`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, motivo, dias }),
    },
    'Não foi possível banir o usuário.',
  )
}

export async function adminAplicarMedidaUsuario(
  adminUsuarioId: string,
  usuarioId: string,
  payload: { motivo: string; dias?: number | null; permanente?: boolean; tipo?: 'conta' | 'chat'; denuncia_id?: string; denuncia_tipo?: 'chat' | 'post' },
) {
  return requestJson<{ mensagem: string }>(
    `/admin/usuarios/${usuarioId}/banir`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, ...payload }),
    },
    'Não foi possível aplicar a medida administrativa.',
  )
}

export async function adminAvisarUsuario(adminUsuarioId: string, usuarioId: string, motivo: string, denunciaId?: string, denunciaTipo?: 'chat' | 'post') {
  return requestJson<{ mensagem: string }>(
    `/admin/usuarios/${usuarioId}/avisar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, motivo, denuncia_id: denunciaId ?? null, denuncia_tipo: denunciaTipo ?? null }),
    },
    'Não foi possível enviar o aviso administrativo.',
  )
}

export async function adminDesbanirUsuario(adminUsuarioId: string, usuarioId: string, motivo = 'Desbanimento manual pelo administrador Foundy.') {
  return requestJson<{ mensagem: string }>(
    `/admin/usuarios/${usuarioId}/desbanir`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, motivo }),
    },
    'Não foi possível desbanir o usuário.',
  )
}

export async function adminResolverDenuncia(adminUsuarioId: string, denunciaId: string, denunciaTipo: 'chat' | 'post', motivo: string) {
  return requestJson<{ mensagem: string }>(
    `/admin/denuncias/${denunciaId}/resolver`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, denuncia_tipo: denunciaTipo, motivo }),
    },
    'Não foi possível marcar a denúncia como resolvida.',
  )
}

export async function adminDesfazerModeracaoDenuncia(adminUsuarioId: string, denunciaId: string, denunciaTipo: 'chat' | 'post', motivo: string) {
  return requestJson<{ mensagem: string }>(
    `/admin/denuncias/${denunciaId}/desfazer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, denuncia_tipo: denunciaTipo, motivo }),
    },
    'Não foi possível desfazer a ação de moderação.',
  )
}

export async function adminExcluirDenuncia(adminUsuarioId: string, denunciaId: string, denunciaTipo: 'chat' | 'post', motivo: string) {
  return requestJson<{ mensagem: string }>(
    `/admin/denuncias/${denunciaId}/excluir`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, denuncia_tipo: denunciaTipo, motivo }),
    },
    'Não foi possível excluir os dados da denúncia.',
  )
}

export async function denunciarPost(payload: {
  usuario_id: string
  item_achado_id?: string | null
  alerta_perdido_id?: string | null
  motivo_tipo: string
  motivo: string
}) {
  return requestJson<{ mensagem: string }>(
    '/itens-achados/denunciar-post',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível enviar a denúncia do post.',
  )
}

export async function buscarPlanosMonetizacao() {
  return requestJson<MonetizationPlansResponse>(
    '/monetization/plans',
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar os planos de monetização.',
  )
}

export async function criarSolicitacaoMonetizacao(payload: {
  user_id?: string | null
  company_id?: string | null
  request_type: 'company_verified' | 'safe_point' | 'company_pro' | 'event_plan' | 'sponsorship'
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  message?: string | null
  desired_plan?: string | null
}) {
  return requestJson<MonetizationRequest>(
    '/monetization/requests',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível enviar a solicitação de monetização.',
  )
}

export async function listarMinhasSolicitacoesMonetizacao(userId: string) {
  const query = new URLSearchParams({ user_id: userId })
  return requestJson<MonetizationRequest[]>(
    `/me/monetization/requests?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar suas solicitações.',
  )
}

export async function criarApoioFoundy(payload: {
  user_id?: string | null
  amount_cents: number
  payer_name?: string | null
  payer_email?: string | null
  message?: string | null
  payment_method?: 'manual_pix' | 'manual_transfer' | 'future_gateway'
}) {
  return requestJson<SupportContribution>(
    '/support/contributions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível registrar o apoio ao Foundy.',
  )
}

export async function listarMeusApoiosFoundy(userId: string) {
  const query = new URLSearchParams({ user_id: userId })
  return requestJson<SupportContribution[]>(
    `/me/support/contributions?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar seus apoios.',
  )
}

export async function solicitarBoostAlerta(alertaId: string, userId: string, boostType: '24h' | '3d' | '7d') {
  return requestJson<LossAlertBoost>(
    `/loss-alerts/${alertaId}/boost`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ user_id: userId, boost_type: boostType }),
    },
    'Não foi possível solicitar o Alerta Ampliado.',
  )
}

export async function listarMeusBoostsAlerta(userId: string) {
  const query = new URLSearchParams({ user_id: userId })
  return requestJson<LossAlertBoost[]>(
    `/me/loss-alert-boosts?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar seus Alertas Ampliados.',
  )
}

export async function adminAtualizarSolicitacaoMonetizacao(adminUsuarioId: string, requestId: string, statusValue: 'pending' | 'approved' | 'rejected' | 'cancelled', adminNotes?: string) {
  return requestJson<{ mensagem: string }>(
    `/admin/monetization/requests/${requestId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, status: statusValue, admin_notes: adminNotes ?? null }),
    },
    'Não foi possível atualizar a solicitação de monetização.',
  )
}

export async function adminAtualizarApoioFoundy(adminUsuarioId: string, contributionId: string, statusValue: 'pending' | 'confirmed' | 'cancelled', adminNotes?: string) {
  return requestJson<{ mensagem: string }>(
    `/admin/support/contributions/${contributionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, status: statusValue, admin_notes: adminNotes ?? null }),
    },
    'Não foi possível atualizar o apoio ao Foundy.',
  )
}

export async function adminAtualizarBoostAlerta(adminUsuarioId: string, boostId: string, statusValue: 'pending_payment' | 'active' | 'expired' | 'cancelled', adminNotes?: string) {
  return requestJson<{ mensagem: string }>(
    `/admin/loss-alert-boosts/${boostId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ admin_usuario_id: adminUsuarioId, status: statusValue, admin_notes: adminNotes ?? null }),
    },
    'Não foi possível atualizar o Alerta Ampliado.',
  )
}

export async function buscarPerfilPublicoEmpresa(slug: string) {
  return requestJson<CompanyPublicProfile>(
    `/companies/${encodeURIComponent(slug)}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar a página pública da empresa.',
  )
}

export async function buscarPerfilEmpresa(empresaId: string) {
  return requestJson<CompanyPublicProfile>(
    `/companies/${empresaId}/public-profile`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar o perfil público da empresa.',
  )
}

export async function atualizarPerfilPublicoEmpresa(empresaId: string, payload: {
  usuario_id: string
  public_slug?: string | null
  public_description?: string | null
  public_whatsapp?: string | null
  public_email?: string | null
  public_opening_hours?: string | null
  public_address_visible?: boolean
  custom_cover_url?: string | null
  custom_logo_url?: string | null
  safe_point_latitude?: number | null
  safe_point_longitude?: number | null
  safe_point_service_days?: string | null
}) {
  return requestJson<{ mensagem: string }>(
    `/companies/${empresaId}/public-profile`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível atualizar a página pública da empresa.',
  )
}

export async function buscarRelatorioEmpresa(empresaId: string, usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId })
  return requestJson<{
    company_id: string
    total_itens: number
    total_retirados: number
    total_disponiveis: number
    total_arquivados: number
    taxa_retirada: number
    periodo: string
    observacao: string
  }>(
    `/companies/${empresaId}/reports/summary?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar o relatório empresarial.',
  )
}

export async function buscarQrCodeEmpresa(empresaId: string, usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId })
  return requestJson<{ url: string; qr_content: string; print_text: string }>(
    `/companies/${empresaId}/qr-code?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível gerar o QR Code da empresa.',
  )
}

export async function listarMembrosEmpresa(empresaId: string, usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId })
  return requestJson<CompanyMember[]>(
    `/companies/${empresaId}/members?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar a equipe empresarial.',
  )
}

export async function convidarMembroEmpresa(empresaId: string, usuarioId: string, invitedEmail: string, role: 'manager' | 'staff') {
  return requestJson<CompanyMember & { mensagem?: string }>(
    `/companies/${empresaId}/members`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, invited_email: invitedEmail, role }),
    },
    'Não foi possível convidar o membro da equipe.',
  )
}

export async function listarEventosEmpresa(empresaId: string, usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId })
  return requestJson<CompanyEventPlan[]>(
    `/companies/${empresaId}/events?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar os eventos empresariais.',
  )
}

export async function criarEventoEmpresa(empresaId: string, payload: {
  usuario_id: string
  title: string
  slug?: string | null
  description?: string | null
  location_name?: string | null
  address?: string | null
  starts_at?: string | null
  ends_at?: string | null
}) {
  return requestJson<CompanyEventPlan & { mensagem?: string }>(
    `/companies/${empresaId}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Não foi possível criar o evento empresarial.',
  )
}

export async function buscarPontosSegurosFoundy(q?: string) {
  const query = new URLSearchParams()
  if (q) query.set('q', q)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return requestJson<EmpresaFoundy[]>(
    `/companies/safe-points/nearby${suffix}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Não foi possível carregar os Pontos Seguros Foundy.',
  )
}

export async function registrarCliquePontoSeguro(empresaId: string) {
  return requestJson<{ mensagem: string }>(
    `/companies/safe-points/${empresaId}/click`,
    { method: 'POST', headers: { Accept: 'application/json' } },
    'Não foi possível registrar o clique no Ponto Seguro Foundy.',
  )
}
