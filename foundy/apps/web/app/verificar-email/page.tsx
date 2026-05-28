import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function confirmarEmail(token: string) {
  try {
    const response = await fetch(`${API_URL}/usuarios/confirmar-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null
      return {
        ok: false,
        mensagem: payload?.detail ?? 'Nao foi possivel confirmar este e-mail. O token pode ter expirado.',
      }
    }

    const payload = (await response.json()) as { mensagem?: string }
    return { ok: true, mensagem: payload.mensagem ?? 'E-mail confirmado com sucesso.' }
  } catch {
    return {
      ok: false,
      mensagem: 'Nao conseguimos falar com a API agora. Tente novamente em alguns minutos.',
    }
  }
}

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token?.trim()
  const resultado = token
    ? await confirmarEmail(token)
    : { ok: false, mensagem: 'Link sem token de verificacao. Solicite um novo e-mail de confirmacao.' }

  return (
    <main className="foundy-app-shell grid min-h-dvh place-items-center bg-foundy-background px-4 py-10 text-foundy-foreground">
      <section className="foundy-modal-panel w-full max-w-xl rounded-3xl border border-foundy-border bg-foundy-surface p-6 text-center shadow-2xl">
        <span className={`mx-auto grid size-16 place-items-center rounded-3xl ${resultado.ok ? 'bg-foundy-green text-slate-950' : 'bg-red-500 text-white'}`}>
          {resultado.ok ? 'OK' : '!'}
        </span>
        <h1 className="mt-5 text-3xl font-black">
          {resultado.ok ? 'E-mail confirmado' : 'Nao foi possivel confirmar'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-foundy-muted">{resultado.mensagem}</p>
        <Link className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-foundy-blue px-5 text-sm font-black text-white" href="/">
          Voltar para o Foundy
        </Link>
      </section>
    </main>
  )
}
