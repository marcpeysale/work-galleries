import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  mediaBucket: s3.Bucket;
  exportsBucket: s3.Bucket;
  adminDistribution: cloudfront.Distribution;
  galleryDistribution: cloudfront.Distribution;
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

    table.grantReadWriteData(usersHandler);
    table.grantReadWriteData(projectsHandler);
    table.grantReadData(mediaHandler);
    table.grantReadWriteData(mediaHandler);
    table.grantReadData(zipHandler);

    props.mediaBucket.grantReadWrite(mediaHandler);
    props.mediaBucket.grantRead(zipHandler);
    props.exportsBucket.grantReadWrite(zipHandler);

    const groupLookupPolicy = new iam.PolicyStatement({
      actions: ['cognito-idp:AdminListGroupsForUser'],
      resources: [props.userPool.userPoolArn],
    });
    [usersHandler, projectsHandler, mediaHandler, zipHandler].forEach((fn) =>
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
