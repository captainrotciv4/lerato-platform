import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

if (!process.env.R2_ENDPOINT)          throw new Error("R2_ENDPOINT is not set");
if (!process.env.R2_ACCESS_KEY_ID)     throw new Error("R2_ACCESS_KEY_ID is not set");
if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("R2_SECRET_ACCESS_KEY is not set");
if (!process.env.R2_BUCKET_NAME)       throw new Error("R2_BUCKET_NAME is not set");

const r2 = new S3Client({
  region: process.env.R2_REGION ?? "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

export async function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 600) {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(r2, cmd, { expiresIn });
}

// Returns a presigned download URL valid for 24 hours (private bucket)
export async function getPresignedDownloadUrl(key: string, expiresIn = 86400) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export async function deleteObject(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

// Legacy — kept for compatibility; fileUrl is now always a presigned URL
export function publicUrl(key: string): string {
  return key;
}
