'use client'

import dynamic from 'next/dynamic'
import {
  ArrowRight,
  Bell,
  Camera,
  CheckCircle2,
  KeyRound,
  LocateFixed,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buscarItensAchadosProximos,
  cadastrarItemAchado,
  cadastrarUsuario,
  entrarUsuario,
  enviarRespostaDesafio,
  type ItemAchado,
} from '@/lib/foundy-api'

const MapaInterativo = dynamic(() => import('@/components/MapaInterativo'), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-[430px] place-items-center rounded-lg border border-white/10 bg-slate-900 text-sm text-slate-300">
      Carregando mapa seguro...
    </div>
  ),
})

type ModalAtivo = 'auth' | 'item' | 'desafio' | 'chat' | null
type CategoriaItem = ItemAchado['categoria']

const itensDemonstracao: ItemAchado[] = [
  {
    id: 'demo-1',
    titulo: 'Chave com chaveiro azul',
    descricao: 'Encontrada perto da saída principal da estação. A localização foi aproximada por segurança.',
    categoria: 'chaves',
    local_descricao: 'Região da estação central',
    latitude_aproximada: -23.5489,
    longitude_aproximada: -46.6372,
    raio_mascara_metros: 500,
    distancia_metros: 620,
    imagem_url: null,
    status: 'publicado',
    criado_em: new Date().toISOString(),
    desafio_pergunta: 'Qual detalhe só o dono saberia informar?',
    chat_desbloqueado: false,
  },
  {
    id: 'demo-2',
    titulo: 'Carteira preta',
    descricao: 'Carteira pequena encontrada em uma cafeteria. Nenhum documento completo aparece no anúncio.',
    categoria: 'documentos',
    local_descricao: 'Próximo à praça',
    latitude_aproximada: -23.5533,
    longitude_aproximada: -46.6312,
    raio_mascara_metros: 500,
    distancia_metros: 980,
    imagem_url: null,
    status: 'publicado',
    criado_em: new Date().toISOString(),
    desafio_pergunta: 'Qual era o detalhe escondido dentro da carteira?',
    chat_desbloqueado: false,
  },
  {
    id: 'demo-3',
    titulo: 'Fone sem fio',
    descricao: 'Estojo branco encontrado em banco público. Converse com segurança após confirmar o detalhe oculto.',
    categoria: 'eletronicos',
    local_descricao: 'Área comercial do bairro',
    latitude_aproximada: -23.5561,
    longitude_aproximada: -46.642,
    raio_mascara_metros: 500,
    distancia_metros: 1430,
    imagem_url: null,
    status: 'publicado',
    criado_em: new Date().toISOString(),
    desafio_pergunta: 'Qual marca ou sinal existe no estojo?',
    chat_desbloqueado: false,
  },
]

const categorias: Record<CategoriaItem, string> = {
  documentos: 'Documentos',
  eletronicos: 'Eletrônicos',
  chaves: 'Chaves',
  vestuario: 'Vestuário',
  outros: 'Outros',
}

function formatarDistancia(valor: number | null) {
  if (valor === null) return 'Distância protegida'
  if (valor < 1000) return `${Math.round(valor)} m`
  return `${(valor / 1000).toFixed(1).replace('.', ',')} km`
}

