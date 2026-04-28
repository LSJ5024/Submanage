import * as cdk from 'aws-cdk-lib';

import { SubTrackNetworkStack }   from './stacks/network.stack';
import { SubTrackDatabaseStack }  from './stacks/database.stack';
import { SubTrackCacheStack }     from './stacks/cache.stack';
import { SubTrackSecretsStack }   from './stacks/secrets.stack';
import { SubTrackMonitorStack }   from './stacks/monitor.stack';
import { SubTrackComputeStack }   from './stacks/compute.stack';
import { SubTrackCdnStack }       from './stacks/cdn.stack';
import { SubTrackKpiStack }       from './stacks/kpi-monitor.stack';
import { SubTrackSchedulerStack } from './stacks/scheduler.stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region:  process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-2',
};

// 1. 네트워크 (VPC, 서브넷, 보안 그룹)
const networkStack = new SubTrackNetworkStack(app, 'SubTrackNetwork', { env });

// 2. 시크릿 관리 (Secrets Manager)
const secretsStack = new SubTrackSecretsStack(app, 'SubTrackSecrets', { env });

// 3. 데이터베이스 (RDS PostgreSQL Multi-AZ + 읽기 복제본)
const dbStack = new SubTrackDatabaseStack(app, 'SubTrackDatabase', {
  env, vpc: networkStack.vpc, dbSecurityGroup: networkStack.dbSecurityGroup,
});
dbStack.addDependency(networkStack);

// 4. 캐시 (ElastiCache Redis Multi-AZ)
const cacheStack = new SubTrackCacheStack(app, 'SubTrackCache', {
  env, vpc: networkStack.vpc, cacheSecurityGroup: networkStack.cacheSecurityGroup,
});
cacheStack.addDependency(networkStack);

// 5. 컴퓨트 (ECS Fargate + ALB Auto Scaling — 동시 10,000명)
const computeStack = new SubTrackComputeStack(app, 'SubTrackCompute', {
  env, vpc: networkStack.vpc, apiSecurityGroup: networkStack.apiSecurityGroup,
});
computeStack.addDependency(networkStack);
computeStack.addDependency(dbStack);
computeStack.addDependency(cacheStack);
computeStack.addDependency(secretsStack);

// 6. CDN (CloudFront + S3 Web 앱 + 자산)
const cdnStack = new SubTrackCdnStack(app, 'SubTrackCdn', { env });

// 7. Lambda 스케줄러 (D-3 알림 + 마이데이터 증분 동기화)
const schedulerStack = new SubTrackSchedulerStack(app, 'SubTrackScheduler', {
  env, vpc: networkStack.vpc,
});
schedulerStack.addDependency(networkStack);
schedulerStack.addDependency(computeStack);

// 8. 인프라 모니터링 (CloudWatch 알람 + 운영 대시보드)
const monitorStack = new SubTrackMonitorStack(app, 'SubTrackMonitor', { env });
monitorStack.addDependency(computeStack);
monitorStack.addDependency(dbStack);
monitorStack.addDependency(cacheStack);

// 9. KPI 모니터링 (MAU, 카드 연동률, D-3 CTR 등 비즈니스 지표)
const kpiStack = new SubTrackKpiStack(app, 'SubTrackKpi', { env });
kpiStack.addDependency(computeStack);

app.synth();
