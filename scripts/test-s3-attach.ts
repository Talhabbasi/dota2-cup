import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { uploadMatchScreenshot } from "../src/lib/object-storage";

async function main() {
  const prisma = new PrismaClient();
  const matchId = process.argv[2] || "cmuad78u70037grhocdmlkisq";
  const file = process.argv[3] || "tmp-scoreboards/1550959635249238016.png";
  const before = await prisma.match.findUnique({
    where: { id: matchId },
    select: { screenshotPath: true },
  });
  console.log("before", before?.screenshotPath);
  const buf = await readFile(file);
  const mime = file.endsWith(".png") ? "image/png" : "image/jpeg";
  const uploaded = await uploadMatchScreenshot({
    buffer: buf,
    mime,
    keyHint: `local-test-${Date.now()}`,
  });
  await prisma.match.update({
    where: { id: matchId },
    data: { screenshotPath: uploaded.screenshotPath },
  });
  const res = await fetch(uploaded.screenshotPath);
  console.log(
    JSON.stringify({
      status: res.status,
      contentType: res.headers.get("content-type"),
      url: uploaded.screenshotPath,
    }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
