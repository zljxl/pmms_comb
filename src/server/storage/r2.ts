import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

type R2Config = {
  bucket: string;
  publicUrl: string;
  client: S3Client;
};

let configuration: R2Config | undefined;

function getConfig(): R2Config {
  if (configuration) return configuration;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    throw new Error(
      'R2 não configurado. Defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL.',
    );
  }

  configuration = {
    bucket,
    publicUrl,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
  return configuration;
}

export async function uploadObject({
  key,
  body,
  contentType,
  contentDisposition,
}: {
  key: string;
  body: Uint8Array;
  contentType: string;
  contentDisposition?: string;
}) {
  const { bucket, publicUrl, client } = getConfig();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return `${publicUrl}/${key}`;
}
