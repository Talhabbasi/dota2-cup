import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** True when AWS S3 env is complete enough to upload. */
export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
      process.env.AWS_REGION?.trim() &&
      process.env.AWS_S3_BUCKET?.trim(),
  );
}

function requireObjectStorage() {
  if (!isObjectStorageConfigured()) {
    throw new Error(
      "S3 is required for image uploads. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET.",
    );
  }
}

function s3Client(): S3Client {
  requireObjectStorage();
  return new S3Client({
    region: process.env.AWS_REGION!.trim(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

function s3PublicBaseUrl(): string {
  const custom = process.env.AWS_S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (custom) return custom;
  const bucket = process.env.AWS_S3_BUCKET!.trim();
  const region = process.env.AWS_REGION!.trim();
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

function extForMime(mime: string): string {
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  return ".jpg";
}

function safeKeyHint(hint: string): string {
  const cleaned = hint.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "file").slice(0, 64);
}

/**
 * Upload an image to S3 only (no local disk / public/uploads).
 * `folder` e.g. `matches` or `payments`.
 */
export async function uploadImageToS3(input: {
  buffer: Buffer;
  mime?: string | null;
  keyHint: string;
  folder?: string;
}): Promise<{ screenshotPath: string; buffer: Buffer; mime: string; key: string }> {
  requireObjectStorage();
  const mime = input.mime?.trim() || "image/jpeg";
  const ext = extForMime(mime);
  const hint = safeKeyHint(input.keyHint);
  const folder = (input.folder ?? "matches").replace(/[^a-zA-Z0-9_-]+/g, "") || "matches";
  const fileName = `${hint}-${randomUUID()}${ext}`;
  const key = `${folder}/${fileName}`;

  await s3Client().send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!.trim(),
      Key: key,
      Body: input.buffer,
      ContentType: mime,
    }),
  );

  return {
    screenshotPath: `${s3PublicBaseUrl()}/${key}`,
    buffer: input.buffer,
    mime,
    key,
  };
}

/** Match scoreboard screenshots → `matches/` on S3. */
export async function uploadMatchScreenshot(input: {
  buffer: Buffer;
  mime?: string | null;
  keyHint: string;
}): Promise<{ screenshotPath: string; buffer: Buffer; mime: string }> {
  const uploaded = await uploadImageToS3({ ...input, folder: "matches" });
  return {
    screenshotPath: uploaded.screenshotPath,
    buffer: uploaded.buffer,
    mime: uploaded.mime,
  };
}
