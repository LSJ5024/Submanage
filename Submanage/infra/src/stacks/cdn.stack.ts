import * as cdk        from 'aws-cdk-lib';
import * as s3         from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins    from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy   from 'aws-cdk-lib/aws-s3-deployment';
import { Construct }   from 'constructs';

/**
 * CloudFront CDN + S3 스택 (TASK-060)
 * - Web 앱 정적 파일 배포
 * - 해지 가이드 스크린샷 저장
 * - API 응답 캐싱 (대시보드 초기 로딩 2초 목표)
 */
export class SubTrackCdnStack extends cdk.Stack {
  public readonly webBucket:    s3.Bucket;
  public readonly assetsBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ── Web 앱 S3 버킷 ────────────────────────────────────────────────────
    this.webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName:          `subtrack-web-${this.account}`,
      blockPublicAccess:   s3.BlockPublicAccess.BLOCK_ALL, // CloudFront OAC로만 접근
      removalPolicy:       cdk.RemovalPolicy.RETAIN,
      versioned:           true,
      encryption:          s3.BucketEncryption.S3_MANAGED,
    });

    // ── 정적 자산 버킷 (해지 가이드 스크린샷 등) ──────────────────────────
    this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName:        `subtrack-assets-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:     cdk.RemovalPolicy.RETAIN,
      cors: [{
        allowedMethods:  [s3.HttpMethods.GET],
        allowedOrigins:  ['https://subtrack.app', 'https://www.subtrack.app'],
        allowedHeaders:  ['*'],
        maxAge:          3600,
      }],
    });

    // ── CloudFront OAC ─────────────────────────────────────────────────────
    const oac = new cloudfront.S3OriginAccessControl(this, 'WebOac', {
      description: 'SubTrack Web OAC',
    });

    // ── CloudFront 배포 ───────────────────────────────────────────────────
    this.distribution = new cloudfront.Distribution(this, 'SubTrackDistribution', {
      comment:           'SubTrack Web + API CDN',
      defaultRootObject: 'index.html',
      priceClass:        cloudfront.PriceClass.PRICE_CLASS_200, // 한국 포함 리전

      // Web SPA (S3)
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.webBucket, { originAccessControl: oac }),
        viewerProtocolPolicy:   cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:            cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy:  cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        allowedMethods:         cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress:               true,
      },

      additionalBehaviors: {
        // API 프록시 — 캐시 없음 (동적 데이터)
        '/api/*': {
          // 실제 배포 시 ALB origin으로 변경
          origin: new origins.HttpOrigin('api.subtrack.app', {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy:          cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods:       cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy:  cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },

        // 정적 자산 (스크린샷, 이미지) — 1일 캐시
        '/assets/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(this.assetsBucket, { originAccessControl: oac }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy:          cloudfront.CachePolicy.CACHING_OPTIMIZED,
          allowedMethods:       cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
      },

      // SPA 라우팅 — 404를 index.html로 반환
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],

      // WAF 연결 (별도 WAF 스택 구성 시 활성화)
      // webAclId: wafStack.webAclArn,
    });

    // ── 버킷 정책 (CloudFront OAC 허용) ──────────────────────────────────
    this.webBucket.addToResourcePolicy(new (require('aws-cdk-lib/aws-iam').PolicyStatement)({
      principals: [new (require('aws-cdk-lib/aws-iam').ServicePrincipal)('cloudfront.amazonaws.com')],
      actions:    ['s3:GetObject'],
      resources:  [`${this.webBucket.bucketArn}/*`],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`,
        },
      },
    }));

    // ── 출력 ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'WebBucketName',      { value: this.webBucket.bucketName });
    new cdk.CfnOutput(this, 'AssetsBucketName',   { value: this.assetsBucket.bucketName });
    new cdk.CfnOutput(this, 'CloudFrontUrl',      { value: `https://${this.distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'DistributionId',     { value: this.distribution.distributionId });
  }
}
