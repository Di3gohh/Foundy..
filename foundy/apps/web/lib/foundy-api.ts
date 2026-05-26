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
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

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
    throw new Error('Não foi possível carregar os itens achados.')
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
}) {
  const response = await fetch(`${API_URL}/itens-achados`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Não foi possível cadastrar o item achado.')
  }

  return (await response.json()) as ItemAchado
}

export async function enviarRespostaDesafio(itemId: string, resposta: string) {
  const response = await fetch(`${API_URL}/itens-achados/${itemId}/reivindicar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ resposta_desafio: resposta }),
  })

  if (!response.ok) {
    throw new Error('Não foi possível enviar a resposta do desafio.')
  }

  return (await response.json()) as { mensagem: string; reivindicacao_id?: string }
}

export async function cadastrarUsuario(payload: { nome: string; email: string; senha: string }) {
  const response = await fetch(`${API_URL}/usuarios/cadastrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Não foi possível criar a conta.')
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
    throw new Error('Não foi possível entrar.')
  }

  return (await response.json()) as {
    mensagem: string
    usuario_id: string
    nome: string
    nivel_perfil: string
    pontos_luz: string
  }
}
