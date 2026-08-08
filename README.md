# Gerenciador de Gastos e Investimentos

Sistema web para controle de gastos pessoais e investimentos atrelados ao CDI, com frontend estático no **GitHub Pages** e API em **Cloudflare Workers** persistindo JSON no **R2** (`applications/gerenciador_de_gastos/`).

## Arquitetura

```text
GitHub Pages (React/Vite)
        │ HTTPS + JWT
        ▼
Cloudflare Worker (Hono)
        │ binding R2
        ▼
R2 bucket "applications"
  └── gerenciador_de_gastos/
        ├── users/
        └── market/cdi-daily.json
```

Dados privados **nunca** são lidos pelo frontend via link público do bucket — só através da API autenticada.

## Estrutura

- `frontend/` — SPA React + TypeScript + Vite
- `backend/` — Cloudflare Worker (Hono + Zod + R2)
- `.github/workflows/deploy-frontend.yml` — deploy no GitHub Pages

## Pré-requisitos

- Node.js 20+
- Conta Cloudflare com bucket R2 chamado `applications`
- Login no Wrangler (**obrigatório** para gravar no R2 real):

```bash
cd backend
npx wrangler login
npx wrangler whoami
```

Sem login, o `wrangler dev` usa um R2 **simulado** no computador — os arquivos **não** aparecem no painel da Cloudflare.

## Variáveis de ambiente

### Backend (`backend/.dev.vars` local / secrets no Cloudflare)

| Variável | Descrição |
|----------|-----------|
| `JWT_SECRET` | Segredo forte para assinar JWTs |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula |
| `R2_PREFIX` | Prefixo no bucket (padrão: `gerenciador_de_gastos`) |

Binding R2 no `wrangler.toml`: `APPLICATIONS` → bucket `applications`.

```bash
cd backend
cp .dev.vars.example .dev.vars
# edite JWT_SECRET

npx wrangler secret put JWT_SECRET
# opcional em produção:
npx wrangler secret put CORS_ORIGINS
```

### Frontend (`frontend/.env`)

| Variável | Exemplo |
|----------|---------|
| `VITE_API_URL` | `http://127.0.0.1:8787/api` (local) ou `https://seu-worker.workers.dev/api` |
| `VITE_BASE_PATH` | `/` (local) ou `/nome-do-repo/` (GitHub Pages project site) |

No GitHub Actions, configure o secret `VITE_API_URL` com a URL pública do Worker.

## Desenvolvimento local

Terminal 1 — API:

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars
npx wrangler login   # se ainda não estiver autenticado
npm run dev
```

A API sobe em `http://127.0.0.1:8787`. Com `remote = true` no `wrangler.toml`, o binding `APPLICATIONS` grava no bucket **real** `applications`, no prefixo `gerenciador_de_gastos/`.

Confira no painel R2 ou com:

```bash
curl http://127.0.0.1:8787/api/health
```

Se `r2.readable`/`writable` estiverem ok, o healthcheck terá criado `gerenciador_de_gastos/_system/health.json` no bucket.

Terminal 2 — Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:5173`.

### Healthcheck R2

`GET http://127.0.0.1:8787/api/health` — grava e lê `gerenciador_de_gastos/_system/health.json`.

## Deploy do backend (Cloudflare)

```bash
cd backend
npm install
npx wrangler secret put JWT_SECRET
npx wrangler deploy
```

Após o deploy, atualize `CORS_ORIGINS` para incluir `https://SEU_USUARIO.github.io` e a URL do Worker em `VITE_API_URL`.

Confirme no dashboard Cloudflare que o Worker tem o binding R2 `APPLICATIONS` apontando para `applications`.

## Deploy do frontend (GitHub Pages)

1. Publique o repositório no GitHub.
2. Em **Settings → Pages**, fonte = **GitHub Actions**.
3. Crie o secret `VITE_API_URL` (URL do Worker + `/api`).
4. Faça push na branch `main` (ou rode o workflow manualmente).

O workflow define `VITE_BASE_PATH=/{nome-do-repo}/` e copia `index.html` → `404.html` para rotas SPA.

## API (resumo)

| Método | Rota | Auth |
|--------|------|------|
| POST | `/api/auth/register` | Não |
| POST | `/api/auth/login` | Não |
| POST | `/api/auth/logout` | Sim |
| GET | `/api/me` | Sim |
| CRUD | `/api/expenses` | Sim |
| GET | `/api/expenses/summary?month=YYYY-MM` | Sim |
| GET | `/api/expenses/by-period?from=&to=` | Sim |
| GET/POST/PUT | `/api/categories` | Sim |
| CRUD | `/api/investments` | Sim |
| POST | `/api/investments/:id/contributions` | Sim |
| GET | `/api/investments/:id/performance` | Sim |
| GET | `/api/investments/summary` | Sim |
| POST | `/api/investments/:id/simulate-withdrawal` | Sim |
| GET | `/api/market/cdi` | Sim |
| GET | `/api/health` | Não |

O `userId` das operações autenticadas vem **apenas do JWT**, nunca do body/query.

## Metodologia financeira

### CDI

- Fonte: Banco Central — API SGS série **12** (Taxa de juros – CDI), % ao dia.
- Provider intercambiável: `BcbCdiProvider` + interface `CdiProvider`.
- Cache em R2: `gerenciador_de_gastos/market/cdi-daily.json`.
- Para cada aporte, o fator acumulado é o produto, nos dias com DI publicada entre a data do aporte e a data de referência:
  - `fator *= 1 + diDiaria * (cdiPercent / 100)`
- Dias sem publicação (fins de semana/feriados) não alteram o fator.

### IOF (`calculateIOF`)

Tabela regressiva sobre o **rendimento** nos primeiros 29 dias (96% no dia 1 … 3% no dia 29; 0% a partir do 30º).

### IR (`calculateIncomeTax`)

Tabela regressiva de renda fixa sobre o rendimento **após IOF**:

| Prazo | Alíquota |
|-------|----------|
| até 180 dias | 22,5% |
| 181–360 | 20% |
| 361–720 | 17,5% |
| acima de 720 | 15% |

Cada aporte é calculado isoladamente (nunca `saldo total × taxa`).

## Testes

```bash
cd backend
npm test
```

Cobre faixas de IR/IOF e o cálculo de rendimento por aporte.

## Segurança

- Senhas com PBKDF2-SHA-256 (100k iterações) + salt
- JWT HS256 com `JWT_SECRET` só no Worker
- Validação Zod em todas as entradas
- Isolamento por prefixo `users/{userId}/` no R2
- CORS restrito às origens configuradas
- Sem secrets no frontend

## Link público do R2

Use somente para conteúdo que possa ser público. Profiles, gastos, investimentos e sessões/hashes **não** devem ficar acessíveis por URL pública — sempre via Worker.
