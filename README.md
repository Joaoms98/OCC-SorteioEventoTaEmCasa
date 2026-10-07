# OCC — Sorteio de Brindes

Sistema de sorteio de brindes para os eventos da **Os Crema Culture (OCC)**, criado para o evento beneficente **Tá em Casa**. Código aberto e software livre.

- **Backend:** Node.js + TypeScript, Express 5, Prisma 7 + PostgreSQL — em Clean Architecture
- **Frontend:** React 19 + Vite
- **Hospedagem gratuita:** Render (app) + Neon (banco PostgreSQL)

## Funcionalidades

- **Página inicial pública** (`/`): lista os sorteios ativos sobre a estampa da OCC, com os botões para se inscrever e assistir ao vivo
- Área da organização em `/admin`, protegida por senha (login com token JWT); as páginas públicas não têm link para ela
- Cadastro de eventos, brindes (com quantidade e foto) e participantes
- Importação de participantes colando uma lista ou colunas de planilha (`Nome; telefone; e-mail`)
- **Inscrição pública pelo celular** via link/QR Code, com abertura/fechamento das inscrições e **confirmação por código enviado por e-mail** (cada pessoa só se inscreve uma vez)
- **Sorteio por roleta**, desenhada em CSS, em três tipos escolhidos em cada evento:
  - **Roleta de brindes:** a roleta mostra os brindes e para no brinde sorteado, enquanto os nomes dos participantes passam até revelar quem ganhou
  - **Roleta de participantes:** a organização escolhe o brinde da rodada e a roleta gira com os nomes de quem está concorrendo, parando no ganhador (ideal para evento com um brinde só)
  - **Roleta interativa:** cada pessoa se inscreve e gira a roleta de brindes no próprio celular ou computador, arrastando com o dedo ou o mouse; todo inscrito ganha um brinde enquanto houver
- **Telão de sorteio** para projetor: animação, confete, atalho de teclado (Enter/Espaço) e tela cheia, sobre a estampa da OCC com efeito parallax (acompanha o mouse e a rolagem)
- **Sorteio ao vivo** em `/live/<id-do-evento>`: qualquer pessoa com o link (ou QR Code) acompanha cada sorteio em tempo real pelo celular, junto com o telão, e vê quantas pessoas estão assistindo
- **Prêmio desbloqueado / Resgatar brinde:** ao revelar o ganhador, o palco mostra o cartão do prêmio; quando a pessoa retira o brinde, a organização clica em **Resgatar** e uma comemoração (moeda OCC girando, explosão de luz) aparece no telão e em todos os celulares
- Anulação de sorteio quando o ganhador está ausente (o brinde volta a ficar disponível)
- Lista de ganhadores com exportação para CSV (abre direto no Excel)

## Regras do sorteio

- O brinde e o ganhador são escolhidos **no servidor** com gerador aleatório criptográfico (`crypto.randomInt`). A roleta e os nomes passando são apenas a animação desse resultado.
- **Roleta de brindes:** cada unidade restante é uma chance igual, como bilhetes num saco. Um brinde com 3 unidades restantes tem 3 vezes mais chance que um com 1. Na tela, cada brinde disponível aparece **uma vez**, em fatias do mesmo tamanho, seja qual for o estoque; ele só sai da roleta quando acaba.
- **Roleta de participantes:** o ganhador é sorteado entre **todos** os participantes aptos, com a mesma chance para cada um. A roleta mostra até 12 nomes (o ganhador e outros concorrentes escolhidos ao acaso), então aparecer ou não na roleta não muda a chance de ninguém. O brinde da rodada é o que a organização escolheu em **Valendo** (por padrão, o primeiro com unidades restantes).
- **Roleta interativa:** o brinde de cada pessoa é sorteado no servidor, do mesmo jeito da roleta de brindes, no instante em que ela confirma a inscrição; o gesto de girar define o sentido, a força e a duração do giro, e a roleta para no brinde sorteado.
  - Cada pessoa gira uma vez por evento.
  - O evento aceita tantas inscrições quantas unidades de brinde tiver: quando os brindes acabam, ninguém mais se inscreve (nem recebe o código por e-mail). Um giro anulado devolve a unidade à roleta.
  - A organização não sorteia nem inscreve ninguém à mão nesse tipo; ela entrega os brindes pela aba **Ganhadores**.
  - O brinde fica guardado no aparelho em que a pessoa se inscreveu: reabrindo a página ela vê o resultado, sem girar de novo. Em outro aparelho o resultado não aparece, mas continua registrado para a organização.
