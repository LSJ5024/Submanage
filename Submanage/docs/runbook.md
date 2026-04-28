# SubTrack 장애 대응 Runbook (TASK-063)

> 서비스 가용률 목표: **99.9%** (월 최대 다운타임 43분)

---

## 1. 장애 등급 정의

| 등급 | 기준 | 대응 시간 |
|------|------|-----------|
| **P0 (Critical)** | 전체 서비스 불가, 데이터 손실 위험 | 즉시 (15분 내) |
| **P1 (High)**     | 핵심 기능 장애 (로그인, 구독 조회 불가) | 30분 내 |
| **P2 (Medium)**   | 일부 기능 이상 (알림 지연, 특정 화면 오류) | 2시간 내 |
| **P3 (Low)**      | 사소한 버그, UX 이슈 | 다음 릴리즈 |

---

## 2. 알람 발생 시 초동 대응

### 2-1. CloudWatch 알람 수신 시

```bash
# 1. 현재 ECS 서비스 상태 확인
aws ecs describe-services \
  --cluster subtrack-prod \
  --services subtrack-api \
  --query 'services[0].{running:runningCount,desired:desiredCount,status:status}'

# 2. 최근 에러 로그 확인 (최근 100줄)
aws logs filter-log-events \
  --log-group-name /subtrack/api \
  --filter-pattern "ERROR" \
  --start-time $(date -d '30 minutes ago' +%s000) \
  --limit 100

# 3. RDS 상태 확인
aws rds describe-db-instances \
  --db-instance-identifier subtrack-prod \
  --query 'DBInstances[0].{status:DBInstanceStatus,cpu:LatestRestorableTime}'

# 4. Redis 상태 확인
aws elasticache describe-replication-groups \
  --replication-group-id subtrack-redis
```

### 2-2. API P95 1.5초 초과 시

```bash
# 병목 확인: 느린 쿼리 로그 확인
aws logs filter-log-events \
  --log-group-name /subtrack/api \
  --filter-pattern '{ $.responseTime > 1500 }'

# ECS 태스크 수 강제 증가 (긴급 스케일 아웃)
aws ecs update-service \
  --cluster subtrack-prod \
  --service subtrack-api \
  --desired-count 20
```

---

## 3. 롤백 절차 (TASK-061)

```bash
# 1. 이전 태스크 정의 버전 확인
aws ecs list-task-definitions \
  --family-prefix subtrack-api \
  --sort DESC \
  --max-items 5

# 2. 이전 버전으로 롤백
aws ecs update-service \
  --cluster subtrack-prod \
  --service subtrack-api \
  --task-definition subtrack-api:<이전_버전_번호>

# 3. 롤백 완료 확인
aws ecs wait services-stable \
  --cluster subtrack-prod \
  --services subtrack-api

echo "롤백 완료"
```

---

## 4. DB 장애 대응

```bash
# RDS 페일오버 (Multi-AZ 자동, 수동 트리거)
aws rds failover-db-cluster \
  --db-cluster-identifier subtrack-prod

# 최신 스냅샷으로 복구
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier subtrack-prod \
  --target-db-instance-identifier subtrack-restored \
  --restore-time <YYYY-MM-DDThh:mm:ssZ>
```

---

## 5. KPI 모니터링 지표 (TASK-063)

| KPI | 목표 | 모니터링 쿼리 |
|-----|------|--------------|
| MAU | - | `SELECT COUNT(DISTINCT user_id) FROM users WHERE last_active > NOW() - INTERVAL '30 days'` |
| 카드 연동률 | >30% | `SELECT COUNT(DISTINCT user_id) FROM cards / COUNT(*) FROM users * 100` |
| D-3 알림 CTR | >40% | `sent / opened * 100 FROM notifications` |
| 해지 안내 완료율 | >20% | `cancel_guide_clicks / subscription_count * 100` |
| 구독 자동 탐지 정확도 | >90% | `auto_detected_confirmed / auto_detected * 100` |

---

## 6. 긴급 연락처

| 역할 | 담당자 | 연락처 |
|------|--------|--------|
| 온콜 (1차) | - | Slack `#oncall` |
| 인프라 담당 | - | Slack `#infra-alert` |
| 보안 이슈 | - | security@subtrack.app |
