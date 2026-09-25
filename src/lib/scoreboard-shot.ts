import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { currentSeasonId } from "./seasons";
import { loadHeroCatalog, loadItemCatalog } from "./opendota";
import { normalizeAlias } from "./player-aliases";

export type ScoreboardItem = { key: string; name: string };

export type ScoreboardPlayerRow = {
  name: string;
  hero: string;
  side: "radiant" | "dire";
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  gpm: number;
  xpm: number;
  items: string[];
};

export type ParsedScoreboard = {
  radiantTeam?: string;
  direTeam?: string;
  radiantScore?: number;
  direScore?: number;
  winnerSide?: "radiant" | "dire";
  durationSeconds?: number | null;
  matchId?: string | null;
  players: ScoreboardPlayerRow[];
};

const MATCH_INCLUDE = {
  players: { include: { player: true } },
  radiantTeam: true,
  direTeam: true,
  winnerTeam: true,
} as const;

type RosterPlayer = {
  id: string;
  steamName: string;
  steam32: number;
  discordName?: string | null;
  teamId: string | null;
  labels: string[];
};

function norm(value: string) {
  return normalizeAlias(value);
}

function parseDuration(value: string | null | undefined) {
  if (!value) return null;
  const m = value.trim().match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const PARSE_PROMPT = `Read this Dota 2 post-game SCOREBOARD screenshot (the table with Items, LH/DN, GPM).
Return ONLY JSON with this shape:
{
  "radiantTeam": "string",
  "direTeam": "string",
  "radiantScore": 0,
  "direScore": 0,
  "winnerSide": "radiant" or "dire",
  "duration": "mm:ss" or null,
  "matchId": "digits" or null,
  "players": [
    {
      "name": "player name on the board",
      "hero": "official Dota 2 hero name",
      "side": "radiant" or "dire",
      "kills": 0, "deaths": 0, "assists": 0,
      "lastHits": 0, "denies": 0,
      "gpm": 0, "xpm": 0,
      "items": ["Phase Boots", "Blink Dagger"]
    }
  ]
}
Rules:
- Exactly 10 players, radiant (left/top team) first, then dire.
- Hero names must be official (Tidehunter, Shadow Shaman, Night Stalker, Lifestealer, Underlord, ...).
- items = the 6 inventory slots left to right. Skip empty slots. Ignore backpack and neutrals.
- xpm is 0 if the column is not on screen.
- matchId is the number labeled Match, not Lobby.`;

function asRows(raw: unknown): ScoreboardPlayerRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const side = String(row.side ?? "").toLowerCase();
    if (side !== "radiant" && side !== "dire") return [];
    const items = Array.isArray(row.items)
      ? row.items.map((item) => String(item)).filter(Boolean)
      : [];
    return [
      {
        name: String(row.name ?? "").trim(),
        hero: String(row.hero ?? "").trim(),
        side,
        kills: Number(row.kills) || 0,
        deaths: Number(row.deaths) || 0,
        assists: Number(row.assists) || 0,
        lastHits: Number(row.lastHits) || 0,
        denies: Number(row.denies) || 0,
        gpm: Number(row.gpm) || 0,
        xpm: Number(row.xpm) || 0,
        items,
      },
    ];
  });
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fromVisionObject(data: Record<string, unknown>): ParsedScoreboard | null {
  const players = asRows(data.players);
  if (players.length < 8) return null;
  const winner = String(data.winnerSide ?? "").toLowerCase();
  return {
    radiantTeam: data.radiantTeam ? String(data.radiantTeam) : undefined,
    direTeam: data.direTeam ? String(data.direTeam) : undefined,
    radiantScore:
      data.radiantScore == null ? undefined : Number(data.radiantScore),
    direScore: data.direScore == null ? undefined : Number(data.direScore),
    winnerSide: winner === "dire" || winner === "radiant" ? winner : undefined,
    durationSeconds: parseDuration(
      data.duration == null ? null : String(data.duration),
    ),
    matchId: data.matchId ? String(data.matchId).replace(/\D/g, "") || null : null,
    players,
  };
}

function geminiImageMime(mime: string) {
  const normalized = mime.toLowerCase();
  if (normalized === "image/jpg" || normalized === "image/pjpeg") return "image/jpeg";
  if (normalized.startsWith("image/")) return normalized;
  return "image/jpeg";
}

const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
];

function isBusyGemini(status: number, message: string) {
  return (
    status === 429 ||
    status === 503 ||
    /high demand|overloaded|unavailable|resource.?exhausted|try again later/i.test(
      message,
    )
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateGeminiJson(
  model: string,
  key: string,
  imageMime: string,
  buffer: Buffer,
) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PARSE_PROMPT },
              {
                inline_data: {
                  mime_type: imageMime,
                  data: buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    },
  );
  const body = (await res.json()) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return { res, body };
}

