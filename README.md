# Gerenciador de Gastos e Investimentos

Sistema web para controle de gastos pessoais e investimentos atrelados ao CDI, com frontend estático no **GitHub Pages** e API em **Cloudflare Workers** com banco **D1 (SQLite)**.

## Arquitetura

```text
GitHub Pages (React/Vite)
        │ HTTPS + JWT
        ▼
Cloudflare Worker (Hono)
        │ binding D1
        ▼
D1 "gerenciador_de_gastos" (SQLite)
  ├── users / categories / expenses
  ├── investments / contributions
  └── cdi_rates (cache de mercado)
```

## Estrutura

- `frontend/` — SPA React + TypeScript + Vite
- `backend/` — Cloudflare Worker (Hono + Zod + D1)
- `backend/migrations/` — schema SQL do D1
- `.github/workflows/deploy-frontend.yml` — deploy no GitHub Pages

## Pré-requisitos

- Node.js 20+
- Conta Cloudflare com banco D1 `gerenciador_de_gastos`
- Login no Wrangler:

```bash
cd backend
npx wrangler login
npx wrangler whoami
```

## Variáveis de ambiente

### Backend (`backend/.dev.vars` local / secrets no Cloudflare)

| Variável | Descrição |
|----------|-----------|
| `JWT_SECRET` | Segredo forte para assinar JWTs |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula |
| `ADMIN_EMAIL` | E-mail promovido a administrador |
| `ADMIN_PASSWORD` | Senha do admin no ambiente (bootstrap + login) |

Binding no `wrangler.toml`: `DB` → D1 `gerenciador_de_gastos`.

```bash
cd backend
cp .dev.vars.example .dev.vars
# edite JWT_SECRET, ADMIN_EMAIL e ADMIN_PASSWORD

npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_PASSWORD
```

## Desenvolvimento local

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply gerenciador_de_gastos --local
npm run dev
```

Healthcheck: `GET http://127.0.0.1:8787/api/health` — deve retornar `d1.readable: true`.

Terminal 2 — Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Deploy do backend (Cloudflare)

```bash
cd backend
npx wrangler d1 migrations apply gerenciador_de_gastos --remote
npx wrangler deploy
```

## Deploy do frontend (GitHub Pages)

1. Publique o repositório no GitHub.
2. Em **Settings → Pages**, fonte = **GitHub Actions**.
3. Faça push na branch `main` (o workflow já define `VITE_API_URL` e `VITE_BASE_PATH`).

## Segurança

- Senhas com PBKDF2-SHA-256 (100k iterações) + salt
- JWT HS256 com `JWT_SECRET` só no Worker
- Validação Zod em todas as entradas
- Isolamento por `user_id` no D1
- CORS restrito às origens configuradas
- Sem secrets no frontend
