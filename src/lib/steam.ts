const STEAM64_BASE = BigInt("76561197960265728");
const STEAM_COMMUNITY = "https://steamcommunity.com";

export const STEAM_PROFILE_HELP =
  "Paste your full Steam profile link from the Steam app (Share → Copy Page URL), e.g. https://steamcommunity.com/profiles/76561198… or https://steamcommunity.com/id/yourname";

export type SteamProfile = {
  steam32: number;
  steam64: string;
  steamName: string;
  profileUrl: string;
};

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

async function fetchProfileXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "MM-Dota-Cup/1.0 (+discord registration)" },
  });
  if (!res.ok) {
    throw new Error(
      "Steam profile not found. Make sure the link is correct and the profile is public.",
    );
  }
  return res.text();
}

function parseProfileXml(
  xml: string,
  expectedSteam32?: number,
): Omit<SteamProfile, "profileUrl"> {
  const id64Match = xml.match(/<steamID64>(\d{17})<\/steamID64>/);
  if (!id64Match) {
    throw new Error(
      "Could not read that Steam profile. Use Share → Copy Page URL from the Steam app.",
    );
  }

  const steam64 = id64Match[1];
  const steam32 = steam64To32(BigInt(steam64));

  if (expectedSteam32 != null && steam32 !== expectedSteam32) {
    throw new Error(
      "Steam profile could not be verified. Copy the link again from the Steam app.",
    );
  }

  const persona =
    xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] ??
    xml.match(/<steamID>([^<]+)<\/steamID>/)?.[1];
  const steamName = persona?.trim();
  if (!steamName) {
    throw new Error(
      "Could not read that Steam display name. Check the profile is public, or use the profiles/7656… link.",
    );
  }

  return { steam32, steam64, steamName };
}

/** Resolve and verify a Steam profile URL (registration only — not bare IDs). */
export async function resolveSteamProfile(input: string): Promise<SteamProfile> {
  const parsed = parseProfileInput(input);

  if (parsed.kind === "profiles") {
    const expectedSteam32 = steam64To32(BigInt(parsed.steam64));
    const xml = await fetchProfileXml(
      `${steamProfileUrl(parsed.steam64)}?xml=1`,
    );
    const profile = parseProfileXml(xml, expectedSteam32);
    return { ...profile, profileUrl: steamProfileUrl(profile.steam64) };
  }

  const xml = await fetchProfileXml(
    `${STEAM_COMMUNITY}/id/${encodeURIComponent(parsed.vanity)}?xml=1`,
  );
  const profile = parseProfileXml(xml);
  return { ...profile, profileUrl: steamProfileUrl(profile.steam64) };
}

/** Confirm an existing Steam32 still resolves (admin / match tooling). */
export async function verifySteamAccount(
  steam32: number,
): Promise<{ steamName: string; profileUrl: string }> {
  const steam64 = steam32To64(steam32);
  const xml = await fetchProfileXml(`${steamProfileUrl(steam64)}?xml=1`);
  const profile = parseProfileXml(xml, steam32);
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
