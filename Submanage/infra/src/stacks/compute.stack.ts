import * as cdk         from 'aws-cdk-lib';
import * as ec2         from 'aws-cdk-lib/aws-ec2';
import * as ecs         from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr         from 'aws-cdk-lib/aws-ecr';
import * as iam         from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface Props extends cdk.StackProps {
  vpc: ec2.Vpc;
  apiSecurityGroup: ec2.SecurityGroup;
}

/**
 * ECS Fargate + ALB Auto Scaling 스택 (TASK-060)
 * 동시 접속자 10,000명 목표 — Auto Scaling 적용 (CLAUDE.md §13)
 */
export class SubTrackComputeStack extends cdk.Stack {
  public readonly apiService: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { vpc, apiSecurityGroup } = props;

    // ── ECR 저장소 ────────────────────────────────────────────────────────
    const apiRepo = new ecr.Repository(this, 'ApiRepo', {
      repositoryName: 'subtrack-api',
      removalPolicy:  cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 10 }], // 최근 10개만 보관
    });

    const aiEngineRepo = new ecr.Repository(this, 'AiEngineRepo', {
      repositoryName: 'subtrack-ai-engine',
      removalPolicy:  cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 5 }],
    });

    // ── ECS 클러스터 ───────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'SubTrackCluster', {
      vpc,
      clusterName:        'subtrack-prod',
      containerInsights:  true, // CloudWatch Container Insights 활성화
    });

    // ── IAM 실행 역할 (Secrets Manager 접근) ───────────────────────────────
    const taskRole = new iam.Role(this, 'ApiTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'),
    );
    // Secrets Manager 읽기 권한
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:subtrack/*`],
    }));
    // CloudWatch 로그 쓰기
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: ['*'],
    }));

    // ── API 시크릿 참조 ────────────────────────────────────────────────────
    const jwtSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'JwtSecret', 'subtrack/jwt/access-secret',
    );
    const encryptionKey = secretsmanager.Secret.fromSecretNameV2(
      this, 'EncryptionKey', 'subtrack/crypto/encryption-key',
    );

    // ── Fargate 서비스 (ALB + Auto Scaling) ───────────────────────────────
    this.apiService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this, 'ApiService', {
        cluster,
        serviceName:    'subtrack-api',
        cpu:            512,
        memoryLimitMiB: 1024,
        desiredCount:   2,        // 초기 태스크 수
        securityGroups: [apiSecurityGroup],
        taskSubnets:    { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        taskImageOptions: {
          image:          ecs.ContainerImage.fromEcrRepository(apiRepo, 'latest'),
          containerPort:  3000,
          taskRole,
          environment: {
            NODE_ENV:    'production',
            PORT:        '3000',
            API_VERSION: 'v1',
          },
          secrets: {
            JWT_ACCESS_SECRET:  ecs.Secret.fromSecretsManager(jwtSecret),
            ENCRYPTION_KEY:     ecs.Secret.fromSecretsManager(encryptionKey),
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'subtrack-api',
            logGroup: new (require('aws-cdk-lib/aws-logs').LogGroup)(this, 'ApiLogGroup', {
              logGroupName: '/subtrack/api',
              retention:    30,
            }),
          }),
        },
        publicLoadBalancer: true,
        // TLS 1.3 — 실제 배포 시 ACM 인증서 ARN 설정
        // certificate: acm.Certificate.fromCertificateArn(...)
      },
    );

    // ── 헬스 체크 설정 ─────────────────────────────────────────────────────
    this.apiService.targetGroup.configureHealthCheck({
      path:                '/health',
      healthyHttpCodes:    '200',
      interval:            cdk.Duration.seconds(15),
      timeout:             cdk.Duration.seconds(5),
      healthyThresholdCount:   2,
      unhealthyThresholdCount: 3,
    });

    // ── Auto Scaling (동시 접속자 10,000명 목표, CLAUDE.md §13) ─────────────
    const scaling = this.apiService.service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 50, // Fargate 50 tasks → 동시 처리 충분
    });

    // CPU 기반 스케일 아웃: 70% 초과 시
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown:          cdk.Duration.seconds(60),
      scaleOutCooldown:         cdk.Duration.seconds(30),
    });

    // 요청 수 기반 스케일 아웃: 태스크당 1,000 RPS
    scaling.scaleOnRequestCount('RequestScaling', {
      requestsPerTarget:  1000,
      targetGroup:        this.apiService.targetGroup,
      scaleInCooldown:    cdk.Duration.seconds(60),
      scaleOutCooldown:   cdk.Duration.seconds(30),
    });

    // ── AI 엔진 서비스 (내부 전용 — ALB 없음) ─────────────────────────────
    const aiTaskDef = new ecs.FargateTaskDefinition(this, 'AiTaskDef', {
      cpu:            1024, // AI 처리에 더 많은 CPU 필요
      memoryLimitMiB: 2048,
      taskRole,
    });
    aiTaskDef.addContainer('AiEngine', {
      image:          ecs.ContainerImage.fromEcrRepository(aiEngineRepo, 'latest'),
      portMappings:   [{ containerPort: 8000 }],
      environment: {
        PYTHON_ENV: 'production',
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'subtrack-ai-engine' }),
    });

    new ecs.FargateService(this, 'AiEngineService', {
      cluster,
      serviceName:    'subtrack-ai-engine',
      taskDefinition: aiTaskDef,
      desiredCount:   2,
      // 내부 서비스 — 외부 노출 없음 (CLAUDE.md §4)
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // ── 출력 ────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value:       `http://${this.apiService.loadBalancer.loadBalancerDnsName}`,
      description: 'API 서버 URL (HTTPS 인증서 적용 후 https로 변경)',
    });
    new cdk.CfnOutput(this, 'ApiRepoUri',      { value: apiRepo.repositoryUri });
    new cdk.CfnOutput(this, 'AiEngineRepoUri', { value: aiEngineRepo.repositoryUri });
  }
}
