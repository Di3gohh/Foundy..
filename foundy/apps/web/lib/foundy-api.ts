export type ItemCategory = 'documentos' | 'eletronicos' | 'chaves' | 'vestuario' | 'outros'

export type ItemAchado = {
  id: string
  titulo: string
  descricao: string
  categoria: ItemCategory
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
  nivel_perfil: string
  pontos_luz: string
  badge_publica?: string
  foto_url?: string
  ocupacao?: string
  aceita_notificacoes_email?: string
  is_admin?: string
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
  item_achado_id: string
  encontrador_usuario_id?: string | null
  dono_usuario_id?: string | null
  item_titulo: string
  status: string
  criado_em: string
  atualizado_em: string
  outro_usuario_nome?: string | null
  ultima_mensagem?: string | null
}

export type LostAlert = {
  id: string
  titulo: string
  descricao: string
  status: string
  criado_em: string
  atualizado_em?: string
}

export type ClaimSummary = {
  id: string
  item_achado_id: string
  item_titulo: string
  usuario_reivindicante_id: string | null
  status: string
  resposta_desafio: string
  criado_em: string
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
  item_achado_id: string
  remetente_usuario_id: string | null
  destinatario_usuario_id: string | null
  mensagem: string
  status_moderacao: string
  motivos_moderacao: string[]
  denunciar_extorsao_visivel: boolean
  criado_em: string
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
  if (normalizedLocation.includes('email')) return 'Informe um e-mail valido para continuar.'
  if (normalizedLocation.includes('nome')) return 'Informe seu nome com pelo menos 2 caracteres.'
  if (normalizedMessage.includes('json decode')) return 'Nao foi possivel entender os dados enviados. Atualize a pagina.'
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
    'Nao foi possivel carregar os itens achados.',
  )
}

export async function cadastrarItemAchado(payload: {
  titulo: string
  descricao: string
  categoria: ItemCategory
  latitude: number
  longitude: number
  local_descricao?: string
  desafio_pergunta: string
  detalhe_oculto: string
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
    'Nao foi possivel cadastrar o item achado.',
  )
}

export async function processarImagemComPrivacidade(file: File, textoExtraido = '') {
  const formData = new FormData()
  formData.append('imagem', file)
  formData.append('texto_extraido', textoExtraido)

  const response = await fetch(`${API_URL}/processamento/imagem`, { method: 'POST', body: formData })
  if (!response.ok) await parseError(response, 'Nao foi possivel processar a imagem com filtros de privacidade.')

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
    'Nao foi possivel enviar a resposta do desafio.',
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
    'Nao foi possivel validar a resposta do desafio.',
  )
}

export async function listarMensagensChat(salaChatId: string, usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId })
  return requestJson<MensagemChat[]>(
    `/itens-achados/salas/${salaChatId}/mensagens?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Nao foi possivel carregar as mensagens do chat seguro.',
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
    'Nao foi possivel enviar a mensagem.',
  )
}

export async function denunciarExtorsao(salaChatId: string, usuarioId: string, motivo: string, mensagemId?: string) {
  return requestJson<{ mensagem: string }>(
    `/itens-achados/salas/${salaChatId}/denunciar-extorsao`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, motivo, mensagem_chat_id: mensagemId ?? null }),
    },
    'Nao foi possivel enviar a denuncia de extorsao.',
  )
}

export async function criarAlertaPerdido(payload: {
  usuario_id: string
  titulo: string
  descricao: string
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
    'Nao foi possivel criar o alerta perdido.',
  )
}

export async function listarNotificacoes(usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId, limite: '50' })
  return requestJson<NotificationItem[]>(
    `/notificacoes?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Nao foi possivel carregar as notificacoes.',
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
    'Nao foi possivel marcar a notificacao como lida.',
  )
}

export async function cadastrarUsuario(payload: {
  nome: string
  email: string
  senha: string
  maior_de_idade: boolean
  aceitou_termos: boolean
  aceita_notificacoes_email: boolean
}) {
  return requestJson<{ mensagem: string; email_verificado?: boolean; login_liberado?: boolean }>(
    '/usuarios/cadastrar',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    },
    'Nao foi possivel criar a conta. Confira os dados e tente novamente.',
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
    'Nao foi possivel entrar.',
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
    'Nao foi possivel atualizar o perfil.',
  )
}

export async function buscarPainelUsuario(usuarioId: string) {
  return requestJson<UserDashboard>(
    `/painel/usuarios/${usuarioId}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Nao foi possivel carregar sua pagina de usuario.',
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
    'Nao foi possivel confirmar a devolucao.',
  )
}

export async function buscarPainelAdmin(usuarioId: string) {
  const query = new URLSearchParams({ admin_usuario_id: usuarioId })
  return requestJson<{ usuarios: unknown[]; itens: ItemAchado[]; moderacao: unknown[] }>(
    `/admin/painel?${query.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
    'Nao foi possivel carregar o painel administrativo.',
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
    'Nao foi possivel arquivar o item.',
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
    'Nao foi possivel banir o usuario.',
  )
}
