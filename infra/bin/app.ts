import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../stacks/AuthStack';
import { StorageStack } from '../stacks/StorageStack';
import { ApiStack } from '../stacks/ApiStack';
import { FrontendStack } from '../stacks/FrontendStack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-3',
};

const authStack = new AuthStack(app, 'GalleryAuthStack', { env });

const storageStack = new StorageStack(app, 'GalleryStorageStack', { env });

const apiStack = new ApiStack(app, 'GalleryApiStack', {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  mediaBucket: storageStack.mediaBucket,
  exportsBucket: storageStack.exportsBucket,
});
apiStack.addDependency(authStack);
apiStack.addDependency(storageStack);

const frontendStack = new FrontendStack(app, 'GalleryFrontendStack', {
  env,
  adminBucket: storageStack.adminBucket,
  galleryBucket: storageStack.galleryBucket,
  mediaBucket: storageStack.mediaBucket,
});
frontendStack.addDependency(storageStack);
