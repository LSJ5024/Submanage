import * as cdk     from 'aws-cdk-lib';
import * as lambda  from 'aws-cdk-lib/aws-lambda';
import * as events  from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam     from 'aws-cdk-lib/aws-iam';
import * as logs    from 'aws-cdk-lib/aws-logs';
import * as ec2     from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface Props extends cdk.StackProps {
  vpc: ec2.Vpc;
}

/**
 * Lambda 스케줄러 스택 (TASK-023, TASK-020 Lambda 증분 동기화)
 *
 * 스케줄:
 * - D-3 알림 스케줄러: 매일 01:00 UTC (한국 10:00)
 * - 증분 동기화:       매일 15:00 UTC (한국 00:00 자정)
 *
 * 아키텍처:
 * EventBridge Rule → Lambda → ECS API 서버 /internal/scheduler 호출
 * (Lambda는 VPC 내부에서 실행하여 ECS 내부망 호출 가능)
 */
export class SubTrackSchedulerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { vpc } = props;

    // ── Lambda 실행 역할 ─────────────────────────────────────────────────
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });
    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:subtrack/*`],
    }));
    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['*'],
    }));

    // ── Lambda 보안 그룹 (API 서버 내부망 접근) ──────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, 'SchedulerLambdaSg', {
      vpc,
      description: 'SubTrack Scheduler Lambda SG',
      allowAllOutbound: true,
    });

    // ── 공통 Lambda 설정 ─────────────────────────────────────────────────
    const commonLambdaProps: Omit<lambda.FunctionProps, 'functionName' | 'description' | 'handler' | 'code'> = {
      runtime:     lambda.Runtime.NODEJS_20_X,
      architecture:lambda.Architecture.ARM_64, // Graviton2 — 비용 절감
      timeout:     cdk.Duration.minutes(5),
      memorySize:  256,
      role:        schedulerRole,
      vpc,
      vpcSubnets:  { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        API_INTERNAL_URL: `http://subtrack-api.subtrack-prod.local:3000`, // ECS Service Discovery
        NODE_ENV:         'production',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    };

    // ── D-3 알림 스케줄러 Lambda ─────────────────────────────────────────
    const notificationSchedulerFn = new lambda.Function(this, 'NotificationScheduler', {
      ...commonLambdaProps,
      functionName: 'subtrack-notification-scheduler',
      description:  'D-3 결제 예정 알림 발송 스케줄러 (TASK-023)',
      handler:      'index.handler',
      code:         lambda.Code.fromInline(`
        const https = require('https');
        exports.handler = async () => {
          console.log('[Scheduler] D-3 알림 스케줄러 시작');
          // API 서버 내부 엔드포인트 호출
          const url = process.env.API_INTERNAL_URL + '/internal/scheduler/notifications';
          await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Scheduler-Key': process.env.SCHEDULER_SECRET || '',
            },
          });
          console.log('[Scheduler] 알림 스케줄러 완료');
        };
      `),
    });

    // ── 증분 동기화 Lambda ────────────────────────────────────────────────
    const incrementalSyncFn = new lambda.Function(this, 'IncrementalSync', {
      ...commonLambdaProps,
      functionName: 'subtrack-incremental-sync',
      description:  '마이데이터 결제 내역 증분 동기화 (TASK-020)',
      handler:      'index.handler',
      code:         lambda.Code.fromInline(`
        const https = require('https');
        exports.handler = async () => {
          console.log('[Scheduler] 증분 동기화 시작');
          const url = process.env.API_INTERNAL_URL + '/internal/scheduler/sync';
          await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Scheduler-Key': process.env.SCHEDULER_SECRET || '',
            },
          });
          console.log('[Scheduler] 증분 동기화 완료');
        };
      `),
    });

    // ── EventBridge 규칙 ─────────────────────────────────────────────────

    // D-3 알림: 매일 01:00 UTC = 한국 10:00 AM
    const notificationRule = new events.Rule(this, 'D3NotificationRule', {
      ruleName:    'subtrack-d3-notification',
      description: 'D-3 결제 예정 알림 — 매일 오전 10시 (한국)',
      schedule:    events.Schedule.cron({ hour: '1', minute: '0' }),
    });
    notificationRule.addTarget(new targets.LambdaFunction(notificationSchedulerFn, {
      retryAttempts: 2,
      // 실패 시 DLQ로 전송 (별도 SQS 구성 권장)
    }));

    // 증분 동기화: 매일 15:00 UTC = 한국 00:00 자정
    const syncRule = new events.Rule(this, 'IncrementalSyncRule', {
      ruleName:    'subtrack-incremental-sync',
      description: '마이데이터 증분 동기화 — 매일 자정 (한국)',
      schedule:    events.Schedule.cron({ hour: '15', minute: '0' }),
    });
    syncRule.addTarget(new targets.LambdaFunction(incrementalSyncFn, {
      retryAttempts: 2,
    }));

    // ── 출력 ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'NotificationSchedulerArn', { value: notificationSchedulerFn.functionArn });
    new cdk.CfnOutput(this, 'IncrementalSyncArn',       { value: incrementalSyncFn.functionArn });
  }
}
