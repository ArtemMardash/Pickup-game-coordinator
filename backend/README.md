# Backend

FastAPI service for Pickup Game Coordinator.

## Getting started

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
fastapi dev app/main.py
```

Runs at http://localhost:8000. Interactive docs at http://localhost:8000/docs.

| Command | Description |
| --- | --- |
| `fastapi dev app/main.py` | Dev server with auto-reload |
| `pytest` | Run tests |

## Structure

```
app/main.py    FastAPI app, CORS, routes
tests/         pytest tests
```
## Database setup

Local development uses Python 3.13 and PostgreSQL 17.

Create a PostgreSQL login named `pug_app` and a database named `pug`
owned by that login. Each developer uses their own local password.

From the `backend` directory, copy the environment template:

```powershell
Copy-Item .env.example .env
```

Fill in `DB_PASSWORD` in `.env` with your local application's database
password. Never commit `.env`.

With the virtual environment activated, install dependencies and apply
existing migrations:

```powershell
python -m pip install -r requirements-dev.txt
python -m alembic upgrade head
```

Database models share `Base` from `app.database`. Routes use `get_db`
from the same module to obtain a database session.

Import new models in `alembic/env.py` before generating migrations:

```powershell
python -m alembic revision --autogenerate -m "Describe the schema change"
```

Review the generated migration before applying it:

```powershell
python -m alembic upgrade head
python -m alembic check
python -m pytest
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