import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";

/** Format: saltHex:hashHex (scrypt, 64-byte key). Never store plaintext passwords. */
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyAdminPassword(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (!stored) return false;
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expectedBuf = Buffer.from(expected, "hex");
    if (actual.length !== expectedBuf.length) return false;
    return timingSafeEqual(actual, expectedBuf);
  } catch {
    return false;
  }
}

export function adminEmailConfigured(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

export function adminUsernameConfigured(): string | null {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  return username || null;
}

/** Login id may be username or email from .env. */
export function adminLoginIdMatches(input: string): boolean {
  const raw = input.trim().toLowerCase();
  if (!raw) return false;
  const email = adminEmailConfigured();
  const username = adminUsernameConfigured();
  if (email && raw === email) return true;
  if (username && raw === username) return true;
  return false;
}

export function adminPasswordHashConfigured(): string | null {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  return hash || null;
}

/**
 * Reject plaintext ADMIN_PASSWORD in env — only the scrypt hash is allowed.
 * Returns an error message if misconfigured.
 */
export function adminPasswordPlaintextMisconfigured(): string | null {
  if (process.env.ADMIN_PASSWORD?.trim()) {
    return "ADMIN_PASSWORD must not be set. Store ADMIN_PASSWORD_HASH only (run npm run admin:hash-password).";
  }
  return null;
}

export function adminPasswordLoginConfigured(): boolean {
  if (adminPasswordPlaintextMisconfigured()) return false;
  const hasId = Boolean(adminEmailConfigured() || adminUsernameConfigured());
  return hasId && Boolean(adminPasswordHashConfigured());
}
