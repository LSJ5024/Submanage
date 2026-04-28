import * as cdk          from 'aws-cdk-lib';
import * as ec2          from 'aws-cdk-lib/aws-ec2';
import * as elasticache  from 'aws-cdk-lib/aws-elasticache';
import { Construct }      from 'constructs';

interface Props extends cdk.StackProps {
  vpc: ec2.Vpc;
  cacheSecurityGroup: ec2.SecurityGroup;
}

export class SubTrackCacheStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { vpc, cacheSecurityGroup } = props;

    // ── ElastiCache Redis 7 서브넷 그룹 ─────────────────────────────────────
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'SubTrack Redis Subnet Group',
      subnetIds: vpc.isolatedSubnets.map((s) => s.subnetId),
    });

    // ── Redis 클러스터 (마이데이터 토큰 암호화 저장 — CLAUDE.md §7) ───────────
    new elasticache.CfnReplicationGroup(this, 'SubTrackRedis', {
      replicationGroupDescription: 'SubTrack Redis Cache',
      cacheNodeType: 'cache.t3.medium',
      engine: 'redis',
      engineVersion: '7.1',
      numCacheClusters: 2,              // Multi-AZ
      automaticFailoverEnabled: true,
      atRestEncryptionEnabled: true,    // 저장 시 암호화 (CLAUDE.md §7)
      transitEncryptionEnabled: true,   // TLS 전송 암호화 (CLAUDE.md §7)
      cacheSubnetGroupName: subnetGroup.ref,
      securityGroupIds: [cacheSecurityGroup.securityGroupId],
      snapshotRetentionLimit: 1,
    });
  }
}
