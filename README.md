# Easy Stock — Sistema de Controle de Estoque Hospitalar

Sistema enterprise completo para controle de estoque em hospitais oftalmológicos, com arquitetura moderna, RBAC, auditoria, relatórios PDF e dashboard administrativo.

## Stack Tecnológica

| Camada | Tecnologias |
|--------|-------------|
| Frontend | React, TypeScript, Vite, TailwindCSS, TanStack Query, Zustand, React Hook Form, Zod |
| Backend | Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT, Bcrypt |
| Infra | Docker, Docker Compose, Vercel, NGINX, PM2, DigitalOcean |

## Arquitetura

O projeto segue **Clean Architecture** com separação clara de responsabilidades:

```
backend/src/
├── modules/          # Domínio (Auth, Products, Movements, etc.)
├── routes/           # Rotas HTTP + Swagger
├── middlewares/      # Auth, validação, auditoria, erros
├── services/         # Regras de negócio transversais
├── repositories/     # Acesso a dados (via Prisma)
├── providers/        # JWT, PDF
├── database/         # Cliente Prisma
├── configs/          # Env, Swagger
└── shared/           # Erros, utils, logger, tipos
```

### Decisões Técnicas

- **Repository Pattern via Prisma**: ORM tipado elimina SQL injection e garante type-safety
- **Service Layer**: Toda lógica de negócio (estoque, transferências, inventário) centralizada nos services
- **DTO + Zod**: Validação dupla (entrada HTTP e tipos inferidos)
- **JWT + Refresh Token**: Sessões seguras com rotação de tokens
- **RBAC granular**: Permissões por módulo (`products:CREATE`, `movements:APPROVE`, etc.)
- **Auditoria automática**: Middleware registra ações críticas
- **Menu superior horizontal**: UX estilo ERP moderno (sem sidebar)

## Módulos Implementados

- ✅ Autenticação JWT (login, refresh, logout, recuperação de senha)
- ✅ Usuários e RBAC (5 perfis)
- ✅ Produtos (lote, validade, código de barras)
- ✅ **Controle de Vencimentos por Lote** (FEFO, alertas, cron, dashboard, PDFs)
- ✅ Multi-estoque (Central, CC, Consultórios, Farmácia, Satélites)
- ✅ Entradas / Saídas / Transferências com aprovação
- ✅ Inventário com ajuste automático
- ✅ Dashboard com KPIs e gráficos
- ✅ Relatórios PDF profissionais
- ✅ Auditoria completa
- ✅ Busca global, paginação, filtros
- ✅ Swagger/OpenAPI

## Módulo de Vencimentos (Lotes)

Controle hospitalar **por lote** (não apenas por produto), com status automáticos (`VALID`, `WARNING`, `CRITICAL`, `EXPIRED`), alertas em 90/60/30/7 dias, job `node-cron`, saídas **FEFO** e entradas obrigatórias com lote/fabricação/validade.

| Recurso | Rota / Tela |
|---------|-------------|
| API Lotes | `GET/POST/PUT/DELETE /api/batches` |
| Vencendo / Vencidos | `/api/batches/expiring`, `/api/batches/expired` |
| Dashboard vencimentos | `/api/batches/dashboard` |
| Alertas | `/api/batches/alerts`, contador em `/api/batches/alerts/count` |
| Frontend | `/vencimentos` (menu superior) |
| Permissões RBAC | `batches:READ`, `batches:CREATE`, `batches:UPDATE`, `batches:DELETE` |

### Migração do banco (schema de lotes) — preserva dados

Se você já tinha lotes no schema antigo (`lot`, `expiryDate`), use a migration que **não apaga** registros:

```powershell
cd backend
npx prisma migrate deploy
npm run prisma:seed
```

A migration `20250520120000_migrate_product_batches_legacy` copia `lot` → `batch_number`, `expiry_date` → `expiration_date`, define `stock_location_id` a partir de `stock_items` (ou do primeiro local ativo), recalcula `status` e cria `expiration_alerts`.

Somente em ambiente vazio/desenvolvimento sem dados importantes:

```powershell
npx prisma db push --force-reset
npm run prisma:seed
```

## Execução Local

### Pré-requisitos

- Node.js 20+
- Docker Desktop (recomendado) ou PostgreSQL local

