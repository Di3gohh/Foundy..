# Guia de deploy da Foundy para CEO

Este documento explica, sem excesso de termos técnicos, como a Foundy sai do código local e vira um site público.

## O que foi preparado

1. O site em Next.js ficou pronto para Vercel.
   A Vercel será responsável por hospedar a interface que o usuário acessa pelo navegador.

2. A API em FastAPI ficou pronta para Render.
   O Render será responsável por manter o servidor Python ligado e conectado ao Supabase.

3. O Supabase virou o banco central.
   Ele guarda usuários, itens achados e mensagens de chat. A localização exibida no mapa é aproximada por projeto, com raio de privacidade.

4. As chaves sensíveis ficam fora do navegador.
   A chave privada do Supabase deve ficar apenas no Render. A Vercel recebe somente a URL pública da API.

## Passo a passo

1. Criar o projeto no Supabase.
   Entre no Supabase, crie um novo projeto e abra o SQL Editor.

2. Rodar o SQL.
   Cole o conteúdo de `foundy/supabase/foundy_cloud_schema.sql` no SQL Editor e execute.
   Depois cole e execute `foundy/supabase/foundy_product_flows.sql` para habilitar desafios, chat, notificações, limpeza e Pontos de Luz.

3. Guardar as chaves.
   No painel do Supabase, copie a Project URL e a chave `service_role`. A chave `service_role` é privada e nunca deve ir para o frontend.

4. Subir a API no Render.
   Crie um Web Service apontando para `foundy/apps/api`. Configure o comando de build como `pip install -r requirements.txt` e o start como `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

5. Configurar variáveis no Render.
   Use o modelo `foundy/apps/api/.env.render.example`.

6. Subir o frontend na Vercel.
   Importe o repositório na Vercel e defina o Root Directory como `foundy/apps/web`.

7. Configurar variável na Vercel.
   Adicione `NEXT_PUBLIC_API_URL` com a URL pública da API no Render.

8. Publicar.
   A Vercel gera uma URL pública do site. Depois disso, configure `CORS_ORIGINS` no Render com essa URL e redeploye a API.

## Como validar

1. Abra `https://sua-api.onrender.com/health`.
   A resposta esperada é uma mensagem dizendo que a Foundy API está operacional.

2. Abra o site da Vercel.
   A página deve carregar o mapa aproximado, os botões em português e o feed de itens.

3. Cadastre um item pela API ou pelo fluxo futuro do formulário.
   O ponto exibido deve aparecer aproximado, não no endereço exato.