async function parseWithGemini(
  buffer: Buffer,
  mime: string,
  key: string,
): Promise<ParsedScoreboard> {
  const imageMime = geminiImageMime(mime);
  let lastError = "Gemini did not return a scoreboard.";
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { res, body } = await generateGeminiJson(model, key, imageMime, buffer);
        if (!res.ok) {
          lastError = body.error?.message || `Gemini ${model} returned ${res.status}.`;
          if (res.status === 404) break;
          if (isBusyGemini(res.status, lastError) && attempt === 0) {
            await sleep(1200);
            continue;
          }
          break;
        }
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          lastError = `Gemini ${model} returned an empty reply.`;
          break;
        }
        const parsed = parseJsonObject(text);
        const scoreboard = parsed ? fromVisionObject(parsed) : null;
        if (scoreboard) return scoreboard;
        lastError = `Gemini ${model} could not map 10 players from that screenshot.`;
        break;
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : `Gemini ${model} failed.`;
        if (attempt === 0 && /timeout|abort|network|fetch/i.test(lastError)) {
          await sleep(800);
          continue;
        }
        break;
      }
    }
  }
  throw new Error(lastError);
}

async function parseWithOpenAi(
  buffer: Buffer,
  mime: string,
  key: string,
): Promise<ParsedScoreboard | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PARSE_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mime};base64,${buffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content;
  if (!text) return null;
  const parsed = parseJsonObject(text);
  return parsed ? fromVisionObject(parsed) : null;
}

async function parseWithOcr(buffer: Buffer): Promise<ParsedScoreboard | null> {
  const Tesseract = await import("tesseract.js");
  const result = await Tesseract.recognize(buffer, "eng");
  const text = result.data.text || "";
  const heroes = await loadHeroCatalog();
  const byNorm = [...heroes].sort((a, b) => b.name.length - a.name.length);
  const found: { hero: string; index: number }[] = [];
  const hay = text.replace(/\s+/g, " ");
  const used = new Set<number>();
  for (const hero of byNorm) {
    const needle = hero.name.toUpperCase();
    let from = 0;
    while (from < hay.length) {
      const at = hay.toUpperCase().indexOf(needle, from);
      if (at < 0) break;
      if (![...used].some((i) => Math.abs(i - at) < 3)) {
        found.push({ hero: hero.name, index: at });
        used.add(at);
        break;
      }
      from = at + needle.length;
    }
  }
  found.sort((a, b) => a.index - b.index);
  if (found.length < 8) return null;

  const players: ScoreboardPlayerRow[] = found.slice(0, 10).map((hit, i) => {
    const slice = hay.slice(hit.index, hit.index + 220);
    const nums = [...slice.matchAll(/\d{1,5}/g)].map((m) => Number(m[0]));
    const kda = nums.slice(0, 3);
    const lh = slice.match(/(\d{1,4})\s*\/\s*(\d{1,3})/);
    const gpmMatch = [...slice.matchAll(/\b(\d{2,4})\b/g)].pop();
    return {
      name: "",
      hero: hit.hero,
      side: i < 5 ? "radiant" : "dire",
      kills: kda[0] ?? 0,
      deaths: kda[1] ?? 0,
      assists: kda[2] ?? 0,
      lastHits: lh ? Number(lh[1]) : 0,
      denies: lh ? Number(lh[2]) : 0,
      gpm: gpmMatch ? Number(gpmMatch[1]) : 0,
      xpm: 0,
      items: [],
    };
  });

  const winnerDire = /winner/i.test(text) && /lala|dire/i.test(text);
  return {
    winnerSide: winnerDire ? "dire" : "radiant",
    players,
  };
}

export async function parseScoreboardImage(
  buffer: Buffer,
  mime = "image/jpeg",
): Promise<ParsedScoreboard> {
  const gemini = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  let lastError = "";
  if (gemini) {
    try {
      return await parseWithGemini(buffer, mime, gemini);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn("Gemini scoreboard parse failed, trying fallback:", lastError);
    }
  }
  if (openai) {
    const parsed = await parseWithOpenAi(buffer, mime, openai);
    if (parsed) return parsed;
  }
  const ocr = await parseWithOcr(buffer).catch(() => null);
  if (ocr) return ocr;
  if (/high demand|overloaded|unavailable|try again later/i.test(lastError)) {
    throw new Error(
      "Gemini is busy right now. Post the **SCOREBOARD** screenshot again in a minute.",
    );
  }
  throw new Error(
    lastError ||
      "Could not read that scoreboard screenshot. Post the **SCOREBOARD** tab (heroes, K/D/A, LH/DN, GPM), not Overview.",
  );
}

