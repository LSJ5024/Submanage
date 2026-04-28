import * as cdk  from 'aws-cdk-lib';
import * as ec2   from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class SubTrackNetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly cacheSecurityGroup: ec2.SecurityGroup;
  public readonly apiSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ── VPC ────────────────────────────────────────────────────────────────
    this.vpc = new ec2.Vpc(this, 'SubTrackVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public',   subnetType: ec2.SubnetType.PUBLIC,           cidrMask: 24 },
        { name: 'Private',  subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'Isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // ── API 서버 보안 그룹 ─────────────────────────────────────────────────
    this.apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSG', {
      vpc: this.vpc,
      description: 'SubTrack API Server Security Group',
      allowAllOutbound: true,
    });
    this.apiSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    this.apiSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  'HTTP (redirect)');

    // ── RDS 보안 그룹 (API SG에서만 접근 허용) ─────────────────────────────
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSG', {
      vpc: this.vpc,
      description: 'SubTrack RDS Security Group',
      allowAllOutbound: false,
    });
    this.dbSecurityGroup.addIngressRule(this.apiSecurityGroup, ec2.Port.tcp(5432), 'PostgreSQL from API');

    // ── Redis 보안 그룹 ────────────────────────────────────────────────────
    this.cacheSecurityGroup = new ec2.SecurityGroup(this, 'CacheSG', {
      vpc: this.vpc,
      description: 'SubTrack Redis Security Group',
      allowAllOutbound: false,
    });
    this.cacheSecurityGroup.addIngressRule(this.apiSecurityGroup, ec2.Port.tcp(6379), 'Redis from API');

    // ── 출력 ────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId });
  }
}
