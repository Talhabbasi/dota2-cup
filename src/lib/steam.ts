import { noteFailedResponse } from "./public-error";

const STEAM64_BASE = BigInt("76561197960265728");
const STEAM_COMMUNITY = "https://steamcommunity.com";

export const STEAM_PROFILE_HELP =
  "Use a full steamcommunity.com profile link.";

export type SteamProfile = {
  steam32: number;
  steam64: string;
  steamName: string;
  profileUrl: string;
};

export function steamWebApiKey() {
  return (
    process.env.STEAM_WEB_API_KEY?.trim() ||
    process.env.STEAM_API_KEY?.trim() ||
    ""
  );
}

export function steam64To32(steam64: bigint): number {
  return Number(steam64 - STEAM64_BASE);
}

export function steam32To64(steam32: number): bigint {
  return BigInt(steam32) + STEAM64_BASE;
}

export function steamProfileUrl(steam64: string | bigint | number): string {
  return `${STEAM_COMMUNITY}/profiles/${steam64.toString()}`;
}

function normalizeInput(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function rejectBareNumericId(input: string): void {
  const trimmed = input.trim();
  if (/^\d{6,17}$/.test(trimmed)) {
    throw new Error(
      `Raw Steam ID numbers are not accepted. ${STEAM_PROFILE_HELP}`,
    );
  }
}

type ParsedProfileInput =
  | { kind: "profiles"; steam64: string }
  | { kind: "vanity"; vanity: string };

function parseProfileInput(
  input: string,
  options?: { allowNumericId?: boolean },
): ParsedProfileInput {
  const trimmed = input.trim();
  if (options?.allowNumericId && /^\d{6,17}$/.test(trimmed)) {
    const steam64 =
      trimmed.length >= 17
        ? trimmed
        : steam32To64(Number(trimmed)).toString();
    return { kind: "profiles", steam64 };
  }
  rejectBareNumericId(input);
  const normalized = normalizeInput(input);

  const profiles = normalized.match(
    /(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/profiles\/(\d{17})(?:\/|$|\?|#)/i,
  );
  if (profiles) {
    return { kind: "profiles", steam64: profiles[1] };
  }

  const vanity = normalized.match(
    /(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/id\/([^/?#]+)/i,
  );
  if (vanity) {
    return { kind: "vanity", vanity: decodeURIComponent(vanity[1]) };
  }

  throw new Error(
    `That is not a valid Steam profile link. ${STEAM_PROFILE_HELP}`,
  );
}

function steamNotFound(notes: string[]) {
  const extra = [...new Set(notes.filter(Boolean))].slice(-2).join(" ");
  const base =
    "Steam profile not found. Make sure the link is correct and the profile is public.";
  return extra ? `${base} ${extra}` : base;
}

async function fetchProfileXml(
  url: string,
  notes: string[],
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MM-Dota-Cup/1.0 (+discord registration)" },
      cache: "no-store",
    });
    if (!res.ok) {
      notes.push(await noteFailedResponse("Steam community profile", res));
      return null;
    }
    return res.text();
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Steam community request failed.";
    notes.push(reason);
    console.error("Steam community profile request failed", error);
    return null;
  }
}

function parseProfileXml(
  xml: string,
  expectedSteam32?: number,
): Omit<SteamProfile, "profileUrl"> | null {
  const id64Match = xml.match(/<steamID64>(\d{17})<\/steamID64>/);
  if (!id64Match) return null;

  const steam64 = id64Match[1];
  const steam32 = steam64To32(BigInt(steam64));

  if (expectedSteam32 != null && steam32 !== expectedSteam32) {
    return null;
  }

  const persona =
    xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] ??
    xml.match(/<steamID>([^<]+)<\/steamID>/)?.[1];
  const steamName = persona?.trim();
  if (!steamName) return null;

  return { steam32, steam64, steamName };
}

async function resolveVanityViaSteamApi(
  vanity: string,
  notes: string[],
): Promise<string | null> {
  const key = steamWebApiKey();
  if (!key) {
    notes.push("STEAM_WEB_API_KEY is not set, so the vanity URL was not resolved by Steam.");
    return null;
  }
  try {
    const url = new URL(
      "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/",
    );
    url.searchParams.set("key", key);
    url.searchParams.set("vanityurl", vanity);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      notes.push(await noteFailedResponse("Steam vanity lookup", res));
      return null;
    }
    const data = (await res.json()) as {
      response?: { success?: number; steamid?: string };
    };
    if (data.response?.success !== 1 || !data.response.steamid) {
      notes.push("Steam vanity lookup did not return a profile for that link.");
      return null;
    }
    return data.response.steamid;
  } catch (error) {
    notes.push(
      error instanceof Error ? error.message : "Steam vanity lookup failed.",
    );
    console.error("Steam vanity lookup failed", error);
    return null;
  }
}

async function personaViaSteamApi(
  steam64: string,
  notes: string[],
): Promise<Omit<SteamProfile, "profileUrl"> | null> {
  const key = steamWebApiKey();
  if (!key) {
    notes.push("STEAM_WEB_API_KEY is not set, so the Steam profile API was skipped.");
    return null;
  }
  try {
    const url = new URL(
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/",
    );
    url.searchParams.set("key", key);
    url.searchParams.set("steamids", steam64);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      notes.push(await noteFailedResponse("Steam player summary", res));
      return null;
    }
    const data = (await res.json()) as {
      response?: {
        players?: { steamid?: string; personaname?: string }[];
      };
    };
    const player = data.response?.players?.[0];
    const name = player?.personaname?.trim();
    const id64 = player?.steamid?.trim();
    if (!name || !id64 || id64 !== steam64) {
      notes.push("Steam player summary did not include a public name for that profile.");
      return null;
    }
    return {
      steam32: steam64To32(BigInt(id64)),
      steam64: id64,
      steamName: name,
    };
  } catch (error) {
    notes.push(
      error instanceof Error ? error.message : "Steam player summary failed.",
    );
    console.error("Steam player summary failed", error);
    return null;
  }
}

