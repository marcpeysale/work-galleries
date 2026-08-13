import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { InvocationType, InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

const args = process.argv.slice(2);
const getArgument = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const region = process.env.AWS_REGION ?? process.env.REGION ?? 'eu-west-3';
const bucket = getArgument('--bucket') ?? process.env.MEDIA_BUCKET;
const functionName = getArgument('--function') ?? 'gallery-thumbnails';
const dryRun = args.includes('--dry-run');
const concurrency = Number(getArgument('--concurrency') ?? 8);

if (!bucket) throw new Error('MEDIA_BUCKET ou --bucket est requis');
if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('--concurrency doit être un entier positif');

const s3 = new S3Client({ region });
const lambda = new LambdaClient({ region });
const photos = [];
let continuationToken;

do {
  const result = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: 'projects/',
    ContinuationToken: continuationToken,
  }));
  for (const object of result.Contents ?? []) {
    if (object.Key && /^projects\/[^/]+\/photos\/[0-9a-f-]{36}-.+/i.test(object.Key)) {
      photos.push({ key: object.Key, size: object.Size });
    }
  }
  continuationToken = result.NextContinuationToken;
} while (continuationToken);

console.log(`${photos.length} photo(s) détectée(s)`);

if (dryRun) {
  for (const photo of photos) console.log(photo.key);
  process.exit(0);
}

let processed = 0;
for (let index = 0; index < photos.length; index += concurrency) {
  const batch = photos.slice(index, index + concurrency);
  await Promise.all(batch.map((photo) =>
    lambda.send(new InvokeCommand({
      FunctionName: functionName,
      InvocationType: InvocationType.Event,
      Payload: Buffer.from(JSON.stringify({
        detail: {
          bucket: { name: bucket },
          object: { key: photo.key, size: photo.size },
        },
      })),
    })),
  ));
  processed += batch.length;
  console.log(`${processed}/${photos.length} invocation(s) envoyée(s)`);
}
