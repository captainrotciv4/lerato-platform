import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _client: S3Client | null = null;
let _bucket: string | null = null;

function getClient(): { client: S3Client; bucket: string } {
  if (_client && _bucket) return { client: _client, bucket: _bucket };

  if (!process.env.R2_ENDPOINT)          throw new Error("R2_ENDPOINT is not set");
  if (!process.env.R2_ACCESS_KEY_ID)     throw new Error("R2_ACCESS_KEY_ID is not set");
  if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("R2_SECRET_ACCESS_KEY is not set");
  if (!process.env.R2_BUCKET_NAME)       throw new Error("R2_BUCKET_NAME is not set");

  _client = new S3Client({
    region: process.env.R2_REGION ?? "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  _bucket = process.env.R2_BUCKET_NAME;

  return { client: _client, bucket: _bucket };
}

export async function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 600) {
  const { client, bucket } = getClient();
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function getPresignedDownloadUrl(key: string, expiresIn = 86400) {
  const { client, bucket } = getClient();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, cmd, { expiresIn });
}

export async function deleteObject(key: string) {
  const { client, bucket } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function publicUrl(key: string): string {
  return key;
}
