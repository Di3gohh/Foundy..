'use client'

import { Flag, Send } from 'lucide-react'

export function SecureChatPanel({ extortionFlagged }: { extortionFlagged: boolean }) {
  return (
    <section className="itemCard" aria-label="Conversa segura">
      <div className="itemCardHeader">
        <h2 className="itemTitle">Conversa</h2>
        {extortionFlagged ?<span className="badge">Em revisão</span> : null}
      </div>

      <div className="field">
        <label htmlFor="mensagem">Mensagem</label>
        <textarea id="mensagem" name="mensagem" placeholder="Digite sua mensagem" />
      </div>

      <div className="itemActions">
        <button className="primaryButton" type="button">
          <Send size={16} aria-hidden="true" /> Enviar
        </button>
        {extortionFlagged ?(
          <button className="dangerButton" type="button">
            <Flag size={16} aria-hidden="true" /> Denunciar Extorsão
          </button>
        ) : null}
      </div>
    </section>
  )
}
