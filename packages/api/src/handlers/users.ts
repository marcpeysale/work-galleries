import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminResetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  ListUsersCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../lib/dynamo';
import { getAuthContext } from '../lib/auth';
import * as res from '../lib/response';
import type { CreateUserInput } from '@gallery/shared';

const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION });
const USER_POOL_ID = process.env.USER_POOL_ID!;

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers['origin'];

  try {
    const auth = await getAuthContext(event);
    if (!auth.isAdmin) return res.forbidden(origin);

    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    const userId = event.pathParameters?.['userId'];

    if (method === 'GET' && path === '/admin/users') {
      const result = await cognito.send(new ListUsersCommand({ UserPoolId: USER_POOL_ID }));
      const users = (result.Users ?? []).map((u) => ({
        id: u.Attributes?.find((a) => a.Name === 'sub')?.Value ?? '',
        email: u.Attributes?.find((a) => a.Name === 'email')?.Value ?? '',
        firstName: u.Attributes?.find((a) => a.Name === 'given_name')?.Value ?? '',
        lastName: u.Attributes?.find((a) => a.Name === 'family_name')?.Value ?? '',
        status: u.Enabled ? 'active' : 'suspended',
        userStatus: u.UserStatus,
        createdAt: u.UserCreateDate?.toISOString() ?? '',
      }));
      return res.ok(users, origin);
    }

    if (method === 'GET' && userId) {
      const result = await cognito.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      }));
      const attrs = result.UserAttributes ?? [];
      const sub = attrs.find((a) => a.Name === 'sub')?.Value ?? '';
      const projectsResult = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': `USER#${sub}`, ':sk': 'PROJECT#' },
      }));
      return res.ok({
        id: sub,
        email: attrs.find((a) => a.Name === 'email')?.Value ?? '',
        firstName: attrs.find((a) => a.Name === 'given_name')?.Value ?? '',
        lastName: attrs.find((a) => a.Name === 'family_name')?.Value ?? '',
        status: result.Enabled ? 'active' : 'suspended',
        projectIds: (projectsResult.Items ?? []).map((i) => i['SK'].replace('PROJECT#', '')),
      }, origin);
    }

    if (method === 'POST' && path === '/admin/users') {
      const body: CreateUserInput = JSON.parse(event.body ?? '{}');
      if (!body.email || !body.firstName || !body.lastName) {
        return res.badRequest('email, firstName et lastName sont requis', origin);
      }
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: body.email,
        UserAttributes: [
          { Name: 'email', Value: body.email },
          { Name: 'given_name', Value: body.firstName },
          { Name: 'family_name', Value: body.lastName },
          { Name: 'email_verified', Value: 'true' },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }));
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: body.email,
        GroupName: 'client',
      }));
      return res.created({ message: 'Utilisateur créé, invitation envoyée' }, origin);
    }

    if (method === 'PUT' && userId && path.endsWith('/suspend')) {
      await cognito.send(new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: userId }));
      return res.ok({ message: 'Compte suspendu' }, origin);
    }

    if (method === 'PUT' && userId && path.endsWith('/activate')) {
      await cognito.send(new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: userId }));
      return res.ok({ message: 'Compte réactivé' }, origin);
    }

    if (method === 'POST' && userId && path.endsWith('/reset-password')) {
      await cognito.send(new AdminResetUserPasswordCommand({ UserPoolId: USER_POOL_ID, Username: userId }));
      return res.ok({ message: 'Email de réinitialisation envoyé' }, origin);
    }

    if (method === 'PUT' && userId && path.endsWith('/projects')) {
      const { projectIds }: { projectIds: string[] } = JSON.parse(event.body ?? '{}');
      const existingResult = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'PROJECT#' },
      }));
      const deleteOps = (existingResult.Items ?? []).map((item) =>
        ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: item['PK'], SK: item['SK'] } }))
      );
      await Promise.all(deleteOps);
      const putOps = projectIds.map((pid) =>
        ddb.send(new PutCommand({
          TableName: TABLE,
          Item: {
            PK: `USER#${userId}`,
            SK: `PROJECT#${pid}`,
            GSI1PK: `PROJECT#${pid}`,
            GSI1SK: `USER#${userId}`,
            assignedAt: new Date().toISOString(),
          },
        }))
      );
      await Promise.all(putOps);
      return res.ok({ message: 'Projets assignés', projectIds }, origin);
    }

    return res.notFound(origin);
  } catch (err) {
    console.error(err);
    return res.internalError(undefined, origin);
  }
};
