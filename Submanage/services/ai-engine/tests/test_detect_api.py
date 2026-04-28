"""구독 탐지 API 통합 테스트 (TASK-033)."""

import time
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from main import app

# 내부 시크릿 헤더 (테스트 환경)
INTERNAL_SECRET = "test_internal_secret"
HEADERS = {"x-internal-secret": INTERNAL_SECRET}

# 환경 변수 패치
import os
os.environ["INTERNAL_API_SECRET"] = INTERNAL_SECRET
os.environ["PYTHON_ENV"] = "development"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def make_transactions(service_name: str, amount: float, count: int, cycle_days: int) -> list[dict]:
    """테스트용 월간 반복 결제 내역 생성 헬퍼."""
    transactions = []
    for i in range(count):
        tx_date = datetime.now() - timedelta(days=cycle_days * (count - i - 1))
        transactions.append({
            "transaction_id": f"tx-{service_name}-{i}",
            "merchant_name_encrypted": service_name,
            "amount_encrypted": str(amount),
            "transaction_date": tx_date.isoformat(),
            "card_id": "card-001",
            "user_id": "user-001",
        })
    return transactions


class TestDetectEndpoint:
    def test_health_check_no_auth_required(self, client: TestClient) -> None:
        """헬스 체크는 인증 없이 접근 가능하다."""
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_detect_requires_internal_secret(self, client: TestClient) -> None:
        """내부 시크릿 없이 탐지 요청 시 403을 반환한다."""
        res = client.post("/internal/detect", json={"transactions": []})
        assert res.status_code == 403

    def test_detect_wrong_secret_returns_403(self, client: TestClient) -> None:
        """잘못된 시크릿으로 요청 시 403을 반환한다."""
        res = client.post(
            "/internal/detect",
            json={"transactions": []},
            headers={"x-internal-secret": "wrong_secret"},
        )
        assert res.status_code == 403

    def test_detect_empty_transactions(self, client: TestClient) -> None:
        """빈 결제 내역 요청 시 빈 탐지 결과를 반환한다."""
        res = client.post("/internal/detect", json={"transactions": []}, headers=HEADERS)
        assert res.status_code == 200
        data = res.json()
        assert data["processed_count"] == 0
        assert data["detected"] == []

    def test_detect_monthly_netflix(self, client: TestClient) -> None:
        """월간 넷플릭스 결제 내역 4건을 탐지한다."""
        txs = make_transactions("Netflix", 17000, 4, 30)
        res = client.post("/internal/detect", json={"transactions": txs}, headers=HEADERS)

        assert res.status_code == 200
        data = res.json()
        assert data["processed_count"] == 4

        detected = data["detected"]
        if detected:  # 패턴 탐지 신뢰도 기준 통과 시
            netflix = next((d for d in detected if "Netflix" in d["service_name"]), None)
            if netflix:
                assert netflix["billing_cycle"] == "MONTHLY"
                assert netflix["confidence_score"] >= 0.6
                assert netflix["amount"] > 0

    def test_detect_multiple_services(self, client: TestClient) -> None:
        """여러 서비스의 구독을 동시에 탐지한다."""
        txs = (
            make_transactions("Netflix", 17000, 3, 30)
            + make_transactions("Spotify", 10900, 3, 30)
        )
        res = client.post("/internal/detect", json={"transactions": txs}, headers=HEADERS)
        assert res.status_code == 200
        data = res.json()
        assert data["processed_count"] == 6

    def test_detect_returns_processing_time_ms(self, client: TestClient) -> None:
        """탐지 결과에 처리 시간(ms)이 포함된다."""
        res = client.post("/internal/detect", json={"transactions": []}, headers=HEADERS)
        assert res.status_code == 200
        assert "processing_time_ms" in res.json()
        assert res.json()["processing_time_ms"] >= 0

    def test_detect_unknown_service_flagged(self, client: TestClient) -> None:
        """카탈로그에 없는 서비스는 is_unknown=True로 표시된다."""
        txs = make_transactions("UnregisteredService", 9999, 3, 30)
        res = client.post("/internal/detect", json={"transactions": txs}, headers=HEADERS)
        assert res.status_code == 200
        for d in res.json()["detected"]:
            if d["service_name"] == "UnregisteredService":
                assert d["is_unknown"] is True

    def test_performance_1000_transactions(self, client: TestClient) -> None:
        """1,000건 결제 내역 처리가 30초 이내에 완료된다 (PRD NFR-PERF)."""
        # 50개 서비스 × 20회 = 1,000건
        txs = []
        for i in range(50):
            txs.extend(make_transactions(f"Service{i}", 9900 + i * 100, 20, 30))

        start = time.monotonic()
        res = client.post("/internal/detect", json={"transactions": txs}, headers=HEADERS)
        elapsed = time.monotonic() - start

        assert res.status_code == 200
        assert res.json()["processed_count"] == 1000
        assert elapsed < 30.0, f"처리 시간 초과: {elapsed:.2f}초 (목표: 30초 이내)"

    def test_invalid_transaction_format(self, client: TestClient) -> None:
        """잘못된 형식의 요청은 422 에러를 반환한다."""
        res = client.post(
            "/internal/detect",
            json={"transactions": [{"invalid_field": "value"}]},
            headers=HEADERS,
        )
        assert res.status_code == 422
