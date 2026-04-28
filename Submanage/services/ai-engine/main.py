"""SubTrack AI Engine — 구독 탐지 FastAPI 서버."""

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from app.routers import detect
from app.config import settings
from app.database import check_connection

app = FastAPI(
    title="SubTrack AI Engine",
    description="구독 서비스 자동 탐지 내부 API (외부 직접 접근 금지)",
    version="1.0.0",
    # 내부 전용 서비스 — Swagger UI는 개발 환경에서만 노출
    docs_url="/docs" if settings.python_env == "development" else None,
    redoc_url=None,
)

# 내부 서비스 간 통신만 허용 (CLAUDE.md §4 AI 엔진 분리 원칙)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # API 서버만 허용
    allow_methods=["POST"],
    allow_headers=["*"],
)


async def verify_internal_secret(x_internal_secret: str = Header(...)) -> str:
    """API 서버 ↔ AI 엔진 내부 인증 검증."""
    if x_internal_secret != settings.internal_api_secret:
        raise HTTPException(status_code=403, detail="내부 시크릿이 올바르지 않습니다.")
    return x_internal_secret


app.include_router(
    detect.router,
    prefix="/internal",
    dependencies=[Depends(verify_internal_secret)],
)


@app.get("/health")
async def health() -> dict:
    """헬스 체크 엔드포인트 (DB 연결 상태 포함)."""
    db_ok = check_connection()
    return {
        "status":    "ok" if db_ok else "degraded",
        "database":  "connected" if db_ok else "disconnected",
    }
