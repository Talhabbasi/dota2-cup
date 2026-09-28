import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Swords } from "lucide-react";
import {
  EsportsCard,
  MatchStatusBadge,
  StatTile,
  TeamBadge,
} from "@/components/common";
import { formatDuration, formatRoles, getPlayer, getPlayerMeta } from "@/lib/data";
import { formatPoints, MEDAL_LABELS, type Medal } from "@/lib/constants";
import { PLAY_WINDOW_LABELS, playWindowOrBoth } from "@/lib/play-window";
import {
  heroIconUrl,
  heroPortraitUrl,
  loadHeroCatalog,
} from "@/lib/opendota";
import type { Metadata } from "next";
import { isMatchStandIn } from "@/lib/stand-in";
import { CUP_NAME } from "@/lib/brand";
import { getPublicSeasonContext } from "@/lib/season-page";
import { cn } from "@/lib/utils";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayerMeta(id);
  if (!player) return { title: "Player" };
  const teamBit = player.teamName ? ` · ${player.teamName}` : "";
  return {
    title: player.name,
    description: `${player.name}${teamBit} in ${CUP_NAME} — player profile, heroes, and match history.`,
  };
}

function playerWon(
  side: string,
  radiantWin: boolean | null,
  winnerTeamId: string | null,
  radiantTeamId: string | null,
  direTeamId: string | null,
) {
  const teamId = side === "radiant" ? radiantTeamId : direTeamId;
  if (winnerTeamId && teamId) return winnerTeamId === teamId;
  if (radiantWin == null) return null;
  return side === "radiant" ? radiantWin : !radiantWin;
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { seasonId } = await getPublicSeasonContext(sp);
  const player = await getPlayer(id, { seasonId });
  if (!player) notFound();

  const catalog = await loadHeroCatalog();
  const byId = new Map(catalog.map((h) => [h.id, h]));
  const byName = new Map(catalog.map((h) => [h.name.toLowerCase(), h]));

  const games = player.matchPlayers.map((row) => {
    const heroInfo =
      (row.heroId ? byId.get(row.heroId) : undefined) ??
      byName.get(row.hero.toLowerCase());
    const won = playerWon(
      row.side,
      row.match.radiantWin,
      row.match.winnerTeamId,
      row.match.radiantTeam?.id ?? null,
      row.match.direTeam?.id ?? null,
    );
    return {
      ...row,
      heroInfo,
      won,
    };
  });

  const focus = player.focusStats;
  const career = player.career;
  const wins = focus.wins;
  const losses = focus.losses;
  const kda = focus.kda != null ? focus.kda.toFixed(2) : "—";
  const careerKda = career.kda != null ? career.kda.toFixed(2) : "—";

  const heroCounts = new Map<
    string,
    { slug: string; name: string; plays: number; kills: number; deaths: number; assists: number }
  >();
  for (const game of games) {
    const key = game.heroInfo?.slug ?? game.hero.toLowerCase();
    const name = game.heroInfo?.name ?? game.hero;
    const slug = game.heroInfo?.slug ?? "";
    const current = heroCounts.get(key) ?? {
      slug,
      name,
      plays: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    };
    current.plays += 1;
    current.kills += game.kills;
    current.deaths += game.deaths;
    current.assists += game.assists;
    heroCounts.set(key, current);
  }
  const topHeroes = [...heroCounts.values()].sort((a, b) => b.plays - a.plays);

  const seasonQuery = (sid: string | null) =>
    sid ? `/players/${player.id}?season=${sid}` : `/players/${player.id}`;

  return (
    <div className="page">
      <Link href="/players" className="back-link">
        ← Players
      </Link>

      <EsportsCard interactive={false} className="mb-6 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="m-0 text-[0.68rem] font-semibold tracking-[0.16em] text-primary uppercase">
            Career profile
          </p>
          <h1 className="mt-2 mb-2 font-display text-3xl tracking-wide text-foreground uppercase">
            {player.steamName}
          </h1>
          <p className="m-0 text-sm text-muted-foreground">
            {MEDAL_LABELS[player.medal as Medal] ?? player.medal}
            {" · "}
            {formatRoles(player.roles)}
            {" · "}
            {PLAY_WINDOW_LABELS[playWindowOrBoth(player.playWindow)]}
          </p>
        </div>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 border-b border-white/10 p-5 sm:grid-cols-4">
          <li>
            <StatTile label="Career games" value={career.games || "0"} />
          </li>
          <li>
            <StatTile
              label="Career record"
              value={career.games ? `${career.wins}W–${career.losses}L` : "—"}
            />
          </li>
          <li>
            <StatTile icon={<Swords />} label="Career KDA" value={careerKda} />
          </li>
          <li>
            <StatTile
              label="Seasons"
              value={player.seasonHistory.length || "—"}
            />
          </li>
        </ul>

        {player.seasonHistory.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-3">
            {player.seasonHistory.map((row) => {
              const active = player.focusSeasonId === row.seasonId;
              return (
                <Link
                  key={row.seasonId}
                  href={seasonQuery(row.seasonId)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition",
                    active
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-100"
                      : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground",
                  )}
                >
                  Season {row.number}
                  {row.live ? " · Live" : ""}
                </Link>
              );
            })}
          </div>
        ) : null}

        <div className="border-b border-white/10 px-5 py-4">
          <p className="m-0 text-[0.68rem] font-semibold tracking-[0.16em] text-primary uppercase">
            {player.currentSeason
              ? `Season ${player.currentSeason.number}`
              : "Season"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {player.team ? (
              <Link
                href={`/teams/${player.team.id}${
                  player.focusSeasonId
                    ? `?season=${player.focusSeasonId}`
                    : ""
                }`}
              >
                <TeamBadge name={player.team.name} />
              </Link>
            ) : games.length > 0 ? (
              <span className="text-sm text-muted-foreground">Stand-in</span>
            ) : (
              <span className="text-sm text-muted-foreground">Unsigned</span>
            )}
            {player.isCaptain ? (
              <span className="text-sm text-amber-300">👑 Captain</span>
            ) : null}
            {player.rosterRole === "sub" ? (
              <span className="text-sm text-muted-foreground">Sub</span>
            ) : null}
            {player.focusSoldPrice != null ? (
              <span className="font-mono text-sm tabular-nums text-foreground">
                Sold {formatPoints(player.focusSoldPrice)}
              </span>
            ) : player.isCaptain ? (
              <span className="text-sm text-muted-foreground">Captain seat</span>
            ) : null}
          </div>
        </div>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          <li>
            <StatTile label="Games" value={games.length || "0"} />
          </li>
          <li>
            <StatTile
              label="Record"
              value={games.length ? `${wins}W–${losses}L` : "—"}
            />
          </li>
          <li>
            <StatTile icon={<Swords />} label="Avg KDA" value={kda} />
          </li>
          <li>
            <StatTile label="Heroes" value={topHeroes.length || "—"} />
          </li>
        </ul>
      </EsportsCard>

      {player.seasonHistory.length > 1 ? (
        <section className="mb-6">
          <div className="section-head">
            <h2>Season breakdown</h2>
          </div>
          <div className="grid gap-2">
            {player.seasonHistory.map((row) => {
              const active = player.focusSeasonId === row.seasonId;
              return (
                <Link key={row.seasonId} href={seasonQuery(row.seasonId)}>
                  <EsportsCard
                    className={cn(
                      "px-4 py-3 transition",
                      active && "border-amber-500/40",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="m-0 font-medium text-foreground">
                          Season {row.number}
                          {row.name !== `Season ${row.number}`
                            ? ` · ${row.name}`
                            : ""}
                          {row.live ? (
                            <span className="ml-2 text-[0.65rem] text-amber-400 uppercase">
                              Live
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 mb-0 text-sm text-muted-foreground">
                          {row.games
                            ? `${row.wins}W–${row.losses}L · KDA ${
                                row.kda?.toFixed(2) ?? "—"
                              }`
                            : "No matches"}
                          {row.soldPrice != null
                            ? ` · Sold ${formatPoints(row.soldPrice)}`
                            : row.isCaptain
                              ? " · Captain"
                              : ""}
                        </p>
                      </div>
                      {row.teamId && row.teamName ? (
                        <TeamBadge name={row.teamName} size="sm" />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Unsigned
                        </span>
                      )}
                    </div>
                  </EsportsCard>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {topHeroes.length > 0 ? (
        <section className="mb-6">
          <div className="section-head">
            <h2>Signature heroes</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {topHeroes.map((hero) =>
              hero.slug ? (
                <Link
                  key={hero.slug}
                  href={`/heroes/${hero.slug}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#121824] px-2.5 py-2 transition hover:border-amber-500/30"
                >
                  <Image
                    src={heroIconUrl(hero.slug)}
                    alt={hero.name}
                    width={32}
                    height={32}
                    unoptimized
                    className="rounded"
                  />
                  <span className="text-sm text-foreground">
                    {hero.name}
                    <span className="mt-0.5 block font-mono text-[0.65rem] tabular-nums text-muted-foreground">
                      {hero.plays} · {hero.kills}/{hero.deaths}/{hero.assists}
                    </span>
                  </span>
                </Link>
              ) : (
                <span
                  key={hero.name}
                  className="inline-flex rounded-lg border border-white/10 bg-[#121824] px-2.5 py-2 text-sm"
                >
                  {hero.name}
                </span>
              ),
            )}
          </div>
        </section>
      ) : null}

      <div className="section-head">
        <h2>
          Match history
          {player.currentSeason
            ? ` · Season ${player.currentSeason.number}`
            : ""}
        </h2>
      </div>
      {games.length === 0 ? (
        <EsportsCard interactive={false} className="p-6">
          <p className="m-0 text-muted-foreground">
            No posted matches yet for this season.
          </p>
        </EsportsCard>
      ) : (
        <div className="grid gap-3">
          {games.map((game) => {
            const standIn = isMatchStandIn({
              side: game.side,
              unknown: game.unknown,
              playerId: player.id,
              playerTeamId: game.seasonTeamId ?? null,
              radiantTeamId: game.match.radiantTeam?.id ?? null,
              direTeamId: game.match.direTeam?.id ?? null,
            });
            return (
              <EsportsCard key={game.id} className="overflow-hidden">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  {game.heroInfo ? (
                    <Link
                      href={`/heroes/${game.heroInfo.slug}`}
                      className="relative block h-20 w-full shrink-0 overflow-hidden rounded-lg sm:h-16 sm:w-28"
                    >
                      <Image
                        src={heroPortraitUrl(game.heroInfo.slug)}
                        alt={game.heroInfo.name}
                        fill
                        unoptimized
                        sizes="112px"
                        className="object-cover"
                      />
                    </Link>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/matches/${game.match.id}`}
                      className="font-medium text-foreground!"
                    >
                      {game.match.radiantTeam?.name ?? "Radiant"} vs{" "}
                      {game.match.direTeam?.name ?? "Dire"}
                    </Link>
                    <p className="mt-1 mb-0 text-sm text-muted-foreground">
                      {game.side === "radiant" ? "Radiant" : "Dire"}
                      {standIn ? " (stand-in)" : ""}
                      {" · "}
                      {formatDuration(game.match.duration)}
                      {game.match.season
                        ? ` · Season ${game.match.season.number}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <MatchStatusBadge
                      status="completed"
                      label={
                        game.won == null ? "FT" : game.won ? "WIN" : "LOSS"
                      }
                    />
                    <div className="text-right">
                      <p className="m-0 font-mono text-lg font-bold tabular-nums text-foreground">
                        {game.kills}/{game.deaths}/{game.assists}
                      </p>
                      <p className="m-0 text-[0.62rem] tracking-wide text-muted-foreground uppercase">
                        KDA
                      </p>
                    </div>
                  </div>
                </div>
              </EsportsCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
