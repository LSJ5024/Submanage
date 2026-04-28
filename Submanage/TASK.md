# TASK.md — SubTrack 개발 태스크 관리 문서

> **PRD v1.0** 및 **CLAUDE.md** 기반으로 작성된 전체 개발 태스크 목록입니다.
> MVP 출시 목표: 개발 착수 후 **6개월 (M1~M6)**
> **마지막 업데이트:** 2026-04-28

---

## 📐 전체 개발 Phase 구조

```
Phase 0 (M1 Week 1~2)   : 프로젝트 기반 세팅 (모노레포, 인프라, CI/CD)       ✅ 완료
Phase 1 (M1 Week 3~4)   : 공용 기반 레이어 구현 (DB 스키마, 인증, 공통 모듈) ✅ 완료
Phase 2 (M2~M3)         : 핵심 백엔드 기능 구현 (카드 연동, 구독 탐지, 알림) ✅ 완료
Phase 3 (M3~M4)         : AI 탐지 엔진 구현 (Python FastAPI)                  🔄 기반 완성, 고도화 필요
Phase 4 (M4~M5)         : 프론트엔드 구현 (React Native 앱 + React.js 웹)    🔄 프로젝트 초기화 완료
Phase 5 (M5 Week 3~4)   : 통합 테스트 및 보안 점검                            [ ] 미착수
Phase 6 (M6)            : 성능 최적화, 배포, MVP 출시                          [ ] 미착수
```

---

## ✅ 태스크 상태 범례

| 상태 | 의미 |
|------|------|
| `[ ]` | 미시작 |
| `[~]` | 진행 중 |
| `[x]` | 완료 |
| `[!]` | 블로커 / 주의 필요 |

---

## Phase 0 — 프로젝트 기반 세팅
> 목표: 팀 전체가 동일한 개발 환경에서 시작할 수 있는 기반 마련

### TASK-001 | 모노레포 초기 세팅
- **담당:** 인프라 / 리드 개발자
- **참조:** CLAUDE.md §3 디렉토리 구조
- **세부 작업:**
  - [x] `pnpm workspace` 기반 모노레포 구성
  - [x] 루트 `package.json`, `pnpm-workspace.yaml` 작성
  - [x] `apps/mobile`, `apps/web`, `services/api`, `services/ai-engine`, `packages/shared`, `infra`, `docs` 디렉토리 골격 생성
  - [x] `packages/shared` — 공용 TypeScript 타입 정의 패키지 초기화 (`@subtrack/shared`)

### TASK-002 | 코드 컨벤션 및 린터 설정
- **담당:** 리드 개발자
- **참조:** CLAUDE.md §5 코딩 컨벤션
- **세부 작업:**
  - [x] TypeScript 프로젝트 ESLint + Prettier 설정 (`.eslintrc.js`, `.prettierrc`)
  - [x] Python FastAPI 프로젝트 Black + Flake8 설정 (`pyproject.toml`)
  - [x] Husky + lint-staged: 커밋 전 자동 린팅 훅 설정 (`.husky/pre-commit`)
  - [x] `tsconfig.base.json` 작성 후 각 앱에서 extend하는 구조 적용

### TASK-003 | CI/CD 파이프라인 구축
- **담당:** 인프라 / DevOps
- **세부 작업:**
  - [x] GitHub Actions 워크플로우 작성 (`.github/workflows/ci.yml` — lint, test, build)
  - [ ] 브랜치 전략 정의 및 보호 규칙 설정 (`main`, `develop`, `feature/*`, `hotfix/*`)
  - [x] Docker Compose 개발 환경 구성 (`docker-compose.yml` — API + AI엔진 + PostgreSQL + Redis)
  - [x] `.env.example` 작성 — 필수 환경변수 목록 문서화

