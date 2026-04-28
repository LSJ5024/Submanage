"""AI 엔진 요청/응답 스키마."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TransactionInput(BaseModel):
    """결제 내역 입력 스키마."""

    transaction_id: str
    merchant_name_encrypted: str  # AES-256 암호화된 가맹점명
    amount_encrypted: str  # AES-256 암호화된 금액
    transaction_date: datetime
    card_id: str
    user_id: str


class DetectRequest(BaseModel):
    """구독 탐지 요청 스키마."""

    transactions: list[TransactionInput]


class DetectedSubscription(BaseModel):
    """탐지된 구독 결과 스키마."""

    service_name: str
    category: str
    amount: float
    currency: str = "KRW"
    billing_cycle: str
    confidence_score: float  # 0.0 ~ 1.0
    catalog_id: Optional[str] = None
    is_unknown: bool = False  # 카탈로그 미등록 서비스


class DetectResponse(BaseModel):
    """구독 탐지 응답 스키마."""

    detected: list[DetectedSubscription]
    processed_count: int
    processing_time_ms: float