function resolveHero(
  name: string,
  heroes: { id: number; name: string; slug: string }[],
) {
  const want = norm(name);
  return (
    heroes.find((h) => norm(h.name) === want) ??
    heroes.find((h) => norm(h.name).includes(want) || want.includes(norm(h.name)))
  );
}

function resolveItem(
  label: string,
  items: { key: string; name: string }[],
): ScoreboardItem | null {
  const want = norm(label);
  if (!want) return null;
  const hit =
    items.find((item) => norm(item.name) === want || norm(item.key) === want) ??
    items.find(
      (item) =>
        norm(item.name).includes(want) ||
        want.includes(norm(item.name)) ||
        norm(item.key).includes(want),
    );
  return hit ? { key: hit.key, name: hit.name } : { key: "", name: label };
}

function playerLabels(player: {
  steamName: string;
  discordName?: string | null;
  aliases?: string[];
}) {
  const base = [player.steamName, player.discordName ?? ""]
    .map(norm)
    .filter(Boolean);
  const extra = (player.aliases ?? []).map(norm).filter(Boolean);
  return [...new Set([...base, ...extra])];
}

/** Classic Levenshtein distance on normalized strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const cur = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j < cols; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cols; j++) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}

/**
 * Match a board name only inside that side's current-season roster.
 * Exact / alias first; then one clear Levenshtein winner (distance ≤ 2,
 * strictly better than the runner-up). Never attaches another team's player.
 * Already-mapped players in `usedIds` are skipped so one seat cannot win twice.
 */
export function resolvePlayer(
  name: string,
  roster: RosterPlayer[],
  teamId: string | null | undefined,
  usedIds?: Set<string>,
): RosterPlayer | null {
  const want = norm(name);
  if (!want || !teamId) return null;

  const pool = roster.filter(
    (p) => p.teamId === teamId && !(usedIds?.has(p.id) ?? false),
  );
  if (pool.length === 0) return null;

  const exact = pool.find((p) => p.labels.includes(want));
  if (exact) return exact;

  const scored = pool
    .map((p) => {
      const distance = Math.min(
        ...p.labels.map((have) => levenshtein(want, have)),
        Number.POSITIVE_INFINITY,
      );
      return { player: p, distance };
    })
    .filter((row) => Number.isFinite(row.distance) && row.distance <= 2)
    .sort((a, b) => a.distance - b.distance);

  if (scored.length === 0) return null;
  const best = scored[0]!;
  const runner = scored[1];
  if (runner && runner.distance === best.distance) return null;
  return best.player;
}

function resolveTeam(
  name: string | undefined,
  teams: { id: string; name: string }[],
) {
  if (!name) return null;
  const want = norm(name);
  return (
    teams.find((t) => norm(t.name) === want) ??
    teams.find((t) => norm(t.name).includes(want) || want.includes(norm(t.name))) ??
    null
  );
}

export async function discordMessageAlreadyIngested(messageId: string) {
  const key = `shot-${messageId}`;
  const found = await prisma.match.findFirst({
    where: {
      OR: [
        { openDotaId: key },
        { screenshotPath: { contains: messageId } },
      ],
    },
    select: { id: true },
  });
  return Boolean(found);
}