### TASK-004 | AWS 인프라 초기 프로비저닝
- **담당:** 인프라
- **참조:** PRD §2.2 아키텍처, CLAUDE.md §7 보안
- **세부 작업:**
  - [ ] AWS CDK 또는 Terraform으로 IaC 코드 작성 (`infra/` 디렉토리)
  - [ ] VPC, 서브넷, 보안 그룹 구성
  - [ ] RDS (PostgreSQL), ElastiCache (Redis) 프로비저닝
  - [ ] S3 버킷 생성 (정적 자산, 해지 가이드 스크린샷용)
  - [ ] AWS Secrets Manager 설정 — API 키, 인증서 관리 구조 정의
  - [ ] CloudWatch 로그 그룹 및 알람 초기 설정

---

## Phase 1 — 공용 기반 레이어 구현
> 목표: DB 스키마, 인증 미들웨어, 공통 응답 포맷 등 팀 전체가 공유하는 기반 완성

### TASK-010 | Prisma DB 스키마 정의 및 초기 마이그레이션
- **담당:** 백엔드
- **참조:** PRD §4 데이터 요구사항, CLAUDE.md §6 DB 규칙
- **세부 작업:**
  - [x] `prisma/schema.prisma` 작성
    - [x] `users` 테이블 (UUID PK, `deleted_at` 소프트 삭제 포함)
    - [x] `cards` 테이블 (카드사 연동 정보, 국내 7대 카드사 ENUM)
    - [x] `transactions` 테이블 (AES-256 암호화 컬럼 + `@@unique` 중복 방지)
    - [x] `subscriptions` 테이블 (PRD §4.2 데이터 사전 기준 — 모든 컬럼, ENUM 타입 정의)
    - [x] `subscription_catalog` 테이블 (지원 구독 서비스 마스터 DB)
    - [x] `notifications` 테이블 (알림 이력)
    - [x] `notification_settings` 테이블 (사용자 opt-out 설정)
    - [x] `cancellation_guides` 테이블 (해지 가이드 콘텐츠)
    - [x] `subscription_status_histories` 테이블 (상태 전이 audit trail)
  - [x] 모든 테이블에 `created_at`, `updated_at` 자동 관리 설정
  - [ ] `prisma migrate dev` 초기 마이그레이션 실행 및 검증 (DB 연결 시 실행 필요)
  - [x] Prisma Client 생성 (`prisma generate` 완료)
  - [x] **⚠️ 주의:** `DELETE` 쿼리 직접 사용 금지 — 소프트 삭제(`deleted_at`) 구현

### TASK-011 | AES-256 암호화 유틸리티 구현
- **담당:** 백엔드
- **참조:** CLAUDE.md §7 보안 필수 사항
- **세부 작업:**
  - [x] `packages/shared/src/crypto.ts` — AES-256-GCM 암호화/복호화 유틸 함수 구현
  - [x] 환경변수 `ENCRYPTION_KEY` 기반 키 관리
  - [x] Prisma 미들웨어로 `transactions` 테이블 저장/조회 시 자동 암/복호화 (`src/lib/prisma.ts`)
  - [x] 단위 테스트 작성 (`crypto.test.ts` — 5개 케이스)

### TASK-012 | 공통 응답 포맷 및 에러 핸들러 구현
- **담당:** 백엔드
- **참조:** CLAUDE.md §10 API 설계 규칙
- **세부 작업:**
  - [x] `packages/shared/src/response.ts` — `successResponse` / `errorResponse` 래퍼 구현
  - [x] 글로벌 에러 핸들러 미들웨어 (`src/middlewares/errorHandler.ts`)
  - [x] 도메인별 커스텀 에러 클래스 (`src/common/errors.ts` — NotFound, Unauthorized, Forbidden, BadRequest, Conflict, InternalServer)
  - [x] HTTP 상태 코드 일관성 유지 (AppError 상속 구조)

