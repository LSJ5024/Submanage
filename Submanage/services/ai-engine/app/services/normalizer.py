"""가맹점명 정규화 모듈 (TASK-031)."""

import re
from typing import Optional

# 구독 서비스 가맹점명 정규화 사전 (TASK-031)
MERCHANT_NAME_DICT: dict[str, str] = {
    # 영상 스트리밍
    "netflix": "Netflix",
    "netflix.com": "Netflix",
    "넷플릭스": "Netflix",
    "netflix korea": "Netflix",
    "youtube premium": "YouTube Premium",
    "유튜브 프리미엄": "YouTube Premium",
    "wavve": "Wavve",
    "웨이브": "Wavve",
    "tving": "Tving",
    "티빙": "Tving",
    "coupang play": "Coupang Play",
    "쿠팡플레이": "Coupang Play",
    # 음악
    "spotify": "Spotify",
    "스포티파이": "Spotify",
    "apple music": "Apple Music",
    "melon": "Melon",
    "멜론": "Melon",
    "genie": "Genie Music",
    "지니": "Genie Music",
    # 멤버십
    "apple one": "Apple One",
    "naver plus": "Naver Plus",
    "네이버플러스": "Naver Plus",
    "kakao": "Kakao 이용권",
    # 소프트웨어
    "adobe": "Adobe CC",
    "adobe creative cloud": "Adobe CC",
    "microsoft 365": "Microsoft 365",
    "ms365": "Microsoft 365",
    "notion": "Notion",
    "slack": "Slack",
    "github": "GitHub",
}


def normalize_merchant_name(raw_name: str) -> str:
    """
    Normalize a raw merchant name to a canonical service name.

    Args:
        raw_name: 원본 가맹점명 (암호화 해제 후 전달됨)

    Returns:
        정규화된 서비스명. 사전에 없으면 원본 정리 버전 반환.
    """
    cleaned = _clean(raw_name)
    lookup = cleaned.lower()

    # 정확 매칭
    if lookup in MERCHANT_NAME_DICT:
        return MERCHANT_NAME_DICT[lookup]

    # 부분 매칭
    for key, value in MERCHANT_NAME_DICT.items():
        if key in lookup:
            return value

    return cleaned


def is_known_subscription(normalized_name: str) -> bool:
    """정규화된 이름이 알려진 구독 서비스인지 확인."""
    return normalized_name in MERCHANT_NAME_DICT.values()


def _clean(name: str) -> Optional[str]:
    """불필요한 문자, 과도한 공백, 도메인 접미사 제거."""
    cleaned = re.sub(r'\s+', ' ', name).strip()
    cleaned = re.sub(r'\.(com|co\.kr|net|io)$', '', cleaned, flags=re.IGNORECASE)
    return cleaned
