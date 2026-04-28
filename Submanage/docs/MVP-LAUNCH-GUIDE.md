# SubTrack MVP 출시 가이드라인

> **대상:** 개발 완료 후 실제 서비스 출시를 위한 단계별 실행 가이드  
> **예상 소요:** 약 2~3주 (외부 심사/인증 포함)

---

## 📋 전체 로드맵

```
Week 1   : AWS 인프라 구축 + 외부 API 신청
Week 2   : 통합 테스트 + 앱 심사 제출
Week 3   : 심사 통과 + 소프트 론치
```

---

## STEP 1 — AWS 계정 및 사전 준비

### 1-1. AWS 계정 설정

```bash
# AWS CLI 설치 및 설정
aws configure
# AWS Access Key ID:     <IAM 사용자 키>
# AWS Secret Access Key: <IAM 사용자 시크릿>
# Default region name:   ap-northeast-2
# Default output format: json

# CDK 부트스트랩 (최초 1회)
cd infra
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-2
```

**필요한 IAM 권한:**
- `AdministratorAccess` (개발 단계) 또는 최소 권한:
  - `ec2:*`, `ecs:*`, `ecr:*`, `rds:*`, `elasticache:*`
  - `cloudfront:*`, `s3:*`, `secretsmanager:*`
  - `cloudwatch:*`, `logs:*`, `iam:*`

### 1-2. 도메인 및 SSL 인증서 발급

```bash
# Route 53에서 도메인 등록 (예: subtrack.app)
# 또는 기존 도메인 네임서버를 Route 53으로 이전

# ACM (AWS Certificate Manager)에서 인증서 발급
aws acm request-certificate \
  --domain-name subtrack.app \
  --subject-alternative-names "*.subtrack.app" "api.subtrack.app" \
  --validation-method DNS \
  --region us-east-1  # CloudFront는 us-east-1 인증서 필수

# 발급된 인증서 ARN을 infra/src/stacks/cdn.stack.ts에 추가
# certificate: acm.Certificate.fromCertificateArn(this, 'Cert', 'arn:aws:acm:...')
```

---

## STEP 2 — 인프라 프로비저닝

### 2-1. CDK 전체 배포

```bash
cd D:/mypy/Submanage/infra

# 의존성 설치
npm install

# 배포 순서대로 실행 (의존성 자동 처리)
npx cdk deploy --all --require-approval never

# 또는 스택별 순서 배포 (권장)
npx cdk deploy SubTrackNetwork
npx cdk deploy SubTrackSecrets
npx cdk deploy SubTrackDatabase SubTrackCache   # 병렬 가능
npx cdk deploy SubTrackCompute
npx cdk deploy SubTrackCdn
npx cdk deploy SubTrackMonitor SubTrackKpi      # 병렬 가능
```

**배포 완료 후 출력값 수집:**
```bash
# 각 스택의 Output 값을 .env 파일에 기록
npx cdk --outputs-file cdk-outputs.json deploy --all
cat cdk-outputs.json
```

| Output 키 | 용도 |
|-----------|------|
| `SubTrackDatabase.RdsEndpoint` | `DATABASE_URL` 구성 |
| `SubTrackCompute.ApiUrl` | API 서버 도메인 |
| `SubTrackCdn.CloudFrontUrl` | 웹 앱 도메인 |
| `SubTrackCdn.DistributionId` | CloudFront 무효화용 |
| `SubTrackCompute.ApiRepoUri` | ECR Docker 푸시 주소 |

### 2-2. Secrets Manager 값 채우기

> ⚠️ **중요:** 코드에 절대 하드코딩하지 마세요 (CLAUDE.md §7, §9)

```bash
# 각 시크릿에 실제 값 입력
aws secretsmanager put-secret-value \
  --secret-id subtrack/jwt/access-secret \
  --secret-string "$(openssl rand -hex 32)"

aws secretsmanager put-secret-value \
  --secret-id subtrack/jwt/refresh-secret \
  --secret-string "$(openssl rand -hex 32)"

aws secretsmanager put-secret-value \
  --secret-id subtrack/crypto/encryption-key \
  --secret-string "$(openssl rand -hex 32)"   # 반드시 32바이트(64자 hex)

# 마이데이터 API 키 (STEP 3 완료 후)
aws secretsmanager put-secret-value \
  --secret-id subtrack/mydata/client-secret \
  --secret-string "<마이데이터_CLIENT_SECRET>"

# AI 엔진 내부 통신 키
aws secretsmanager put-secret-value \
  --secret-id subtrack/ai-engine/internal-key \
  --secret-string "$(openssl rand -hex 32)"

# FCM 서버 키 (STEP 4 완료 후)
aws secretsmanager put-secret-value \
  --secret-id subtrack/fcm/server-key \
  --secret-string "<FCM_SERVER_KEY>"

# APNs p8 키 파일 내용
aws secretsmanager put-secret-value \
  --secret-id subtrack/apns/private-key \
  --secret-string "$(cat AuthKey_XXXXXXXXXX.p8)"

# Twilio
aws secretsmanager put-secret-value \
  --secret-id subtrack/twilio/auth-token \
  --secret-string "<TWILIO_AUTH_TOKEN>"
```

