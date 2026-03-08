import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../lib/dynamo';
import { getAuthContext } from '../lib/auth';
import * as res from '../lib/response';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';
import { randomUUID } from 'crypto';

const s3 = new S3Client({ region: process.env.REGION });
const MEDIA_BUCKET = process.env.MEDIA_BUCKET!;
const EXPORTS_BUCKET = process.env.EXPORTS_BUCKET!;
const DOWNLOAD_URL_TTL = 86400;

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers['origin'];
  const auth = getAuthContext(event);
  const projectId = event.pathParameters?.['projectId'];

  if (!projectId) return res.badRequest('projectId manquant', origin);

  if (!auth.isAdmin) {
    const accessCheck = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${auth.sub}`, SK: `PROJECT#${projectId}` },
    }));
    if (!accessCheck.Item) return res.forbidden(origin);
  }

  const mediaResult = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `PROJECT#${projectId}`, ':sk': 'MEDIA#' },
  }));

  const items = mediaResult.Items ?? [];
  if (items.length === 0) return res.badRequest('Aucun média dans ce projet', origin);

  const projectResult = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `PROJECT#${projectId}`, SK: 'METADATA' },
  }));
  const projectName = (projectResult.Item?.['name'] as string | undefined) ?? projectId;

  try {
    const exportKey = `exports/${projectId}/${randomUUID()}.zip`;
    const passThrough = new PassThrough();

    const archive = archiver('zip', { zlib: { level: 1 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(passThrough);

    const uploadPromise = uploadStreamToS3(passThrough, EXPORTS_BUCKET, exportKey);

    for (const item of items) {
      const s3Key = item['s3Key'] as string;
      const filename = item['filename'] as string;
      const s3Object = await s3.send(new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: s3Key }));
      if (s3Object.Body) {
        archive.append(s3Object.Body as Readable, { name: filename });
      }
    }

    await archive.finalize();
    await uploadPromise;

    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: EXPORTS_BUCKET,
        Key: exportKey,
        ResponseContentDisposition: `attachment; filename="${projectName}.zip"`,
      }),
      { expiresIn: DOWNLOAD_URL_TTL },
    );

    const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL * 1000).toISOString();
    return res.ok({ downloadUrl, expiresAt }, origin);
  } catch (err) {
    console.error(err);
    return res.internalError('Erreur lors de la génération du ZIP', origin);
  }
};

const uploadStreamToS3 = (stream: PassThrough, bucket: string, key: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', async () => {
      try {
        const body = Buffer.concat(chunks);
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'application/zip',
        }));
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    stream.on('error', reject);
  });
