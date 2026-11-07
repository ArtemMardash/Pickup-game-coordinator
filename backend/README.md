# Backend

FastAPI service for Pickup Game Coordinator. For the full-stack setup (database,
backend, and frontend together), see the [root README](../README.md).

## Getting started

Run from the `backend` directory. Local development uses Python 3.13 and
PostgreSQL 17 (via Docker).

```powershell
Copy-Item .env.example .env       # macOS/Linux: cp .env.example .env
docker compose up -d              # PostgreSQL on 127.0.0.1:5432
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
fastapi dev app/main.py
```

Runs at http://localhost:8000. Interactive docs at http://localhost:8000/docs.

| Command | Description |
| --- | --- |
| `fastapi dev app/main.py` | Dev server with auto-reload |
| `alembic upgrade head` | Apply database migrations |
| `alembic check` | Verify models and migrations are in sync |
| `pytest` | Run tests |
| `docker compose stop` | Stop the database (data is kept) |

Use the `alembic` command directly. `python -m alembic` does not work.

## Configuration

Settings are read from `backend/.env` (see `.env.example`). Never commit `.env`.

| Variable | Default | Description |
| --- | --- | --- |
| `DB_HOST` | `127.0.0.1` | Database host. Prefer the IP over `localhost`, which can resolve to IPv6 and hang against Docker's IPv4-only port |
| `DB_PORT` | `5432` | Database port (also the host port Docker publishes) |
| `DB_NAME` | `pug` | Database name |
| `DB_USER` | `pug_app` | Database login |
| `DB_PASSWORD` | none (required) | Database password. The example value is dev-only |
| `JWT_SECRET_KEY` | none (required) | Signing key, at least 32 characters (see "Login" below) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | JWT lifetime |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated frontend origins |

`docker compose` creates the `pug_app` login and the `pug` database from these
values the first time it starts. The password is only applied at that point; if
you change it later, either update it inside Postgres or reset with
`docker compose down -v` (deletes local data).

Using your own PostgreSQL instead of Docker: create a login named `pug_app`
and a database named `pug` owned by that login, and put its credentials in
`.env`.

## Structure

```
app/main.py            FastAPI app, CORS, routers
app/config.py          Settings loaded from .env
app/database.py        Engine, session, Base, get_db
app/deps.py            get_current_user / CurrentUser
app/models/            User, Game, GameParticipant
app/routers/           auth, users, games
app/schemas/           Request / response models
alembic/               Migrations
docker-compose.yml     Local PostgreSQL
tests/                 pytest tests
```

## Migrations

Database models share `Base` from `app.database`. Routes use `get_db` from the
same module to obtain a database session.

Import new models in `alembic/env.py` before generating migrations:

```powershell
alembic revision --autogenerate -m "Describe the schema change"
```

Review the generated migration before applying it:

```powershell
alembic upgrade head
alembic check
pytest
```

The users table stores a UUID, username, email, password hash,
non-critical notification preference, and creation timestamp.
Usernames and emails are case-insensitively unique.

Temporary login lockout is excluded from the MVP.

## Registration

`POST /api/auth/register` accepts JSON:

```json
{
  "username": "example_player",
  "email": "player@example.com",
  "password": "ExamplePass123!"
}
```

- Username: 3–50 characters after trimming surrounding whitespace.
- Email: valid format, up to 254 characters.
- Password: at least 8 characters and no more than 72 UTF-8 bytes.
- Usernames and emails are case-insensitively unique.
- Passwords are hashed with bcrypt.

Responses:
- `201`: account created; returns ID, username, email, notification
  preference, and creation timestamp.
- `409`: username or email already in use.
- `422`: invalid input.

Responses exclude passwords and password hashes. Validation errors omit
submitted input values. Registration does not log the user in.

### Tests

With PostgreSQL running, `.env` configured, and migrations applied:

```powershell
python -m pytest -v
```

Registration tests use the configured local database and roll back their
changes after each test.

## Login and authenticated requests

Configure these values in your local `.env`:

