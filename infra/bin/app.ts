import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../stacks/AuthStack';
import { InfraStack } from '../stacks/InfraStack';
import { ApiStack } from '../stacks/ApiStack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-3',
};

const authStack = new AuthStack(app, 'GalleryAuthStack', { env });

const infraStack = new InfraStack(app, 'GalleryInfraStack', { env });

const apiStack = new ApiStack(app, 'GalleryApiStack', {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  mediaBucket: infraStack.mediaBucket,
  exportsBucket: infraStack.exportsBucket,
});
apiStack.addDependency(authStack);
apiStack.addDependency(infraStack);