**Um único servidor** — API e interface React rodam juntos na porta **3333** (Express serve o build; em desenvolvimento usa Vite no mesmo processo).

### Opção 1: Desenvolvimento (recomendado)

```bash
# Na raiz do projeto
docker compose up -d postgres

npm run install:all

cd backend
npx prisma migrate dev --name init
npm run prisma:seed

# Na raiz — sobe API + UI em http://localhost:3333
npm run dev
```

Requisito: `npm install` em `frontend/` (para o Vite em modo dev).

### Opção 2: Produção local

```bash
npm run build    # frontend → backend/public (build:server) + compila API
npm run start    # node dist/server.js
```

### Opção 3: Docker Compose (app + banco)

```bash
docker compose up --build
```

Acesse: **http://localhost:3333**

### Credenciais Padrão

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Administrador | `admin@hospital.com` | `Admin@123` |
| Operacional | `operacional@hospital.com` | `Oper@123` |

### URLs

| Serviço | URL |
|---------|-----|
| Aplicação (UI + API) | http://localhost:3333 |
| API | http://localhost:3333/api |
| Swagger | http://localhost:3333/api/docs |
| Health | http://localhost:3333/api/health |

## Perfis de Usuário (RBAC)

| Perfil | Descrição |
|--------|-----------|
| **Administrador** | Acesso total: usuários, exclusões, auditoria e todas as operações |
| **Operacional** | Uso diário: dashboard, cadastros, produtos, estoque, entradas/saídas/transferências, inventário, vencimentos e relatórios (sem gestão de usuários nem exclusões críticas) |

Na tela **Usuários**, o administrador pode:
- Definir o perfil **Administrador** ou **Operacional**
- Usar **Perfil padrão** (permissões do Operacional) ou **Personalizado** (marcar permissões por módulo)

Perfis legados (`FARMACIA`, `ESTOQUE`, etc.) permanecem no banco; ao editar, migre para Operacional ou Administrador.

Após atualizar o schema, execute `npx prisma migrate deploy` e `npx prisma db seed` no backend.

## Deploy na Vercel

O repositório está preparado para **dois serviços** no mesmo projeto (recurso experimental da Vercel), definidos em `vercel.json` na raiz:

| Serviço | Pasta | Rota |
|---------|-------|------|
| Frontend (Vite) | `frontend/` | `/` |
| Backend (Express serverless) | `backend/` | `/_/backend` |

### 1. Banco de dados — Vercel Postgres

O backend usa **PostgreSQL** via Prisma. Em produção, use **Vercel Postgres** (Storage no painel do projeto).

#### Criar e conectar

1. Vercel → projeto **constock** (ou o seu) → aba **Storage**.
2. **Create Database** → **Postgres** → escolha região e crie.
3. **Connect to Project** → marque o projeto e o ambiente **Production** e **Preview**.
4. Confirme que as variáveis aparecem no serviço **backend** (monorepo):
   - `POSTGRES_PRISMA_URL` — conexão com pool (runtime)
   - `POSTGRES_URL_NON_POOLING` — conexão direta (migrations)

O código mapeia automaticamente para o Prisma:

| Variável Vercel | Uso no Prisma |
|-----------------|---------------|
| `POSTGRES_PRISMA_URL` | `DATABASE_URL` (queries) |
| `POSTGRES_URL_NON_POOLING` | `DIRECT_URL` (migrate deploy) |

Não é obrigatório copiar manualmente, desde que as variáveis `POSTGRES_*` estejam no serviço **backend**.

5. **Redeploy** do backend — o build executa `prisma migrate deploy` e cria as tabelas.
6. **Seed** (usuários iniciais), uma vez:
   ```bash
   cd backend
   vercel env pull .env   # traz POSTGRES_* do projeto
   npx prisma db seed
   ```

#### Desenvolvimento local

```bash
docker compose up -d postgres
```

Copie `backend/.env.example` → `backend/.env` (`DATABASE_URL` e `DIRECT_URL` iguais no Docker).

**Sincronizar com o banco da Vercel:** `vercel env pull backend/.env` na pasta do projeto.

### 2. Importar no painel Vercel

1. Conecte o repositório GitHub.
2. Confirme que o **Root Directory** é `./` (raiz do monorepo).
3. A Vercel deve detectar `vercel.json` e pedir o layout com **frontend** + **backend**.

