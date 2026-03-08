import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

export interface AuthContext {
  sub: string;
  email: string;
  groups: string[];
  isAdmin: boolean;
}

export const getAuthContext = (event: APIGatewayProxyEventV2WithJWTAuthorizer): AuthContext => {
  const claims = event.requestContext.authorizer.jwt.claims;
  const groups: string[] = JSON.parse((claims['cognito:groups'] as string | undefined) ?? '[]');
  return {
    sub: claims['sub'] as string,
    email: claims['email'] as string,
    groups,
    isAdmin: groups.includes('admin'),
  };
};
