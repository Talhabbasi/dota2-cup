import type { OpenDotaMatch, OpenDotaMatchPlayer } from "./opendota";

export function steamWebApiKey() {
  return (
    process.env.STEAM_WEB_API_KEY?.trim() ||
    process.env.STEAM_API_KEY?.trim() ||
    ""
  );
}

type SteamPlayer = {
  account_id?: number;
  player_slot: number;
  hero_id: number;
  item_0: number;
  item_1: number;
  item_2: number;
  item_3: number;
  item_4: number;
  item_5: number;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gold_per_min: number;
  xp_per_min: number;
};

type SteamMatchDetails = {
  result?: {
    error?: string;
    match_id: number;
    duration: number;
    start_time: number;
    radiant_win: boolean;
    players?: SteamPlayer[];
  };
};

type SteamHistory = {
  result?: {
    matches?: { match_id: number; start_time: number }[];
  };
};

function toOpenDotaPlayer(player: SteamPlayer): OpenDotaMatchPlayer {
  return {
    account_id: player.account_id,
    hero_id: player.hero_id,
    player_slot: player.player_slot,
    kills: player.kills ?? 0,
    deaths: player.deaths ?? 0,
    assists: player.assists ?? 0,
    last_hits: player.last_hits ?? 0,
    denies: player.denies ?? 0,
    gold_per_min: player.gold_per_min ?? 0,
    xp_per_min: player.xp_per_min ?? 0,
    item_0: player.item_0 ?? 0,
    item_1: player.item_1 ?? 0,
    item_2: player.item_2 ?? 0,
    item_3: player.item_3 ?? 0,
    item_4: player.item_4 ?? 0,
    item_5: player.item_5 ?? 0,
  };
}

export async function fetchSteamMatchDetails(
  matchId: string,
): Promise<OpenDotaMatch | null> {
  const key = steamWebApiKey();
  if (!key || !/^\d{8,12}$/.test(matchId)) return null;
  const url = new URL(
    "https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/V1/",
  );
  url.searchParams.set("key", key);
  url.searchParams.set("match_id", matchId);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as SteamMatchDetails;
  const match = data.result;
  if (!match || match.error || !match.players || match.players.length < 10) {
    return null;
  }
  return {
    match_id: match.match_id,
    duration: match.duration,
    start_time: match.start_time,
    radiant_win: match.radiant_win,
    players: match.players.map(toOpenDotaPlayer),
  };
}

export async function fetchSteamRecentMatchIds(
  steam32: number,
): Promise<{ match_id: number; start_time: number }[]> {
  const key = steamWebApiKey();
  if (!key) return [];
  const url = new URL(
    "https://api.steampowered.com/IDOTA2Match_570/GetMatchHistory/V1/",
  );
  url.searchParams.set("key", key);
  url.searchParams.set("account_id", String(steam32));
  url.searchParams.set("matches_requested", "20");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as SteamHistory;
  return (data.result?.matches ?? []).filter(
    (row) => row.match_id && row.start_time,
  );
}
