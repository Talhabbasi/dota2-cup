import Link from "next/link";
import { AdminCard } from "@/components/admin/ui";
import type { PlayerInsightAward } from "@/lib/player-insight";
import { cn } from "@/lib/utils";

/** Shared highlight card — same awards on public Player Insight and admin Insights. */
export function PlayerInsightAwardCard({
  eyebrow,
  award,
  empty,
  accent,
  featured = false,
  fullWidth = false,
  children,
}: {
  eyebrow: string;
  award: PlayerInsightAward | null;
  empty: string;
  accent: string;
  featured?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}) {
  const body = award ? (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        {award.kind === "standin" ? (
          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[0.6rem] font-semibold tracking-[0.1em] text-amber-300 uppercase">
            Stand-in
          </span>
        ) : null}
      </div>
      <h2 className="mt-2 mb-1 text-xl font-semibold tracking-wide text-foreground sm:text-2xl">
        {award.playerId ? (
          <Link
            href={`/players/${award.playerId}`}
            className="text-inherit! transition hover:text-amber-300!"
          >
            {award.name}
          </Link>
        ) : (
          award.name
        )}
      </h2>
      {award.teamName && award.teamName !== award.name ? (
        <p className="m-0 text-sm text-muted-foreground">
          {award.kind === "standin" ? `For ${award.teamName}` : award.teamName}
        </p>
      ) : null}
      <p className={cn("mt-3 mb-0 text-lg font-semibold", accent)}>
        {award.valueLabel}
      </p>
      {award.detail ? (
        <p className="mt-1 mb-0 text-xs text-muted-foreground">{award.detail}</p>
      ) : null}
      {children}
    </>
  ) : (
    <>
      <p className="m-0 text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <p className="mt-3 mb-0 text-sm text-muted-foreground">{empty}</p>
    </>
  );

  return (
    <AdminCard
      tone={featured ? "accent" : "default"}
      className={cn(
        fullWidth && "col-span-full sm:col-span-2",
        featured && "border-amber-500/35",
      )}
    >
      {body}
    </AdminCard>
  );
}

export function PlayerInsightAwardsGrid({
  awards,
}: {
  awards: {
    mostKills: PlayerInsightAward | null;
    mostAssists: PlayerInsightAward | null;
    mostDeaths: PlayerInsightAward | null;
    mostTeamKills: PlayerInsightAward | null;
    mostTeamDeaths: PlayerInsightAward | null;
    highestBid: PlayerInsightAward | null;
    mostCorrectPredictions: PlayerInsightAward | null;
    predictionsRevealed: boolean;
    playerOfTournament: (PlayerInsightAward & {
      kills: number;
      assists: number;
      deaths: number;
      games: number;
    }) | null;
  };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <PlayerInsightAwardCard
        eyebrow="Most kills"
        award={awards.mostKills}
        empty="No linked scoreboard kills yet."
        accent="text-rose-300"
      />
      <PlayerInsightAwardCard
        eyebrow="Most assists · Support"
        award={awards.mostAssists}
        empty="No linked assists yet."
        accent="text-cyan-300"
      />
      <PlayerInsightAwardCard
        eyebrow="Most deaths"
        award={awards.mostDeaths}
        empty="No linked deaths yet."
        accent="text-orange-300"
      />
      <PlayerInsightAwardCard
        eyebrow="Most team kills"
        award={awards.mostTeamKills}
        empty="No team kill totals yet."
        accent="text-rose-200"
      />
      <PlayerInsightAwardCard
        eyebrow="Most team deaths"
        award={awards.mostTeamDeaths}
        empty="No team death totals yet."
        accent="text-slate-300"
      />
      <PlayerInsightAwardCard
        eyebrow="Highest bid"
        award={awards.highestBid}
        empty="No auction sales yet."
        accent="text-amber-300"
      />
      <PlayerInsightAwardCard
        eyebrow="Most correct predictions"
        award={
          awards.predictionsRevealed ? awards.mostCorrectPredictions : null
        }
        empty={
          awards.predictionsRevealed
            ? "No scored predictions yet."
            : "Unlocks after the group stage is complete."
        }
        accent="text-violet-300"
        fullWidth
      />
      <PlayerInsightAwardCard
        eyebrow="Player of the tournament"
        award={awards.playerOfTournament}
        empty="Play some matches — impact is kills + assists − deaths, with assists weighted higher."
        accent="text-amber-200"
        featured
        fullWidth
      >
        {awards.playerOfTournament ? (
          <dl className="mt-4 mb-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Kills", awards.playerOfTournament.kills],
                ["Assists", awards.playerOfTournament.assists],
                ["Deaths", awards.playerOfTournament.deaths],
                ["Games", awards.playerOfTournament.games],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">
                  {label}
                </dt>
                <dd className="m-0 mt-1 text-base font-semibold text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </PlayerInsightAwardCard>
    </div>
  );
}
