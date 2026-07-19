from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import diagnosis

app = FastAPI(title="AI 홈트 코치 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(diagnosis.router)


@app.get("/")
def health():
    return {"status": "ok"}