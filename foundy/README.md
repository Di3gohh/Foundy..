# Foundy

Foundy é uma plataforma pública, hiperlocal e mobile-first para publicar itens encontrados e facilitar a recuperação com segurança. A interface do produto deve ser 100% em PT-BR.

## Estrutura do projeto

```text
foundy/
  apps/
    api/                         # FastAPI assíncrono
      app/
        core/                    # configuração, segurança, filtros e geolocalização
        db/                      # pool asyncpg
        models/                  # contratos Pydantic
        routers/                 # auth, itens e chat
        services/                # compressão de imagem e futuro matching
        main.py
      requirements.txt
    web/                         # Next.js App Router + PWA
      app/
      components/
      lib/
      public/
      types/
      next.config.ts
      package.json
      tsconfig.json
  supabase/
    schema.sql                   # DDL inicial PostgreSQL/PostGIS
  .env.example
```

## Arquitetura

- Frontend: Next.js App Router, TypeScript, PWA, UI responsiva com dark mode por `prefers-color-scheme`.
- Backend: FastAPI com `asyncpg`, Uvicorn, JWT e `passlib[bcrypt]`.
- Banco: Supabase PostgreSQL com PostGIS. A tabela de itens armazena apenas coordenadas aproximadas, nunca o ponto exato informado pelo usuário.
- Privacidade: e-mail, telefone, endereço e dados sensíveis ficam restritos ao próprio usuário e ao backend.
- Recuperação: o botão "É meu" cria uma sala privada de chat entre quem publicou e quem reivindicou o item.
- Segurança do chat: mensagens com sinais de extorsão financeira acionam revisão humana e deixam a ação "Denunciar Extorsão" disponível.
- Escala futura: `lost_boost_orders`, `is_premium`, `premium_until` e `item_matches` deixam prontos os pontos de monetização e matching automático.

## Comandos locais

API:

```bash
cd apps/api
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Web:

```bash
cd apps/web
npm install
npm run dev
```

Banco:

```bash
psql "$DATABASE_URL" -f supabase/foundy_cloud_schema.sql
```

Para Supabase Cloud, o caminho mais simples é abrir o SQL Editor e executar o conteúdo de
`supabase/foundy_cloud_schema.sql`.

## Deploy

- Frontend: Vercel com root directory `apps/web`.
- Backend: Render com o blueprint `render.yaml`.
- Banco: Supabase Cloud com PostGIS habilitado pelo SQL do projeto.
- Variável pública do frontend: apenas `NEXT_PUBLIC_API_URL`.
- Variáveis privadas do backend: `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET_KEY` e `CORS_ORIGINS`.

## Decisões de segurança

- O mapa e o feed mostram apenas `approx_location`, gerada com raio de 500 metros.
- `public.users` não deve ser exposta diretamente a clientes públicos.
- Chat e mensagens exigem autenticação e associação à sala.
- Descrições de itens são bloqueadas quando contêm telefone, e-mail, CPF ou termos ilícitos.
- Mensagens de chat suspeitas não são bloqueadas automaticamente; elas são entregues, sinalizadas e enviadas para revisão.
