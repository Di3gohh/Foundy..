const API_URL = process.env.NEXT_PUBLIC_API_URL ?'http://localhost:8000'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: 'Não foi possível concluir a solicitação.' }))
    throw new Error(Array.isArray(payload.detail) ?payload.detail.join(' ') : payload.detail)
  }

  return response.json() as Promise<T>
}
