import * as cdk       from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns        from 'aws-cdk-lib/aws-sns';
import * as actions    from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs       from 'aws-cdk-lib/aws-logs';
import { Construct }   from 'constructs';

export class SubTrackMonitorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ── 알람 수신 SNS 토픽 ─────────────────────────────────────────────────
    const alarmTopic = new sns.Topic(this, 'SubTrackAlarmTopic', {
      topicName: 'subtrack-alarms',
      displayName: 'SubTrack 장애 알람',
    });

    // ── CloudWatch 로그 그룹 (CLAUDE.md §11) ──────────────────────────────
    const logGroups = [
      { name: '/subtrack/api',       retention: logs.RetentionDays.ONE_MONTH },
      { name: '/subtrack/ai-engine', retention: logs.RetentionDays.ONE_MONTH },
      { name: '/subtrack/scheduler', retention: logs.RetentionDays.ONE_MONTH },
    ];

    logGroups.forEach(({ name, retention }) => {
      new logs.LogGroup(this, name.replace(/\//g, '-'), {
        logGroupName: name,
        retention,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });
    });

    // ── API P95 응답 시간 알람 (목표: 1.5초, 경고: 1초) ────────────────────
    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName:        'SubTrack-API-P95-Latency',
      alarmDescription: 'API P95 응답 시간 1.5초 초과 — PRD NFR-PERF 위반',
      metric: new cloudwatch.Metric({
        namespace:  'SubTrack/API',
        metricName: 'ResponseTime',
        statistic:  'p95',
        period:     cdk.Duration.minutes(5),
      }),
      threshold:          1500,  // ms
      evaluationPeriods:  3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData:   cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiLatencyAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // ── API 5xx 에러율 알람 ────────────────────────────────────────────────
    const errorRateAlarm = new cloudwatch.Alarm(this, 'ApiErrorRateAlarm', {
      alarmName:        'SubTrack-API-Error-Rate',
      alarmDescription: 'API 5xx 에러율 1% 초과',
      metric: new cloudwatch.Metric({
        namespace:  'SubTrack/API',
        metricName: 'ErrorRate5xx',
        statistic:  'Average',
        period:     cdk.Duration.minutes(5),
      }),
      threshold:          1,   // 1%
      evaluationPeriods:  2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    errorRateAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // ── RDS CPU 알람 ───────────────────────────────────────────────────────
    new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
      alarmName:        'SubTrack-RDS-CPU',
      alarmDescription: 'RDS CPU 사용률 80% 초과',
      metric: new cloudwatch.Metric({
        namespace:  'AWS/RDS',
        metricName: 'CPUUtilization',
        statistic:  'Average',
        period:     cdk.Duration.minutes(5),
      }),
      threshold:          80,
      evaluationPeriods:  3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    }).addAlarmAction(new actions.SnsAction(alarmTopic));

    // ── 대시보드 ────────────────────────────────────────────────────────────
    new cloudwatch.Dashboard(this, 'SubTrackDashboard', {
      dashboardName: 'SubTrack-Operations',
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: 'API 응답 시간 (P50/P95/P99)',
            left: [
              new cloudwatch.Metric({ namespace: 'SubTrack/API', metricName: 'ResponseTime', statistic: 'p50'  }),
              new cloudwatch.Metric({ namespace: 'SubTrack/API', metricName: 'ResponseTime', statistic: 'p95'  }),
              new cloudwatch.Metric({ namespace: 'SubTrack/API', metricName: 'ResponseTime', statistic: 'p99'  }),
            ],
            width: 12,
          }),
          new cloudwatch.GraphWidget({
            title: 'API 요청 수 / 에러율',
            left: [new cloudwatch.Metric({ namespace: 'SubTrack/API', metricName: 'RequestCount', statistic: 'Sum' })],
            right: [new cloudwatch.Metric({ namespace: 'SubTrack/API', metricName: 'ErrorRate5xx', statistic: 'Average' })],
            width: 12,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'RDS CPU / 커넥션',
            left: [new cloudwatch.Metric({ namespace: 'AWS/RDS', metricName: 'CPUUtilization' })],
            right: [new cloudwatch.Metric({ namespace: 'AWS/RDS', metricName: 'DatabaseConnections' })],
            width: 12,
          }),
          new cloudwatch.GraphWidget({
            title: 'Redis 메모리 / 히트율',
            left: [new cloudwatch.Metric({ namespace: 'AWS/ElastiCache', metricName: 'BytesUsedForCache' })],
            right: [new cloudwatch.Metric({ namespace: 'AWS/ElastiCache', metricName: 'CacheHitRate' })],
            width: 12,
          }),
        ],
      ],
    });
  }
}
