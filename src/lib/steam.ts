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

function parseProfileInput(input: string): ParsedProfileInput {
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

async function fetchProfileXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MM-Dota-Cup/1.0 (+discord registration)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
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

async function resolveVanityViaSteamApi(vanity: string): Promise<string | null> {
  const key = steamWebApiKey();
  if (!key) return null;
  try {
    const url = new URL(
      "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/",
    );
    url.searchParams.set("key", key);
    url.searchParams.set("vanityurl", vanity);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      response?: { success?: number; steamid?: string };
    };
    if (data.response?.success !== 1 || !data.response.steamid) return null;
    return data.response.steamid;
  } catch {
    return null;
  }
}

async function personaViaSteamApi(
  steam64: string,
): Promise<Omit<SteamProfile, "profileUrl"> | null> {
  const key = steamWebApiKey();
  if (!key) return null;
  try {
    const url = new URL(
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/",
    );
    url.searchParams.set("key", key);
    url.searchParams.set("steamids", steam64);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      response?: {
        players?: { steamid?: string; personaname?: string }[];
      };
    };
    const player = data.response?.players?.[0];
    const name = player?.personaname?.trim();
    const id64 = player?.steamid?.trim();
    if (!name || !id64 || id64 !== steam64) return null;
    return {
      steam32: steam64To32(BigInt(id64)),
      steam64: id64,
      steamName: name,
    };
  } catch {
    return null;
  }
}

async function personaViaOpenDota(
  steam32: number,
  expectedSteam64: string,
): Promise<Omit<SteamProfile, "profileUrl"> | null> {
  try {
    const res = await fetch(`https://api.opendota.com/api/players/${steam32}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
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
      return null;
    }
    return {
      steam32,
      steam64: expectedSteam64,
      steamName: name,
    };
  } catch {
    return null;
  }
}

async function resolveSteam64(parsed: ParsedProfileInput): Promise<string> {
  if (parsed.kind === "profiles") return parsed.steam64;

  const viaApi = await resolveVanityViaSteamApi(parsed.vanity);
  if (viaApi) return viaApi;

  const xml = await fetchProfileXml(
    `${STEAM_COMMUNITY}/id/${encodeURIComponent(parsed.vanity)}?xml=1`,
  );
  if (xml) {
    const profile = parseProfileXml(xml);
    if (profile) return profile.steam64;
  }

  throw new Error(
    "Steam profile not found. Make sure the link is correct and the profile is public.",
  );
}

async function resolvePersona(
  steam64: string,
): Promise<Omit<SteamProfile, "profileUrl">> {
  const steam32 = steam64To32(BigInt(steam64));

  const viaApi = await personaViaSteamApi(steam64);
  if (viaApi) return viaApi;

  const xml = await fetchProfileXml(`${steamProfileUrl(steam64)}?xml=1`);
  if (xml) {
    const profile = parseProfileXml(xml, steam32);
    if (profile) return profile;
  }

  const viaOpenDota = await personaViaOpenDota(steam32, steam64);
  if (viaOpenDota) return viaOpenDota;

  throw new Error(
    "Steam profile not found. Make sure the link is correct and the profile is public.",
  );
}

/** Resolve and verify a Steam profile URL (registration only — not bare IDs). */
export async function resolveSteamProfile(input: string): Promise<SteamProfile> {
  const parsed = parseProfileInput(input);
  const steam64 = await resolveSteam64(parsed);
  const profile = await resolvePersona(steam64);
  return { ...profile, profileUrl: steamProfileUrl(profile.steam64) };
}

/** Confirm an existing Steam32 still resolves (admin / match tooling). */
export async function verifySteamAccount(
  steam32: number,
): Promise<{ steamName: string; profileUrl: string }> {
  const steam64 = steam32To64(steam32).toString();
  const profile = await resolvePersona(steam64);
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

export async function hasOpenDotaProfile(steam32: number): Promise<boolean> {
  try {
    const res = await fetch(`https://api.opendota.com/api/players/${steam32}`);
    if (!res.ok) return false;
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
    if (!res.ok) return `Player ${steam32}`;
    const data = (await res.json()) as {
      profile?: { personaname?: string };
    };
    return data.profile?.personaname || `Player ${steam32}`;
  } catch {
    return `Player ${steam32}`;
  }
}