### TASK-013 | 구조화 로거 구현
- **담당:** 백엔드
- **참조:** CLAUDE.md §11 로깅 규칙
- **세부 작업:**
  - [x] Pino 기반 JSON 구조화 로거 (`src/middlewares/logger.ts`)
  - [x] 필수 필드 자동 주입: `timestamp`, `level`, `requestId`
  - [x] 민감 데이터 마스킹 (`redact` 옵션 — 토큰, 카드번호, 비밀번호 → `***`)
  - [x] `requestId` 생성 미들웨어 (`src/middlewares/requestId.ts` — UUID 자동 부여)
  - [ ] AWS CloudWatch 로그 스트림 전송 설정 (인프라 구성 후 연동 예정)

### TASK-014 | JWT 인증 미들웨어 구현
- **담당:** 백엔드
- **참조:** CLAUDE.md §7 인증/인가
- **세부 작업:**
  - [x] 회원가입 / 로그인 API (`POST /api/v1/auth/register`, `POST /api/v1/auth/login`)
  - [x] JWT Access Token 발급 (만료: 1시간), Refresh Token 발급 (만료: 30일)
  - [x] JWT 인증 미들웨어 (`src/middlewares/auth.ts`) — 모든 보호 라우터에 적용
  - [x] bcrypt 비밀번호 해싱 (Salt rounds 12 고정)
  - [x] 관리자 권한 검증 미들웨어 (`requireAdmin`)
  - [x] `user_id` 소유권 검증 유틸 함수 (`assertOwnership`)
  - [x] **⚠️ 보안:** 비밀번호 평문/해시 모두 로그 출력 절대 금지
  - [x] 단위 테스트 작성 (`auth.service.test.ts` — 9개 케이스)

### TASK-015 | 공용 타입 정의 (`@subtrack/shared`)
- **담당:** 백엔드 / 프론트엔드
- **세부 작업:**
  - [x] `Subscription`, `User`, `Card`, `Notification`, `CancellationGuide` 공용 인터페이스 정의
  - [x] `SubscriptionStatus`, `BillingCycle`, `NotificationChannel`, `CardCompany`, `SubscriptionCategory` ENUM 정의
  - [x] API 응답 공용 제네릭 타입 `ApiResponse<T>`, `CursorPagination<T>` 정의

---

## Phase 2 — 핵심 백엔드 기능 구현
> 목표: FR-001~FR-005 백엔드 API 전체 구현 (카드 연동, 구독 탐지 연동, 알림, 해지 가이드)

### TASK-020 | 카드 연동 — 마이데이터 API 연동 모듈 (FR-005)
- **담당:** 백엔드
- **참조:** PRD §5.2, CLAUDE.md §9 마이데이터 API
- **세부 작업:**
  - [x] `MyDataConnector` 서비스 클래스 구현 (`src/services/mydata/mydata.connector.ts`)
    - [x] OAuth 2.0 인가 코드 기반 토큰 발급 플로우
    - [x] Access Token / Refresh Token Redis 암호화 저장 (`mydata:token:{userId}`)
    - [x] 토큰 만료 5분 전 선제 갱신 로직
    - [x] API 실패 시 Exponential Backoff 재시도 (최대 3회: 1s→2s→4s)
  - [x] 카드사 연동 API 구현
    - [x] `POST /api/v1/cards/link` — 카드 연동 (국내 7대 카드사 화이트리스트 검증)
    - [x] `GET /api/v1/cards` — 연동된 카드 목록 조회
    - [x] `DELETE /api/v1/cards/:id` — 카드 연동 해제 (소프트 삭제)
  - [x] 최초 연동 시 12개월치 결제 내역 비동기 동기화 트리거
  - [ ] Lambda Scheduler 설정 — 매일 자정 증분 동기화 (인프라 구성 후)
  - [x] **⚠️ 제약:** 해외 카드사 연동 구현 금지 (v1 Out-of-Scope) — 화이트리스트로 차단

