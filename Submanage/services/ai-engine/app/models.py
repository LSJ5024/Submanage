"""AI 엔진 SQLAlchemy 모델 (subscription_catalog 조회용)."""

import uuid
from datetime import datetime

from sqlalchemy import UUID, Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SubscriptionCatalog(Base):
    """
    구독 서비스 마스터 DB (Prisma로 관리, AI 엔진은 읽기 전용).

    Prisma 스키마의 subscription_catalog 테이블과 매핑.
    AI 엔진은 INSERT/UPDATE 없이 SELECT만 수행.
    """
    __tablename__ = "subscription_catalog"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service_name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    website_url: Mapped[str | None] = mapped_column(String, nullable=True)
    merchant_name_patterns: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
