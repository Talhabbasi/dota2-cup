import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, Swords } from "lucide-react";
import {
  EsportsCard,
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
  FactionBadge,
  MatchStatusBadge,
  StatTile,
  TeamBadge,
} from "@/components/common";
import { formatDuration, getMatch, getMatchMeta } from "@/lib/data";
import { formatKillScore, matchKillTotals } from "@/lib/match-score";
import { loadHeroCatalog, heroIconUrl } from "@/lib/opendota";
import { isMatchStandIn, unregisteredStandInLabel } from "@/lib/stand-in";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchMeta(id);
  if (!match) return { title: "Match" };
  return {
    title: match.title,
    description: `${match.title} — MM Dota Cup match result${
      match.openDotaId ? ` · Match ${match.openDotaId}` : ""
    }.`,
  };
}

type CatalogHero = {
  id: number;
  slug: string;
  name: string;
};

type MatchPlayerRow = {
  id: string;
  side: string;
  hero: string;
  heroId: number;
  kills: number;
  deaths: number;
  assists: number;
  unknown: boolean;
  boardName: string;
  steam32: number;
  player: { id: string; steamName: string; teamId: string | null } | null;
};

function resolveHero(
  player: MatchPlayerRow,
  byId: Map<number, CatalogHero>,
  byName: Map<string, CatalogHero>,
) {
  return (
    (player.heroId ? byId.get(player.heroId) : undefined) ??
    byName.get(player.hero.toLowerCase())
  );
}

function SideScoreboard({
  label,
  side,
  rows,
  match,
  byId,
  byName,
}: {
  label: string;
  side: "radiant" | "dire";
  rows: MatchPlayerRow[];
  match: {
    radiantTeam: { id: string } | null;
    direTeam: { id: string } | null;
  };
  byId: Map<number, CatalogHero>;
  byName: Map<string, CatalogHero>;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <FactionBadge side={side} label={label} />
      </div>
      <EsportsTable>
        <EsportsTableHeader>
          <EsportsTableRow className="hover:bg-transparent">
            <EsportsTableHead>Player</EsportsTableHead>
            <EsportsTableHead>Hero</EsportsTableHead>
            <EsportsTableHead className="text-right!">K/D/A</EsportsTableHead>
          </EsportsTableRow>
        </EsportsTableHeader>
        <EsportsTableBody>
          {rows.map((p) => {
            const hero = resolveHero(p, byId, byName);
            const standIn = isMatchStandIn({
              side: p.side,
              unknown: p.unknown,
              playerTeamId: p.player?.teamId ?? null,
              radiantTeamId: match.radiantTeam?.id ?? null,
              direTeamId: match.direTeam?.id ?? null,
            });
            return (
              <EsportsTableRow key={p.id}>
                <EsportsTableCell>
                  {p.player && !p.unknown ? (
                    <>
                      <Link
                        href={`/players/${p.player.id}`}
                        className="text-foreground!"
                      >
                        {p.player.steamName}
                      </Link>
                      {standIn ? (
                        <span className="text-muted-foreground"> (stand-in)</span>
                      ) : null}
                    </>
                  ) : (
                    unregisteredStandInLabel(p.boardName, p.steam32)
                  )}
                </EsportsTableCell>
                <EsportsTableCell>
                  {hero ? (
                    <Link
                      href={`/heroes/${hero.slug}`}
                      className="inline-flex items-center gap-2 text-foreground!"
                    >
                      <Image
                        src={heroIconUrl(hero.slug)}
                        alt=""
                        width={28}
                        height={28}
                        unoptimized
                        className="size-7 rounded-sm ring-1 ring-white/10"
                      />
                      <span>{hero.name}</span>
                    </Link>
                  ) : (
                    p.hero
                  )}
                </EsportsTableCell>
                <EsportsTableCell className="text-right! font-mono tabular-nums">
                  {p.kills}/{p.deaths}/{p.assists}
                </EsportsTableCell>
              </EsportsTableRow>
            );
          })}
        </EsportsTableBody>
      </EsportsTable>
    </section>
  );
}

