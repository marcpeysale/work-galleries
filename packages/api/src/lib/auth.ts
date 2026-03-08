import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

export interface AuthContext {
  sub: string;
  email: string;
  groups: string[];
  isAdmin: boolean;
}

export const getAuthContext = (event: APIGatewayProxyEventV2WithJWTAuthorizer): AuthContext => {
  const claims = event.requestContext.authorizer.jwt.claims;
  const raw = claims['cognito:groups'];
  let groups: string[] = [];
  if (Array.isArray(raw)) {
    groups = raw as string[];
  } else if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      groups = Array.isArray(parsed) ? parsed : raw.split(',').map((g) => g.trim()).filter(Boolean);
    } catch {
      groups = raw.split(',').map((g) => g.trim()).filter(Boolean);
    }
  }
  return {
    sub: claims['sub'] as string,
    email: claims['email'] as string,
    groups,
    isAdmin: groups.includes('admin'),
  };
};