export async function applyParsedScoreboard(
  parsed: ParsedScoreboard,
  screenshotPath?: string | null,
  sourceId?: string | null,
) {
  if (parsed.players.length < 8) {
    throw new Error("That screenshot does not look like a 10-player scoreboard.");
  }

  const seasonId = await currentSeasonId();
  const [heroes, itemCatalog, seasonPlayers, aliasRows, teams] =
    await Promise.all([
      loadHeroCatalog(),
      loadItemCatalog(),
      prisma.seasonPlayer.findMany({
        where: { seasonId },
        select: {
          teamId: true,
          player: {
            select: {
              id: true,
              steamName: true,
              discordName: true,
              steam32: true,
            },
          },
        },
      }),
      prisma.playerAlias.findMany({ select: { playerId: true, alias: true } }),
      prisma.team.findMany({
        where: { seasonId },
        select: { id: true, name: true },
      }),
    ]);
  const itemList = Object.values(itemCatalog);

  const aliasesByPlayer = new Map<string, string[]>();
  for (const row of aliasRows) {
    const list = aliasesByPlayer.get(row.playerId) ?? [];
    list.push(row.alias);
    aliasesByPlayer.set(row.playerId, list);
  }

  const roster: RosterPlayer[] = seasonPlayers.map((row) => ({
    id: row.player.id,
    steamName: row.player.steamName,
    steam32: row.player.steam32,
    discordName: row.player.discordName,
    teamId: row.teamId,
    labels: playerLabels({
      steamName: row.player.steamName,
      discordName: row.player.discordName,
      aliases: aliasesByPlayer.get(row.player.id),
    }),
  }));

  const radiantTeam = resolveTeam(parsed.radiantTeam, teams);
  const direTeam = resolveTeam(parsed.direTeam, teams);
  const sourceKey = sourceId ? `shot-${sourceId}` : null;

  const existingWhere = [
    parsed.matchId ? { openDotaId: parsed.matchId } : undefined,
    sourceKey ? { openDotaId: sourceKey } : undefined,
    radiantTeam && direTeam
      ? {
          OR: [
            { radiantTeamId: radiantTeam.id, direTeamId: direTeam.id },
            { radiantTeamId: direTeam.id, direTeamId: radiantTeam.id },
          ],
        }
      : undefined,
  ].filter(Boolean) as object[];

  const existing = existingWhere.length
    ? await prisma.match.findFirst({
        where: { OR: existingWhere },
        include: {
          players: true,
          scheduledFixture: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const winnerSide =
    parsed.winnerSide ??
    (parsed.direScore != null &&
    parsed.radiantScore != null &&
    parsed.direScore > parsed.radiantScore
      ? "dire"
      : "radiant");

  const usedIds = new Set<string>();
  const rows = parsed.players.map((row) => {
    const hero = resolveHero(row.hero, heroes);
    const sideTeamId =
      row.side === "dire" ? direTeam?.id ?? null : radiantTeam?.id ?? null;
    const mapped = resolvePlayer(row.name, roster, sideTeamId, usedIds);
    if (mapped) usedIds.add(mapped.id);
    const items = row.items
      .map((label) => resolveItem(label, itemList))
      .filter((item): item is ScoreboardItem => Boolean(item));
    return {
      steam32: mapped?.steam32 ?? 0,
      playerId: mapped?.id ?? null,
      unknown: !mapped,
      boardName: row.name,
      side: row.side,
      hero: hero?.name ?? row.hero,
      heroId: hero?.id ?? 0,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      lastHits: row.lastHits,
      denies: row.denies,
      gpm: row.gpm,
      xpm: row.xpm,
      itemsJson: JSON.stringify(items),
    };
  });

  const radiantTeamId = radiantTeam?.id ?? existing?.radiantTeamId ?? null;
  const direTeamId = direTeam?.id ?? existing?.direTeamId ?? null;
  const winnerTeamId =
    winnerSide === "dire" ? direTeamId : radiantTeamId;

  const data = {
    openDotaId:
      parsed.matchId ||
      existing?.openDotaId ||
      (sourceId ? `shot-${sourceId}` : `shot-${Date.now()}`),
    duration: parsed.durationSeconds ?? existing?.duration ?? null,
    radiantWin: winnerSide === "radiant",
    radiantTeamId,
    direTeamId,
    winnerTeamId,
    screenshotPath: screenshotPath ?? existing?.screenshotPath ?? null,
    radiantScore: parsed.radiantScore ?? existing?.radiantScore ?? null,
    direScore: parsed.direScore ?? existing?.direScore ?? null,
  };

  const match = existing
    ? await prisma.$transaction(async (tx) => {
        await tx.matchPlayer.deleteMany({ where: { matchId: existing.id } });
        return tx.match.update({
          where: { id: existing.id },
          data: { ...data, players: { create: rows } },
          include: MATCH_INCLUDE,
        });
      })
    : await prisma.match.create({
        data: {
          seasonId,
          ...data,
          players: { create: rows },
        },
        include: MATCH_INCLUDE,
      });

  if (existing?.scheduledFixture?.status !== "completed") {
    try {
      const { completeScheduledFixture } = await import("./schedule");
      await completeScheduledFixture({
        radiantTeamId: match.radiantTeamId,
        direTeamId: match.direTeamId,
        winnerTeamId: match.winnerTeamId,
        matchId: match.id,
      });
    } catch {
      /* schedule optional */
    }
  }

  return { match, created: !existing };
}

export async function ingestScoreboardScreenshot(input: {
  buffer: Buffer;
  mime?: string;
  screenshotPath?: string | null;
  sourceId?: string | null;
}) {
  const parsed = await parseScoreboardImage(input.buffer, input.mime);
  return applyParsedScoreboard(parsed, input.screenshotPath, input.sourceId);
}

export async function ingestScoreboardFile(filePath: string) {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath.replace(/^\//, ""));
  const buffer = await readFile(abs);
  const mime = abs.endsWith(".png") ? "image/png" : "image/jpeg";
  return ingestScoreboardScreenshot({ buffer, mime }).then((row) => row.match);
}
