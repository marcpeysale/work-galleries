import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../lib/dynamo';
import { getAuthContext } from '../lib/auth';
import * as res from '../lib/response';
import type { MediaType } from '@gallery/shared';
import { randomUUID } from 'crypto';

const s3 = new S3Client({ region: process.env.REGION });
const MEDIA_BUCKET = process.env.MEDIA_BUCKET!;
const MEDIA_DOMAIN = process.env.MEDIA_DOMAIN ?? '';
const UPLOAD_URL_TTL = 300;
const SIGNED_URL_TTL = 3600;

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers['origin'];
  const auth = getAuthContext(event);
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;
  const projectId = event.pathParameters?.['projectId'];
  const mediaId = event.pathParameters?.['mediaId'];

  try {
    if (method === 'POST' && projectId && path.endsWith('/upload-url')) {
      if (!auth.isAdmin) return res.forbidden(origin);
      const { filename, type, contentType }: { filename: string; type: MediaType; contentType: string } =
        JSON.parse(event.body ?? '{}');
      if (!filename || !type || !contentType) {
        return res.badRequest('filename, type et contentType sont requis', origin);
      }
      const id = randomUUID();
      const s3Key = `projects/${projectId}/${type}s/${id}-${filename}`;

      const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: MEDIA_BUCKET, Key: s3Key, ContentType: contentType }),
        { expiresIn: UPLOAD_URL_TTL },
      );

      const now = new Date().toISOString();
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `PROJECT#${projectId}`,
          SK: `MEDIA#${id}`,
          id,
          projectId,
          type,
          filename,
          s3Key,
          size: 0,
          order: Date.now(),
          uploadedAt: now,
        },
      }));

      return res.ok({ uploadUrl, mediaId: id, s3Key }, origin);
    }

    if (method === 'GET' && projectId && path.includes('/media')) {
      if (!auth.isAdmin) {
        const accessCheck = await ddb.send(new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: { ':pk': `USER#${auth.sub}`, ':sk': `PROJECT#${projectId}` },
        }));
        if (!accessCheck.Items?.length) return res.forbidden(origin);
      }

      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': `PROJECT#${projectId}`, ':sk': 'MEDIA#' },
      }));

      const mediaItems = await Promise.all(
        (result.Items ?? []).map(async (item): Promise<Record<string, unknown>> => {
          const url = MEDIA_DOMAIN
            ? `https://${MEDIA_DOMAIN}/${item['s3Key']}?token=${randomUUID()}`
            : await getSignedUrl(
                s3,
                new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: item['s3Key'] as string }),
                { expiresIn: SIGNED_URL_TTL },
              );
          return { ...item, url };
        }),
      );

      return res.ok(mediaItems.sort((a, b) => (a['order'] as number) - (b['order'] as number)), origin);
    }

    if (method === 'DELETE' && projectId && mediaId) {
      if (!auth.isAdmin) return res.forbidden(origin);
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: { ':pk': `PROJECT#${projectId}`, ':sk': `MEDIA#${mediaId}` },
      }));
      const item = result.Items?.[0];
      if (!item) return res.notFound(origin);

      await s3.send(new DeleteObjectCommand({ Bucket: MEDIA_BUCKET, Key: item['s3Key'] as string }));
      await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `PROJECT#${projectId}`, SK: `MEDIA#${mediaId}` },
      }));
      return res.noContent(origin);
    }

    return res.notFound(origin);
  } catch (err) {
    console.error(err);
    return res.internalError(undefined, origin);
  }
};
