# Pickup Game Coordinator

Dashboard for discovering, organizing, and joining local pickup sports games.

- **Frontend:** React + Vite, in the repo root (http://localhost:5173)
- **Backend:** FastAPI + PostgreSQL, in `backend/` (http://localhost:8000)

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Python](https://www.python.org/) 3.13
- [Docker](https://www.docker.com/products/docker-desktop/) (runs the local PostgreSQL 17 database)

## Quick start

Run everything from a fresh clone. Commands are PowerShell; on macOS/Linux
use `cp` instead of `Copy-Item` and `source .venv/bin/activate` instead of
`.venv\Scripts\activate`.

### 1. Database and backend

```powershell
cd backend
Copy-Item .env.example .env          # defaults work for local development
docker compose up -d                 # starts PostgreSQL on 127.0.0.1:5432

python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
alembic upgrade head                 # applies database migrations
fastapi dev app/main.py              # http://localhost:8000
```

API docs are at http://localhost:8000/docs and a health check at
http://localhost:8000/api/health.

### 2. Frontend

In a second terminal, from the repo root:

```powershell
Copy-Item .env.example .env          # points the frontend at the backend
npm install
npm run dev                          # http://localhost:5173
```

### Stopping

Stop each dev server with `Ctrl+C`. Stop the database with
`docker compose stop` (from `backend/`). `docker compose down` removes the
container but keeps your data; add `-v` to delete the data as well.

## Configuration

Both `.env` files are gitignored. Copy the `.env.example` next to each one.

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` | Database connection (defaults match `docker-compose.yml`) |
| `backend/.env` | `DB_PASSWORD` | Database password. The example value is dev-only; `docker compose` uses it to create the database the first time it starts |
| `backend/.env` | `CORS_ORIGINS` | Comma-separated frontend origins the API accepts |
| `.env` | `VITE_API_URL` | Backend URL used by the frontend (`src/lib/api.ts`) |

If you change the frontend port or URL, update `CORS_ORIGINS` to match. If
you change `DB_PASSWORD` after the database was first created, the existing
database keeps the old password. Either change it inside Postgres, or reset
with `docker compose down -v` (this deletes local data).

Never commit `.env` files or put secrets in `VITE_*` variables: Vite sends
them to the browser.

## Frontend commands

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Oxlint |

## Backend

See [backend/README.md](backend/README.md) for migrations, tests, and database details.

## Troubleshooting

- **`Cannot find native binding` from `npm run dev` or `npm run lint` on
  Windows:** npm skipped an optional native package (a known npm bug). Install
  the one named in the error without saving it, matching the installed
  version of the tool (see its `package.json` in `node_modules`):
  `npm install --no-save @rolldown/binding-win32-x64-msvc@<version>` for dev/build,
  `npm install --no-save @oxlint/binding-win32-x64-msvc@<version>` for lint.
  Alternatively delete `node_modules` and `package-lock.json` and run
  `npm install` again.
- **Backend can't connect to the database:** check that the container is up
  (`docker compose ps` in `backend/`) and that `backend/.env` matches the
  values the database was created with.
- **Migrations or the backend hang when connecting to the database:** set
  `DB_HOST=127.0.0.1` in `backend/.env` instead of `localhost`. On some
  machines `localhost` resolves to IPv6 first, and Docker's published port is
  IPv4-only.
- **Port 5432 already in use:** another PostgreSQL is running. Stop it, or set
  `DB_PORT` in `backend/.env` to a free port before `docker compose up -d`.
- **Browser shows a CORS error:** add the frontend's origin to `CORS_ORIGINS`
  in `backend/.env` and restart the backend.

## Structure

```
src/App.tsx             App shell and split layout
src/types.ts            Domain types and sport catalogue
src/data/seed.ts        Sample games
src/state/useGames.ts   Game data access
src/lib/                Formatting, derived helpers, API client
src/components/         Feature components
src/components/ui/      Button, Pill, Combobox, FillMeter
backend/                FastAPI service, migrations, docker-compose.yml
```

Plain CSS Modules over the tokens in `src/index.css`. No UI framework.

## Not built yet

- Search, filter, and sort render but do nothing
- No persistence — seed data resets on refresh; the frontend does not call the backend yet
- The map is a placeholder illustration
- Desktop only (1440px), no auth