### 2-3. DB 마이그레이션 및 초기 데이터

```bash
# RDS 접속을 위한 Bastion Host 또는 SSM Session Manager 사용
# (RDS는 Private Subnet에 있으므로 직접 접근 불가)

# 방법 1: SSM Session Manager로 ECS 태스크에서 실행
aws ecs execute-command \
  --cluster subtrack-prod \
  --task <TASK_ARN> \
  --container api \
  --interactive \
  --command "/bin/sh"

# 방법 2: 로컬에서 DATABASE_URL 지정 후 실행 (VPN 필요)
cd D:/mypy/Submanage/services/api

DATABASE_URL="postgresql://subtrack_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/subtrack" \
  npx prisma migrate deploy

# 초기 데이터 시딩 (30종 구독 카탈로그 + 해지 가이드)
DATABASE_URL="postgresql://..." npx ts-node prisma/seed.ts
```

---

## STEP 3 — 마이데이터 API 연동 신청

> **소요 기간:** 약 4~8주 (금융위원회 심사)

### 3-1. 마이데이터 사업 허가 신청

1. [금융위원회 마이데이터 포털](https://mydata.go.kr) 접속
2. **본허가 신청** 또는 **테스트베드 신청** (개발 단계)
3. 제출 서류:
   - 사업계획서 (구독 탐지 목적 명시)
   - 개인정보처리방침 (`docs/` 참조)
   - 보안 심사 결과서 (ISMS 또는 자체 보안 점검)
   - API 활용 동의서

### 3-2. 테스트베드 활용 (개발 단계)

```bash
# 테스트베드 신청 승인 후
# MYDATA_API_BASE_URL=https://testbed.mydata.go.kr (테스트)
# MYDATA_API_BASE_URL=https://api.mydata.go.kr     (프로덕션)

# services/api/.env (실제 연동 전 목 데이터로 개발)
MYDATA_CLIENT_ID=your_client_id
MYDATA_CLIENT_SECRET=your_client_secret
MYDATA_API_BASE_URL=https://testbed.mydata.go.kr
```

### 3-3. 국내 7대 카드사 개별 연동

| 카드사 | 포털 | 비고 |
|--------|------|------|
| 신한카드 | [shinhancard.com](https://shinhancard.com) | API 신청 |
| KB국민카드 | [kbcard.com](https://kbcard.com) | API 신청 |
| 현대카드 | [hyundaicard.com](https://hyundaicard.com) | API 신청 |
| 삼성카드 | [samsungcard.com](https://samsungcard.com) | API 신청 |
| 롯데카드 | [lottecard.co.kr](https://lottecard.co.kr) | API 신청 |
| 우리카드 | [wooricard.com](https://wooricard.com) | API 신청 |
| 하나카드 | [hanacard.co.kr](https://hanacard.co.kr) | API 신청 |

---

## STEP 4 — 알림 서비스 설정

### 4-1. Firebase Cloud Messaging (Android 푸시)

```bash
# 1. Firebase Console (https://console.firebase.google.com) 프로젝트 생성
# 2. 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
# 3. Cloud Messaging → 서버 키 확인

# Google Play Console에 앱 등록 후
# google-services.json을 apps/mobile/android/app/ 에 배치
```

### 4-2. APNs (iOS 푸시)

```bash
# 1. Apple Developer Console (https://developer.apple.com) 접속
# 2. Certificates, Identifiers & Profiles → Keys → + 추가
# 3. Apple Push Notifications service (APNs) 체크
# 4. .p8 파일 다운로드 (한 번만 다운로드 가능!)

# 환경변수 설정
APNS_KEY_ID=<10자리 KEY ID>
APNS_TEAM_ID=<10자리 TEAM ID>
APNS_PRIVATE_KEY=<.p8 파일 내용 (개행은 \n으로 이스케이프)>

# apps/mobile/ios/GoogleService-Info.plist 배치
```

### 4-3. AWS SES 이메일 발신 설정

```bash
# 1. SES 샌드박스 → 프로덕션으로 이동 신청 (AWS 콘솔)
# 2. 발신 도메인 인증 (subtrack.app DNS TXT 레코드 추가)
# 3. 발신 이메일 주소 인증

aws ses verify-domain-identity --domain subtrack.app
aws ses verify-email-identity --email-address noreply@subtrack.app

# services/api/src/services/notification/notification.dispatcher.ts
# sendEmail() 메서드에 @aws-sdk/client-ses 실제 구현 연결
npm install @aws-sdk/client-ses --workspace=@subtrack/api
```

### 4-4. Twilio SMS 설정

```bash
# 1. twilio.com 계정 생성
# 2. 한국 발신 번호 구매 (또는 Alphanumeric Sender ID)
# 3. 발신 번호 등록 (한국: 070 또는 해외번호)

TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxx
TWILIO_PHONE_NUMBER=+821012345678
```

---

## STEP 5 — Lambda 스케줄러 설정

> 매일 자정 증분 동기화 + D-3 알림 스케줄러

```bash
# infra/src/stacks/scheduler.stack.ts 추가 필요
```

```typescript
// 추가할 스택 예시
import * as lambda   from 'aws-cdk-lib/aws-lambda';
import * as events   from 'aws-cdk-lib/aws-events';
import * as targets  from 'aws-cdk-lib/aws-events-targets';

// D-3 알림 스케줄러: 매일 오전 01:00 (UTC, 한국 10:00)
new events.Rule(this, 'D3NotificationRule', {
  schedule: events.Schedule.cron({ hour: '1', minute: '0' }),
  targets: [new targets.LambdaFunction(notificationSchedulerLambda)],
});

// 증분 동기화: 매일 자정 (UTC 15:00 = 한국 00:00)
new events.Rule(this, 'IncrementalSyncRule', {
  schedule: events.Schedule.cron({ hour: '15', minute: '0' }),
  targets: [new targets.LambdaFunction(syncSchedulerLambda)],
});
```

---

## STEP 6 — GitHub Actions 시크릿 등록

> GitHub 저장소 → Settings → Secrets and Variables → Actions

| Secret 이름 | 값 | 출처 |
|-------------|-----|------|
| `AWS_ACCESS_KEY_ID` | IAM 사용자 액세스 키 | AWS IAM |
| `AWS_SECRET_ACCESS_KEY` | IAM 사용자 시크릿 키 | AWS IAM |
| `PROD_DATABASE_URL` | `postgresql://...` | RDS Endpoint |
| `WEB_S3_BUCKET` | `subtrack-web-<ACCOUNT_ID>` | CDK Output |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1XXXXXXXXXX` | CDK Output |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/...` | Slack App 설정 |

### GitHub 브랜치 보호 규칙 설정

```
GitHub → Settings → Branches → Add rule

브랜치 패턴: main
✅ Require a pull request before merging
✅ Require status checks to pass (CI 워크플로우 선택)
✅ Require branches to be up to date before merging
✅ Restrict who can push to matching branches
✅ Do not allow bypassing the above settings
```

---

## STEP 7 — 성능 검증 (k6 부하 테스트)

```bash
# k6 설치
winget install k6   # Windows
# brew install k6   # macOS

# 테스트용 JWT 토큰 생성 (임시)
cd services/api
JWT_TOKEN=$(node -e "
  const jwt = require('jsonwebtoken');
  console.log(jwt.sign(
    { userId: 'load-test-user', email: 'load@test.com', role: 'USER' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '24h', algorithm: 'HS256' }
  ));
")

# 부하 테스트 실행
cd services/api/src/tests/performance
k6 run load-test.k6.js \
  --env BASE_URL=https://api.subtrack.app/api/v1 \
  --env TEST_JWT_TOKEN=$JWT_TOKEN \
  --out json=results.json

# 결과 확인
cat performance-report.json
```

**목표 임계값:**

| 지표 | 목표 | 실패 시 조치 |
|------|------|-------------|
| 대시보드 P95 | < 2,000ms | DB 인덱스 최적화, Redis 캐싱 강화 |
| API P95 | < 1,500ms | ECS 태스크 증가, 쿼리 최적화 |
| 에러율 | < 1% | 로그 분석 후 버그 수정 |
| 동시 접속 | 10,000명 | Auto Scaling 최대값 조정 |

---

## STEP 8 — 앱 스토어 제출

### 8-1. 앱 아이콘 / 스플래시 / 스크린샷 제작

```
필요한 에셋:
├── 앱 아이콘
│   ├── iOS: 1024×1024 PNG (투명 없음)
│   └── Android: 512×512 PNG
├── 스플래시 이미지
│   └── 2048×2048 PNG (중앙 집중형)
└── 스크린샷 (각 5~8장 권장)
    ├── iPhone 6.7" (1290×2796)
    ├── iPhone 6.5" (1242×2688)
    ├── iPad Pro (2048×2732)
    └── Android (1080×1920)

스크린샷 순서 (권장):
1. 대시보드 (구독 총액 + 임박 결제)
2. 구독 자동 탐지 결과
3. 카드 연동 화면
4. D-3 알림 화면
5. 해지 안내 화면
```

### 8-2. iOS App Store 제출

```bash
# 1. Xcode에서 Archive 빌드
cd apps/mobile
npx react-native run-ios --configuration Release

# 또는 EAS Build 사용 (권장)
npm install -g eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios
```

**App Store Connect 필수 정보:**
- 앱 이름: SubTrack
- 카테고리: 금융
- 연령 등급: 4+
- 개인정보처리방침 URL: `https://subtrack.app/privacy`
- 심사 노트: "마이데이터 API를 통해 카드 결제 내역을 조회합니다. 실제 결제 기능은 없습니다."

### 8-3. Google Play Store 제출

```bash
# EAS Build
eas build --platform android --profile production
eas submit --platform android
```

**Play Console 필수 설정:**
- 앱 카테고리: 금융
- 개인정보 처리방침 제출
- 금융 앱 선언서 작성
- 타겟 API 레벨: 34 (Android 14)

---

## STEP 9 — SES 이메일 실제 연동

> `notification.dispatcher.ts`의 `sendEmail()` stub 완성

```bash
cd D:/mypy/Submanage/services/api
pnpm add @aws-sdk/client-ses
```

```typescript
// services/api/src/services/notification/notification.dispatcher.ts
// sendEmail() 메서드를 다음으로 교체:
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

private async sendEmail(payload: SendPayload): Promise<void> {
  if (!payload.email) return;
  const client = new SESClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
  await client.send(new SendEmailCommand({
    Source:      process.env.AWS_SES_FROM_EMAIL ?? 'noreply@subtrack.app',
    Destination: { ToAddresses: [payload.email] },
    Message: {
      Subject: { Data: payload.title, Charset: 'UTF-8' },
      Body:    { Text: { Data: payload.body,  Charset: 'UTF-8' } },
    },
  }));
}
```

---

## STEP 10 — 소프트 론치 체크리스트

```
출시 전 최종 확인:

인프라
□ 모든 CDK 스택 배포 완료 및 Healthy 상태
□ RDS Multi-AZ 정상 작동
□ Redis 클러스터 정상 작동
□ CloudFront 배포 완료 (전파 시간 약 15분)
□ SSL 인증서 적용 확인 (https://subtrack.app)

기능
□ 회원가입 / 로그인 정상 동작
□ 카드 연동 테스트 (테스트베드 or 실 카드사)
□ 구독 탐지 결과 확인
□ D-3 알림 발송 테스트 (수동 트리거)
□ 해지 가이드 30종 모두 조회 가능

보안
□ HTTPS 전 구간 적용 확인
□ 민감 데이터 로그 출력 없음 확인
□ JWT 토큰 만료 처리 정상 동작
□ 타인 데이터 접근 차단 확인 (IDOR 검증)

성능
□ k6 부하 테스트 통과 (P95 1.5초, 에러율 1% 미만)
□ 대시보드 초기 로딩 2초 이내 확인
□ CloudWatch 알람 정상 설정 확인

앱 스토어
□ iOS 심사 통과
□ Android 심사 통과
□ 개인정보처리방침 URL 접속 가능
```

---

## 예상 일정

| 기간 | 작업 |
|------|------|
| **D+0~3** | AWS 인프라 구축 (STEP 1~2) |
| **D+3~7** | 외부 서비스 연동 (STEP 3~5) — 마이데이터 신청은 별도 진행 |
| **D+7~10** | GitHub Actions 설정 + k6 테스트 (STEP 6~7) |
| **D+10~14** | 앱 아이콘/스크린샷 제작 + 스토어 제출 (STEP 8) |
| **D+14~21** | 심사 대기 (iOS 1~7일, Android 1~3일) |
| **D+21** | 🚀 소프트 론치 |

> **마이데이터 본허가:** 금융위원회 심사 4~8주 소요. 개발 단계에서는 테스트베드로 진행하고, 허가 완료 후 프로덕션 전환 권장.

---

*© 2025 SubTrack. 이 문서는 내부 개발팀용입니다.*