### TASK-021 | 결제 내역 처리 및 AI 엔진 연동 (FR-001)
- **담당:** 백엔드
- **참조:** PRD §3.2, CLAUDE.md §4 AI 엔진 분리 원칙
- **세부 작업:**
  - [x] `TransactionSyncService` 구현 (`src/services/transaction-sync.service.ts`)
    - [x] 수신된 결제 내역 AES-256 암호화 후 `transactions` 테이블 저장
    - [x] 중복 저장 방지 (`@@unique([card_id, transaction_date, amount_encrypted])`)
    - [x] AI 엔진 내부 HTTP 호출 (`X-Internal-Secret` 헤더 인증)
    - [x] 탐지 결과 수신 후 `subscriptions` 테이블 upsert (신규 → DETECTED 상태)
  - [x] 구독 수동 CRUD API 구현
    - [x] `POST /api/v1/subscriptions` — 수동 등록
    - [x] `GET /api/v1/subscriptions` — 목록 조회 (cursor 기반 페이지네이션)
    - [x] `PATCH /api/v1/subscriptions/:id` — 정보 수정
    - [x] `DELETE /api/v1/subscriptions/:id` — 소프트 삭제
  - [x] **⚠️ AI 엔진 직접 외부 노출 금지** — API 서버 경유 필수 적용
  - [x] 단위 테스트 작성 (`subscription.service.test.ts`)

### TASK-022 | 구독 상태 관리 — 상태 머신 구현
- **담당:** 백엔드
- **참조:** PRD §3.8 구독 상태 머신
- **세부 작업:**
  - [x] 구독 상태 전이 로직 구현 (`SubscriptionService.updateStatus`)
    ```
    Detected   → Active      ✅
    Active     → Cancelling  ✅
    Cancelling → Cancelled   ✅
    Active     → Paused      ✅
    Paused     → Active      ✅
    Cancelling → Active      ✅
    ```
  - [x] `PATCH /api/v1/subscriptions/:id/status` — 상태 변경 API
  - [x] 상태 전이 이력 로깅 (`subscription_status_histories` 테이블)
  - [x] 단위 테스트 — 유효 전이 6개 + 차단 전이 4개 케이스

### TASK-023 | D-3 알림 스케줄러 구현 (FR-003)
- **담당:** 백엔드
- **참조:** PRD §3.4
- **세부 작업:**
  - [x] `NotificationScheduler` 구현 (`src/services/notification/notification.scheduler.ts`)
    - [x] 매일 자정 실행 — D-3 이내 결제 예정 구독 조회
    - [x] 사용자 opt-out 설정 반영 (`isChannelEnabled` 확인 후 발송)
  - [x] `NotificationDispatcher` 구현 (`src/services/notification/notification.dispatcher.ts`)
    - [x] FCM (Android 푸시) 발송 모듈
    - [x] APNs (iOS 푸시) — FCM 통합 예정
    - [x] AWS SES (이메일) 발송 모듈 (stub — SDK 연동 필요)
    - [x] Twilio (SMS) 발송 모듈
    - [x] 발송 실패 시 Exponential Backoff 재시도 (최대 3회)
    - [x] 알림 발송 이력 `notifications` 테이블 저장
  - [x] `NotificationService` — opt-out 설정 DB 저장/조회 (`notification_settings`)
  - [x] 알림 설정 API
    - [x] `GET /api/v1/notifications/settings`
    - [x] `PATCH /api/v1/notifications/settings`
  - [x] **⚠️ 보안:** 모든 인증 키 환경변수 관리 (FCM_SERVER_KEY, TWILIO_AUTH_TOKEN 등)
  - [x] 단위 테스트 작성 (`notification.scheduler.test.ts`)

