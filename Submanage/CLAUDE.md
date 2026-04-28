# CLAUDE.md — SubTrack 프로젝트 가이드

> 이 파일은 Claude Code가 SubTrack 코드베이스를 올바르게 이해하고 작업할 수 있도록 작성된 프로젝트 규칙서입니다.

---

## 1. 프로젝트 개요

**SubTrack**은 사용자의 카드 결제 내역을 분석해 구독 서비스를 자동 탐지하고, 결제 D-3 알림 및 원클릭 해지 안내를 제공하는 **구독 통합 관리 플랫폼**입니다.

- **슬로건:** 내 구독, 한눈에. 쉽게 관리.
- **MVP 목표:** 개발 착수 후 6개월 내 출시
- **현재 문서 버전:** PRD v1.0 (초안)

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| 모바일 | React Native (iOS 15.0+ / Android 10.0+) |
| 웹 | React.js |
| API 서버 | Node.js (Express) + TypeScript |
| AI 탐지 엔진 | Python (FastAPI) |
| 주 데이터베이스 | PostgreSQL |
| 캐시 / 세션 | Redis |
| 클라우드 | AWS (EC2, RDS, S3, SES, Lambda) |
| 푸시 알림 | Firebase Cloud Messaging (Android), APNs (iOS) |
| SMS | Twilio |
| 이메일 | AWS SES |
| 외부 금융 연동 | 마이데이터 API (금융위원회) |

---

## 3. 디렉토리 구조

```
subtrack/
├── apps/
│   ├── mobile/          # React Native 앱 (iOS / Android 공용)
│   └── web/             # React.js 웹 클라이언트
├── services/
│   ├── api/             # Node.js Express API 서버 (메인 백엔드)
│   └── ai-engine/       # Python FastAPI — 구독 탐지 AI 엔진
├── infra/               # AWS CDK / Terraform IaC 코드
├── packages/
│   └── shared/          # 공용 타입 정의, 유틸리티 (모노레포 공유)
└── docs/                # 기획서, ERD, API 명세 등 문서
```

---

## 4. 아키텍처 원칙

### 레이어 구조 (Node.js API 서버)
반드시 아래 레이어 순서를 준수하세요. 레이어를 건너뛰는 직접 호출은 금지합니다.

```
Router → Controller → Service → Repository → DB
```

- **Controller:** 요청/응답 처리, 입력값 유효성 검증만 담당
- **Service:** 핵심 비즈니스 로직 처리
- **Repository:** DB 쿼리만 담당 (비즈니스 로직 포함 금지)

### AI 엔진 분리 원칙
- 구독 탐지 AI 로직은 **반드시 `services/ai-engine` (FastAPI) 내에서만** 처리합니다.
- API 서버(`services/api`)는 AI 엔진을 내부 HTTP 호출로만 사용합니다.
- AI 엔진에 직접 외부 요청이 오도록 라우팅하지 마세요.

---

## 5. 코딩 컨벤션

### TypeScript (Node.js / React / React Native)
- 린터: **ESLint** (`.eslintrc` 설정 파일 준수)
- 포매터: **Prettier**
- 네이밍:
  - 변수 / 함수: `camelCase`
  - 클래스 / 타입 / 인터페이스: `PascalCase`
  - 상수: `UPPER_SNAKE_CASE`
  - DB 컬럼 매핑 객체: `snake_case` (DB 원형 유지)
- `any` 타입 사용 금지 — 반드시 명시적 타입 정의
- 비동기 처리: `async/await` 사용 (`Promise.then` 체이닝 지양)

### Python (FastAPI AI 엔진)
- 포매터: **Black**
- 린터: **Flake8**
- 네이밍: PEP 8 준수 (`snake_case`)
- 타입 힌트 필수 (`def func(x: int) -> str:`)

### 주석 언어
- 코드 인라인 주석: **한국어** 사용
- 함수/클래스 docstring: **영어** 사용 (외부 라이브러리 호환성 고려)

### Import 순서 (TypeScript)
```typescript
// 1. Node.js 내장 모듈
// 2. 외부 라이브러리 (node_modules)
// 3. 내부 공용 패키지 (@subtrack/shared)
// 4. 현재 서비스 내부 모듈 (상대 경로)
```

---

## 6. 데이터베이스 규칙

- **ORM:** Prisma (Node.js), SQLAlchemy (Python)
- **마이그레이션:** Prisma Migrate — 직접 SQL로 스키마 변경 금지
- **테이블명:** `snake_case` 복수형 (예: `users`, `subscriptions`)
- **PK:** 모든 테이블은 `UUID` 사용 (`id UUID PRIMARY KEY`)
- **Timestamp:** 모든 테이블에 `created_at`, `updated_at` 필드 포함
- **소프트 삭제:** 민감 데이터(User, Subscription)는 `deleted_at` 컬럼으로 소프트 삭제 처리 — `DELETE` 쿼리 직접 실행 금지
- **금융 데이터:** `transactions` 테이블의 가맹점명, 금액 관련 필드는 AES-256 암호화 후 저장 (아래 보안 섹션 참고)

---

## 7. ⚠️ 보안 필수 사항 (반드시 준수)

