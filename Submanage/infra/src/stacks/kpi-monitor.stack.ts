import * as cdk       from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns        from 'aws-cdk-lib/aws-sns';
import * as actions    from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct }   from 'constructs';

/**
 * KPI 모니터링 대시보드 (TASK-063)
 * MVP 출시 후 비즈니스 지표 실시간 추적
 */
export class SubTrackKpiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const alarmTopic = sns.Topic.fromTopicArn(
      this, 'AlarmTopic',
      `arn:aws:sns:${this.region}:${this.account}:subtrack-alarms`,
    );

    // ── 비즈니스 KPI 메트릭 (커스텀 — Lambda/API에서 발행) ──────────────
    const kpiMetrics = {
      mau: new cloudwatch.Metric({
        namespace:  'SubTrack/Business',
        metricName: 'MonthlyActiveUsers',
        statistic:  'Maximum',
        period:     cdk.Duration.days(1),
      }),
      cardLinkRate: new cloudwatch.Metric({
        namespace:  'SubTrack/Business',
        metricName: 'CardLinkRate',
        statistic:  'Average',
        period:     cdk.Duration.hours(1),
      }),
      notificationCtr: new cloudwatch.Metric({
        namespace:  'SubTrack/Business',
        metricName: 'NotificationCTR',
        statistic:  'Average',
        period:     cdk.Duration.hours(1),
      }),
      cancellationGuideRate: new cloudwatch.Metric({
        namespace:  'SubTrack/Business',
        metricName: 'CancellationGuideCompletionRate',
        statistic:  'Average',
        period:     cdk.Duration.hours(1),
      }),
      detectionAccuracy: new cloudwatch.Metric({
        namespace:  'SubTrack/AI',
        metricName: 'DetectionAccuracy',
        statistic:  'Average',
        period:     cdk.Duration.hours(6),
      }),
    };

    // ── 알람: AI 탐지 정확도 90% 미만 ────────────────────────────────────
    new cloudwatch.Alarm(this, 'DetectionAccuracyAlarm', {
      alarmName:        'SubTrack-AI-Accuracy-Low',
      alarmDescription: 'AI 구독 탐지 정확도 90% 미만',
      metric:           kpiMetrics.detectionAccuracy,
      threshold:        90,
      evaluationPeriods:3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    }).addAlarmAction(new actions.SnsAction(alarmTopic));

    // ── MVP KPI 대시보드 ─────────────────────────────────────────────────
    new cloudwatch.Dashboard(this, 'KpiDashboard', {
      dashboardName: 'SubTrack-KPI',
      widgets: [
        // Row 1: 사용자 지표
        [
          new cloudwatch.SingleValueWidget({
            title:   'MAU (월간 활성 사용자)',
            metrics: [kpiMetrics.mau],
            width:   6, height: 4,
          }),
          new cloudwatch.SingleValueWidget({
            title:   '카드 연동률',
            metrics: [kpiMetrics.cardLinkRate],
            width:   6, height: 4,
          }),
          new cloudwatch.SingleValueWidget({
            title:   'D-3 알림 CTR',
            metrics: [kpiMetrics.notificationCtr],
            width:   6, height: 4,
          }),
          new cloudwatch.SingleValueWidget({
            title:   '해지 안내 완료율',
            metrics: [kpiMetrics.cancellationGuideRate],
            width:   6, height: 4,
          }),
        ],
        // Row 2: 기술 성능 지표
        [
          new cloudwatch.GraphWidget({
            title: 'API 응답 시간 추이 (P50/P95)',
            left: [
              new cloudwatch.Metric({ namespace: 'SubTrack/API', metricName: 'ResponseTime', statistic: 'p50', period: cdk.Duration.minutes(5) }),
              new cloudwatch.Metric({ namespace: 'SubTrack/API', metricName: 'ResponseTime', statistic: 'p95', period: cdk.Duration.minutes(5) }),
            ],
            leftAnnotations: [{ value: 1500, color: '#FF0000', label: 'P95 목표 (1.5s)' }],
            width: 12, height: 6,
          }),
          new cloudwatch.GraphWidget({
            title: 'AI 탐지 정확도 추이',
            left: [kpiMetrics.detectionAccuracy],
            leftAnnotations: [{ value: 90, color: '#FF6600', label: '목표 (90%)' }],
            width: 12, height: 6,
          }),
        ],
        // Row 3: 인프라 건강도
        [
          new cloudwatch.GraphWidget({
            title: 'ECS 태스크 수 (Auto Scaling)',
            left: [
              new cloudwatch.Metric({ namespace: 'ECS/ContainerInsights', metricName: 'RunningTaskCount', dimensionsMap: { ServiceName: 'subtrack-api', ClusterName: 'subtrack-prod' } }),
            ],
            leftAnnotations: [{ value: 50, color: '#FF0000', label: '최대 (50)' }],
            width: 8, height: 4,
          }),
          new cloudwatch.GraphWidget({
            title: 'RDS 연결 수',
            left: [new cloudwatch.Metric({ namespace: 'AWS/RDS', metricName: 'DatabaseConnections', period: cdk.Duration.minutes(1) })],
            width: 8, height: 4,
          }),
          new cloudwatch.GraphWidget({
            title: 'Redis 캐시 히트율',
            left: [new cloudwatch.Metric({ namespace: 'AWS/ElastiCache', metricName: 'CacheHitRate', period: cdk.Duration.minutes(5) })],
            width: 8, height: 4,
          }),
        ],
      ],
    });
  }
}
