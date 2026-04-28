"""AI 엔진 PostgreSQL 연결 설정 (SQLAlchemy)."""

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


# ── 엔진 생성 ──────────────────────────────────────────────────────────────
engine = create_engine(
    settings.database_url,
    pool_size=5,           # 커넥션 풀 기본 크기
    max_overflow=10,       # 최대 추가 커넥션
    pool_pre_ping=True,    # 커넥션 유효성 사전 확인
    pool_recycle=3600,     # 1시간마다 커넥션 재생성
    echo=(settings.python_env == "development"),  # 개발 환경에서만 SQL 로깅
)

# ── 세션 팩토리 ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Base 모델 ─────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """SQLAlchemy 모든 모델의 기반 클래스."""
    pass


# ── 세션 의존성 (FastAPI Depends 사용) ───────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """
    FastAPI 라우터에서 DB 세션을 주입받기 위한 의존성 함수.

    Usage:
        @router.get("/items")
        def get_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """일반 함수에서 컨텍스트 매니저로 사용."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_connection() -> bool:
    """DB 연결 상태 확인 (헬스 체크용)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