- O tipo de roleta é definido no cadastro do evento. Trocar entre a roleta de brindes e a de participantes é livre; entrar ou sair da roleta interativa só enquanto o evento não tem participantes.
- Cada unidade de um brinde é sorteada separadamente.
- **Uma pessoa ganha no máximo uma vez por evento.** Se o sorteio dela for anulado (ausência), ela não volta a concorrer.
- **Telefone obrigatório para todo participante** e único por evento, assim como o e-mail (formatos diferentes do mesmo número são reconhecidos como iguais). O telefone precisa ter um DDD brasileiro válido; celulares precisam do 9 na frente.
- **Inscrição pública em duas etapas:** a pessoa informa nome, celular e e-mail e recebe por e-mail um código de 6 números; a inscrição só existe depois que o código é confirmado. Assim ninguém se inscreve com o e-mail de outra pessoa nem repete a inscrição.
  - O código vale 10 minutos e aceita 5 tentativas; pode ser reenviado depois de 1 minuto (até 5 vezes).
  - No máximo 3 inscrições iniciadas por hora para o mesmo e-mail (evita envio de spam).
  - Só o hash do código (HMAC) fica no banco.
  - No cadastro feito pela organização (manual ou importação) não há código; e-mail é opcional ali.
- Participantes já sorteados e brindes com histórico de sorteio não podem ser removidos (auditoria).
- A entrega do brinde (resgate) só pode ser registrada depois da revelação, uma única vez, e um sorteio com brinde entregue não pode mais ser anulado.
- Sorteios simultâneos são serializados por evento (lock no banco): nunca se sorteia além da quantidade.
- O telão e a página ao vivo mostram só o nome do ganhador; telefone e e-mail aparecem apenas na área da organização.

## Páginas

| Endereço                         | Quem usa     | O que é                                                    |
| -------------------------------- | ------------ | ---------------------------------------------------------- |
| `/`                              | Público      | Sorteios ativos, com inscrição e link para assistir ao vivo |
| `/register/<id-do-evento>`       | Público      | Inscrição no sorteio (código por e-mail)                   |
| `/live/<id-do-evento>`           | Público      | Sorteio ao vivo                                            |
| `/spin/<id-do-evento>`           | Público      | Roleta interativa de quem acabou de se inscrever (e o brinde ganho) |
| `/admin`                         | Organização  | Eventos (pede a senha em `/admin/login`)                   |
| `/admin/events/<id-do-evento>`   | Organização  | Participantes, brindes, ganhadores e links públicos        |
| `/admin/events/<id-do-evento>/draw` | Organização | Telão de sorteio                                        |

Um sorteio está **ativo**, e aparece na página inicial, enquanto as inscrições estão abertas ou ainda há brinde para sortear. Rascunho sem brinde e com inscrições fechadas não aparece; evento com tudo sorteado e inscrições fechadas sai da lista. Os endereços antigos (`/login`, `/events/...`) redirecionam para `/admin`.

## Sorteio ao vivo

O telão da organização e a página pública `/live/<id-do-evento>` exibem o mesmo palco, sincronizado pelo servidor via **Server-Sent Events (SSE)**:

