import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token) throw new Error("No DISCORD_TOKEN");
if (!guildId) throw new Error("No DISCORD_GUILD_ID");

const ids = [
  "1551330985017217104",
  "1551353094003101907",
  "1551354268215152691",
];

async function api(pathname: string) {
  const res = await fetch(`https://discord.com/api/v10${pathname}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${pathname} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const channels = await api(`/guilds/${guildId}/channels`);
  const resultsName = (process.env.RESULTS_CHANNEL_NAME || "results").toLowerCase();
  const results = channels.find(
    (c: { type: number; name?: string }) =>
      c.type === 0 && c.name?.toLowerCase() === resultsName,
  );
  if (!results) {
    const names = channels
      .filter((c: { type: number }) => c.type === 0)
      .map((c: { name: string }) => c.name);
    console.log("text channels", names);
    throw new Error(`No #${resultsName}`);
  }
  console.log("results channel", results.id, results.name);

  await mkdir("tmp-scoreboards", { recursive: true });

  for (const id of ids) {
    try {
      const msg = await api(`/channels/${results.id}/messages/${id}`);
      const att = (msg.attachments || [])[0];
      if (!att?.url) {
        console.log("NO_ATTACH", id, (msg.content || "").slice(0, 80));
        continue;
      }
      const ext = path.extname(att.filename || ".png") || ".png";
      const out = path.join("tmp-scoreboards", `${id}${ext}`);
      const img = await fetch(att.url);
      if (!img.ok) {
        console.log("DOWNLOAD_FAIL", id, img.status);
        continue;
      }
      await writeFile(out, Buffer.from(await img.arrayBuffer()));
      console.log("SAVED", out, att.filename);
    } catch (e) {
      console.log("FAIL", id, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
