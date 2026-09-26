/**
 * Migrate Match.screenshotPath from local `/uploads/matches/...` to S3
 * (images are JPEG-compressed in uploadMatchScreenshot).
 *
 * Looks for files under:
 *   - public/uploads/matches/
 *   - tmp-scoreboards/  (basename = Discord message id)
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/migrate-screenshots-to-s3.ts
 *   npx tsx --env-file=.env scripts/migrate-screenshots-to-s3.ts --dry-run
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { uploadMatchScreenshot } from "../src/lib/object-storage";

const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

/** Resolve a local disk file for an old `/uploads/...` path. */
function resolveLocalFile(screenshotPath: string): string | null {
  const rel = screenshotPath.replace(/^\//, "");
  const fromPublic = path.join(process.cwd(), "public", rel);
  if (existsSync(fromPublic)) return fromPublic;

  // /uploads/matches/shot-1551….png → tmp-scoreboards/1551….png|jpg
  const base = path.basename(screenshotPath);
  const idMatch = base.match(/^(?:shot-)?(\d+)\./i);
  if (idMatch) {
    const id = idMatch[1];
    const tmpDir = path.join(process.cwd(), "tmp-scoreboards");
    for (const ext of [".png", ".jpg", ".jpeg", ".JPG", ".PNG", ".webp"]) {
      const candidate = path.join(tmpDir, `${id}${ext}`);
      if (existsSync(candidate)) return candidate;
    }
  }

  // Exact basename under tmp-scoreboards
  const tmpExact = path.join(process.cwd(), "tmp-scoreboards", base);
  if (existsSync(tmpExact)) return tmpExact;

  return null;
}

async function main() {
  const rows = await prisma.match.findMany({
    where: { screenshotPath: { not: null } },
    select: { id: true, screenshotPath: true, openDotaId: true },
    orderBy: { createdAt: "asc" },
  });

  const local = rows.filter(
    (r) => r.screenshotPath && !/^https?:\/\//i.test(r.screenshotPath),
  );

  console.log(
    `Found ${local.length} local screenshot path(s). dryRun=${dryRun}`,
  );

  let migrated = 0;
  let missing = 0;

  for (const row of local) {
    const stored = row.screenshotPath!;
    const file = resolveLocalFile(stored);
    if (!file) {
      missing += 1;
      console.log(`MISSING  ${row.id}  ${stored}`);
      continue;
    }

    if (dryRun) {
      console.log(`WOULD    ${row.id}  ${stored}  ←  ${file}`);
      migrated += 1;
      continue;
    }

    const buffer = await readFile(file);
    const uploaded = await uploadMatchScreenshot({
      buffer,
      mime: mimeFor(file),
      keyHint: `migrate-${row.openDotaId || row.id.slice(0, 8)}`,
    });
    await prisma.match.update({
      where: { id: row.id },
      data: { screenshotPath: uploaded.screenshotPath },
    });
    migrated += 1;
    console.log(`OK       ${row.id}  →  ${uploaded.screenshotPath}`);
  }

  console.log(`Done. migrated=${migrated} missing=${missing}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
