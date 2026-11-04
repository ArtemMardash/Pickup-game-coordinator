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
