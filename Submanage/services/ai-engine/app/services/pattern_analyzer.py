"""반복 결제 패턴 분석 엔진 (TASK-032)."""

from collections import defaultdict
from datetime import timedelta
from typing import Any

from app.schemas import DetectedSubscription, TransactionInput
from app.services.normalizer import is_known_subscription


# 금액 허용 오차율 (환율, 부가세 변동 고려)
AMOUNT_TOLERANCE_RATE = 0.05

# 주기별 허용 일수 오차
BILLING_CYCLE_TOLERANCE_DAYS = 5

CYCLE_DEFINITIONS = {
    "WEEKLY": 7,
    "MONTHLY": 30,
    "QUARTERLY": 90,
    "SEMI_ANNUAL": 180,
    "ANNUAL": 365,
}


def analyze_patterns(
    transactions: list[TransactionInput],
    normalized_names: list[str],
) -> list[DetectedSubscription]:
    """
    Analyze payment patterns to detect recurring subscriptions.

    Args:
        transactions: 결제 내역 목록
        normalized_names: 정규화된 가맹점명 목록 (transactions와 인덱스 대응)

    Returns:
        탐지된 구독 목록
    """
    # 가맹점명별로 결제 내역 그룹화
    groups: dict[str, list[Any]] = defaultdict(list)
    for tx, name in zip(transactions, normalized_names):
        groups[name].append(tx)

    detected: list[DetectedSubscription] = []

    for service_name, txs in groups.items():
        if len(txs) < 2:
            continue  # 최소 2회 이상 결제된 경우만 분석

        txs_sorted = sorted(txs, key=lambda t: t.transaction_date)
        cycle, confidence = _detect_cycle(txs_sorted)

        if cycle and confidence >= 0.6:
            detected.append(
                DetectedSubscription(
                    service_name=service_name,
                    category=_infer_category(service_name),
                    amount=_median_amount(txs_sorted),
                    billing_cycle=cycle,
                    confidence_score=round(confidence, 3),
                    is_unknown=not is_known_subscription(service_name),
                )
            )

    return detected


def _detect_cycle(
    txs: list[Any],
) -> tuple[str | None, float]:
    """결제 간격을 분석해 반복 주기와 신뢰도를 반환."""
    if len(txs) < 2:
        return None, 0.0

    intervals: list[int] = []
    for i in range(1, len(txs)):
        delta: timedelta = txs[i].transaction_date - txs[i - 1].transaction_date
        intervals.append(abs(delta.days))

    avg_interval = sum(intervals) / len(intervals)

    for cycle_name, expected_days in CYCLE_DEFINITIONS.items():
        if abs(avg_interval - expected_days) <= BILLING_CYCLE_TOLERANCE_DAYS:
            # 일관성 점수: 간격 편차가 작을수록 신뢰도 높음
            variance = sum((d - avg_interval) ** 2 for d in intervals) / len(intervals)
            confidence = max(0.0, 1.0 - (variance / (expected_days ** 2)) * 10)
            return cycle_name, min(confidence, 1.0)

    return None, 0.0


def _median_amount(txs: list[Any]) -> float:
    """결제 금액 중앙값 반환 (환율 변동 고려)."""
    amounts = sorted(float(tx.amount_encrypted) for tx in txs if tx.amount_encrypted.replace('.', '').isdigit())
    if not amounts:
        return 0.0
    mid = len(amounts) // 2
    return amounts[mid] if len(amounts) % 2 else (amounts[mid - 1] + amounts[mid]) / 2


def _infer_category(service_name: str) -> str:
    """서비스명 기반 카테고리 추론."""
    video_services = {"Netflix", "YouTube Premium", "Wavve", "Tving", "Coupang Play"}
    music_services = {"Spotify", "Apple Music", "Melon", "Genie Music"}
    software_services = {"Adobe CC", "Microsoft 365", "Notion", "GitHub", "Slack"}

    if service_name in video_services:
        return "VIDEO"
    if service_name in music_services:
        return "MUSIC"
    if service_name in software_services:
        return "SOFTWARE"
    return "OTHER"
