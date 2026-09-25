"use client";

import {
  AdminCard,
  AdminEmpty,
  AdminStatus,
  AdminToolbar,
} from "@/components/admin/ui";
import { PlayerInsightAwardsGrid } from "@/components/player-insight-awards";
import {
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
} from "@/components/common/esports-table";
import { formatPoints } from "@/lib/constants";
import type { PublicPlayerInsight } from "@/lib/player-insight";

export type InsightLeaderRow = {
  name: string;
  teamName: string | null;
  value: number;
  detail?: string;
  kind?: "roster" | "standin";
};

export type InsightsView = {
  matchesPlayed: number;
  matchesWithWinner: number;
  standInSeats: number;
  unmatchedSeats: number;
  linkedSeats: number;
  registeredPlayers: number;
  signedPlayers: number;
  roleBreakdown: { role: string; label: string; count: number }[];
  topKills: InsightLeaderRow[];
  topAssists: InsightLeaderRow[];
  topDeaths: InsightLeaderRow[];
  mostGames: InsightLeaderRow[];
  highestGpm: InsightLeaderRow[];
  mostPickedHeroes: InsightLeaderRow[];
  topTeamKills: InsightLeaderRow[];
  topTeamDeaths: InsightLeaderRow[];
  standInTopKills: InsightLeaderRow[];
  standInTopAssists: InsightLeaderRow[];
  standInMostGames: InsightLeaderRow[];
  highestBid: InsightLeaderRow | null;
  highestSold: InsightLeaderRow | null;
  avgSoldPrice: number | null;
  soldCount: number;
};

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <AdminCard>
      <p className="m-0 text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={`mt-2 mb-0 text-2xl font-semibold tracking-wide ${accent ?? "text-foreground"}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 mb-0 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </AdminCard>
  );
}

function LeaderTable({
  title,
  rows,
  valueLabel,
  nameHeader = "Player",
  formatValue,
}: {
  title: string;
  rows: InsightLeaderRow[];
  valueLabel: string;
  nameHeader?: string;
  formatValue?: (n: number) => string;
}) {
  return (
    <div>
      <AdminToolbar title={title} count={rows.length} />
      {rows.length === 0 ? (
        <AdminEmpty>No data yet.</AdminEmpty>
      ) : (
        <div className="admin-table-scroll">
          <EsportsTable>
            <EsportsTableHeader>
              <EsportsTableRow>
                <EsportsTableHead className="w-12">#</EsportsTableHead>
                <EsportsTableHead>{nameHeader}</EsportsTableHead>
                <EsportsTableHead>Team</EsportsTableHead>
                <EsportsTableHead>{valueLabel}</EsportsTableHead>
              </EsportsTableRow>
            </EsportsTableHeader>
            <EsportsTableBody>
              {rows.map((row, i) => (
                <EsportsTableRow
                  key={`${row.kind ?? "row"}-${row.name}-${row.teamName}-${i}`}
                >
                  <EsportsTableCell className="tabular-nums text-muted-foreground">
                    {i + 1}
                  </EsportsTableCell>
                  <EsportsTableCell className="font-medium">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {row.name}
                      {row.kind === "standin" ? (
                        <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-[0.08em] text-amber-300 uppercase">
                          Stand-in
                        </span>
                      ) : null}
                    </span>
                  </EsportsTableCell>
                  <EsportsTableCell className="text-muted-foreground">
                    {row.kind === "standin" && row.teamName
                      ? `For ${row.teamName}`
                      : (row.teamName ?? "—")}
                  </EsportsTableCell>
                  <EsportsTableCell className="tabular-nums text-[#8eb4ff]">
                    {formatValue ? formatValue(row.value) : row.value}
                  </EsportsTableCell>
                </EsportsTableRow>
              ))}
            </EsportsTableBody>
          </EsportsTable>
        </div>
      )}
    </div>
  );
}

