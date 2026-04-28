"""가맹점명 정규화 모듈 단위 테스트 (TASK-031)."""

import pytest

from app.services.normalizer import normalize_merchant_name, is_known_subscription


class TestNormalizeMerchantName:
    def test_exact_match_english(self) -> None:
        assert normalize_merchant_name("netflix") == "Netflix"

    def test_exact_match_korean(self) -> None:
        assert normalize_merchant_name("넷플릭스") == "Netflix"

    def test_domain_suffix_removed(self) -> None:
        assert normalize_merchant_name("NETFLIX.COM") == "Netflix"

    def test_case_insensitive(self) -> None:
        assert normalize_merchant_name("SPOTIFY") == "Spotify"

    def test_unknown_merchant_returns_cleaned_name(self) -> None:
        result = normalize_merchant_name("MY CUSTOM STORE")
        assert result == "MY CUSTOM STORE"

    def test_partial_match(self) -> None:
        assert normalize_merchant_name("adobe creative cloud korea") == "Adobe CC"

    def test_extra_whitespace_cleaned(self) -> None:
        result = normalize_merchant_name("  netflix  ")
        assert result == "Netflix"


class TestIsKnownSubscription:
    def test_known_service(self) -> None:
        assert is_known_subscription("Netflix") is True

    def test_unknown_service(self) -> None:
        assert is_known_subscription("알 수 없는 서비스") is False
