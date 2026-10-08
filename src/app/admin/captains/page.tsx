import Link from "next/link";
import { PageHeader } from "@/components/common";
import { AdminSeasonViewer } from "@/components/admin/season-viewer";
import { CaptainCredentialsPanel } from "@/components/admin/captain-credentials-panel";
import { AdminCard, AdminSection } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { listCaptainAccounts } from "@/lib/captain-accounts";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { prisma } from "@/lib/prisma";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Captains",
  "Season captains and auction logins.",
);

export default async function AdminCaptainsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const seasonView = await resolveAdminSeasonView(sp.season);
  const [captains, teams, accounts] = await Promise.all([
    prisma.seasonPlayer.findMany({
      where: { seasonId: seasonView.view.id, isCaptain: true },
      orderBy: { player: { steamName: "asc" } },
      select: {
        player: {
          select: {
            id: true,
            steamName: true,
            pubgName: true,
            discordName: true,
          },
        },
        team: { select: { id: true, name: true } },
      },
    }),
    adminListTeamsForPicker(seasonView.view.id),
    listCaptainAccounts(seasonView.view.id),
  ]);
  const pubg = seasonView.view.game === "PUBG";

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Captains"
        subtitle="Captains for the selected season. Bidding requires Discord sign-in on the appointed account, or a passcode created here."
        pills={[{ value: captains.length, label: "captains" }]}
        actions={
          <Link href="/auction/captain" className="text-sm text-primary underline-offset-2 hover:underline">
            Captain desk
          </Link>
        }
      />
      <AdminSeasonViewer
        view={seasonView.view}
        options={seasonView.options}
        readOnly={seasonView.readOnly}
        publicSeasonParam={seasonView.publicSeasonParam}
        publicHref="/auction/live"
      />
      <AdminCard className="mt-6">
        <AdminSection title="Appointed captains">
          <p className="mb-3 text-sm text-muted-foreground">
            A typed Discord ID is not a login. Appoint the captain on the team page from a player already registered in this season.
          </p>
          {captains.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">
              No captains in this season yet.
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0 text-sm">
              {captains.map((row) => {
                const name = pubg
                  ? row.player.pubgName || row.player.steamName
                  : row.player.steamName;
                return (
                  <li key={row.player.id}>
                    <Link
                      href={`/admin/players/${row.player.id}?season=${seasonView.view.id}`}
                      className="font-medium text-foreground"
                    >
                      {name}
                    </Link>
                    {row.team ? (
                      <>
                        {" · "}
                        <Link href={`/admin/teams/${row.team.id}?season=${seasonView.view.id}`}>
                          {row.team.name}
                        </Link>
                      </>
                    ) : (
                      " · no team"
                    )}
                    {row.player.discordName ? ` · Discord ${row.player.discordName}` : ""}
                  </li>
                );
              })}
            </ul>
          )}
        </AdminSection>
      </AdminCard>
      <AdminCard className="mt-6">
        <AdminSection title="Passcode logins">
          <CaptainCredentialsPanel
            teams={teams.map((team) => ({
              id: team.id,
              name: team.name,
              tag: team.tag ?? null,
            }))}
            accounts={accounts.map((account) => ({
              id: account.id,
              loginName: account.loginName,
              teamId: account.teamId,
              teamName: account.team.name,
            }))}
            readOnly={seasonView.readOnly}
          />
        </AdminSection>
      </AdminCard>
    </div>
  );
}