### TASK-024 | 해지 가이드 API 구현 (FR-004)
- **담당:** 백엔드
- **참조:** PRD §3.5
- **세부 작업:**
  - [x] `GET /api/v1/subscriptions/:id/cancel-guide` — 해지 안내 조회 API
  - [x] `cancellation_guides` 테이블 — 30종 지원 플랫폼 초기 데이터 시딩 (`prisma/seed.ts`)
    - Netflix, YouTube Premium, Spotify, Apple One, Wavve, Tving, Coupang Play, Naver Plus, Adobe CC, Microsoft 365, Notion, GitHub, Slack, Disney+, Apple Music, Melon, Genie Music, Kakao 이용권, Naver Webtoon, Kakao Webtoon, Ridi Books, Millie Library, Welaaa, Class101, Dropbox, iCloud, Google One, Nintendo Switch Online, Xbox Game Pass 외
  - [x] 관리자 CMS API 구현
    - [x] `POST /api/v1/admin/cancel-guides`
    - [x] `PATCH /api/v1/admin/cancel-guides/:id`
    - [x] `GET /api/v1/admin/cancel-guides`
  - [x] **⚠️ 제약:** 자동 해지 실행 로직 구현 절대 금지 — 안내만 제공 (준수)
  - [x] **⚠️ 제약:** 직접 결제 대행 로직 구현 절대 금지 (준수)

### TASK-025 | 대시보드 및 리포트 API 구현 (FR-002, FR-006)
- **담당:** 백엔드
- **참조:** PRD §3.3
- **세부 작업:**
  - [x] `GET /api/v1/dashboard` — 대시보드 집계 데이터 API
    - [x] 이번 달 구독 총액 (`totalMonthlyAmount`)
    - [x] 카테고리별 분포 데이터 (`categoryBreakdown`)
    - [x] 임박 결제 목록 D-7 이내 (`upcomingBillings` + `daysLeft` 필드)
  - [x] `GET /api/v1/dashboard/reports/monthly` — 월별 지출 리포트 API
    - [x] 월별 총 지출, 카테고리별 분포, 구독 목록
  - [x] 정렬 파라미터 지원: `?sort=billing_date|amount|category`
  - [ ] 단위 테스트 작성 (`dashboard.service.test.ts`) — 추후 작성 예정

---

## Phase 3 — AI 탐지 엔진 구현
> 목표: 구독 자동 탐지 AI 엔진 (Python FastAPI) 완성

### TASK-030 | FastAPI 프로젝트 기반 세팅
- **담당:** AI / 백엔드
- **참조:** CLAUDE.md §4 AI 엔진 분리 원칙, §5 Python 컨벤션
- **세부 작업:**
  - [x] `services/ai-engine/` FastAPI 프로젝트 초기화
  - [ ] SQLAlchemy 설정 (PostgreSQL 연결) — 추후 구현
  - [x] Black + Flake8 설정 (`pyproject.toml`)
  - [x] Docker 이미지 빌드 설정 (`Dockerfile`)
  - [x] 내부 전용 엔드포인트 인증 (`X-Internal-Secret` 헤더 검증)

### TASK-031 | 가맹점명 정규화 모듈
- **담당:** AI
- **참조:** PRD §3.2 FR-001 처리 흐름 2단계
- **세부 작업:**
  - [x] 가맹점명 정규화 함수 구현 (`app/services/normalizer.py`)
    - [x] 대소문자, 특수문자, 도메인 접미사 처리
    - [x] 한/영 혼용 처리 (`넷플릭스` → `Netflix`)
  - [x] 정규화 규칙 사전 (30종 구독 서비스 기준) 구축
  - [x] 단위 테스트 작성 (`tests/test_normalizer.py` — 7개 케이스)

### TASK-032 | 반복 결제 패턴 분석 엔진
- **담당:** AI
- **참조:** PRD §3.2 FR-001
- **세부 작업:**
  - [x] 결제 내역에서 반복 패턴 감지 알고리즘 구현 (`app/services/pattern_analyzer.py`)
    - [x] 동일 가맹점 반복 결제 감지 (WEEKLY/MONTHLY/QUARTERLY/SEMI_ANNUAL/ANNUAL)
    - [x] 금액 허용 오차 범위 설정 (±5일 주기 오차)
    - [x] 신뢰도 점수 계산 (0.6 미만 필터링)
  - [x] 구독 서비스 DB 매칭 로직 (`is_known_subscription` 연동)
  - [x] 미등록 가맹점 처리: `is_unknown=True` 플래그 설정
  - [x] 단위 테스트 작성 (`tests/test_pattern_analyzer.py` — 13개 케이스)

