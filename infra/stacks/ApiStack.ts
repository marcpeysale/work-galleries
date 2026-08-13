import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  mediaBucket: s3.Bucket;
  exportsBucket: s3.Bucket;
  adminDistribution: cloudfront.Distribution;
  galleryDistribution: cloudfront.Distribution;
  mediaDistribution: cloudfront.Distribution;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'GalleryTable', {
      tableName: 'gallery-table',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const allowedOrigins = [
      'https://admin.peysale.com',
      'https://galeries.peysale.com',
      `https://${props.adminDistribution.distributionDomainName}`,
      `https://${props.galleryDistribution.distributionDomainName}`,
      'http://localhost:5173',
      'http://localhost:5174',
    ];
    const environment: Record<string, string> = {
      TABLE_NAME: table.tableName,
      MEDIA_BUCKET: props.mediaBucket.bucketName,
      EXPORTS_BUCKET: props.exportsBucket.bucketName,
      USER_POOL_ID: props.userPool.userPoolId,
      REGION: this.region,
      ALLOWED_ORIGINS: allowedOrigins.join(','),
      MEDIA_DOMAIN: props.mediaDistribution.distributionDomainName,
    };

    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_24_X,
      environment,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      architecture: lambda.Architecture.ARM_64,
    };

    const usersHandler = new lambda.Function(this, 'UsersHandler', {
      ...lambdaDefaults,
      functionName: 'gallery-users',
      handler: 'users.handler',
      code: lambda.Code.fromAsset('../packages/api/dist'),
      description: 'Gestion des utilisateurs Cognito',
    });

    const projectsHandler = new lambda.Function(this, 'ProjectsHandler', {
      ...lambdaDefaults,
      functionName: 'gallery-projects',
      handler: 'projects.handler',
      code: lambda.Code.fromAsset('../packages/api/dist'),
      description: 'CRUD projets DynamoDB',
    });

    const mediaHandler = new lambda.Function(this, 'MediaHandler', {
      ...lambdaDefaults,
      functionName: 'gallery-media',
      handler: 'media.handler',
      code: lambda.Code.fromAsset('../packages/api/dist'),
      description: 'Gestion des médias S3',
    });

    const zipHandler = new lambda.Function(this, 'ZipHandler', {
      ...lambdaDefaults,
      functionName: 'gallery-zip',
      handler: 'zip.handler',
      code: lambda.Code.fromAsset('../packages/api/dist'),
      description: 'Génération ZIP exports',
      timeout: cdk.Duration.minutes(15),
      memorySize: 3008,
    });

    const invitesHandler = new lambda.Function(this, 'InvitesHandler', {
      ...lambdaDefaults,
      functionName: 'gallery-invites',
      handler: 'invites.handler',
      code: lambda.Code.fromAsset('../packages/api/dist'),
      description: "Gestion des liens d'invitation clients",
    });

    const thumbnailsHandler = new nodejs.NodejsFunction(this, 'ThumbnailsHandler', {
      functionName: 'gallery-thumbnails',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.X86_64,
      entry: path.resolve(__dirname, '../../packages/api/src/handlers/thumbnails.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(__dirname, '../../pnpm-lock.yaml'),
      projectRoot: path.resolve(__dirname, '../..'),
      environment: {
        TABLE_NAME: table.tableName,
        REGION: this.region,
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 1536,
      bundling: {
        target: 'node24',
        nodeModules: ['sharp'],
        forceDockerBundling: true,
        minify: true,
        sourceMap: false,
      },
      description: 'Génération des miniatures WebP',
    });

    table.grantReadWriteData(usersHandler);
    table.grantReadWriteData(projectsHandler);
    table.grantReadData(mediaHandler);
    table.grantReadWriteData(mediaHandler);
    table.grantReadWriteData(zipHandler);
    table.grantReadWriteData(invitesHandler);
    table.grantReadWriteData(thumbnailsHandler);

    props.mediaBucket.grantReadWrite(mediaHandler);
    props.mediaBucket.grantRead(zipHandler);
    props.mediaBucket.grantReadWrite(thumbnailsHandler);
    props.exportsBucket.grantReadWrite(zipHandler);

    const thumbnailRule = new events.Rule(this, 'ThumbnailObjectCreatedRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [props.mediaBucket.bucketName] },
          object: { key: [{ wildcard: 'projects/*/photos/*' }] },
        },
      },
    });
    thumbnailRule.addTarget(new targets.LambdaFunction(thumbnailsHandler, {
      retryAttempts: 2,
      maxEventAge: cdk.Duration.hours(2),
    }));

    const groupLookupPolicy = new iam.PolicyStatement({
      actions: ['cognito-idp:AdminListGroupsForUser'],
      resources: [props.userPool.userPoolArn],
    });
    [usersHandler, projectsHandler, mediaHandler, zipHandler, invitesHandler].forEach((fn) =>
      fn.addToRolePolicy(groupLookupPolicy),
    );

    usersHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminDisableUser',
        'cognito-idp:AdminEnableUser',
        'cognito-idp:AdminResetUserPassword',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminRemoveUserFromGroup',
        'cognito-idp:ListUsers',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminUpdateUserAttributes',
      ],
      resources: [props.userPool.userPoolArn],
    }));

    const authorizer = new authorizers.HttpJwtAuthorizer('CognitoAuthorizer', props.userPool.userPoolProviderUrl, {
      jwtAudience: [props.userPoolClient.userPoolClientId],
    });

    const api = new apigateway.HttpApi(this, 'GalleryApi', {
      apiName: 'gallery-api',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PUT,
          apigateway.CorsHttpMethod.DELETE,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: allowedOrigins,
        maxAge: cdk.Duration.hours(1),
      },
    });

    const usersIntegration = new integrations.HttpLambdaIntegration('UsersIntegration', usersHandler);
    const projectsIntegration = new integrations.HttpLambdaIntegration('ProjectsIntegration', projectsHandler);
    const mediaIntegration = new integrations.HttpLambdaIntegration('MediaIntegration', mediaHandler);
    const zipIntegration = new integrations.HttpLambdaIntegration('ZipIntegration', zipHandler);
    const invitesIntegration = new integrations.HttpLambdaIntegration('InvitesIntegration', invitesHandler);

    const adminRoutes: Array<{ method: apigateway.HttpMethod; path: string; integration: integrations.HttpLambdaIntegration }> = [
      { method: apigateway.HttpMethod.GET, path: '/admin/users', integration: usersIntegration },
      { method: apigateway.HttpMethod.POST, path: '/admin/users', integration: usersIntegration },
      { method: apigateway.HttpMethod.GET, path: '/admin/users/{userId}', integration: usersIntegration },
      { method: apigateway.HttpMethod.PUT, path: '/admin/users/{userId}/suspend', integration: usersIntegration },
      { method: apigateway.HttpMethod.PUT, path: '/admin/users/{userId}/activate', integration: usersIntegration },
      { method: apigateway.HttpMethod.POST, path: '/admin/users/{userId}/reset-password', integration: usersIntegration },
      { method: apigateway.HttpMethod.PUT, path: '/admin/users/{userId}/projects', integration: usersIntegration },
      { method: apigateway.HttpMethod.GET, path: '/admin/projects', integration: projectsIntegration },
      { method: apigateway.HttpMethod.POST, path: '/admin/projects', integration: projectsIntegration },
      { method: apigateway.HttpMethod.GET, path: '/admin/projects/{projectId}', integration: projectsIntegration },
      { method: apigateway.HttpMethod.GET, path: '/admin/projects/{projectId}/users', integration: projectsIntegration },
      { method: apigateway.HttpMethod.POST, path: '/admin/projects/{projectId}/users', integration: projectsIntegration },
      { method: apigateway.HttpMethod.DELETE, path: '/admin/projects/{projectId}/users/{userId}', integration: projectsIntegration },
      { method: apigateway.HttpMethod.PUT, path: '/admin/projects/{projectId}', integration: projectsIntegration },
      { method: apigateway.HttpMethod.DELETE, path: '/admin/projects/{projectId}', integration: projectsIntegration },
      { method: apigateway.HttpMethod.POST, path: '/admin/projects/{projectId}/media/upload-url', integration: mediaIntegration },
      { method: apigateway.HttpMethod.DELETE, path: '/admin/projects/{projectId}/media/{mediaId}', integration: mediaIntegration },
      { method: apigateway.HttpMethod.GET, path: '/admin/invites', integration: invitesIntegration },
      { method: apigateway.HttpMethod.POST, path: '/admin/invites', integration: invitesIntegration },
      { method: apigateway.HttpMethod.DELETE, path: '/admin/invites/{token}', integration: invitesIntegration },
    ];

    const galleryRoutes: Array<{ method: apigateway.HttpMethod; path: string; integration: integrations.HttpLambdaIntegration }> = [
      { method: apigateway.HttpMethod.GET, path: '/gallery/projects', integration: projectsIntegration },
      { method: apigateway.HttpMethod.GET, path: '/gallery/projects/{projectId}', integration: projectsIntegration },
      { method: apigateway.HttpMethod.GET, path: '/gallery/projects/{projectId}/media', integration: mediaIntegration },
      { method: apigateway.HttpMethod.POST, path: '/gallery/projects/{projectId}/export', integration: zipIntegration },
    ];

    for (const route of [...adminRoutes, ...galleryRoutes]) {
      api.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: route.integration,
        authorizer,
      });
    }

    const inviteRoutes: Array<{ method: apigateway.HttpMethod; path: string; integration: integrations.HttpLambdaIntegration }> = [
      { method: apigateway.HttpMethod.GET, path: '/invite/{token}', integration: invitesIntegration },
      { method: apigateway.HttpMethod.GET, path: '/invite/{token}/projects', integration: projectsIntegration },
      { method: apigateway.HttpMethod.GET, path: '/invite/{token}/projects/{projectId}', integration: projectsIntegration },
      { method: apigateway.HttpMethod.GET, path: '/invite/{token}/projects/{projectId}/media', integration: mediaIntegration },
      { method: apigateway.HttpMethod.POST, path: '/invite/{token}/projects/{projectId}/export', integration: zipIntegration },
    ];

    for (const route of inviteRoutes) {
      api.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: route.integration,
      });
    }

    this.apiUrl = api.apiEndpoint;

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
      exportName: 'GalleryApiUrl',
    });
    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      exportName: 'GalleryTableName',
    });
  }
}