1. A organização clica em **Girar roleta**. O servidor sorteia o brinde e o ganhador, grava e avisa todos os espectadores: "a roleta vai parar em *Kit de cabelo* em 6 s".
2. Todas as telas giram a roleta e mostram os nomes passando ao mesmo tempo; a roleta para no brinde exatamente no instante da revelação. Nessa fase, o nome do ganhador **não é enviado** a ninguém além da organização, nem aparece no código da página.
3. No instante da revelação o servidor envia o ganhador; telão e celulares revelam juntos, com confete.

   Na **roleta de participantes** o servidor envia primeiro só os nomes que estão na roleta; ela gira livre e, 3 s antes da revelação, o servidor avisa em qual nome ela para e todas as telas freiam juntas até ele.
4. Quando o ganhador retira o brinde, a organização clica em **Resgatar brinde** e a comemoração aparece em todas as telas.
5. Anulações ("ganhador ausente") e mudanças no placar (brindes restantes, inscritos, ganhadores) também chegam em tempo real.

Regras do palco:

- **Um sorteio por vez:** só é possível sortear de novo depois que o ganhador atual foi revelado.
- Quem entra no meio do suspense pega o sorteio em andamento; quem perde a conexão reconecta sozinho e recebe o estado atual.
- O tempo de suspense (giro da roleta) é configurável (`DRAW_SUSPENSE_SECONDS`, padrão 6 s).
- Durante o giro o placar público mostra a situação de antes do sorteio (unidades e participantes aptos), para não entregar o resultado nem tirar a fatia sorteada da roleta.
- A animação usa só o primeiro nome e a inicial do sobrenome dos concorrentes ("Maria S."); o nome completo aparece apenas para quem ganha.

O palco ao vivo fica em memória no servidor (porta `LiveDrawChannel`, implementação `InMemoryLiveDrawChannel`), o que atende a instância única do plano gratuito. Para rodar várias instâncias, troque a implementação por um broker compartilhado (Redis ou `LISTEN/NOTIFY` do Postgres) sem mexer nos casos de uso.

## Arquitetura

```
.
├── backend/                # API Express + Prisma (Clean Architecture)
├── frontend/               # SPA React + Vite
├── assets/                 # Identidade visual da OCC (fontes dos arquivos em frontend/public/brand/)
├── scripts/                # Utilitários de build de arte, rodados à mão quando a arte muda
├── docker-compose.yml      # PostgreSQL local para desenvolvimento
└── render.yaml             # Infraestrutura do deploy (Render)
```

Os arquivos de `assets/` não vão para o build: são as artes originais de onde saíram as imagens
otimizadas em `frontend/public/brand/`. `assets/stage-pattern-source.jpg` é a entrada do
[`build-stage-pattern.py`](scripts/build-stage-pattern.py), e `assets/roulette-reference.jpg` é a
referência da roleta desenhada em CSS.

O backend segue a Clean Architecture: as dependências apontam sempre para dentro (`main → presentation/infrastructure → application → domain`).

```
backend/src
├── domain/                 # Regras de negócio puras (sem Express, Prisma ou HTTP)
│   ├── entities/           # Event, Participant, Prize, Draw
│   ├── value-objects/      # Phone, Email (normalização e validação)
│   ├── errors/             # DomainError + ErrorCode (códigos em inglês, sem texto para o usuário)
│   └── repositories/       # Contratos (interfaces) de persistência
├── application/
│   ├── ports/              # Clock, IdGenerator, RandomNumberGenerator, TokenService, TransactionManager, LiveDrawChannel…
│   └── use-cases/          # Um caso de uso por classe: DrawPrize, VoidDraw, GetLiveBoard, ImportParticipants…
├── infrastructure/         # Implementações concretas dos contratos
│   ├── database/prisma/    # Repositórios Prisma, transações (AsyncLocalStorage), client gerado
│   ├── live/               # Palco ao vivo em memória (suspense e revelação)
│   ├── security/           # JWT, verificação da senha de admin
│   └── services/           # UUID, RNG criptográfico, relógio
├── presentation/http/      # Express: rotas, controllers, validação (Zod), presenters, tradução de erros, SSE (live/)
└── main/                   # Composição (injeção de dependências), variáveis de ambiente, servidor

frontend/src
├── api/                    # Cliente HTTP, endpoints e ApiError
├── auth/                   # Sessão do administrador
├── components/             # Componentes reutilizáveis (prize/: prêmio desbloqueado, moeda 3D, comemoração do resgate)
├── live/                   # Sorteio ao vivo: EventSource, estado sincronizado (reducer) e o palco compartilhado
├── pages/                  # Telas (eventos, detalhe do evento, telão, ao vivo, inscrição pública)
├── hooks/  utils/  types/  styles/
```

