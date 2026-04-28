import * as cdk  from 'aws-cdk-lib';
import * as ec2   from 'aws-cdk-lib/aws-ec2';
import * as rds   from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

interface Props extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class SubTrackDatabaseStack extends cdk.Stack {
  public readonly dbInstance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { vpc, dbSecurityGroup } = props;

    // ── RDS PostgreSQL 16 (CLAUDE.md §2) ──────────────────────────────────
    this.dbInstance = new rds.DatabaseInstance(this, 'SubTrackRds', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      databaseName: 'subtrack',
      credentials: rds.Credentials.fromGeneratedSecret('subtrack_admin', {
        secretName: 'subtrack/rds/credentials',
      }),
      multiAz: true,               // 프로덕션 고가용성
      allocatedStorage: 100,       // GB
      maxAllocatedStorage: 500,    // 자동 스케일 최대값
      storageEncrypted: true,      // 암호화 (CLAUDE.md §7)
      deletionProtection: true,
      backupRetention: cdk.Duration.days(7),  // 일 1회 스냅샷, 7일 보존 (TASK-060)
      preferredBackupWindow: '18:00-19:00',   // UTC (한국 시간 03:00)
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
    });

    // ── 읽기 복제본 (TASK-060) ─────────────────────────────────────────────
    new rds.DatabaseInstanceReadReplica(this, 'SubTrackRdsReadReplica', {
      sourceDatabaseInstance: this.dbInstance,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
    });

    // ── 출력 ────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: this.dbInstance.instanceEndpoint.hostname,
    });
  }
}
