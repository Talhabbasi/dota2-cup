/**
 * Generate ADMIN_PASSWORD_HASH for .env (scrypt salt:hash).
 *
 * Usage:
 *   npm run admin:hash-password -- "your-secret-password"
 *
 * Then put the printed line into .env. Never commit the plaintext password.
 */
import { hashAdminPassword } from "../src/lib/admin-password";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run admin:hash-password -- "your-password"');
  process.exit(1);
}

const hash = hashAdminPassword(password);
console.log("");
console.log("# Add these to .env (password is one-way hashed — not reversible):");
console.log(`ADMIN_USERNAME="admin"`);
console.log(`ADMIN_EMAIL="admin@mmdotacup.local"`);
console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
console.log("");
console.log("# Do NOT set ADMIN_PASSWORD=... — plaintext is rejected.");
console.log("");
