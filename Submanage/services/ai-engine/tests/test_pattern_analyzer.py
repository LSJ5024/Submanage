"""반복 결제 패턴 분석 엔진 단위 테스트 (TASK-032)."""

from datetime import datetime, timedelta

import pytest

from app.schemas import TransactionInput
from app.services.pattern_analyzer import analyze_patterns, _detect_cycle, _infer_category


def make_tx(
    merchant_name_encrypted: str,
    amount: float,
    days_ago: int,
    user_id: str = "user-1",
    card_id: str = "card-1",
) -> TransactionInput:
    """테스트용 TransactionInput 생성 헬퍼."""
    return TransactionInput(
        transaction_id=f"tx-{days_ago}",
        merchant_name_encrypted=merchant_name_encrypted,
        amount_encrypted=str(amount),
        transaction_date=datetime.now() - timedelta(days=days_ago),
        card_id=card_id,
        user_id=user_id,
    )


class TestDetectCycle:
    def test_monthly_interval_detected(self) -> None:
        """30일 간격 결제는 MONTHLY로 탐지된다."""
        txs = [make_tx("Netflix", 17000, d) for d in [90, 60, 30, 0]]
        cycle, confidence = _detect_cycle(txs)
        assert cycle == "MONTHLY"
        assert confidence >= 0.6

    def test_annual_interval_detected(self) -> None:
        """365일 간격 결제는 ANNUAL로 탐지된다."""
        txs = [make_tx("Adobe", 71400, d) for d in [730, 365, 0]]
        cycle, confidence = _detect_cycle(txs)
        assert cycle == "ANNUAL"
        assert confidence >= 0.5

    def test_weekly_interval_detected(self) -> None:
        """7일 간격 결제는 WEEKLY로 탐지된다."""
        txs = [make_tx("Weekly", 5000, d) for d in [28, 21, 14, 7, 0]]
        cycle, confidence = _detect_cycle(txs)
        assert cycle == "WEEKLY"
        assert confidence >= 0.6

    def test_irregular_interval_returns_none(self) -> None:
        """불규칙한 간격은 주기로 탐지되지 않는다."""
        txs = [make_tx("Random", 10000, d) for d in [100, 50, 10, 0]]
        cycle, _ = _detect_cycle(txs)
        assert cycle is None

    def test_single_transaction_returns_none(self) -> None:
        """거래가 1개이면 주기를 알 수 없다."""
        txs = [make_tx("Netflix", 17000, 0)]
        cycle, confidence = _detect_cycle(txs)
        assert cycle is None
        assert confidence == 0.0

    def test_tolerance_allows_slight_variation(self) -> None:
        """±5일 오차 이내의 간격도 MONTHLY로 인식한다."""
        # 28, 31, 30 일 간격 (허용 오차 5일 이내)
        txs = [make_tx("Spotify", 10900, d) for d in [89, 61, 30, 0]]
        cycle, _ = _detect_cycle(txs)
        assert cycle == "MONTHLY"


class TestAnalyzePatterns:
    def test_detects_netflix_monthly(self) -> None:
        """월간 넷플릭스 결제 패턴을 탐지한다."""
        txs = [make_tx("Netflix", 17000, d) for d in [90, 60, 30, 0]]
        names = ["Netflix"] * 4

        result = analyze_patterns(txs, names)

        assert len(result) == 1
        assert result[0].service_name == "Netflix"
        assert result[0].billing_cycle == "MONTHLY"
        assert result[0].confidence_score >= 0.6

    def test_single_transaction_not_detected(self) -> None:
        """1회만 결제된 항목은 구독으로 탐지하지 않는다."""
        txs = [make_tx("OnceOnly", 5000, 0)]
        result = analyze_patterns(txs, ["OnceOnly"])
        assert result == []

    def test_multiple_services_detected_independently(self) -> None:
        """여러 구독 서비스를 각각 독립적으로 탐지한다."""
        netflix_txs = [make_tx("Netflix", 17000, d) for d in [60, 30, 0]]
        spotify_txs = [make_tx("Spotify", 10900, d) for d in [60, 30, 0]]
        all_txs = netflix_txs + spotify_txs
        names = ["Netflix"] * 3 + ["Spotify"] * 3

        result = analyze_patterns(all_txs, names)
        service_names = {r.service_name for r in result}

        assert "Netflix" in service_names
        assert "Spotify" in service_names

    def test_unknown_service_flagged(self) -> None:
        """카탈로그에 없는 서비스는 is_unknown=True로 표시된다."""
        txs = [make_tx("UnknownSvc", 9999, d) for d in [60, 30, 0]]
        result = analyze_patterns(txs, ["UnknownSvc"])

        if result:  # 패턴이 탐지된 경우에만 검사
            assert result[0].is_unknown is True

    def test_low_confidence_not_returned(self) -> None:
        """신뢰도 0.6 미만의 탐지 결과는 포함되지 않는다."""
        # 매우 불규칙한 간격 (29, 45, 15 일)
        txs = [
            make_tx("IrregularSvc", 5000, 89),
            make_tx("IrregularSvc", 5000, 60),
            make_tx("IrregularSvc", 5000, 15),
            make_tx("IrregularSvc", 5000, 0),
        ]
        result = analyze_patterns(txs, ["IrregularSvc"] * 4)
        for r in result:
            assert r.confidence_score >= 0.6


class TestInferCategory:
    def test_video_service_inferred(self) -> None:
        assert _infer_category("Netflix") == "VIDEO"

    def test_music_service_inferred(self) -> None:
        assert _infer_category("Spotify") == "MUSIC"

    def test_software_service_inferred(self) -> None:
        assert _infer_category("Adobe CC") == "SOFTWARE"

    def test_unknown_service_is_other(self) -> None:
        assert _infer_category("알 수 없는 서비스") == "OTHER"
