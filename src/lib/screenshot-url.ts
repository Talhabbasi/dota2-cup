/** True when the stored path is a public http(s) URL (e.g. S3). */
export function isRemoteScreenshotUrl(path: string | null | undefined): boolean {
  if (!path) return false;
  return /^https?:\/\//i.test(path.trim());
}

/**
 * URL to render for a match screenshot.
 * Old local paths (`/uploads/...`) are not available on Vercel — return null.
 */
export function screenshotDisplayUrl(
  path: string | null | undefined,
): string | null {
  if (!path?.trim()) return null;
  const value = path.trim();
  if (isRemoteScreenshotUrl(value)) return value;
  return null;
}
