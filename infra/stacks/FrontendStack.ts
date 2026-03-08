import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

interface FrontendStackProps extends cdk.StackProps {
  adminBucket: s3.Bucket;
  galleryBucket: s3.Bucket;
  mediaBucket: s3.Bucket;
}

export class FrontendStack extends cdk.Stack {
  public readonly adminDistribution: cloudfront.Distribution;
  public readonly galleryDistribution: cloudfront.Distribution;
  public readonly mediaDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const spaErrorResponse: cloudfront.ErrorResponse = {
      httpStatus: 403,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
      ttl: cdk.Duration.seconds(0),
    };

    const adminOai = new cloudfront.OriginAccessIdentity(this, 'AdminOai');
    props.adminBucket.grantRead(adminOai);

    this.adminDistribution = new cloudfront.Distribution(this, 'AdminDistribution', {
      comment: 'Gallery admin back-office',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(props.adminBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      errorResponses: [spaErrorResponse, { ...spaErrorResponse, httpStatus: 404 }],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    const galleryOai = new cloudfront.OriginAccessIdentity(this, 'GalleryOai');
    props.galleryBucket.grantRead(galleryOai);

    this.galleryDistribution = new cloudfront.Distribution(this, 'GalleryDistribution', {
      comment: 'Gallery client portal',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(props.galleryBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      errorResponses: [spaErrorResponse, { ...spaErrorResponse, httpStatus: 404 }],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    this.mediaDistribution = new cloudfront.Distribution(this, 'MediaDistribution', {
      comment: 'Gallery media CDN (photos + vidéos)',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(props.mediaBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, 'MediaCachePolicy', {
          defaultTtl: cdk.Duration.hours(24),
          maxTtl: cdk.Duration.days(7),
          minTtl: cdk.Duration.seconds(0),
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new cdk.CfnOutput(this, 'AdminDistributionDomain', {
      value: this.adminDistribution.distributionDomainName,
      exportName: 'GalleryAdminDomain',
    });
    new cdk.CfnOutput(this, 'AdminDistributionId', {
      value: this.adminDistribution.distributionId,
      exportName: 'GalleryAdminDistributionId',
    });
    new cdk.CfnOutput(this, 'GalleryDistributionDomain', {
      value: this.galleryDistribution.distributionDomainName,
      exportName: 'GalleryClientDomain',
    });
    new cdk.CfnOutput(this, 'GalleryDistributionId', {
      value: this.galleryDistribution.distributionId,
      exportName: 'GalleryClientDistributionId',
    });
    new cdk.CfnOutput(this, 'MediaDistributionDomain', {
      value: this.mediaDistribution.distributionDomainName,
      exportName: 'GalleryMediaDomain',
    });
  }
}