### Idiomas: código em inglês, erros em português

Tabelas, colunas, rotas, código e códigos de erro estão em inglês. Tudo o que chega ao usuário está em português:

```json
HTTP 409
{
  "error": {
    "code": "PARTICIPANT_ALREADY_REGISTERED",
    "message": "Este telefone já está cadastrado neste evento.",
    "details": { "field": "phone" }
  }
}
```

- O domínio lança erros **apenas com código** (`ErrorCode`); a tradução fica na camada de apresentação, em [`errorMessages.ts`](backend/src/presentation/http/errors/errorMessages.ts). O TypeScript obriga que todo código tenha mensagem.
- Erros de validação (`VALIDATION_ERROR`) trazem `details: [{ field, message }]` com mensagens em português definidas em [`schemas.ts`](backend/src/presentation/http/validation/schemas.ts) (com o locale `pt-BR` do Zod como padrão).
- O frontend exibe a mensagem da API e tem mensagens próprias em português só para falhas de rede ([`ApiError.ts`](frontend/src/api/ApiError.ts)). A validação nativa do navegador fica desligada para não aparecer mensagem no idioma do navegador.

### Banco de dados

| Tabela         | Descrição                                                                  |
| -------------- | -------------------------------------------------------------------------- |
| `events`       | Eventos (nome, data, descrição, `registration_open`, `draw_mode`)                     |
| `participants` | Participantes por evento — únicos por (`event_id`, `phone`) e (`event_id`, `email`) |
| `prizes`       | Brindes por evento com `quantity` (`image_updated_at` = versão da foto)    |
| `prize_images` | Fotos dos brindes (bytes no banco, ver abaixo)                             |
| `draws`        | Sorteios (`status`: `CONFIRMED`/`VOIDED`, `claimed_at` = brinde entregue) — único por (`event_id`, `participant_id`) |

Schema em [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma); migrações em `backend/prisma/migrations`.

**Fotos dos brindes ficam no banco, não em disco:** o Render gratuito apaga o disco a cada deploy e quando o serviço hiberna, então arquivos enviados se perderiam. O navegador reduz a foto para no máximo 1200 px e converte para WebP antes do envio (tipicamente dezenas de KB); o servidor aceita só JPG/PNG/WebP de até 2 MB, conferindo o conteúdo real do arquivo. As fotos são servidas em `/api/public/prizes/:id/image?v=<versão>` com cache longo.

## Rodando localmente

Requisitos: **Node.js 22.12+** (recomendado 24, ver `.nvmrc`) e um PostgreSQL.

```bash
# 1. Dependências (também gera o Prisma Client)
npm install

# 2. Banco local — com Docker, ou use uma branch de desenvolvimento no Neon
docker compose up -d

# 3. Variáveis de ambiente
cp backend/.env.example backend/.env    # ajuste ADMIN_PASSWORD e JWT_SECRET

# 4. Criar as tabelas
npm run db:deploy -w backend

# 5. Subir API (porta 3333) + frontend (porta 5173, com proxy para /api)
npm run dev
```

Acesse http://localhost:5173 para ver a página pública e http://localhost:5173/admin para a área da organização (entre com a `ADMIN_PASSWORD`).

### Scripts

