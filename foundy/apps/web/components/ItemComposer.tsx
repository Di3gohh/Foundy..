'use client'

import { Camera, X } from 'lucide-react'

export function ItemComposer({ onClose }: { onClose: () => void }) {
  return (
    <div className="dialogBackdrop" role="presentation">
      <section className="dialog" aria-modal="true" role="dialog" aria-labelledby="postar-item-title">
        <header className="dialogHeader">
          <h2 className="dialogTitle" id="postar-item-title">
            Postar item encontrado
          </h2>
          <button className="iconButton" type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <form>
          <div className="formGrid">
            <div className="field">
              <label htmlFor="titulo">Título do item</label>
              <input id="titulo" name="titulo" placeholder="Ex.: Chave com chaveiro azul" />
            </div>

            <div className="field">
              <label htmlFor="descricao">Descrição</label>
              <textarea id="descricao" name="descricao" placeholder="Cor, marca e sinais gerais" />
            </div>

            <div className="field">
              <label htmlFor="categoria">Categoria</label>
              <select id="categoria" name="categoria" defaultValue="">
                <option value="" disabled>
                  Selecione a categoria
                </option>
                <option value="documentos">Documentos</option>
                <option value="eletronicos">Eletrônicos</option>
                <option value="chaves">Chaves</option>
                <option value="vestuario">Vestuário</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="local">Onde encontrou?</label>
              <input id="local" name="local" placeholder="Ex.: perto da estação, praça ou comércio" />
            </div>

            <button className="ghostButton" type="button">
              <Camera size={17} aria-hidden="true" /> Clique para tirar foto ou enviar imagem
            </button>
          </div>

          <footer className="dialogFooter">
            <button className="ghostButton" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="primaryButton" type="submit">
              Publicar agora
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
