import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

/** Display image stays sharp (Season 1 PNGs). OCR uses a smaller JPEG so Gemini answers in time. */
const MAX_DISPLAY_EDGE = 1920;
const DISPLAY_JPEG_QUALITY = 86;
const KEEP_ORIGINAL_MAX_BYTES = 3_500_000;
const MAX_OCR_EDGE = 768;
const OCR_JPEG_QUALITY = 50;

function displayExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/**
 * Keep a readable scoreboard for the match page, plus a smaller JPEG for OCR.
 * Files already within 1920px and 3.5MB are stored as uploaded.
 */
export async function compressImageForS3(input: {
  buffer: Buffer;
  mime?: string | null;
}): Promise<{ uploadBuffer: Buffer; uploadMime: string; ocrBuffer: Buffer; ocrMime: string }> {
  const fallbackMime = input.mime?.trim() || "image/jpeg";
  try {
    const source = sharp(input.buffer, { failOn: "none" });
    const meta = await source.metadata();
    const edge = Math.max(meta.width ?? 0, meta.height ?? 0);
    const mime = fallbackMime.toLowerCase();
    const oriented = (meta.orientation ?? 1) > 1;
    const keepOriginal =
      !oriented &&
      edge > 0 &&
      edge <= MAX_DISPLAY_EDGE &&
      input.buffer.length <= KEEP_ORIGINAL_MAX_BYTES &&
      (mime === "image/png" || mime === "image/jpeg" || mime === "image/webp");

    const uploadBuffer = keepOriginal
      ? input.buffer
      : await source
          .clone()
          .rotate()
          .resize({
            width: MAX_DISPLAY_EDGE,
            height: MAX_DISPLAY_EDGE,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: DISPLAY_JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
    const uploadMime = keepOriginal ? mime : "image/jpeg";
    const ocrBuffer = await source
      .clone()
      .rotate()
      .resize({
        width: MAX_OCR_EDGE,
        height: MAX_OCR_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: OCR_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return {
      uploadBuffer,
      uploadMime,
      ocrBuffer,
      ocrMime: "image/jpeg",
    };
  } catch {
    return {
      uploadBuffer: input.buffer,
      uploadMime: fallbackMime,
      ocrBuffer: input.buffer,
      ocrMime: fallbackMime,
    };
  }
}

/**
 * Upload an image to S3. No local disk / public/uploads.
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
  const fileName = `${hint}-${randomUUID()}.${displayExtension(compressed.uploadMime)}`;
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

/** Remove a match screenshot from S3 when the URL belongs to this bucket. */
export async function deleteStoredScreenshot(screenshotPath: string | null | undefined) {
  if (!screenshotPath?.trim() || !isObjectStorageConfigured()) return;
  const base = s3PublicBaseUrl();
  const value = screenshotPath.trim();
  if (!value.startsWith(`${base}/`)) return;
  const key = decodeURIComponent(value.slice(base.length + 1));
  if (!key.startsWith("matches/") && !key.startsWith("payments/")) return;
  await s3Client().send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!.trim(),
      Key: key,
    }),
  );
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