| Comando                         | O que faz                                                   |
| ------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                   | API e frontend em modo desenvolvimento                      |
| `npm test`                      | Testes do backend (unitários + integração HTTP) e do frontend |
| `npm run test:db -w backend`    | Testes dos repositórios contra PostgreSQL real (veja abaixo)  |
| `npm run typecheck`             | Checagem de tipos dos dois pacotes                          |
| `npm run build`                 | Build do frontend e do backend                              |
| `npm start`                     | Aplica migrações pendentes e sobe o servidor de produção    |
| `npm run db:migrate -w backend` | Cria uma nova migração após alterar o `schema.prisma`       |
| `npm run db:studio -w backend`  | Abre o Prisma Studio para inspecionar o banco               |

Os testes de `test:db` **apagam os dados** do banco indicado em `TEST_DATABASE_URL` e aplicam as migrações sozinhos. Use um banco exclusivo para testes:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/occ_raffle_test npm run test:db -w backend
```

### Variáveis de ambiente (backend)

| Variável               | Obrigatória | Descrição                                                                 |
| ---------------------- | ----------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`         | sim         | Conexão PostgreSQL usada pela aplicação (no Neon: a URL *pooled*)          |
| `DIRECT_URL`           | no Neon     | Conexão direta usada só pelas migrações (no Neon: a URL sem `-pooler`). Sem ela, usa `DATABASE_URL` |
| `ADMIN_PASSWORD`       | sim         | Senha da área da organização (mín. 8 caracteres; em produção, mín. 12 e diferente do exemplo) |
| `JWT_SECRET`           | sim         | Segredo para assinar os tokens (mín. 32 caracteres)                       |
| `JWT_EXPIRES_IN_HOURS` | não         | Duração do login, padrão `12`                                             |
| `PORT`                 | não         | Porta HTTP, padrão `3333` (o Render define automaticamente)               |
| `TRUST_PROXY`          | não         | Nº de proxies à frente da app (Render: `1`), para o limite de requisições por IP |
| `CLIENT_IP_HEADER`     | não         | Cabeçalho em que a borda da hospedagem envia o IP real do visitante (Render: `cf-connecting-ip`); só use atrás dessa borda |
| `CORS_ORIGINS`         | não         | Domínios do frontend, separados por vírgula, se ele for hospedado à parte |
| `DRAW_SUSPENSE_SECONDS`| não         | Duração do giro da roleta antes de revelar o ganhador, padrão `6`         |
| `EMAIL_PROVIDER`       | produção    | `console` (desenvolvimento: o código aparece na tela) ou `brevo` (obrigatório em produção) |
| `BREVO_API_KEY`        | com brevo   | Chave de API do Brevo (envio dos códigos)                                 |
| `EMAIL_FROM`           | com brevo   | Remetente dos e-mails, verificado no Brevo                                |
| `EMAIL_FROM_NAME`      | não         | Nome do remetente, padrão `Sorteio OCC`                                   |
| `PUBLIC_URL`           | não         | Endereço público do app; no Render é detectado sozinho (`RENDER_EXTERNAL_URL`) |
| `EMAIL_LOGO_URL`       | não         | Endereço público do logo do e-mail; padrão `<PUBLIC_URL>/brand/occ-logo-email.png` |

## API

Base: `/api`. Rotas de `/events` exigem `Authorization: Bearer <token>`.