async function personaViaOpenDota(
  steam32: number,
  expectedSteam64: string,
  notes: string[],
): Promise<Omit<SteamProfile, "profileUrl"> | null> {
  try {
    const res = await fetch(`https://api.opendota.com/api/players/${steam32}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      notes.push(await noteFailedResponse("OpenDota player", res));
      return null;
    }
    const data = (await res.json()) as {
      profile?: {
        account_id?: number;
        personaname?: string;
        steamid?: string;
      };
    };
    const name = data.profile?.personaname?.trim();
    const id64 = data.profile?.steamid?.trim();
    if (
      !name ||
      data.profile?.account_id !== steam32 ||
      (id64 && id64 !== expectedSteam64)
    ) {
      notes.push("OpenDota has no public persona for that Steam account.");
      return null;
    }
    return {
      steam32,
      steam64: expectedSteam64,
      steamName: name,
    };
  } catch (error) {
    notes.push(error instanceof Error ? error.message : "OpenDota player lookup failed.");
    console.error("OpenDota player lookup failed", error);
    return null;
  }
}

async function resolveSteam64(
  parsed: ParsedProfileInput,
  notes: string[],
): Promise<string> {
  if (parsed.kind === "profiles") return parsed.steam64;

  const viaApi = await resolveVanityViaSteamApi(parsed.vanity, notes);
  if (viaApi) return viaApi;

  const xml = await fetchProfileXml(
    `${STEAM_COMMUNITY}/id/${encodeURIComponent(parsed.vanity)}?xml=1`,
    notes,
  );
  if (xml) {
    const profile = parseProfileXml(xml);
    if (profile) return profile.steam64;
    notes.push("Steam community XML did not include a profile id.");
  }

  throw new Error(steamNotFound(notes));
}

async function resolvePersona(
  steam64: string,
  notes: string[],
): Promise<Omit<SteamProfile, "profileUrl">> {
  const steam32 = steam64To32(BigInt(steam64));

  const viaApi = await personaViaSteamApi(steam64, notes);
  if (viaApi) return viaApi;

  const xml = await fetchProfileXml(`${steamProfileUrl(steam64)}?xml=1`, notes);
  if (xml) {
    const profile = parseProfileXml(xml, steam32);
    if (profile) return profile;
    notes.push("Steam community XML did not include a public name.");
  }

  const viaOpenDota = await personaViaOpenDota(steam32, steam64, notes);
  if (viaOpenDota) return viaOpenDota;

  throw new Error(steamNotFound(notes));
}

/** Resolve and verify a Steam profile URL (registration only — not bare IDs). */
export async function resolveSteamProfile(
  input: string,
  options?: { allowNumericId?: boolean },
): Promise<SteamProfile> {
  const notes: string[] = [];
  const parsed = parseProfileInput(input, options);
  const steam64 = await resolveSteam64(parsed, notes);
  const profile = await resolvePersona(steam64, notes);
  return { ...profile, profileUrl: steamProfileUrl(profile.steam64) };
}

/** Confirm an existing Steam32 still resolves (admin / match tooling). */
export async function verifySteamAccount(
  steam32: number,
): Promise<{ steamName: string; profileUrl: string }> {
  const steam64 = steam32To64(steam32).toString();
  const profile = await resolvePersona(steam64, []);
  if (profile.steam32 !== steam32) {
    throw new Error(
      "Steam profile could not be verified. Copy the link again from the Steam app.",
    );
  }
  return {
    steamName: profile.steamName,
    profileUrl: steamProfileUrl(profile.steam64),
  };
}

const privacyCache = new Map<number, { isPublic: boolean; at: number }>();
const PRIVACY_CACHE_MS = 10 * 60 * 1000;

async function steamCommunityIsPublic(steam32: number): Promise<boolean> {
  const cached = privacyCache.get(steam32);
  if (cached && Date.now() - cached.at < PRIVACY_CACHE_MS) return cached.isPublic;
  try {
    const res = await fetch(`${steamProfileUrl(steam32To64(steam32))}?xml=1`, {
      headers: { "User-Agent": "MM-Dota-Cup/1.0 (+admin roster)" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;
    const xml = await res.text();
    const privacy = xml
      .match(/<privacyState>([^<]+)<\/privacyState>/i)?.[1]
      ?.trim()
      .toLowerCase();
    const isPublic = privacy === "public";
    privacyCache.set(steam32, { isPublic, at: Date.now() });
    return isPublic;
  } catch (error) {
    console.error(`Steam privacy lookup failed for ${steam32}`, error);
    return false;
  }
}

/**
 * Steam32 ids whose Steam community profile is public.
 * Private and friends-only profiles are omitted, so admin tables can hide Dotabuff / OpenDota.
 */
export async function publicSteam32Set(steam32s: number[]): Promise<Set<number>> {
  const unique = [
    ...new Set(steam32s.filter((id) => Number.isInteger(id) && id > 0)),
  ];
  const open = new Set<number>();
  if (unique.length === 0) return open;

  const queue = [...unique];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id == null) return;
      if (await steamCommunityIsPublic(id)) open.add(id);
    }
  });
  await Promise.all(workers);
  return open;
}

export async function hasOpenDotaProfile(steam32: number): Promise<boolean> {
  try {
    const res = await fetch(`https://api.opendota.com/api/players/${steam32}`);
    if (!res.ok) {
      await noteFailedResponse("OpenDota profile check", res);
      return false;
    }
    const data = (await res.json()) as { profile?: { account_id?: number } };
    return data.profile?.account_id === steam32;
  } catch {
    return false;
  }
}

export async function fetchSteamPersona(steam32: number): Promise<string> {
  try {
    const verified = await verifySteamAccount(steam32);
    return verified.steamName;
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch(`https://api.opendota.com/api/players/${steam32}`);
    if (!res.ok) {
      await noteFailedResponse("OpenDota persona", res);
      return `Player ${steam32}`;
    }
    const data = (await res.json()) as {
      profile?: { personaname?: string };
    };
    return data.profile?.personaname || `Player ${steam32}`;
  } catch {
    return `Player ${steam32}`;
  }
}
