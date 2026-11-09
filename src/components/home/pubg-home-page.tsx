import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { AuctionEntry } from "@/components/home/auction-entry";
import { PUBG_CUP_NAME } from "@/lib/brand";
import {
  CUP_GAME,
  isPubgSeason,
  parseCupGame,
  pubgModeLabel,
  rosterRules,
} from "@/lib/games";
import { pubgStandings } from "@/lib/pubg-lobby";
import {
  getFeaturedSeasonForGame,
  getLiveSeason,
  listPublicSeasons,
} from "@/lib/seasons";
import { SEASON_STATUS } from "@/lib/season-constants";

/** Live PUBG cup home. When Dota is active, shows PUBG upcoming / archive. */
export async function PubgHomePage() {
  const liveFirst = await getLiveSeason();
  if (isPubgSeason(liveFirst) && liveFirst) {
    const rules = rosterRules(liveFirst);
    const rows = await pubgStandings(liveFirst.id);
    return (
      <div className="page">
        <header className="game-hero-banner">
          <Image
            src="/pubg/desert.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="game-hero-banner-img"
          />
          <div className="game-hero-banner-scrim" aria-hidden />
          <div className="game-hero-banner-body">
            <p className="eyebrow">
              Indoor PUBG · Pakistan · {pubgModeLabel(liveFirst.pubgMode)}
            </p>
            <h1>{PUBG_CUP_NAME}</h1>
            <p className="lede">
              {liveFirst.name} is open. {rules.label}. Entry is Rs{" "}
              {rules.entryFeePkr.toLocaleString("en-PK")} PKR per player,{" "}
              {rules.teamFeePkr.toLocaleString("en-PK")} PKR for a full{" "}
              {pubgModeLabel(liveFirst.pubgMode).toLowerCase()}. 1st place is 10
              points, and every kill is 1 point.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-gold">
                Register
              </Link>
              <Link href="/table" className="btn">
                Points table
              </Link>
              <Link href="/" className="btn btn-ghost">
                All games
              </Link>
            </div>
          </div>
        </header>
        <Suspense>
          <AuctionEntry />
        </Suspense>
        <section className="mt-8">
          <div className="section-head row">
            <h2>Points</h2>
            <Link href="/table" className="text-link">
              Full table
            </Link>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No squads yet. Register, then captains fill the roster at the
              auction.
            </p>
          ) : (
            <ol className="m-0 grid list-none gap-2 p-0">
              {rows.slice(0, 8).map((row, index) => (
                <li
                  key={row.teamId}
                  className="flex justify-between rounded-md border border-white/10 px-3 py-2 text-sm"
                >
                  <span>
                    {index + 1}. {row.name}
                  </span>
                  <span>{row.total} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    );
  }

  const [featured, publicSeasons] = await Promise.all([
    getFeaturedSeasonForGame(CUP_GAME.PUBG),
    listPublicSeasons(),
  ]);
  const planned =
    featured.season ??
    publicSeasons.find((row) => parseCupGame(row.game) === CUP_GAME.PUBG) ??
    null;

  return (
    <div className="page">
      <header className="game-hero-banner">
        <Image
          src="/pubg/fields.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="game-hero-banner-img"
        />
        <div className="game-hero-banner-scrim" aria-hidden />
        <div className="game-hero-banner-body">
          <p className="eyebrow">MM Tournament Hub · PUBG</p>
          <h1>{PUBG_CUP_NAME}</h1>
          <p className="lede">
            {planned
              ? planned.status === SEASON_STATUS.archived
                ? `${planned.name} is complete${planned.championName ? `. ${planned.championName} won.` : "."} Results stay in the season archive.`
                : `${planned.name} is lined up for PUBG. Registration opens when organizers activate the season.`
              : "No PUBG season yet. Organizers create one from Admin → Seasons."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/seasons" className="btn btn-gold">
              Season archive
            </Link>
            <Link href="/" className="btn">
              All games
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
}