| Método | Rota                                               | Descrição                                    |
| ------ | -------------------------------------------------- | -------------------------------------------- |
| GET    | `/health`                                          | Verificação de saúde                         |
| POST   | `/auth/login`                                      | `{ password }` → `{ token, expiresIn }`      |
| GET    | `/public/events`                                   | Sorteios ativos (página inicial), com `remainingUnits` |
| GET    | `/public/events/:eventId`                          | Dados públicos do evento                     |
| GET    | `/public/events/:eventId/prizes`                   | Brindes como a roleta mostra: nome, foto e unidades restantes |
| POST   | `/public/events/:eventId/registrations`            | Inscrição, etapa 1: `{ name, phone, email }` → envia o código por e-mail |
| POST   | `/public/events/:eventId/registrations/:id/confirm`| Inscrição, etapa 2: `{ code }` → cria o participante; na roleta interativa devolve também `spin` (brinde ganho e a roleta) |
| POST   | `/public/events/:eventId/registrations/:id/resend` | Reenvia o código                              |
| GET    | `/public/events/:eventId/live`                     | Sorteio ao vivo (SSE): `snapshot`, `draw_started`, `draw_revealed`, `draw_claimed`, `draw_voided`, `viewers` |
| GET    | `/events`                                          | Lista eventos                                |
| POST   | `/events`                                          | Cria evento `{ name, drawMode?, ... }` (`drawMode`: `PRIZES`, `PARTICIPANTS` ou `INTERACTIVE`) |
| GET    | `/events/:eventId`                                 | Evento + estatísticas                        |
| PATCH  | `/events/:eventId`                                 | Atualiza evento (ex.: abrir inscrições, tipo de roleta) |
| DELETE | `/events/:eventId`                                 | Exclui evento e tudo relacionado             |
| GET    | `/events/:eventId/participants?search=&page=&pageSize=` | Lista paginada                          |
| POST   | `/events/:eventId/participants`                    | Adiciona participante                        |
| POST   | `/events/:eventId/participants/import`             | `{ participants: [...] }` → `{ created, rejected }` |
| DELETE | `/events/:eventId/participants/:participantId`     | Remove participante (se nunca sorteado)      |
| GET    | `/events/:eventId/prizes`                          | Brindes com unidades sorteadas/restantes     |
| POST   | `/events/:eventId/prizes`                          | Cria brinde `{ name, quantity, description? }` |
| PATCH  | `/events/:eventId/prizes/:prizeId`                 | Edita brinde                                 |
| DELETE | `/events/:eventId/prizes/:prizeId`                 | Remove brinde (se sem sorteios)              |
| PUT    | `/events/:eventId/prizes/:prizeId/image`           | Envia/troca a foto (corpo binário `image/*`) |
| DELETE | `/events/:eventId/prizes/:prizeId/image`           | Remove a foto                                |
| GET    | `/public/prizes/:prizeId/image`                    | Foto do brinde (pública)                     |
| GET    | `/events/:eventId/draws`                           | Histórico de sorteios                        |
| POST   | `/events/:eventId/draws`                           | **Sorteia** `{}` (sorteia o brinde também) ou `{ prizeId }` → ganhador + `revealInMs` (+ `wheel` na roleta de participantes) |
| POST   | `/events/:eventId/draws/:drawId/void`              | Anula um sorteio                             |
| POST   | `/events/:eventId/draws/:drawId/claim`             | Registra a entrega do brinde (resgate)       |

Proteções: `helmet`, limite de 10 tentativas de login com erro a cada 15 min por IP e limite generoso na inscrição pública (vários celulares podem sair pelo mesmo IP do Wi-Fi do local).

## Deploy gratuito (Neon + Render)

Um único serviço no Render entrega a API e o frontend (mesmo domínio, sem CORS). O banco fica no Neon, que não expira no plano gratuito.

### 1. Banco no Neon

1. Crie uma conta em https://neon.tech e um projeto (região **AWS US East (N. Virginia)**, a mesma do Render).
2. Em **Connect**, copie duas strings de conexão:
   - com **Connection pooling** ligado → será o `DATABASE_URL`
   - com pooling desligado (sem `-pooler` no host) → será o `DIRECT_URL` (**obrigatório no Neon**: as migrações não funcionam pela conexão com pooling)

### 2. E-mail no Brevo (códigos de inscrição)

