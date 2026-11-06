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