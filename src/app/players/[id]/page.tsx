import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration, formatRoles, getPlayer } from "@/lib/data";
import { parseStoredItems } from "@/lib/heroes";
import {
  MEDAL_LABELS,
  type Medal,
} from "@/lib/constants";
import { PLAY_WINDOW_LABELS, playWindowOrBoth } from "@/lib/play-window";
import {
  heroIconUrl,
  heroPortraitUrl,
  itemIconUrl,
  loadHeroCatalog,
} from "@/lib/opendota";

export const dynamic = "force-dynamic";

function playerWon(side: string, radiantWin: boolean | null, winnerTeamId: string | null, teamId: string | null) {
  if (winnerTeamId && teamId) return winnerTeamId === teamId;
  if (radiantWin == null) return null;
  return side === "radiant" ? radiantWin : !radiantWin;
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = await getPlayer(id);
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
      player.teamId,
    );
    return {
      ...row,
      heroInfo,
      items: parseStoredItems(row.itemsJson),
      won,
    };
  });

  const wins = games.filter((g) => g.won === true).length;
  const losses = games.filter((g) => g.won === false).length;
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

  return (
    <div className="page">
      <Link href="/players" className="back-link">
        ← Players
      </Link>

      <div className="page-head">
        <p className="eyebrow">Player</p>
        <h1>{player.steamName}</h1>
        <p className="lede">
          {player.discordName} · {MEDAL_LABELS[player.medal as Medal] ?? player.medal}
          {player.isCaptain ? " · Captain" : ""}
        </p>
        <p className="muted" style={{ margin: "0 0 0.8rem" }}>
          {formatRoles(player.roles)}
          {player.rosterRole === "sub" ? " · Sub" : ""}
          {" · "}
          {PLAY_WINDOW_LABELS[playWindowOrBoth(player.playWindow)]}
        </p>
        {player.team ? (
          <Link href={`/teams/${player.team.id}`} className="badge badge-gold">
            {player.team.name}
          </Link>
        ) : (
          <span className="badge">Unsigned</span>
        )}
      </div>

      <section className="lot-stats" style={{ marginBottom: "2rem" }}>
        <div className="stat">
          <span className="muted">Games</span>
          <b>{games.length || "0"}</b>
        </div>
        <div className="stat">
          <span className="muted">Record</span>
          <b>{games.length ? `${wins}W – ${losses}L` : "—"}</b>
        </div>
        <div className="stat">
          <span className="muted">Heroes</span>
          <b>{topHeroes.length || "—"}</b>
        </div>
      </section>

      {topHeroes.length > 0 ? (
        <section style={{ marginBottom: "2rem" }}>
          <div className="section-head">
            <h2>Heroes played</h2>
          </div>
          <div className="player-hero-strip">
            {topHeroes.map((hero) =>
              hero.slug ? (
                <Link
                  key={hero.slug}
                  href={`/heroes/${hero.slug}`}
                  className="player-hero-chip"
                >
                  <Image
                    src={heroIconUrl(hero.slug)}
                    alt={hero.name}
                    width={40}
                    height={40}
                    className="match-hero-icon"
                  />
                  <span>
                    {hero.name}
                    <strong>
                      {hero.plays} · {hero.kills}/{hero.deaths}/{hero.assists}
                    </strong>
                  </span>
                </Link>
              ) : (
                <span key={hero.name} className="player-hero-chip">
                  <span>
                    {hero.name}
                    <strong>{hero.plays} plays</strong>
                  </span>
                </span>
              ),
            )}
          </div>
        </section>
      ) : null}

      <div className="section-head">
        <h2>Match history</h2>
      </div>
      {games.length === 0 ? (
        <div className="empty-panel">
          <p className="muted">No posted matches yet for this Steam account.</p>
        </div>
      ) : (
        <div className="hero-match-stack">
          {games.map((game) => {
            const winner =
              game.match.winnerTeam?.name ??
              (game.match.radiantWin ? "Radiant" : "Dire");
            return (
              <article key={game.id} className="hero-match-card player-game">
                {game.heroInfo ? (
                  <Link href={`/heroes/${game.heroInfo.slug}`} className="player-game-art">
                    <Image
                      src={heroPortraitUrl(game.heroInfo.slug)}
                      alt={game.heroInfo.name}
                      width={220}
                      height={124}
                    />
                    <span>{game.heroInfo.name}</span>
                  </Link>
                ) : (
                  <div className="player-game-art">
                    <span>{game.hero}</span>
                  </div>
                )}
                <div>
                  <Link href={`/matches/${game.match.id}`} className="hero-match-title">
                    {game.match.radiantTeam?.name ?? "Radiant"}{" "}
                    <span className="muted">vs</span>{" "}
                    {game.match.direTeam?.name ?? "Dire"}
                  </Link>
                  <p className="muted">
                    {game.side === "radiant" ? "Radiant" : "Dire"}
                    {game.won == null ? "" : game.won ? " · Win" : " · Loss"}
                    {" · "}
                    Winner {winner} · {formatDuration(game.match.duration)}
                  </p>
                  <div className="hero-stat-row">
                    <span>LH {game.lastHits}</span>
                    <span>DN {game.denies}</span>
                    <span>GPM {game.gpm}</span>
                    <span>XPM {game.xpm}</span>
                  </div>
                  <div className="item-row">
                    {game.items.length === 0 ? (
                      <span className="muted">No items</span>
                    ) : (
                      game.items.map((item, i) =>
                        item.key ? (
                          <div
                            key={`${game.id}-${i}`}
                            className="item-chip"
                            title={item.name}
                          >
                            <Image
                              src={itemIconUrl(item.key)}
                              alt={item.name}
                              width={48}
                              height={36}
                              className="item-icon"
                            />
                          </div>
                        ) : (
                          <span key={`${game.id}-${i}`} className="item-chip text">
                            {item.name}
                          </span>
                        ),
                      )
                    )}
                  </div>
                </div>
                <div className="hero-kda">
                  <strong>
                    {game.kills}/{game.deaths}/{game.assists}
                  </strong>
                  <span className="muted">KDA</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
