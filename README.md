# Pickup Game Coordinator

Dashboard for discovering, organizing, and joining local pickup sports games.

- **Frontend:** React + Vite, in the repo root (http://localhost:5173)
- **Backend:** FastAPI + PostgreSQL, in `backend/` (http://localhost:8000)

For how everything works today, what is done, and what is left, see
[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 22.12 or newer (Vite warns on older versions)
- [Python](https://www.python.org/) 3.12 or newer (tested on 3.12; the backend README says 3.13)
- [Docker](https://www.docker.com/products/docker-desktop/) (runs the local PostgreSQL 17 database)

## Quick start

Run everything from a fresh clone. Commands are PowerShell; on macOS/Linux
use `cp` instead of `Copy-Item` and `source .venv/bin/activate` instead of
`.venv\Scripts\activate`.

### 1. Database and backend

```powershell
cd backend
Copy-Item .env.example .env          # then fill in the two secrets below
python -c "import secrets; print(secrets.token_urlsafe(16))"
                                     # paste the output as DB_PASSWORD in backend/.env
python -c "import secrets; print(secrets.token_hex(32))"
                                     # paste the output as JWT_SECRET_KEY in backend/.env
docker compose up -d                 # starts PostgreSQL on 127.0.0.1:5432

python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
alembic upgrade head                 # applies database migrations
fastapi dev app/main.py              # http://localhost:8000
```

`DB_PASSWORD` and `JWT_SECRET_KEY` have no defaults, so no secret is stored in
the repository. `docker compose` and the backend refuse to start without them,
and the JWT key must be at least 32 characters. Every developer generates their
own; both live only in your gitignored `backend/.env`.

API docs are at http://localhost:8000/docs and a health check at
http://localhost:8000/api/health.

#### Trying the API in the browser (Swagger)

Until the frontend is connected, you can exercise every feature at
http://localhost:8000/docs:

1. `POST /api/auth/register`, then `POST /api/auth/login`, and copy the
   `access_token`.
2. Click **Authorize** (top right) and paste the token. Only the token, without
   `Bearer`.
3. `POST /api/games` to create a game, `GET /api/games` to filter and sort.
4. To act as a second user, register and log in again and paste the new token
   into **Authorize**. Join and leave with `/join` and `/participants/me`; try
   editing the first user's game to see the organizer-only rules (403).

### 2. Frontend

In a second terminal, from the repo root:

```powershell
Copy-Item .env.example .env          # points the frontend at the backend
npm install
npm run dev                          # http://localhost:5173
```

Open http://localhost:5173, register an account, and create a game (it shows
under **My Games**; other users see it in **Explore**). If `npm run dev` or
`npm run build` fails with `Cannot find native binding`, see
[Troubleshooting](#troubleshooting): it is a known npm bug with a one-line fix.

The Google Maps key in `.env` is optional. Without it the map shows a
placeholder and games get no pin; everything else works.

### Stopping

Stop each dev server with `Ctrl+C`. Stop the database with
`docker compose stop` (from `backend/`). `docker compose down` removes the
container but keeps your data; add `-v` to delete the data as well.

## Configuration

Both `.env` files are gitignored. Copy the `.env.example` next to each one.

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` | Database connection (defaults match `docker-compose.yml`) |
| `backend/.env` | `DB_PASSWORD` | Database password (required, choose your own; generate it as shown in the quick start). `docker compose` uses it to create the database the first time it starts |
| `backend/.env` | `JWT_SECRET_KEY` | Signing key for login tokens (required, 32+ characters). Generate it as shown in the quick start; never commit it |
| `backend/.env` | `ACCESS_TOKEN_EXPIRE_MINUTES` | Login token lifetime (default 30) |
| `backend/.env` | `CORS_ORIGINS` | Comma-separated frontend origins the API accepts |
| `.env` | `VITE_API_URL` | Backend URL used by the frontend (`src/lib/api.ts`) |
| `.env` | `VITE_GOOGLE_MAPS_API_KEY` | Optional. Enables the map, pins and address lookup. The key is visible in the browser, so restrict it in Google Cloud (HTTP referrer `http://localhost:5173/*`; Maps JavaScript, Places (New) and Geocoding APIs) |
| `.env` | `VITE_GOOGLE_MAPS_MAP_ID` | Optional. Cloud-styled Map ID; defaults to Google's demo ID |

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

Run the backend tests from `backend/` with `python -m pytest`. They use the
local database from `docker compose`, so it must be running with migrations
applied.

### API summary

| Area | Endpoints |
| --- | --- |
| Accounts | `POST /api/auth/register`, `POST /api/auth/login`, `GET` / `PATCH /api/users/me` |
| Games | `GET` / `POST /api/games`, `GET` / `PATCH` / `DELETE /api/games/{id}` |
| Lobby | `POST /api/games/{id}/join`, `DELETE /api/games/{id}/participants/me`, `DELETE /api/games/{id}/participants/{user_id}` (organizer), `GET /api/games/{id}/players` |

Everything except register, login and the health check needs
`Authorization: Bearer <token>`. Only a game's organizer can edit it, delete it,
or remove players. Full details are in [backend/README.md](backend/README.md).

## Connecting the frontend to the API

[`src/lib/endpoints.ts`](src/lib/endpoints.ts) lists every endpoint path with
typed request and response shapes, an error helper, and a table of which
placeholder (`SEED_GAMES`, `CURRENT_USER`, the Create Post button, and so on)
each endpoint replaces. Use it together with `api()` from `src/lib/api.ts`.
The backend is the source of truth; keep `endpoints.ts` in sync with it.

Things the frontend model has to change to match the backend:

- Skill levels are `beginner`, `intermediate`, `advanced`.
- A game's `capacity` includes the organizer, who is on the roster automatically.
- Field names follow the backend (`game_id`, `game_name`, `start_time`, ...).
- Times must include a timezone offset.

## Troubleshooting

- **`Cannot find native binding` from `npm run dev`, `npm run build` or
  `npm run lint` on Windows (seen on a fresh clone):** npm skipped an optional native package (a known npm bug). Install
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
src/App.tsx             App shell: tabs, list, detail view, create/edit modal
src/types.ts            Sport and language catalogues
src/state/              Auth (AuthProvider) and game data (useGames)
src/lib/api.ts          Fetch wrapper (errors, sign-out on 401)
src/lib/endpoints.ts    Backend endpoint paths and request/response types
src/lib/                Auth, session, filters, form validation, dates, map helpers
src/components/         Feature components (AuthGate, GameCard, GameDetail, GameModal, map)
src/components/ui/      Button, Pill, Combobox, FillMeter, FilterMenu
backend/                FastAPI service, migrations, docker-compose.yml
docs/PROJECT_STATUS.md  How it works, what is done, what is left
```

Plain CSS Modules over the tokens in `src/index.css`. No UI framework.

## Not built yet

Frontend:

- Search, filter, and sort render but do nothing; the frontend still uses seed
  data and does not call the backend yet (see `src/lib/endpoints.ts`)
- No login, sign-up, or profile screens; Create Post does nothing
- The map is a placeholder illustration
- Desktop only (1440px)

Backend:

- Accounts, games, lobbies, filtering and sorting are done and tested
- Geocoding: the server stores latitude/longitude but does not look addresses
  up; the client sends them (for example from Google Places)
- Email notifications for cancelled or changed games are not implemented
- Ended games are deleted the next time the game list is read, not on a timer
