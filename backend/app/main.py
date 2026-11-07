from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers.auth import router as auth_router
from app.routers.games import router as games_router
from app.routers.users import router as users_router

app = FastAPI(title="Pickup Game Coordinator API")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request,
    exc: RequestValidationError,
) -> JSONResponse:
    errors = [
        {
            "loc": error["loc"],
            "msg": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]

    return JSONResponse(
        status_code=422,
        content={"detail": errors},
    )


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(games_router)

# Allow the frontend (Vite dev server by default) to call the API from the
# browser. Configure the allowed origins with CORS_ORIGINS in backend/.env.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