export function AdminInsightsBoard({
  data,
  highlights,
}: {
  data: InsightsView;
  highlights: PublicPlayerInsight;
}) {
  const maxRole = Math.max(...data.roleBreakdown.map((r) => r.count), 1);

  return (
    <div className="space-y-10">
      <section>
        <AdminToolbar
          title="Cup pulse"
          hint="Season snapshot — matches, roster, scoreboard health."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Matches"
            value={data.matchesPlayed}
            hint={`${data.matchesWithWinner} with winner set`}
            accent="text-primary"
          />
          <StatCard
            label="Players"
            value={data.registeredPlayers}
            hint={`${data.signedPlayers} on a team`}
          />
          <StatCard
            label="Stand-ins"
            value={data.standInSeats}
            hint="Guest seats marked by admin"
            accent="text-amber-300"
          />
          <StatCard
            label="OCR health"
            value={data.unmatchedSeats}
            hint={`${data.linkedSeats} linked seats`}
            accent={
              data.unmatchedSeats > 0 ? "text-rose-300" : "text-emerald-300"
            }
          />
        </div>
      </section>

      <section>
        <AdminToolbar
          title="Same as Player Insight"
          hint="Identical winners as the public /player-insight page."
        />
        <PlayerInsightAwardsGrid awards={highlights} />
      </section>

      <section>
        <AdminToolbar
          title="Auction highlights"
          hint="Biggest money moments from this season."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Highest bid"
            value={
              data.highestBid ? formatPoints(data.highestBid.value) : "—"
            }
            hint={
              data.highestBid
                ? `${data.highestBid.name}${data.highestBid.detail ? ` · ${data.highestBid.detail}` : ""}`
                : "No bids yet"
            }
            accent="text-primary"
          />
          <StatCard
            label="Highest sold"
            value={
              data.highestSold ? formatPoints(data.highestSold.value) : "—"
            }
            hint={
              data.highestSold
                ? `${data.highestSold.name}${data.highestSold.teamName ? ` → ${data.highestSold.teamName}` : ""}`
                : "No sales yet"
            }
          />
          <StatCard
            label="Avg sold"
            value={
              data.avgSoldPrice != null
                ? formatPoints(data.avgSoldPrice)
                : "—"
            }
            hint={`${data.soldCount} lots sold`}
          />
        </div>
      </section>

      <section>
        <AdminToolbar
          title="Role mix"
          hint="Registered role preferences across the cup."
        />
        {data.roleBreakdown.length === 0 ? (
          <AdminEmpty>No role data yet.</AdminEmpty>
        ) : (
          <AdminCard className="grid gap-2">
            {data.roleBreakdown.map((row) => (
              <div
                key={row.role}
                className="grid grid-cols-[minmax(4.5rem,6rem)_1fr_auto] items-center gap-2 sm:grid-cols-[7rem_1fr_auto] sm:gap-3"
              >
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500/80 to-amber-300/90"
                    style={{
                      width: `${Math.round((row.count / maxRole) * 100)}%`,
                    }}
                  />
                </div>
                <AdminStatus tone="gold">{row.count}</AdminStatus>
              </div>
            ))}
          </AdminCard>
        )}
      </section>

      <section>
        <AdminToolbar
          title="Player leaders"
          hint="Roster and stand-in rows stay separate — e.g. Seeker for Danu never mixes with Seeker standing in for Stoic."
        />
        <div className="grid gap-8 lg:grid-cols-2">
          <LeaderTable
            title="Most kills"
            rows={data.topKills}
            valueLabel="Kills"
          />
          <LeaderTable
            title="Most assists"
            rows={data.topAssists}
            valueLabel="Assists"
          />
          <LeaderTable
            title="Most deaths"
            rows={data.topDeaths}
            valueLabel="Deaths"
          />
          <LeaderTable
            title="Most games"
            rows={data.mostGames}
            valueLabel="Games"
          />
          <LeaderTable
            title="Most picked heroes"
            rows={data.mostPickedHeroes}
            valueLabel="Picks"
          />
        </div>
      </section>

      <section>
        <AdminToolbar
          title="Team leaders"
          hint="Franchise totals from every scoreboard seat (roster + stand-in)."
        />
        <div className="grid gap-8 lg:grid-cols-2">
          <LeaderTable
            title="Most team kills"
            rows={data.topTeamKills}
            valueLabel="Kills"
            nameHeader="Team"
          />
          <LeaderTable
            title="Most team deaths"
            rows={data.topTeamDeaths}
            valueLabel="Deaths"
            nameHeader="Team"
          />
        </div>
      </section>
    </div>
  );
}
