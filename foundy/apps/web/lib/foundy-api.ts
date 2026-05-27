export type ItemAchado = {
  id: string
  titulo: string
  descricao: string
  categoria: 'documentos' | 'eletronicos' | 'chaves' | 'vestuario' | 'outros'
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
}

export type ReivindicacaoResposta = {
  mensagem: string
  reivindicacao_id?: string
}

export type ValidacaoReivindicacaoResposta = {
  mensagem: string
  chat_desbloqueado: boolean
  sala_chat_id: string | null
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function parseError(response: Response, fallbackMessage: string): Promise<never> {
  let message = fallbackMessage
  try {
    const payload = (await response.json()) as { detail?: string | string[] }
    if (Array.isArray(payload.detail)) {
      message = payload.detail.join(' ')
    } else if (payload.detail) {
      message = payload.detail
    }
  } catch {
    message = fallbackMessage
  }
  throw new Error(message)
}

export async function buscarItensAchadosProximos(params?: {
  latitude?: number
  longitude?: number
  raioMetros?: number
}) {
  const query = new URLSearchParams({
    latitude: String(params?.latitude ?? -23.55052),
    longitude: String(params?.longitude ?? -46.633308),
    raio_metros: String(params?.raioMetros ?? 8000),
    limite: '20',
  })

  const response = await fetch(`${API_URL}/itens-achados/proximos?${query.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    await parseError(response, 'Não foi possível carregar os itens achados.')
  }

  return (await response.json()) as ItemAchado[]
}

export async function cadastrarItemAchado(payload: {
  titulo: string
  descricao: string
  categoria: ItemAchado['categoria']
  latitude: number
  longitude: number
  local_descricao?: string
  desafio_pergunta: string
  detalhe_oculto: string
  imagem_url?: string | null
  tags_ia?: string[]
  usuario_id: string
}) {
  const response = await fetch(`${API_URL}/itens-achados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    await parseError(response, 'Não foi possível cadastrar o item achado.')
  }

  return (await response.json()) as ItemAchado
}

export async function processarImagemComPrivacidade(file: File, textoExtraido = '') {
  const formData = new FormData()
  formData.append('imagem', file)
  formData.append('texto_extraido', textoExtraido)

  const response = await fetch(`${API_URL}/processamento/imagem`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    await parseError(response, 'Não foi possível processar a imagem com filtros de privacidade.')
  }
  const payload = (await response.json()) as {
    imagem_webp_base64: string
    tags_ia: string[]
    hashtags_ia: string[]
    texto_publico_padronizado: string | null
    motivos_privacidade: string[]
  }

  return {
    ...payload,
    imagem_data_url: `data:image/webp;base64,${payload.imagem_webp_base64}`,
  }
}

export async function enviarRespostaDesafio(itemId: string, usuarioId: string, resposta: string) {
  const response = await fetch(`${API_URL}/itens-achados/${itemId}/reivindicar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioId, resposta_desafio: resposta }),
  })

  if (!response.ok) {
    await parseError(response, 'Não foi possível enviar a resposta do desafio.')
  }

  return (await response.json()) as ReivindicacaoResposta
}

export async function validarReivindicacao(
  reivindicacaoId: string,
  payload: { aprovada: boolean; encontrador_usuario_id: string; observacao?: string },
) {
  const response = await fetch(`${API_URL}/itens-achados/reivindicacoes/${reivindicacaoId}/validar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    await parseError(response, 'Não foi possível validar a resposta do desafio.')
  }

  return (await response.json()) as ValidacaoReivindicacaoResposta
}

export async function listarMensagensChat(salaChatId: string, usuarioId: string) {
  const query = new URLSearchParams({ usuario_id: usuarioId })
  const response = await fetch(`${API_URL}/itens-achados/salas/${salaChatId}/mensagens?${query.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    await parseError(response, 'Não foi possível carregar as mensagens do chat seguro.')
  }
  return (await response.json()) as MensagemChat[]
}

export async function enviarMensagemChat(salaChatId: string, usuarioId: string, mensagem: string) {
  const response = await fetch(`${API_URL}/itens-achados/salas/${salaChatId}/mensagens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioId, mensagem }),
  })
  if (!response.ok) {
    await parseError(response, 'Não foi possível enviar a mensagem.')
  }
  return (await response.json()) as MensagemChat
}

export async function denunciarExtorsao(salaChatId: string, usuarioId: string, motivo: string, mensagemId?: string) {
  const response = await fetch(`${API_URL}/itens-achados/salas/${salaChatId}/denunciar-extorsao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioId, motivo, mensagem_chat_id: mensagemId ?? null }),
  })

  if (!response.ok) {
    await parseError(response, 'Não foi possível enviar a denúncia de extorsão.')
  }

  return (await response.json()) as {
    mensagem: string
    email_verificado?: boolean
    login_liberado?: boolean
  }
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
  const response = await fetch(`${API_URL}/notificacoes/alertas-perdidos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    await parseError(response, 'Não foi possível criar o alerta perdido.')
  }
  return (await response.json()) as { mensagem: string; alerta_id: string }
}

export async function criarCheckoutLostBoost(itemId: string, payload: { usuario_id: string; valor_centavos: number }) {
  const response = await fetch(`${API_URL}/itens-achados/${itemId}/lost-boost/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    await parseError(response, 'Não foi possível gerar a cobrança do Lost Boost.')
  }
  return (await response.json()) as { mensagem: string; pix_referencia: string; expira_em: string }
}

export async function simularPixCallback(pixReferencia: string) {
  const response = await fetch(`${API_URL}/itens-achados/lost-boost/simular-pix-callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ pix_referencia: pixReferencia }),
  })
  if (!response.ok) {
    await parseError(response, 'Não foi possível confirmar o pagamento PIX simulado.')
  }
  return (await response.json()) as { mensagem: string; premium_expira_em?: string }
}

export async function cadastrarUsuario(payload: { nome: string; email: string; senha: string }) {
  const response = await fetch(`${API_URL}/usuarios/cadastrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    await parseError(response, 'Não foi possível criar a conta.')
  }

  return (await response.json()) as { mensagem: string }
}

export async function entrarUsuario(payload: { email: string; senha: string }) {
  const response = await fetch(`${API_URL}/usuarios/entrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    await parseError(response, 'Não foi possível entrar.')
  }

  return (await response.json()) as {
    mensagem: string
    usuario_id: string
    nome: string
    nivel_perfil: string
    pontos_luz: string
    badge_publica: string
  }
}
