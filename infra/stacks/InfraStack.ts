import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class InfraStack extends cdk.Stack {
  public readonly mediaBucket: s3.Bucket;
  public readonly exportsBucket: s3.Bucket;
  public readonly adminDistribution: cloudfront.Distribution;
  public readonly galleryDistribution: cloudfront.Distribution;
  public readonly mediaDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `gallery-media-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        { id: 'expire-multipart-uploads', abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.exportsBucket = new s3.Bucket(this, 'ExportsBucket', {
      bucketName: `gallery-exports-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        { id: 'expire-zip-exports', expiration: cdk.Duration.days(1) },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const adminBucket = new s3.Bucket(this, 'AdminBucket', {
      bucketName: `gallery-admin-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const galleryBucket = new s3.Bucket(this, 'GalleryBucket', {
      bucketName: `gallery-client-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const spaErrorResponse: cloudfront.ErrorResponse = {
      httpStatus: 403,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
      ttl: cdk.Duration.seconds(0),
    };

    this.adminDistribution = new cloudfront.Distribution(this, 'AdminDistribution', {
      comment: 'Gallery admin back-office',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(adminBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      errorResponses: [spaErrorResponse, { ...spaErrorResponse, httpStatus: 404 }],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    this.galleryDistribution = new cloudfront.Distribution(this, 'GalleryDistribution', {
      comment: 'Gallery client portal',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(galleryBucket),
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
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.mediaBucket),
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

    this.mediaBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
      allowedOrigins: [
        'https://admin.peysale.com',
        'https://gallery.peysale.com',
        `https://${this.adminDistribution.distributionDomainName}`,
        `https://${this.galleryDistribution.distributionDomainName}`,
      ],
      allowedHeaders: ['*'],
      maxAge: 3000,
    });

    new cdk.CfnOutput(this, 'MediaBucketName', { value: this.mediaBucket.bucketName, exportName: 'GalleryMediaBucketName' });
    new cdk.CfnOutput(this, 'AdminBucketName', { value: adminBucket.bucketName, exportName: 'GalleryAdminBucketName' });
    new cdk.CfnOutput(this, 'GalleryBucketName', { value: galleryBucket.bucketName, exportName: 'GalleryClientBucketName' });
    new cdk.CfnOutput(this, 'AdminDistributionDomain', { value: this.adminDistribution.distributionDomainName, exportName: 'GalleryAdminDomain' });
    new cdk.CfnOutput(this, 'AdminDistributionId', { value: this.adminDistribution.distributionId, exportName: 'GalleryAdminDistributionId' });
    new cdk.CfnOutput(this, 'GalleryDistributionDomain', { value: this.galleryDistribution.distributionDomainName, exportName: 'GalleryClientDomain' });
    new cdk.CfnOutput(this, 'GalleryDistributionId', { value: this.galleryDistribution.distributionId, exportName: 'GalleryClientDistributionId' });
    new cdk.CfnOutput(this, 'MediaDistributionDomain', { value: this.mediaDistribution.distributionDomainName, exportName: 'GalleryMediaDomain' });
    new cdk.CfnOutput(this, 'MediaDistributionId', { value: this.mediaDistribution.distributionId, exportName: 'GalleryMediaDistributionId' });
  }
}
