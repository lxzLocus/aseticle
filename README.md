# ASEticle

Academic paper search with citation-aware ranking and on-demand LLM translation.

- **Free by default** — papers come from the official **arXiv API** (no key, no scraping),
  enriched with citation counts and venue from **Semantic Scholar**.
- **Optional Google Scholar** source via SerpApi (bring your own key) to reach
  paywalled venues (IEEE / ACM / ScienceDirect) at the metadata level.
- **LLM translation** of titles/abstracts via any **OpenAI-compatible** endpoint
  (OpenAI, LM Studio, Ollama, vLLM, …) — bring your own API key.
- **User accounts** in MySQL with JWT auth (httpOnly cookies) + CSRF protection.
  BYO API keys are stored **encrypted at rest** (Fernet).

## Architecture

```
frontend (Next.js 14)  ──/api/* rewrite──▶  backend (FastAPI)  ──▶  MySQL
                                                  │
                                                  ├─ arXiv API (free)
                                                  ├─ Semantic Scholar (free)
                                                  └─ SerpApi / Google Scholar (optional)
```

The browser only talks to the frontend origin; Next.js proxies `/api/*` to the
backend, keeping auth cookies and CSRF tokens same-origin.

| Path        | Stack                          |
|-------------|--------------------------------|
| `frontend/` | Next.js 14, React 18, Radix UI |
| `backend/`  | FastAPI, SQLAlchemy (async), aiomysql |
| `db`        | MySQL 8                        |

## Quick start

```bash
cp .env.example .env
# (recommended) set a strong JWT_SECRET and a fresh ENCRYPTION_KEY:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8080/docs
- MySQL: localhost:3306

Then **Register** an account, open **Settings** to (optionally) configure your
LLM endpoint / SerpApi key, and search.

## Local development (without Docker)

Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# point DATABASE_URL at a running MySQL, then:
uvicorn app.main:app --reload --port 8080
```

Frontend:
```bash
cd frontend
npm install
# proxy target defaults to http://localhost:8080
npm run dev
```

## Security notes

- **JWT**: short-lived access token + long-lived refresh token, both in
  `httpOnly` cookies. The client auto-refreshes on 401.
- **CSRF**: double-submit token — a non-httpOnly `csrf_token` cookie must match
  the `X-CSRF-Token` header on all state-changing requests.
- **Secrets at rest**: user API keys are encrypted with Fernet (`ENCRYPTION_KEY`).
- Passwords hashed with bcrypt.
- For production set `COOKIE_SECURE=true` (HTTPS), a unique `JWT_SECRET` and
  `ENCRYPTION_KEY`, and lock down `CORS_ORIGINS`.

## API overview

| Method | Endpoint            | Auth | Notes                          |
|--------|---------------------|------|--------------------------------|
| POST   | `/api/auth/register`| —    | create account, sets cookies   |
| POST   | `/api/auth/login`   | —    | login                          |
| POST   | `/api/auth/refresh` | cookie+CSRF | rotate access token     |
| POST   | `/api/auth/logout`  | cookie+CSRF | clear cookies           |
| GET    | `/api/auth/me`      | ✓    | current user                   |
| PUT    | `/api/settings`     | ✓+CSRF | source pref + BYO keys       |
| GET    | `/api/search?q=…`   | ✓    | search papers                  |
| POST   | `/api/translate`    | ✓+CSRF | translate text via your LLM  |