export default function Home() {
  const [itens, setItens] = useState<ItemAchado[]>(itensDemonstracao)
  const [itemSelecionado, setItemSelecionado] = useState<ItemAchado | null>(itensDemonstracao[0])
  const [modalAtivo, setModalAtivo] = useState<ModalAtivo>(null)
  const [mensagemSistema, setMensagemSistema] = useState('Carregando itens próximos...')
  const [carregando, setCarregando] = useState(true)
  const [respostaDesafio, setRespostaDesafio] = useState('')
  const [chatLiberado, setChatLiberado] = useState(false)
  const [filtro, setFiltro] = useState<CategoriaItem | 'todos'>('todos')
  const mapSectionRef = useRef<HTMLDivElement | null>(null)

  const itensFiltrados = useMemo(() => {
    if (filtro === 'todos') return itens
    return itens.filter((item) => item.categoria === filtro)
  }, [filtro, itens])

  const carregarItens = useCallback(async (latitude?: number, longitude?: number) => {
    setCarregando(true)
    setMensagemSistema('Buscando itens achados com localização aproximada...')

    try {
      const dados = await buscarItensAchadosProximos({ latitude, longitude })
      const itensCarregados = dados.length > 0 ? dados : itensDemonstracao
      setItens(itensCarregados)
      setItemSelecionado(itensCarregados[0] ?? null)
      setMensagemSistema(dados.length > 0 ? 'Itens achados carregados com segurança.' : 'Ainda não há itens nessa região.')
    } catch {
      setItens(itensDemonstracao)
      setItemSelecionado(itensDemonstracao[0])
      setMensagemSistema('Não foi possível conectar ao servidor agora. Exibindo exemplos da experiência.')
    } finally {
      setCarregando(false)
    }
  }, [])

  function abrirAutenticacao() {
    setModalAtivo('auth')
  }

  function abrirCadastroItem() {
    setModalAtivo('item')
  }

  function iniciarReivindicacao(item: ItemAchado) {
    setItemSelecionado(item)
    setRespostaDesafio('')
    setChatLiberado(Boolean(item.chat_desbloqueado))
    setModalAtivo(item.chat_desbloqueado ? 'chat' : 'desafio')
  }

  function focarNoMapa(item: ItemAchado) {
    setItemSelecionado(item)
    setMensagemSistema(`Mapa focado em área aproximada de ${item.titulo}.`)
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function usarMeuLocal() {
    if (!navigator.geolocation) {
      setMensagemSistema('Seu navegador não oferece localização automática.')
      return
    }

    setMensagemSistema('Solicitando sua localização com segurança...')
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        void carregarItens(posicao.coords.latitude, posicao.coords.longitude)
      },
      () => {
        setMensagemSistema('Não foi possível usar sua localização. Mantivemos a busca regional padrão.')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }

  async function confirmarDesafio() {
    if (!itemSelecionado || respostaDesafio.trim().length < 2) {
      setMensagemSistema('Informe o detalhe oculto para continuar.')
      return
    }

    try {
      await enviarRespostaDesafio(itemSelecionado.id, respostaDesafio.trim())
      setMensagemSistema('Resposta enviada ao encontrador. O chat será liberado após validação.')
      setModalAtivo('chat')
    } catch {
      setMensagemSistema('Servidor indisponível. Abrimos uma demonstração local do fluxo de chat seguro.')
      setModalAtivo('chat')
    }
  }

  function liberarChatDemonstracao() {
    setChatLiberado(true)
    setMensagemSistema('Desafio validado. Conversa segura liberada.')
  }

  useEffect(() => {
    void carregarItens()
  }, [carregarItens])

  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <button className="flex items-center gap-3 text-left" type="button" onClick={() => void carregarItens()}>
            <span className="grid size-10 place-items-center rounded-lg bg-teal-400 text-slate-950">
              <MapPin size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-black tracking-normal">FOUNDY.</span>
              <span className="hidden text-xs text-slate-400 sm:block">O que se perdeu, volta.</span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              className="hidden h-10 items-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:border-teal-300/50 hover:text-white sm:inline-flex"
              type="button"
              onClick={abrirAutenticacao}
            >
              Entrar
            </button>
            <button
              className="grid size-10 place-items-center rounded-lg border border-white/10 text-slate-200 transition hover:border-teal-300/50"
              type="button"
              aria-label="Notificações"
              onClick={() => setMensagemSistema('Você será avisado quando houver um Match Ativo na sua região.')}
            >
              <Bell size={18} aria-hidden="true" />
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-teal-300"
              type="button"
              onClick={abrirCadastroItem}
            >
              <Plus size={18} aria-hidden="true" />
              <span className="hidden sm:inline">Cadastrar Item Achado</span>
              <span className="sm:hidden">Achei algo</span>
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="order-2 grid gap-4 lg:order-1" ref={mapSectionRef}>
          <div className="rounded-lg border border-white/10 bg-slate-900 p-4 shadow-2xl shadow-black/30 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-teal-300">Mapa interativo com localização mascarada</p>
                <h1 className="mt-1 text-2xl font-black tracking-normal text-white sm:text-3xl">
                  Encontre itens próximos sem expor endereços exatos.
                </h1>
              </div>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-100 transition hover:border-teal-300/50"
                type="button"
                onClick={usarMeuLocal}
              >
                <LocateFixed size={17} aria-hidden="true" />
                Perto de mim
              </button>
            </div>

            <MapaInterativo itens={itensFiltrados} itemSelecionado={itemSelecionado} onSelecionarItem={setItemSelecionado} />

            <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">Raio de privacidade ativo</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Cada ponto representa uma área aproximada. O endereço exato nunca aparece para outros usuários.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-teal-300/15 px-3 py-2 text-xs font-bold text-teal-200">
                  <ShieldCheck size={15} aria-hidden="true" />
                  Dados protegidos
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 grid content-start gap-5 lg:order-2">
          <section className="rounded-lg border border-white/10 bg-white p-5 text-slate-950 shadow-2xl shadow-black/20 sm:p-6">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800">
              <KeyRound size={16} aria-hidden="true" />
              Engenharia de Confiança
            </div>
            <h2 className="text-4xl font-black leading-none tracking-normal sm:text-5xl">
              Recupere itens com prova de posse, não com exposição pública.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              A Foundy usa detalhe oculto, localização mascarada e chat bloqueado até o encontrador validar a resposta do dono.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800"
                type="button"
                onClick={abrirCadastroItem}
              >
                Cadastrar Item Achado
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-5 text-sm font-bold text-slate-800 transition hover:border-slate-400"
                type="button"
                onClick={abrirAutenticacao}
              >
                <LockKeyhole size={17} aria-hidden="true" />
                Entrar
              </button>
            </div>
          </section>

          <section className="grid gap-3" aria-label="Feed de itens achados">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-normal">Itens achados perto de você</h2>
                <p className="text-sm text-slate-400" aria-live="polite">
                  {mensagemSistema}
                </p>
              </div>
              <button
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-200 transition hover:border-teal-300/50"
                type="button"
                aria-label="Atualizar feed"
                onClick={() => void carregarItens()}
              >
                <Search size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtros de categoria">
              {(['todos', 'documentos', 'eletronicos', 'chaves', 'vestuario', 'outros'] as const).map((categoria) => (
                <button
                  className={`h-9 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition ${
                    filtro === categoria
                      ? 'border-teal-300 bg-teal-300 text-slate-950'
                      : 'border-white/10 text-slate-300 hover:border-teal-300/50'
                  }`}
                  key={categoria}
                  type="button"
                  onClick={() => setFiltro(categoria)}
                >
                  {categoria === 'todos' ? 'Todos' : categorias[categoria]}
                </button>
              ))}
            </div>

            {itensFiltrados.map((item) => (
              <article className="rounded-lg border border-white/10 bg-slate-900 p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white">{item.titulo}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {categorias[item.categoria]} · {item.local_descricao ?? 'Local aproximado'}
                    </p>
                  </div>
                  <span className="rounded-full bg-teal-300/15 px-3 py-1 text-xs font-bold text-teal-200">
                    {formatarDistancia(item.distancia_metros)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.descricao}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950" type="button" onClick={() => iniciarReivindicacao(item)}>
                    É meu
                  </button>
                  <button
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200"
                    type="button"
                    onClick={() => focarNoMapa(item)}
                  >
                    Ver no mapa
                  </button>
                </div>
              </article>
            ))}

            {carregando ? <p className="text-sm text-slate-400">Atualizando feed em tempo real...</p> : null}
          </section>
        </div>
      </section>

      {modalAtivo === 'auth' ? <ModalAutenticacao onClose={() => setModalAtivo(null)} /> : null}
      {modalAtivo === 'item' ? (
        <ModalItemAchado
          onClose={() => setModalAtivo(null)}
          onCriado={(item) => {
            setItens((atuais) => [item, ...atuais])
            setItemSelecionado(item)
            setMensagemSistema('Item cadastrado. O detalhe oculto foi salvo para validar o verdadeiro dono.')
          }}
        />
      ) : null}
      {modalAtivo === 'desafio' && itemSelecionado ? (
        <ModalDesafio
          item={itemSelecionado}
          resposta={respostaDesafio}
          onRespostaChange={setRespostaDesafio}
          onConfirmar={() => void confirmarDesafio()}
          onClose={() => setModalAtivo(null)}
        />
      ) : null}
      {modalAtivo === 'chat' && itemSelecionado ? (
        <PainelChatSeguro
          item={itemSelecionado}
          chatLiberado={chatLiberado}
          onLiberar={liberarChatDemonstracao}
          onClose={() => setModalAtivo(null)}
        />
      ) : null}
    </main>
  )
}

