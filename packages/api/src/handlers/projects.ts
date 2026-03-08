import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../lib/dynamo';
import { getAuthContext } from '../lib/auth';
import * as res from '../lib/response';
import type { CreateProjectInput, UpdateProjectInput } from '@gallery/shared';
import { randomUUID } from 'crypto';

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers['origin'];

  try {
    const auth = await getAuthContext(event);
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    const projectId = event.pathParameters?.['projectId'];

    if (path.startsWith('/admin') && !auth.isAdmin) return res.forbidden(origin);

    if (method === 'GET' && path === '/admin/projects') {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: { ':gsi1pk': 'PROJECTS' },
      }));
      const projects = (result.Items ?? []).map(itemToProject);
      return res.ok(projects, origin);
    }

    if (method === 'POST' && path === '/admin/projects') {
      const body: CreateProjectInput = JSON.parse(event.body ?? '{}');
      if (!body.name || !body.month || !body.year || !body.status || !body.clientInfo) {
        return res.badRequest('Champs obligatoires manquants', origin);
      }
      const id = randomUUID();
      const now = new Date().toISOString();
      const item = {
        PK: `PROJECT#${id}`,
        SK: 'METADATA',
        GSI1PK: 'PROJECTS',
        GSI1SK: `${body.year}-${String(body.month).padStart(2, '0')}#${id}`,
        id,
        name: body.name,
        month: body.month,
        year: body.year,
        status: body.status,
        clientInfo: body.clientInfo,
        mediaTypes: body.mediaTypes ?? [],
        createdAt: now,
        updatedAt: now,
      };
      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      return res.created(itemToProject(item), origin);
    }

    if (method === 'GET' && projectId && path.startsWith('/admin/projects/')) {
      const result = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `PROJECT#${projectId}`, SK: 'METADATA' },
      }));
      if (!result.Item) return res.notFound(origin);
      return res.ok(itemToProject(result.Item), origin);
    }

    if (method === 'PUT' && projectId && path.startsWith('/admin/projects/')) {
      const body: UpdateProjectInput = JSON.parse(event.body ?? '{}');
      const updates: string[] = [];
      const attrs: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
      const names: Record<string, string> = {};

      for (const [key, val] of Object.entries(body)) {
        if (val !== undefined) {
          updates.push(`#${key} = :${key}`);
          attrs[`:${key}`] = val;
          names[`#${key}`] = key;
        }
      }
      updates.push('#updatedAt = :updatedAt');
      names['#updatedAt'] = 'updatedAt';

      const result = await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `PROJECT#${projectId}`, SK: 'METADATA' },
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeValues: attrs,
        ExpressionAttributeNames: names,
        ReturnValues: 'ALL_NEW',
      }));
      return res.ok(itemToProject(result.Attributes ?? {}), origin);
    }

    if (method === 'DELETE' && projectId && path.startsWith('/admin/projects/')) {
      await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `PROJECT#${projectId}`, SK: 'METADATA' },
      }));
      return res.noContent(origin);
    }

    if (method === 'GET' && path === '/gallery/projects') {
      const userProjectsResult = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': `USER#${auth.sub}`, ':sk': 'PROJECT#' },
      }));
      const projectIds = (userProjectsResult.Items ?? []).map((i) => i['SK'].replace('PROJECT#', ''));
      if (projectIds.length === 0) return res.ok([], origin);

      const projects = await Promise.all(
        projectIds.map((pid) =>
          ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `PROJECT#${pid}`, SK: 'METADATA' } }))
        )
      );
      return res.ok(
        projects.filter((r) => r.Item).map((r) => itemToProject(r.Item!)),
        origin,
      );
    }

    if (method === 'GET' && projectId && path.startsWith('/gallery/projects/')) {
      const accessCheck = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${auth.sub}`, SK: `PROJECT#${projectId}` },
      }));
      if (!accessCheck.Item) return res.forbidden(origin);

      const result = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `PROJECT#${projectId}`, SK: 'METADATA' },
      }));
      if (!result.Item) return res.notFound(origin);
      return res.ok(itemToProject(result.Item), origin);
    }

    return res.notFound(origin);
  } catch (err) {
    console.error(err);
    return res.internalError(undefined, origin);
  }
};

const itemToProject = (item: Record<string, unknown>) => ({
  id: item['id'],
  name: item['name'],
  month: item['month'],
  year: item['year'],
  status: item['status'],
  clientInfo: item['clientInfo'],
  mediaTypes: item['mediaTypes'],
  createdAt: item['createdAt'],
  updatedAt: item['updatedAt'],
});
