import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });
const USER_POOL_ID = process.env.USER_POOL_ID!;

export interface AuthContext {
  sub: string;
  email: string;
  groups: string[];
  isAdmin: boolean;
}

const parseGroupsClaim = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : raw.split(',').map((g) => g.trim()).filter(Boolean);
  } catch {
    return raw.split(',').map((g) => g.trim()).filter(Boolean);
  }
};

export const getAuthContext = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<AuthContext> => {
  const claims = event.requestContext.authorizer.jwt.claims;
  const sub = claims['sub'] as string;
  const email = claims['email'] as string ?? '';

  console.log('[auth] claims keys:', Object.keys(claims).join(', '));
  console.log('[auth] cognito:groups raw:', JSON.stringify(claims['cognito:groups']));

  let groups = parseGroupsClaim(claims['cognito:groups']);

  if (groups.length === 0) {
    console.log('[auth] groups absent from JWT claims, falling back to Cognito API');
    try {
      const username = (claims['cognito:username'] as string | undefined) ?? sub;
      const result = await cognito.send(
        new AdminListGroupsForUserCommand({ UserPoolId: USER_POOL_ID, Username: username }),
      );
      groups = (result.Groups ?? []).map((g) => g.GroupName ?? '').filter(Boolean);
      console.log('[auth] groups from Cognito API:', groups);
    } catch (err) {
      console.error('[auth] Cognito group lookup failed:', err);
    }
  }

  return { sub, email, groups, isAdmin: groups.includes('admin') };
};
