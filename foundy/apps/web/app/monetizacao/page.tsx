'use client'

import Link from 'next/link'
import { Building2, ShieldCheck, Sparkles, Star } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  buscarPlanosMonetizacao,
  criarApoioFoundy,
  criarSolicitacaoMonetizacao,
  type FoundySession,
  type ManualPaymentInfo,
  type MonetizationPlan,
  type MonetizationPlansResponse,
} from '@/lib/foundy-api'

const sessionStorageKey = 'foundy-session-v2'

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function PaymentBox({ payment }: { payment?: ManualPaymentInfo | null }) {
  if (!payment) return null
  return (
    <div className="rounded-3xl border border-foundy-green/30 bg-foundy-green/10 p-4 text-sm">
      <p className="font-black text-foundy-green">Instruções manuais</p>
      <ul className="mt-3 grid gap-2 text-foundy-muted">
        {payment.instructions.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  )
}

export default function MonetizacaoPage() {
  const [plans, setPlans] = useState<MonetizationPlansResponse | null>(null)
  const [session, setSession] = useState<FoundySession | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<MonetizationPlan | null>(null)
  const [message, setMessage] = useState('Carregando monetização responsável...')
  const [payment, setPayment] = useState<ManualPaymentInfo | null>(null)
  const [amount, setAmount] = useState(500)
  const [contact, setContact] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(sessionStorageKey)
    if (stored) {
      try {
        setSession(JSON.parse(stored) as FoundySession)
      } catch {
        localStorage.removeItem(sessionStorageKey)
      }
    }
    void buscarPlanosMonetizacao()
      .then((data) => {
        setPlans(data)
        setMessage('Escolha uma forma ética de apoiar o Foundy.')
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os planos.'))
  }, [])

  async function submit(plan: MonetizationPlan) {
    setSelectedPlan(plan)
    setPayment(null)
    try {
      if (plan.id === 'support_foundy') {
        const resposta = await criarApoioFoundy({
          user_id: session?.usuario_id ?? null,
          amount_cents: amount,
          payer_name: session?.nome ?? null,
          payer_email: session?.email ?? contact || null,
          message: 'Apoio iniciado pela página /monetizacao.',
        })
        setPayment(resposta.payment ?? null)
        setMessage(resposta.mensagem ?? 'Apoio registrado.')
        return
      }
      if (plan.id === 'loss_alert_boost') {
        setMessage('Para ampliar um alerta, entre na sua conta, abra um alerta de perda próprio e clique em "Ampliar alcance".')
        return
      }
      if (session?.tipo_conta !== 'empresa') {
        setMessage('Este plano exige uma conta empresarial Foundy. Crie ou entre com uma conta de empresa para solicitar.')
        return
      }
      const requestType = plan.id === 'safe_point' ? 'safe_point' : plan.id === 'company_pro' ? 'company_pro' : 'company_verified'
      const resposta = await criarSolicitacaoMonetizacao({
        user_id: session.usuario_id,
        company_id: session.usuario_id,
        request_type: requestType,
        contact_name: session.empresa_nome || session.nome,
        contact_email: session.email,
        message: 'Solicitação enviada pela página pública de monetização.',
        desired_plan: plan.title,
      })
      setPayment(resposta.payment ?? null)
      setMessage(resposta.mensagem ?? 'Solicitação enviada para análise.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a solicitação.')
    }
  }

  const list = plans?.plans ?? []

  return (
    <main className="foundy-app-shell min-h-dvh bg-foundy-background px-4 py-6 text-foundy-foreground sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-6">
        <div className="foundy-hero-panel rounded-3xl border border-foundy-border bg-foundy-surface p-6">
          <Link className="text-sm font-black text-foundy-green underline-offset-4 hover:underline" href="/">Voltar ao Foundy</Link>
          <p className="foundy-eyebrow foundy-attention mt-6 text-sm font-semibold text-foundy-green">Monetização responsável</p>
          <h1 className="mt-2 text-4xl font-black">O Foundy continua gratuito para quem quer encontrar ou devolver itens.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-foundy-muted">
            Planos pagos ajudam a manter servidores, segurança, moderação e melhorias da plataforma. Nenhum pagamento garante recuperação, prioridade absoluta ou acesso a dados pessoais.
          </p>
        </div>

        <p className="rounded-2xl border border-foundy-blue/30 bg-foundy-blue/10 p-4 text-sm text-foundy-blue">{message}</p>

        {selectedPlan?.id === 'support_foundy' ? (
          <div className="grid gap-3 rounded-3xl border border-foundy-border bg-foundy-surface p-4">
            <p className="font-black">Valor de apoio voluntário</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[300, 500, 1000, 2000].map((value) => <button className={`h-11 rounded-xl border text-sm font-black ${amount === value ? 'border-foundy-green bg-foundy-green text-slate-950' : 'border-foundy-border'}`} key={value} type="button" onClick={() => setAmount(value)}>{formatMoney(value)}</button>)}
            </div>
            {!session ? <input className="foundy-input" value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Seu e-mail para instruções" /> : null}
          </div>
        ) : null}

        <PaymentBox payment={payment} />

        <div className="grid gap-4 md:grid-cols-2">
          {list.map((plan) => (
            <article className="foundy-item-card rounded-3xl border border-foundy-border bg-foundy-surface p-5" key={plan.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-foundy-green">{plan.price}</p>
                  <h2 className="mt-2 text-2xl font-black">{plan.title}</h2>
                </div>
                <span className="grid size-12 place-items-center rounded-2xl bg-foundy-blue/15 text-foundy-blue">
                  {plan.id === 'support_foundy' ? <Star size={22} /> : plan.id === 'safe_point' ? <ShieldCheck size={22} /> : plan.id === 'loss_alert_boost' ? <Sparkles size={22} /> : <Building2 size={22} />}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-foundy-muted">{plan.description}</p>
              <ul className="mt-4 grid gap-2 text-sm">
                {plan.benefits.map((benefit) => <li className="rounded-2xl border border-foundy-border bg-foundy-background p-3" key={benefit}>{benefit}</li>)}
              </ul>
              <p className="mt-4 rounded-2xl border border-foundy-green/30 bg-foundy-green/10 p-3 text-sm text-foundy-green">{plan.ethical_notice}</p>
              <button className="mt-4 h-11 w-full rounded-xl bg-foundy-blue text-sm font-black text-white" type="button" onClick={() => void submit(plan)}>{plan.cta}</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
