// R2 storage helper for the `shared/files` Platform Service.
//
// R2 is S3-compatible, so this uses the standard AWS S3 SDK rather than
// a Cloudflare-specific package -- one fewer dependency to track, and it
// means this code would also work unmodified against S3 if that ever
// changed.
//
// This backs:
//   - membership_export_requests.export_file_id (Club Manager)
//   - media albums (club/team/session/trip) once shared/media is built
//
// Required env vars (see .env.example):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = process.env.R2_BUCKET_NAME!;

/**
 * Uploads a file to R2 under a tenant-scoped key. Callers are
 * responsible for the RLS-equivalent check BEFORE calling this --
 * R2 has no concept of tenant isolation on its own, so the key prefix
 * convention here (`tenants/<tenant_id>/...`) is a naming discipline,
 * not a security boundary. Never build a key from user input directly;
 * always prefix with the authenticated user's own tenant_id server-side.
 */
export async function uploadFile(params: {
  tenantId: string;
  category: 'exports' | 'media' | 'documents';
  fileName: string;
  body: Buffer | Uint8Array;
  contentType: string;
}) {
  const key = `tenants/${params.tenantId}/${params.category}/${crypto.randomUUID()}-${params.fileName}`;

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );

  return { key };
}

/**
 * Generates a short-lived signed URL for downloading a file. Use this
 * instead of making the bucket public -- access control stays enforced
 * by whatever checked the caller's permission before calling this
 * function (e.g. the membership_export_requests RLS policy), not by R2.
 */
export async function getDownloadUrl(key: string, expiresInSeconds = 3600) {
  const client = getR2Client();
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function deleteFile(key: string) {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