1. Crie uma conta gratuita em https://www.brevo.com (300 e-mails por dia no plano gratuito).
2. Em **Senders, Domains & Dedicated IPs → Senders**, cadastre o e-mail remetente (por exemplo o e-mail da OCC) e confirme pelo link que chega nele. Se tiverem domínio próprio, autentique o domínio para os e-mails não caírem em spam.
3. Em **SMTP & API → API Keys**, gere uma chave (começa com `xkeysib-`; a chave de SMTP, `xsmtpsib-`, não serve). Ela será o `BREVO_API_KEY`; o remetente confirmado será o `EMAIL_FROM`.
4. O Brevo bloqueia chamadas de IPs desconhecidos: em **Configurações → Segurança → IPs autorizados** (https://app.brevo.com/security/authorised_ips), clique em **Desativar bloqueio** ou cadastre os IPs de onde o backend roda. No Render eles são faixas compartilhadas da região, listadas no serviço em **Connect → Outbound**. Sem isso o Brevo responde 401 e a inscrição mostra erro de envio.

**Logo no e-mail:** aplicativos de e-mail só mostram imagens hospedadas em endereço público (o Brevo não envia imagem embutida). Em produção o logo vem do próprio app (`/brand/occ-logo-email.png`); em desenvolvimento local, sem endereço público, o e-mail usa um selo "OCC" desenhado, a não ser que `EMAIL_LOGO_URL` aponte para uma cópia pública do logo.

### 3. App no Render

1. Suba este repositório no GitHub.
2. No Render: **New → Blueprint** e selecione o repositório. O arquivo [`render.yaml`](render.yaml) cria o serviço `occ-sorteio` (plano free) e gera o `JWT_SECRET` automaticamente.
3. Preencha `DATABASE_URL`, `DIRECT_URL`, `ADMIN_PASSWORD`, `BREVO_API_KEY` e `EMAIL_FROM` quando solicitado.
4. A cada deploy o Render executa `npm ci --include=dev && npm run build`; ao iniciar, `npm start` aplica as migrações pendentes e sobe o servidor.

Sem Blueprint, crie um **Web Service** Node com os mesmos comandos de build/start, health check `/api/health` e as variáveis da tabela acima (`NODE_ENV=production`, `TRUST_PROXY=1`, `CLIENT_IP_HEADER=cf-connecting-ip`). No Render o servidor se recusa a iniciar sem `NODE_ENV=production`, para nunca mostrar os códigos de inscrição na tela.

> **Frontend em outro lugar (opcional):** para hospedar o frontend na Vercel/Netlify, faça o build de `frontend/` com `VITE_API_URL=https://seu-backend.onrender.com` e configure `CORS_ORIGINS` no backend com o domínio do frontend. Configure o rewrite de SPA para `index.html`.

### Dicas para o dia do evento

- O plano gratuito do Render **hiberna após 15 min sem acesso**; o primeiro acesso depois disso leva cerca de 1 minuto (e quem escanear o QR Code verá uma tela de carregamento do Render, em inglês). Cadastre `https://<seu-app>.onrender.com/api/health` num monitor gratuito (UptimeRobot, cron-job.org) acessando a cada 10 minutos, ligado **pelo menos 1 hora antes** do evento até o fim.
- O limite de requisições é contado por visitante (IP). Quem está no mesmo Wi-Fi compartilha um IP: são até 300 chamadas de inscrição a cada 15 minutos por rede, o que dá cerca de 150 inscrições nesse intervalo. Se muita gente for se inscrever ao mesmo tempo no local, abra as inscrições com antecedência.
- Abra as inscrições, projete o QR Code da página do evento e feche as inscrições antes de começar os sorteios.
- Divulgue o link **Sorteio ao vivo** (QR Code na página do evento ou no botão **Transmissão** do telão) para quem quiser acompanhar pelo celular.
- No telão, use **Tela cheia** e gire a roleta com **Enter** ou **Espaço**. Se o ganhador não aparecer, use **Ganhador ausente — anular** e sorteie novamente.
- Ao final, exporte a lista de ganhadores em CSV na aba **Ganhadores**.

## Licença

MIT.