### 3. Variáveis de ambiente (serviço **backend**)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` / `POSTGRES_PRISMA_URL` | Sim | Vercel Postgres preenche `POSTGRES_*` automaticamente |
| `DIRECT_URL` / `POSTGRES_URL_NON_POOLING` | Sim (migrations) | Conexão direta para `prisma migrate deploy` |
| `JWT_SECRET` | Sim | Mín. 32 caracteres |
| `JWT_REFRESH_SECRET` | Sim | Mín. 32 caracteres |
| `NODE_ENV` | Sim | `production` |
| `CRON_SECRET` | Recomendado | Protege `GET /api/cron/expiration` |
| `FRONTEND_URL` | Opcional | URL pública do app (domínio customizado) |
| `SMTP_*` | Opcional | Recuperação de senha por e-mail |

O build do backend executa `prisma migrate deploy` (`vercel-build`). Na primeira implantação, `DATABASE_URL` já deve estar configurada.

### 4. Frontend

A Vercel injeta `VITE_BACKEND_URL=/_/backend` no build do frontend. O app monta a API em `/_/backend/api` automaticamente. Em desenvolvimento local (servidor unificado), o padrão continua `/api` — configure `frontend/.env` conforme `.env.example`.

### 5. Cron de vencimentos

Agendado em `backend/vercel.json` (diário às 06:00 UTC). A Vercel envia `Authorization: Bearer <CRON_SECRET>` quando `CRON_SECRET` está definida.

### 6. Verificação pós-deploy

- UI: `https://<seu-projeto>.vercel.app`
- Health: `https://<seu-projeto>.vercel.app/_/backend/api/health`
- Swagger: `https://<seu-projeto>.vercel.app/_/backend/api/docs`

### Produção local / Docker

Continua com **um servidor** (frontend em `backend/public`):

```bash
npm run build && npm run start
# ou: cd frontend && npm run build:server
```

## Deploy DigitalOcean

### 1. Criar Droplet

- Ubuntu 22.04 LTS
- Mínimo: 2 vCPU, 4GB RAM
- Habilitar Docker ou instalar Node 20 + PostgreSQL

### 2. Configurar servidor

```bash
# Instalar dependências
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
npm install -g pm2

# Clonar projeto
git clone <seu-repo> /var/www/hospital-stock
cd /var/www/hospital-stock
```

### 3. Variáveis de ambiente

```bash
cp backend/.env.example backend/.env
# Editar com valores de produção (JWT secrets fortes, DATABASE_URL, etc.)
```

### 4. Deploy automatizado

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### 5. SSL com Let's Encrypt

```bash
sudo certbot --nginx -d seu-dominio.com.br
```

### 6. PM2

```bash
cd /var/www/hospital-stock/backend
pm2 start ../deploy/ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Escalabilidade

| Estratégia | Implementação |
|------------|---------------|
| API horizontal | PM2 cluster mode (`instances: max`) |
| Banco | PostgreSQL com connection pooling (PgBouncer) |
| Cache | Redis para sessões e dashboard (futuro) |
| Filas | BullMQ para relatórios pesados (futuro) |
| CDN | Assets frontend via Cloudflare |
| Multi-tenant | Schema por hospital no Prisma (futuro) |

## Estrutura do Projeto

```
EASY CON/
├── backend/           # API Node.js + Prisma (serve UI em public/)
├── frontend/          # React + Vite (build → backend/public)
├── deploy/            # NGINX, PM2, scripts
├── docker-compose.yml # app (3333) + postgres
├── package.json       # scripts build/dev na raiz
└── README.md
```

## API — Principais Endpoints

```
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/dashboard
GET    /api/products
POST   /api/movements/entries
POST   /api/movements/exits
POST   /api/movements/transfers
PATCH  /api/movements/transfers/:id/approve
GET    /api/reports/*/pdf
GET    /api/audit
```

## Segurança

- Helmet, CORS, Rate Limiting
- Bcrypt (12 rounds)
- JWT com expiração curta + refresh token
- Validação Zod em todas as entradas
- Prisma ORM (anti SQL Injection)
- Auditoria de ações sensíveis

## Licença

Projeto proprietário — Hospital Oftalmológico.
