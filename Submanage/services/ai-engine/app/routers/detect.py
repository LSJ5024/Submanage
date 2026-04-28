"""구독 탐지 내부 API 라우터 (CLAUDE.md §4 — 외부 직접 노출 금지)."""

import time

from fastapi import APIRouter

from app.schemas import DetectRequest, DetectResponse
from app.services.normalizer import normalize_merchant_name
from app.services.pattern_analyzer import analyze_patterns

router = APIRouter()


@router.post("/detect", response_model=DetectResponse)
async def detect_subscriptions(request: DetectRequest) -> DetectResponse:
    """
    결제 내역을 분석해 구독 서비스를 탐지한다.

    내부 전용 엔드포인트 — API 서버(services/api)에서만 호출 가능.
    처리 성능 목표: 1,000건 기준 30초 이내 (PRD NFR-PERF).
    """
    start_time = time.monotonic()

    # 1단계: 가맹점명 정규화 (TASK-031)
    normalized = [
        normalize_merchant_name(tx.merchant_name_encrypted) for tx in request.transactions
    ]

    # 2단계: 반복 결제 패턴 분석 (TASK-032)
    detected = analyze_patterns(request.transactions, normalized)

    elapsed_ms = (time.monotonic() - start_time) * 1000

    return DetectResponse(
        detected=detected,
        processed_count=len(request.transactions),
        processing_time_ms=round(elapsed_ms, 2),
    )
