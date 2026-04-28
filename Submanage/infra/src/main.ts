import * as cdk from 'aws-cdk-lib';

import { SubTrackNetworkStack }  from './stacks/network.stack';
import { SubTrackDatabaseStack } from './stacks/database.stack';
import { SubTrackCacheStack }    from './stacks/cache.stack';
import { SubTrackSecretsStack }  from './stacks/secrets.stack';
import { SubTrackMonitorStack }  from './stacks/monitor.stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region:  process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-2',
};

// 1. 네트워크 (VPC)
const networkStack = new SubTrackNetworkStack(app, 'SubTrackNetwork', { env });

// 2. 데이터베이스 (RDS PostgreSQL)
const dbStack = new SubTrackDatabaseStack(app, 'SubTrackDatabase', {
  env,
  vpc: networkStack.vpc,
  dbSecurityGroup: networkStack.dbSecurityGroup,
});
dbStack.addDependency(networkStack);

// 3. 캐시 (ElastiCache Redis)
const cacheStack = new SubTrackCacheStack(app, 'SubTrackCache', {
  env,
  vpc: networkStack.vpc,
  cacheSecurityGroup: networkStack.cacheSecurityGroup,
});
cacheStack.addDependency(networkStack);

// 4. 시크릿 관리 (Secrets Manager)
const secretsStack = new SubTrackSecretsStack(app, 'SubTrackSecrets', { env });

// 5. 모니터링 (CloudWatch)
const monitorStack = new SubTrackMonitorStack(app, 'SubTrackMonitor', { env });
monitorStack.addDependency(dbStack);
monitorStack.addDependency(cacheStack);

app.synth();
