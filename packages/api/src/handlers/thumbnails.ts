import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE } from '../lib/dynamo';
import sharp from 'sharp';

type ThumbnailEvent = {
  detail: {
    bucket: { name: string };
    object: { key: string; size?: number };
  };
};

const s3 = new S3Client({ region: process.env.REGION });
const SOURCE_KEY_PATTERN = /^projects\/([^/]+)\/photos\/([0-9a-f-]{36})-(.+)$/i;
const THUMBNAIL_WIDTH = 800;
const THUMBNAIL_QUALITY = 80;

export const decodeObjectKey = (key: string): string => {
  try {
    return decodeURIComponent(key.replace(/\+/g, ' '));
  } catch {
    return key;
  }
};

export const handler = async (event: ThumbnailEvent): Promise<void> => {
  const bucket = event.detail.bucket.name;
  const sourceKey = decodeObjectKey(event.detail.object.key);
  const match = sourceKey.match(SOURCE_KEY_PATTERN);
  if (!match) return;

  const [, projectId, mediaId] = match;
  const source = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: sourceKey }));
  if (!source.Body) throw new Error(`Objet S3 vide: ${sourceKey}`);

  const sourceBuffer = Buffer.from(await source.Body.transformToByteArray());
  const { data, info } = await sharp(sourceBuffer)
    .rotate()
    .resize({
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_WIDTH,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const thumbnailS3Key = `projects/${projectId}/thumbnails/${mediaId}.webp`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: thumbnailS3Key,
    Body: data,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: `PROJECT#${projectId}`, SK: `MEDIA#${mediaId}` },
    UpdateExpression: 'SET thumbnailS3Key = :thumbnailS3Key, thumbnailWidth = :width, thumbnailHeight = :height, #size = :size',
    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
    ExpressionAttributeNames: { '#size': 'size' },
    ExpressionAttributeValues: {
      ':thumbnailS3Key': thumbnailS3Key,
      ':width': info.width,
      ':height': info.height,
      ':size': event.detail.object.size ?? sourceBuffer.length,
    },
  }));
};
