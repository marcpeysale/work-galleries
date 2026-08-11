import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../lib/dynamo';
import { getAuthContext } from '../lib/auth';
import { getValidInvite, itemToInvite, touchInvite } from '../lib/invites';
import * as res from '../lib/response';
import type { CreateInviteInput, InviteAccess } from '@gallery/shared';
import { randomBytes } from 'crypto';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers['origin'];

  try {
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    const token = event.pathParameters?.['token'];

    if (path.startsWith('/invite/')) {
      if (method !== 'GET' || !token) return res.notFound(origin);
      const invite = await getValidInvite(token);
      if (!invite) return res.forbidden(origin);
      await touchInvite(token);
      const access: InviteAccess = { token: invite.token, projectIds: invite.projectIds, label: invite.label || undefined };
      return res.ok(access, origin);
    }

    const auth = await getAuthContext(event);
    if (!auth.isAdmin) return res.forbidden(origin);

    if (method === 'GET' && path === '/admin/invites') {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: { ':gsi1pk': 'INVITES' },
        ScanIndexForward: false,
      }));
      const invites = (result.Items ?? []).map(itemToInvite);
      return res.ok(invites, origin);
    }

    if (method === 'POST' && path === '/admin/invites') {
      const body: CreateInviteInput = JSON.parse(event.body ?? '{}');
      if (!body.projectIds?.length) return res.badRequest('Au moins un projet est requis', origin);

      const newToken = randomBytes(24).toString('base64url');
      const now = new Date().toISOString();
      const item = {
        PK: `INVITE#${newToken}`,
        SK: 'METADATA',
        GSI1PK: 'INVITES',
        GSI1SK: `${now}#${newToken}`,
        token: newToken,
        projectIds: body.projectIds,
        label: body.label ?? '',
        createdAt: now,
        createdBy: auth.sub,
        revoked: false,
        useCount: 0,
      };
      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      return res.created(itemToInvite(item), origin);
    }

    if (method === 'DELETE' && token) {
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `INVITE#${token}`, SK: 'METADATA' },
        UpdateExpression: 'SET revoked = :true',
        ExpressionAttributeValues: { ':true': true },
      }));
      return res.noContent(origin);
    }

    return res.notFound(origin);
  } catch (err) {
    console.error(err);
    return res.internalError(undefined, origin);
  }
};