### TASK-033 | 구독 탐지 API 엔드포인트 구현
- **담당:** AI
- **참조:** PRD §3.7 핵심 플로우
- **세부 작업:**
  - [x] `POST /internal/detect` — 결제 내역 수신 후 탐지 결과 반환 (`app/routers/detect.py`)
  - [x] 탐지 결과 응답 스키마 정의 (`app/schemas.py` — 서비스명, 금액, 결제 주기, 카테고리, 신뢰도)
  - [x] 처리 성능 검증: 1,000건 기준 **30초 이내** — 통합 테스트에서 자동 측정
  - [x] 통합 테스트 작성 (`tests/test_detect_api.py` — 9개 케이스, 1,000건 성능 포함)

---

## Phase 4 — 프론트엔드 구현
> 목표: React Native 모바일 앱 + React.js 웹 클라이언트 MVP 화면 완성

### TASK-040 | 프론트엔드 공통 기반 세팅
- **담당:** 프론트엔드
- **세부 작업:**
  - [x] React Native 프로젝트 초기화 (`apps/mobile/` — package.json, tsconfig.json, App.tsx, 네비게이션)
  - [x] React.js 웹 프로젝트 초기화 (`apps/web/` — Vite, index.html, main.tsx, 라우터)
  - [x] `@subtrack/shared` 패키지 연결 — 공용 타입 재사용
  - [x] API 클라이언트 모듈 구현 (Web: Axios + JWT 자동 첨부 + 토큰 갱신 / Mobile: 에뮬레이터 지원)
  - [x] Zustand 상태 관리 스토어 (`auth.store`, `subscription.store`)
  - [x] 공용 UI 컴포넌트 (`Button`, `Input`, `Card`) + CSS Modules

### TASK-041 | 인증 화면 구현
- **세부 작업:**
  - [x] Web — LoginPage, RegisterPage (유효성 검증, 에러 표시)
  - [x] React Native — LoginScreen, RegisterScreen

### TASK-042 | 카드 연동 화면 구현 (FR-005)
- **세부 작업:**
  - [x] Web — CardLinkPage (3단계: 카드사 선택 → 인증 → 완료)
  - [x] React Native — CardLinkScreen (7대 카드사 선택 + 인가 코드 입력)

### TASK-043 | 홈 / 대시보드 화면 구현 (FR-002)
- **세부 작업:**
  - [x] Web — DashboardPage (총액 카드, 임박 결제 D-배지, 카테고리 도넛 차트, 구독 리스트 + 정렬)
  - [x] React Native — DashboardScreen (총액 카드, 임박 결제, 구독 리스트, 당겨서 새로 고침)

### TASK-044 | 구독 상세 화면 구현
- **세부 작업:**
  - [x] Web — SubscriptionDetailPage (상태 머신 버튼, 해지 안내 진입)
  - [x] React Native — SubscriptionDetailScreen

### TASK-045 | 해지 안내 화면 구현 (FR-004)
- **세부 작업:**
  - [x] Web — CancelGuidePage (단계별 안내, 딥링크 버튼)
  - [x] React Native — CancelGuideScreen
  - [x] **⚠️ 제약:** 자동 해지 버튼 구현 금지 — 딥링크(Linking.openURL) 안내만 제공 (준수)

### TASK-046 | 알림 설정 화면 구현 (FR-003)
- **세부 작업:**
  - [x] Web — NotificationSettingsPage (채널별 토글, 알림 시간 설정)
  - [x] React Native — NotificationSettingsScreen