function HeroLineup({
  label,
  side,
  rows,
  byId,
  byName,
}: {
  label: string;
  side: "radiant" | "dire";
  rows: MatchPlayerRow[];
  byId: Map<number, CatalogHero>;
  byName: Map<string, CatalogHero>;
}) {
  const heroes = rows
    .map((p) => resolveHero(p, byId, byName))
    .filter((h): h is CatalogHero => Boolean(h));

  if (heroes.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <FactionBadge side={side} label={label} showIcon={false} />
      <div className="flex flex-wrap gap-1.5">
        {heroes.map((hero) => (
          <Link
            key={hero.id}
            href={`/heroes/${hero.slug}`}
            title={hero.name}
            className="block"
          >
            <Image
              src={heroIconUrl(hero.slug)}
              alt={hero.name}
              width={40}
              height={40}
              unoptimized
              className={cn(
                "size-10 rounded-md ring-1",
                side === "radiant" ? "ring-emerald-500/40" : "ring-red-500/40",
              )}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatch(id);
  if (!match) notFound();

  const catalog = await loadHeroCatalog();
  const byName = new Map(catalog.map((h) => [h.name.toLowerCase(), h]));
  const byId = new Map(catalog.map((h) => [h.id, h]));

  const radiant = match.players.filter((p) => p.side === "radiant");
  const dire = match.players.filter((p) => p.side === "dire");
  const winner =
    match.winnerTeam?.name ?? (match.radiantWin ? "Radiant" : "Dire");
  const { radiantKills, direKills, hasScore } = matchKillTotals(match.players, {
    radiantScore: match.radiantScore,
    direScore: match.direScore,
  });
  const radiantWon =
    match.winnerTeam?.id === match.radiantTeam?.id || match.radiantWin === true;
  const direWon =
    match.winnerTeam?.id === match.direTeam?.id || match.radiantWin === false;
  const killDiff = hasScore ? Math.abs(radiantKills - direKills) : 0;
  const killLeadSide =
    radiantKills > direKills
      ? "Radiant"
      : direKills > radiantKills
        ? "Dire"
        : "Tied";
  const hasHeroLineup = match.players.some(
    (p) =>
      Boolean(p.heroId) ||
      Boolean(byName.get(p.hero.toLowerCase())),
  );

  return (
    <div className="page">
      <Link href="/matches" className="back-link">
        ← Matches
      </Link>

      <EsportsCard interactive={false} className="mb-6 overflow-hidden px-5 py-6 sm:px-7">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <div
            className={cn(
              "flex min-w-0 flex-col gap-2",
              radiantWon && "[&_span]:font-semibold! [&_span]:text-white!",
              direWon && "[&_span]:text-slate-500!",
            )}
          >
            <FactionBadge side="radiant" />
            {match.radiantTeam ? (
              <Link href={`/teams/${match.radiantTeam.id}`} className="min-w-0">
                <TeamBadge
                  name={match.radiantTeam.name}
                  side="radiant"
                  size="lg"
                />
              </Link>
            ) : (
              <TeamBadge name="Radiant" side="radiant" size="lg" />
            )}
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            {hasScore ? (
              <p
                className="m-0 font-mono text-4xl font-bold tracking-wider tabular-nums sm:text-5xl"
                aria-label={`Kill score ${radiantKills} to ${direKills}`}
              >
                <span className={radiantWon ? "text-white" : direWon ? "text-slate-500" : "text-foreground"}>
                  {radiantKills}
                </span>
                <span className="text-slate-600"> : </span>
                <span className={direWon ? "text-white" : radiantWon ? "text-slate-500" : "text-foreground"}>
                  {direKills}
                </span>
              </p>
            ) : (
              <p className="m-0 font-mono text-3xl font-bold text-slate-500">—</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <MatchStatusBadge
                status="completed"
                label={
                  match.openDotaId.startsWith("manual-")
                    ? "FT · Recorded"
                    : `FT · ${match.openDotaId}`
                }
              />
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden />
                {formatDuration(match.duration)}
              </span>
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              {winner} win
              {hasScore ? ` · ${formatKillScore(radiantKills, direKills)}` : ""}
            </p>
          </div>

          <div
            className={cn(
              "flex min-w-0 flex-col gap-2 md:items-end",
              direWon && "[&_span]:font-semibold! [&_span]:text-white!",
              radiantWon && "[&_span]:text-slate-500!",
            )}
          >
            <FactionBadge side="dire" />
            {match.direTeam ? (
              <Link href={`/teams/${match.direTeam.id}`} className="min-w-0">
                <TeamBadge name={match.direTeam.name} side="dire" size="lg" />
              </Link>
            ) : (
              <TeamBadge name="Dire" side="dire" size="lg" />
            )}
          </div>
        </div>
      </EsportsCard>

      {hasScore ? (
        <section className="mb-6" aria-label="Kill advantage">
          <h2 className="mb-3 font-display text-lg tracking-wide text-foreground uppercase">
            Kill advantage
          </h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
            <li>
              <StatTile
                label="Radiant kills"
                value={radiantKills}
                icon={<Swords className="text-emerald-400" />}
              />
            </li>
            <li>
              <StatTile
                label="Dire kills"
                value={direKills}
                icon={<Swords className="text-red-400" />}
              />
            </li>
            <li>
              <StatTile
                label={killLeadSide === "Tied" ? "Kill diff" : `${killLeadSide} lead`}
                value={killDiff}
              />
            </li>
          </ul>
        </section>
      ) : null}

      {hasHeroLineup ? (
        <EsportsCard interactive={false} className="mb-6 px-5 py-5">
          <h2 className="mt-0 mb-4 font-display text-lg tracking-wide text-foreground uppercase">
            Hero lineup
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <HeroLineup
              label="Radiant"
              side="radiant"
              rows={radiant}
              byId={byId}
              byName={byName}
            />
            <HeroLineup
              label="Dire"
              side="dire"
              rows={dire}
              byId={byId}
              byName={byName}
            />
          </div>
        </EsportsCard>
      ) : null}

      {match.players.length === 0 ? (
        <EsportsCard interactive={false} className="px-5 py-6">
          <p className="m-0 text-sm text-muted-foreground">
            Winner is on the site. Heroes and K/D/A appear after a SCOREBOARD
            screenshot is posted in Discord #results.
          </p>
        </EsportsCard>
      ) : (
        <div className="grid gap-6">
          <SideScoreboard
            label="Radiant"
            side="radiant"
            rows={radiant}
            match={match}
            byId={byId}
            byName={byName}
          />
          <SideScoreboard
            label="Dire"
            side="dire"
            rows={dire}
            match={match}
            byId={byId}
            byName={byName}
          />
        </div>
      )}
    </div>
  );
}
