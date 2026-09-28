import Link from "next/link";
import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { adminListSoldLots, adminListTeamsForPicker } from "@/lib/match-admin";
import { pageMeta } from "@/lib/seo";
import { AdminAuctionBoard } from "@/components/admin/auction-board";
import { AdminAuctionDesk } from "@/components/admin/auction-desk";
import { CaptainCredentialsPanel } from "@/components/admin/captain-credentials-panel";
import { AdminCard, AdminSection } from "@/components/admin/ui";
import { listCaptainAccounts } from "@/lib/captain-accounts";
import { getWebAuctionView } from "@/lib/web-auction";
import { getLiveSeason } from "@/lib/seasons";
import { prisma } from "@/lib/prisma";
import { AUCTION_PLAYER_STATUS } from "@/lib/web-auction";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Auction",
  "Live auction desk, captain logins, and sold-lot fixes.",
);

export default async function AdminAuctionPage() {
  await requireAdmin();
  const [lots, view, season, teams, accounts] = await Promise.all([
    adminListSoldLots(),
    getWebAuctionView(),
    getLiveSeason(),
    adminListTeamsForPicker(),
    listCaptainAccounts(),
  ]);

  const poolRows = season
    ? await prisma.seasonPlayer.findMany({
        where: { seasonId: season.id, teamId: null },
        select: {
          player: {
            select: {
              id: true,
              steamName: true,
              medal: true,
              auctionStatus: true,
              basePrice: true,
            },
          },
        },
        orderBy: { player: { steamName: "asc" } },
        take: 80,
      })
    : [];
  const pool = poolRows.map((row) => row.player);

  const format = season?.tournamentFormat ?? "AUCTION_BASED";

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Auction"
        subtitle="Live web desk for captains, credentials, and sold-lot corrections."
        pills={[
          { value: lots.length, label: "sold" },
          { value: pool.length, label: "unsigned" },
        ]}
        actions={
          <Link href="/auction/live" className="text-sm text-primary underline-offset-2 hover:underline">
            Public live board
          </Link>
        }
      />

      <AdminCard tone="accent" className="mb-6">
        <AdminSection title="Live auction desk">
          <AdminAuctionDesk view={view} format={format} />
        </AdminSection>
      </AdminCard>

      <AdminCard className="mb-6">
        <AdminSection title="Captain credentials">
          <p className="m-0 mb-3 text-sm text-muted-foreground">
            Generate single-purpose logins for the captain bid panel at{" "}
            <code>/auction/captain</code>.
          </p>
          <CaptainCredentialsPanel
            teams={teams.map((t) => ({
              id: t.id,
              name: t.name,
              tag: t.tag ?? null,
            }))}
            accounts={accounts.map((a) => ({
              id: a.id,
              loginName: a.loginName,
              teamId: a.teamId,
              teamName: a.team.name,
            }))}
          />
        </AdminSection>
      </AdminCard>

      <AdminCard className="mb-6">
        <AdminSection title="Unsigned player pool">
          <ul className="m-0 grid list-none gap-1 p-0 text-sm">
            {pool.length === 0 ? (
              <li className="text-muted-foreground">No unsigned players.</li>
            ) : (
              pool.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-1.5"
                >
                  <span>
                    {p.steamName}{" "}
                    <span className="text-muted-foreground">({p.medal})</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.auctionStatus || AUCTION_PLAYER_STATUS.UNSOLD}
                    {p.basePrice != null ? ` · floor ${p.basePrice}` : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
        </AdminSection>
      </AdminCard>

      <AdminCard>
        <AdminSection title="Sold lots (price fix)">
          <AdminAuctionBoard
            lots={lots.map((lot) => ({
              id: lot.id,
              playerName: lot.player.steamName,
              teamName: lot.team?.name ?? "—",
              soldPrice: lot.soldPrice ?? 0,
              purse: lot.team?.purse ?? 0,
            }))}
          />
        </AdminSection>
      </AdminCard>
    </div>
  );
}
