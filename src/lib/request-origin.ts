/**
 * Same-site origin check for browser POSTs.
 * Allows localhost ↔ 127.0.0.1 mismatch common in local Next.js + Discord OAuth.
 */
export function isAllowedRequestOrigin(
  request: Request,
  originHeader: string | null,
): boolean {
  if (!originHeader) return true;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }

  if (originHeader === requestOrigin) return true;

  let incoming: URL;
  let expected: URL;
  try {
    incoming = new URL(originHeader);
    expected = new URL(requestOrigin);
  } catch {
    return false;
  }

  if (incoming.protocol !== expected.protocol) return false;
  if (incoming.port !== expected.port) return false;

  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (localHosts.has(incoming.hostname) && localHosts.has(expected.hostname)) {
    return true;
  }

  return false;
}