### TASK-047 | 지출 리포트 화면 구현 (FR-006)
- **세부 작업:**
  - [x] Web — ReportPage (월 네비게이션, 바 차트, 파이 차트, 상세 테이블)
  - [ ] React Native — 추후 구현 예정

---

## Phase 5 — 통합 테스트 및 보안 점검
> 모두 `[ ]` 미착수

---

## Phase 6 — 성능 최적화, 배포, MVP 출시
> 모두 `[ ]` 미착수

---

## 📊 Phase별 요구사항 추적 매트릭스 (RTM)

| 요구사항 ID | 기능명 | 구현 TASK | 테스트 케이스 | 출시 버전 | 상태 |
|------------|--------|-----------|-------------|---------|------|
| FR-001 | 구독 자동 탐지 | TASK-021, 031, 032, 033 | TC-001~TC-010 | MVP | ✅ 백엔드+AI 완료 |
| FR-002 | 구독 대시보드 | TASK-025, 043, 044 | TC-011~TC-020 | MVP | ✅ API+화면 완료 |
| FR-003 | D-3 알림 | TASK-023, 046 | TC-021~TC-030 | MVP | ✅ 백엔드+화면 완료 |
| FR-004 | 원클릭 해지 안내 | TASK-024, 045 | TC-031~TC-040 | MVP | ✅ API+화면 완료 |
| FR-005 | 카드사 연동 | TASK-020, 042 | TC-041~TC-050 | MVP | ✅ 백엔드+화면 완료 |
| FR-006 | 지출 리포트 | TASK-025, 047 | TC-051~TC-060 | v1.1 | ✅ API+Web화면 완료 |
| NFR-PERF | 성능 요구사항 | TASK-052, 060 | 부하 테스트 | MVP | [ ] 미착수 |
| NFR-SEC | 보안 요구사항 | TASK-011, 014, 051 | 보안 점검 | MVP | 🔄 구현 준수, 점검 미실시 |

---

## ⚠️ 전체 공통 주의사항 (모든 Task 적용)

> CLAUDE.md §8에 명시된 절대 구현 금지 항목은 **어떤 Task에서도 예외 없이 적용됩니다.**

1. **자동 해지 실행 기능 구현 금지** ✅ 준수 — 딥링크 안내만 제공
2. **직접 결제 대행 로직 구현 금지** ✅ 준수
3. **해외 카드사 연동 구현 금지** (v1) ✅ 준수 — CardCompany ENUM 7개 고정
4. **가상계좌/무통장 기반 탐지 구현 금지** ✅ 준수
5. **민감 데이터 로그 출력 절대 금지** ✅ 준수 — Pino redact 적용
6. **인증 키 하드코딩 절대 금지** ✅ 준수 — 전량 환경변수 처리
7. **레이어 건너뛰기 금지** ✅ 준수 — Router → Controller → Service → Repository → DB
8. **AI 엔진 외부 직접 노출 금지** ✅ 준수 — API 서버 경유 + 내부 시크릿 인증

---

## 🚀 다음 착수 작업

```
1. [Phase 5] TASK-050 E2E 테스트 — 카드 연동 → 구독 탐지 → 대시보드 전체 플로우
2. [Phase 5] TASK-051 보안 취약점 점검 (OWASP Top 10, 민감 데이터 로그 감사)
3. [Phase 5] TASK-052 성능 테스트 (k6/Artillery — P95 1.5초, 동시접속 10,000명)
4. [Phase 0] TASK-004 AWS 인프라 프로비저닝 (VPC, RDS, Redis, Secrets Manager)
5. [Phase 4] TASK-047 React Native 지출 리포트 화면
6. [Phase 6] TASK-060 프로덕션 배포 파이프라인 구축
```

---

*본 문서는 PRD v1.0 및 CLAUDE.md 기준으로 작성되었습니다. PRD 변경 시 TASK.md도 함께 업데이트하세요.*
*© 2025 SubTrack. Confidential.*