function ModalBase({
  titulo,
  children,
  onClose,
}: {
  titulo: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/75 p-3 backdrop-blur sm:place-items-center" role="presentation">
      <section className="max-h-[92dvh] w-full max-w-xl overflow-auto rounded-lg border border-white/10 bg-slate-900 text-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <h2 className="text-lg font-black tracking-normal" id="modal-titulo">
            {titulo}
          </h2>
          <button className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-200" type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function ModalAutenticacao({ onClose }: { onClose: () => void }) {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState('Confirme seu e-mail para postar ou reivindicar itens.')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setEnviando(true)
    try {
      if (modo === 'cadastrar') {
        const resposta = await cadastrarUsuario({ nome, email, senha })
        setMensagem(resposta.mensagem)
      } else {
        const resposta = await entrarUsuario({ email, senha })
        setMensagem(`Bem-vindo, ${resposta.nome}. Perfil: ${resposta.nivel_perfil}.`)
      }
    } catch {
      setMensagem(
        modo === 'entrar'
          ? 'Não foi possível entrar. Verifique seu e-mail, senha e confirmação de e-mail.'
          : 'Não foi possível criar a conta agora. Tente novamente em instantes.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ModalBase titulo={modo === 'entrar' ? 'Entrar na Foundy' : 'Criar conta'} onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-950 p-1">
          <button className={`rounded-md px-3 py-2 text-sm font-bold ${modo === 'entrar' ? 'bg-teal-400 text-slate-950' : 'text-slate-300'}`} type="button" onClick={() => setModo('entrar')}>
            Entrar
          </button>
          <button className={`rounded-md px-3 py-2 text-sm font-bold ${modo === 'cadastrar' ? 'bg-teal-400 text-slate-950' : 'text-slate-300'}`} type="button" onClick={() => setModo('cadastrar')}>
            Cadastrar
          </button>
        </div>
        {modo === 'cadastrar' ? (
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Nome
            <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" placeholder="Seu nome" value={nome} onChange={(event) => setNome(event.target.value)} />
          </label>
        ) : null}
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          E-mail
          <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" placeholder="voce@email.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Senha
          <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" placeholder="Sua senha segura" type="password" value={senha} onChange={(event) => setSenha(event.target.value)} />
        </label>
        <p className="rounded-lg border border-teal-300/20 bg-teal-300/10 p-3 text-sm text-teal-100" aria-live="polite">
          {mensagem}
        </p>
        <button
          className="h-11 rounded-lg bg-teal-400 px-4 text-sm font-black text-slate-950"
          type="button"
          disabled={enviando}
          onClick={() => void enviar()}
        >
          {enviando ? 'Enviando...' : modo === 'entrar' ? 'Entrar' : 'Criar conta e verificar e-mail'}
        </button>
      </div>
    </ModalBase>
  )
}

function ModalItemAchado({ onClose, onCriado }: { onClose: () => void; onCriado: (item: ItemAchado) => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState<CategoriaItem>('outros')
  const [local, setLocal] = useState('')
  const [desafio, setDesafio] = useState('')
  const [detalheOculto, setDetalheOculto] = useState('')
  const [coords, setCoords] = useState({ latitude: -23.55052, longitude: -46.633308 })
  const [mensagem, setMensagem] = useState('A câmera ou upload será usado apenas para ajudar a identificar o item.')

  function usarGeolocalizacao() {
    if (!navigator.geolocation) {
      setMensagem('Seu navegador não oferece localização automática.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setCoords({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude })
        setMensagem('Localização capturada. Salvaremos apenas uma área aproximada de segurança.')
      },
      () => setMensagem('Não foi possível capturar sua localização. Você pode informar um ponto de referência.'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  async function publicar() {
    if (!titulo.trim() || !descricao.trim() || !desafio.trim() || !detalheOculto.trim()) {
      setMensagem('Preencha título, descrição, desafio e detalhe oculto.')
      return
    }

    const novoItem: ItemAchado = {
      id: `local-${Date.now()}`,
      titulo,
      descricao,
      categoria,
      local_descricao: local || 'Local aproximado',
      latitude_aproximada: coords.latitude,
      longitude_aproximada: coords.longitude,
      raio_mascara_metros: 500,
      distancia_metros: null,
      imagem_url: null,
      status: 'publicado',
      criado_em: new Date().toISOString(),
      desafio_pergunta: desafio,
      chat_desbloqueado: false,
    }

    try {
      const itemCriado = await cadastrarItemAchado({
        titulo,
        descricao,
        categoria,
        latitude: coords.latitude,
        longitude: coords.longitude,
        local_descricao: local,
        desafio_pergunta: desafio,
        detalhe_oculto: detalheOculto,
      })
      onCriado(itemCriado)
    } catch {
      onCriado(novoItem)
    }

    onClose()
  }

  return (
    <ModalBase titulo="Cadastrar item achado" onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Título
            <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex.: Chave com fita azul" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Categoria
            <select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" value={categoria} onChange={(event) => setCategoria(event.target.value as CategoriaItem)}>
              <option value="documentos">Documentos</option>
              <option value="eletronicos">Eletrônicos</option>
              <option value="chaves">Chaves</option>
              <option value="vestuario">Vestuário</option>
              <option value="outros">Outros</option>
            </select>
          </label>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Descrição pública
          <textarea className="min-h-24 rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Descreva sem expor telefone, CPF, RG completo ou endereço exato." />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Local aproximado
          <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" value={local} onChange={(event) => setLocal(event.target.value)} placeholder="Ex.: perto da praça ou estação" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Desafio do Dono
            <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" value={desafio} onChange={(event) => setDesafio(event.target.value)} placeholder="Ex.: Quantas chaves há no chaveiro?" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Detalhe oculto
            <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" value={detalheOculto} onChange={(event) => setDetalheOculto(event.target.value)} placeholder="Resposta que só o dono saberia" />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-bold text-slate-200" type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={17} aria-hidden="true" />
            Enviar imagem
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-bold text-slate-200" type="button" onClick={usarGeolocalizacao}>
            <Camera size={17} aria-hidden="true" />
            Usar câmera/local
          </button>
        </div>
        <input
          accept="image/*"
          capture="environment"
          className="sr-only"
          ref={fileInputRef}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            setMensagem(file ? `Imagem "${file.name}" selecionada. O backend aplicará desfoque e tags automáticas.` : 'Nenhuma imagem selecionada.')
          }}
        />
        <p className="rounded-lg border border-white/10 bg-slate-950 p-3 text-sm text-slate-300" aria-live="polite">{mensagem}</p>
        <button className="h-11 rounded-lg bg-teal-400 px-4 text-sm font-black text-slate-950" type="button" onClick={() => void publicar()}>
          Publicar com detalhe oculto
        </button>
      </div>
    </ModalBase>
  )
}

function ModalDesafio({
  item,
  resposta,
  onRespostaChange,
  onConfirmar,
  onClose,
}: {
  item: ItemAchado
  resposta: string
  onRespostaChange: (value: string) => void
  onConfirmar: () => void
  onClose: () => void
}) {
  return (
    <ModalBase titulo="Verificação do dono" onClose={onClose}>
      <div className="grid gap-4 p-4">
        <p className="text-sm leading-6 text-slate-300">
          Para proteger quem achou e quem perdeu, o chat só será liberado depois que o encontrador validar um detalhe que não está público.
        </p>
        <div className="rounded-lg border border-teal-300/20 bg-teal-300/10 p-4">
          <p className="text-sm font-bold text-teal-100">Desafio do Dono</p>
          <p className="mt-1 text-white">{item.desafio_pergunta ?? 'Informe um detalhe específico do item.'}</p>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Sua resposta
          <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" value={resposta} onChange={(event) => onRespostaChange(event.target.value)} placeholder="Digite o detalhe oculto" />
        </label>
        <button className="h-11 rounded-lg bg-teal-400 px-4 text-sm font-black text-slate-950" type="button" onClick={onConfirmar}>
          Enviar resposta ao encontrador
        </button>
      </div>
    </ModalBase>
  )
}

function PainelChatSeguro({
  item,
  chatLiberado,
  onLiberar,
  onClose,
}: {
  item: ItemAchado
  chatLiberado: boolean
  onLiberar: () => void
  onClose: () => void
}) {
  return (
    <ModalBase titulo="Chat seguro" onClose={onClose}>
      <div className="grid gap-4 p-4">
        <div className="rounded-lg border border-white/10 bg-slate-950 p-4">
          <p className="text-sm text-slate-400">Item</p>
          <p className="font-bold text-white">{item.titulo}</p>
        </div>
        {chatLiberado ? (
          <>
            <div className="rounded-lg border border-teal-300/20 bg-teal-300/10 p-4 text-sm text-teal-100">
              <CheckCircle2 className="mb-2" size={18} aria-hidden="true" />
              Desafio validado. O chat privado está liberado para combinar a devolução em local seguro.
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Mensagem
              <textarea className="min-h-24 rounded-lg border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-teal-300" placeholder="Digite sua mensagem" />
            </label>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 text-sm font-black text-slate-950" type="button">
              <MessageCircle size={17} aria-hidden="true" />
              Enviar mensagem
            </button>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
              Chat bloqueado até o encontrador confirmar que a resposta do desafio está correta.
            </div>
            <button className="h-11 rounded-lg border border-white/10 px-4 text-sm font-bold text-slate-200" type="button" onClick={onLiberar}>
              Validar resposta e liberar chat
            </button>
          </>
        )}
      </div>
    </ModalBase>
  )
}
