import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

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

function safeKeyHint(hint: string): string {
  const cleaned = hint.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "file").slice(0, 64);
}

const MAX_UPLOAD_WIDTH = 1920;
const JPEG_QUALITY = 78;

/**
 * Shrink + JPEG-compress for S3. Falls back to the original buffer if sharp fails.
 * Returned `ocrBuffer` stays close to the source for scoreboard parsing.
 */
export async function compressImageForS3(input: {
  buffer: Buffer;
  mime?: string | null;
}): Promise<{ uploadBuffer: Buffer; uploadMime: string; ocrBuffer: Buffer; ocrMime: string }> {
  const ocrMime = input.mime?.trim() || "image/jpeg";
  try {
    let pipeline = sharp(input.buffer, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    if ((meta.width ?? 0) > MAX_UPLOAD_WIDTH) {
      pipeline = pipeline.resize({
        width: MAX_UPLOAD_WIDTH,
        withoutEnlargement: true,
      });
    }
    const uploadBuffer = await pipeline
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return {
      uploadBuffer,
      uploadMime: "image/jpeg",
      ocrBuffer: input.buffer,
      ocrMime,
    };
  } catch {
    return {
      uploadBuffer: input.buffer,
      uploadMime: ocrMime,
      ocrBuffer: input.buffer,
      ocrMime,
    };
  }
}

/**
 * Upload an image to S3 only (compressed). No local disk / public/uploads.
 * `folder` e.g. `matches` or `payments`.
 */
export async function uploadImageToS3(input: {
  buffer: Buffer;
  mime?: string | null;
  keyHint: string;
  folder?: string;
}): Promise<{ screenshotPath: string; buffer: Buffer; mime: string; key: string }> {
  requireObjectStorage();
  const compressed = await compressImageForS3({
    buffer: input.buffer,
    mime: input.mime,
  });
  const hint = safeKeyHint(input.keyHint);
  const folder =
    (input.folder ?? "matches").replace(/[^a-zA-Z0-9_-]+/g, "") || "matches";
  const fileName = `${hint}-${randomUUID()}.jpg`;
  const key = `${folder}/${fileName}`;

  await s3Client().send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!.trim(),
      Key: key,
      Body: compressed.uploadBuffer,
      ContentType: compressed.uploadMime,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    screenshotPath: `${s3PublicBaseUrl()}/${key}`,
    // Keep original bytes for OCR when callers use the returned buffer.
    buffer: compressed.ocrBuffer,
    mime: compressed.ocrMime,
    key,
  };
}

/** Match scoreboard screenshots → `matches/` on S3 (compressed). */
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
