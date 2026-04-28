"""구독 카탈로그 조회 Repository (AI 엔진 읽기 전용)."""

from typing import Optional

from sqlalchemy.orm import Session

from app.models import SubscriptionCatalog


class CatalogRepository:
    """
    Subscription catalog read-only repository for AI engine.

    DB에서 구독 카탈로그를 조회해 가맹점명 정규화에 활용.
    """

    def __init__(self, db: Session) -> None:
        self._db = db

    def find_by_service_name(self, service_name: str) -> Optional[SubscriptionCatalog]:
        """정확한 서비스명으로 카탈로그 조회."""
        return (
            self._db.query(SubscriptionCatalog)
            .filter(SubscriptionCatalog.service_name == service_name)
            .first()
        )

    def find_by_merchant_pattern(self, merchant_name: str) -> Optional[SubscriptionCatalog]:
        """
        가맹점명 패턴으로 카탈로그 조회.
        merchant_name_patterns 배열에 포함된 항목과 매칭.
        """
        normalized = merchant_name.upper()
        catalogs = self._db.query(SubscriptionCatalog).all()

        for catalog in catalogs:
            for pattern in (catalog.merchant_name_patterns or []):
                if pattern.upper() in normalized or normalized in pattern.upper():
                    return catalog
        return None

    def get_all_patterns(self) -> dict[str, str]:
        """
        전체 가맹점 패턴 → 서비스명 매핑 딕셔너리 반환.
        normalizer.py의 MERCHANT_NAME_DICT를 DB 기반으로 대체할 때 사용.
        """
        catalogs = self._db.query(SubscriptionCatalog).all()
        result: dict[str, str] = {}
        for catalog in catalogs:
            for pattern in (catalog.merchant_name_patterns or []):
                result[pattern.lower()] = catalog.service_name
        return result

    def find_catalog_id_by_service(self, service_name: str) -> Optional[str]:
        """서비스명으로 catalog_id 조회 (탐지 결과에 포함용)."""
        catalog = self.find_by_service_name(service_name)
        return str(catalog.id) if catalog else None
