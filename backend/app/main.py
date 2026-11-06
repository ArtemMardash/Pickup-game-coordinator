from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.routers.auth import router as auth_router

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
# Allow the Vite dev server (npm run dev) to call the API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