```dotenv
JWT_SECRET_KEY=your-generated-secret
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Generate a signing key with:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Never commit the signing key. Each developer uses their own local key.

### Login

`POST /api/auth/login` accepts JSON:

```json
{
  "email": "player@example.com",
  "password": "ExamplePass123!"
}
```

Successful login returns `200` with:
- `access_token`: signed JWT
- `token_type`: `bearer`
- `expires_in`: token lifetime in seconds

Email matching is case-insensitive. Incorrect credentials return `401`.
Temporary login lockout is excluded from the MVP.

### Current profile

`GET /api/users/me` requires:

```http
Authorization: Bearer <access_token>
```

Returns the authenticated user's profile without a password or hash.
Missing, invalid, or expired tokens return `401`.

In Swagger's Authorize dialog, paste only the token value.

### Backend integration

Protected routes can import `CurrentUser` from `app.deps` and declare
a `current_user: CurrentUser` parameter. This provides the authenticated
User model; `current_user.id` is its UUID.

Game routes must separately enforce ownership and participation rules.

### Logout behavior

The client logs out by clearing its token and stopping authenticated
requests. Previously issued tokens remain valid until expiration;
server-side token revocation and refresh tokens are not implemented.

## Games

All game endpoints require `Authorization: Bearer <token>`.

| Method and path | Who | Description |
| --- | --- | --- |
| `GET /api/games` | any user | Upcoming and in-progress games (list and map share this query) |
| `POST /api/games` | any user | Create a game; the creator becomes the organizer and is added to the roster |
| `GET /api/games/{id}` | any user | Game details with participants |
| `PATCH /api/games/{id}` | organizer | Edit; only the fields sent change |
| `DELETE /api/games/{id}` | organizer | Cancel / end the game; the roster is deleted with it |
| `POST /api/games/{id}/join` | any user | Take a spot |
| `DELETE /api/games/{id}/participants/me` | player | Leave (the organizer cannot leave; delete the game instead) |
| `DELETE /api/games/{id}/participants/{user_id}` | organizer | Remove another player |
| `GET /api/games/{id}/players` | any user | Roster |

Rules: a game lasts at most 6 hours, `end_time` must be after `start_time` and
in the future, timestamps need a timezone offset, and `capacity` (which includes
the organizer) can never be lower than the players already joined. Joining locks
the game row (`SELECT ... FOR UPDATE`), so when two people tap Join for the last
spot exactly one gets in.

`GET /api/games` query parameters (every selected filter must match; repeat a
parameter to allow several values, e.g. `skill_level=beginner&skill_level=advanced`):
`game_name`, `skill_level`, `language`, `q` (text in the location),
`lat` + `lng` + `radius_km` (distance; needs all three), `is_online`,
`has_spots`, `joined` (only my games), `sort` (`start_time` default, `game_name`,
`skill_level`), `limit`, `offset`. Ties are broken by start time, then id.
Ended games are never returned and are deleted the next time the list is read.

Errors look like `{"detail": {"status": "error", "reason": "gameFull", "message": "..."}}`.
Reasons: `gameNotFound` (404), `gameTerminated` (410), `notOrganizer` (403),
`invalidGameDetails` / `invalidFilter` (422), `gameFull`, `alreadyJoined`,
`notJoined`, `organizerCannotLeave` (409). Request validation errors from
FastAPI itself (wrong types, missing fields) use the standard 422 `detail` list.

Coordinates (`latitude`, `longitude`) are optional on create and are sent by the
client (e.g. from Google Places). Changing `location` without new coordinates
clears the old ones so the pin never points at the wrong place.

## Profile updates and notification preferences

`PATCH /api/users/me` requires a bearer token and accepts either or both:

```json
{
  "email": "updated@example.com",
  "notify_non_critical": false
}
```

- Only the authenticated account is updated.
- Omitted fields remain unchanged.
- Email changes preserve the account UUID.
- Existing tokens remain valid; future logins use the updated email.
- Notification preferences require JSON booleans (`true` or `false`).
- Empty updates, null values, and unsupported fields return `422`.
- An email belonging to another account returns `409`, with neither
  field changed.
- Successful updates return `200` with the updated profile.

The notification preference applies to optional notifications.
Critical cancellation, time-change, and location-change emails will
remain mandatory when the email service is implemented.