### 암호화
- **금융 데이터 (카드 내역, 가맹점명):** AES-256 양방향 암호화 저장 필수
- **비밀번호:** bcrypt 해시 저장, Salt rounds **12 이상**
- **마이데이터 Access Token / Refresh Token:** Redis에 암호화 저장, 만료 시 자동 삭제
- **통신:** HTTPS 전 구간 필수 (TLS 1.3)

### 로그 출력 절대 금지 항목
아래 데이터는 어떤 로그에도 절대 출력하지 마세요.

```
- 마이데이터 Access Token / Refresh Token
- 카드번호, 계좌번호
- 비밀번호 (평문 및 해시 모두)
- 개인식별정보 (주민등록번호 등)
```

### 인증 / 인가
- 모든 API 엔드포인트는 JWT 인증 미들웨어를 통과해야 합니다 (공개 엔드포인트 제외).
- 사용자는 **본인 데이터에만** 접근 가능 — `user_id` 기반 소유권 검증 필수
- 관리자 전용 엔드포인트는 별도 Admin 권한 검증 미들웨어 적용

### OWASP Top 10
코드 작성 시 OWASP Top 10 기준 취약점을 사전에 고려하세요. 특히:
- SQL Injection: ORM 파라미터 바인딩 사용 (Raw Query 지양)
- XSS: 사용자 입력값 반드시 sanitize 처리

---

## 8. 🚫 절대 구현하지 말 것 (법적 / 비즈니스 제약)

```
1. 자동 해지 실행 기능
   → SubTrack은 해지 "안내"만 제공합니다. 직접 구독을 해지하는 API 호출 / 자동화 로직 구현 금지.

2. 직접 결제 대행
   → 결제 처리 로직 구현 금지. 결제는 각 구독 서비스에서 직접 처리합니다.

3. 해외 카드사 연동 (v1 기준)
   → MVP에서는 국내 7대 카드사만 지원합니다.

4. 가상계좌 / 무통장입금 기반 구독 탐지
   → 카드 결제 내역 기반만 지원합니다.
```

---

## 9. 외부 API 연동 가이드

### 마이데이터 API
- 인증 방식: OAuth 2.0 + 금융 인증서
- 토큰 저장: Redis (`mydata:token:{userId}` 키, 암호화 필수)
- 토큰 만료 처리: Refresh Token으로 자동 갱신 → 실패 시 사용자에게 재인증 알림
- API 실패 시: 최대 3회 재시도 (Exponential Backoff 적용)
- 결제 내역 동기화: 최초 연동 시 12개월치 수신, 이후 Lambda Scheduler로 매일 자정 증분 동기화

### 알림 서비스
| 채널 | 서비스 | 인증 |
|------|--------|------|
| Android Push | FCM | 서버 API Key (환경변수) |
| iOS Push | APNs | p8 인증서 (환경변수) |
| 이메일 | AWS SES | SMTP / API Key |
| SMS | Twilio | API SID + Token (환경변수) |

- 알림 발송 실패 시: 최대 3회 재시도 (Exponential Backoff)
- 모든 인증 키는 **환경변수 또는 AWS Secrets Manager**로 관리 — 코드에 하드코딩 절대 금지

---

## 10. API 설계 규칙

- **스타일:** RESTful
- **버전:** URL prefix 사용 (`/api/v1/...`)
- **응답 포맷:** 모든 응답은 아래 구조 통일

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

- **에러 응답:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SUBSCRIPTION_NOT_FOUND",
    "message": "해당 구독을 찾을 수 없습니다."
  }
}
```

- **HTTP 상태코드:** 명시적으로 사용 (200 OK / 201 Created / 400 Bad Request / 401 Unauthorized / 403 Forbidden / 404 Not Found / 500 Internal Server Error)
- **페이지네이션:** cursor 기반 페이지네이션 사용 (offset 기반 지양)

---

## 11. 로깅 규칙

- **포맷:** JSON 구조화 로그
- **필수 필드:** `timestamp`, `level`, `requestId`, `userId`(있는 경우), `message`
- **로그 레벨:** `debug` / `info` / `warn` / `error`
- **수집:** AWS CloudWatch (요청 ID 기반 추적)
- **민감 데이터 마스킹:** 금융 정보, 토큰은 `***` 처리 후 로그 출력

```typescript
// 올바른 예시
logger.info({ requestId, userId, action: 'subscription.detected', count: 3 });

// 금지 예시
logger.info({ token: accessToken }); // 절대 금지
```

---

## 12. 테스트 규칙

- **프레임워크:** Jest (TypeScript), pytest (Python)
- **커버리지 목표:** 핵심 비즈니스 로직 **80% 이상**
- **테스트 파일 위치:** 대상 파일과 동일 디렉토리, `*.test.ts` / `*_test.py` 형식
- **테스트 종류:**
  - Unit Test: Service, Repository 레이어 필수
  - Integration Test: 주요 API 엔드포인트
  - E2E Test: 구독 탐지 → 알림 발송 핵심 플로우

---

## 13. 핵심 KPI (개발 목표 기준)

| 지표 | 목표 |
|------|------|
| API 평균 응답 시간 | 1.5초 이내 (P95) |
| 대시보드 초기 로딩 | 2초 이내 |
| 구독 탐지 배치 처리 | 1,000건 기준 30초 이내 |
| 동시 접속자 | 10,000명 (Auto Scaling) |
| 서비스 가용률 | 99.9% |
