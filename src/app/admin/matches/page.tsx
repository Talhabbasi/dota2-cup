import { PageHeader } from "@/components/common";
import { AdminSeasonViewer } from "@/components/admin/season-viewer";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { adminListRecentMatches } from "@/lib/match-admin";
import { listPubgLobbies } from "@/lib/pubg-lobby";
import { matchPoints } from "@/lib/pubg-scoring";
import { formatScheduleWhen } from "@/lib/schedule";
import { pageMeta } from "@/lib/seo";
import { AdminMatchesBoard } from "@/components/admin/matches-board";

export const dynamic = "force-dynamic";
/** Match detail OCR / S3 can take longer than the default serverless limit. */
export const maxDuration = 120;
export const metadata = pageMeta("Admin Matches", "Fix match OCR and results.");

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view, options, readOnly, publicSeasonParam } =
    await resolveAdminSeasonView(sp.season);
  const pubg = view.game === "PUBG";
  const lobbies = pubg ? await listPubgLobbies(view.id) : [];
  const played = lobbies.filter((lobby) => lobby.status !== "scheduled");
  const rawMatches = pubg ? [] : await adminListRecentMatches(80, view.id);

  const matches = rawMatches.map((match) => {
    const needsTeam =
      !match.radiantTeam?.id ||
      !match.direTeam?.id ||
      !match.winnerTeam?.id;
    const unmatchedCount = match.players.filter(
      (s) => !s.asStandIn && (s.unknown || !s.playerId),
    ).length;
    const standInCount = match.players.filter((s) => s.asStandIn).length;
    return {
      id: match.id,
      when: formatScheduleWhen(match.createdAt),
      radiantName: match.radiantTeam?.name ?? "Radiant?",
      direName: match.direTeam?.name ?? "Dire?",
      winnerName: match.winnerTeam?.name ?? null,
      needsTeam,
      unmatchedCount,
      standInCount,
    };
  });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Matches"
        subtitle={
          pubg
            ? "Custom-room results for this PUBG season. Book the lobby under Schedule, then record places here or on PUBG results."
            : readOnly
              ? `Archive Dota Season ${view.number} — read-only.`
              : "Team A vs Team B. Fix OCR links and stand-ins, or record the result from Schedule."
        }
        pills={
          pubg
            ? [{ value: played.length, label: "lobbies" }]
            : [
                { value: matches.length, label: "recent" },
                {
                  value: matches.filter((m) => m.unmatchedCount > 0).length,
                  label: "need OCR fix",
                },
              ]
        }
      />
      <AdminSeasonViewer
        view={view}
        options={options}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        publicHref="/matches"
      />
      {pubg ? (
        played.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No played lobbies for this season.
          </p>
        ) : (
          <div className="grid gap-3">
            {played.map((lobby) => (
              <article key={lobby.id} className="rounded-xl border border-white/10 p-4">
                <h2 className="mt-0 mb-2 text-base font-semibold">
                  {lobby.label || "Lobby"} · {lobby.map}
                </h2>
                <p className="mb-3 text-sm text-muted-foreground">
                  {formatScheduleWhen(lobby.playedAt)}
                </p>
                <ul className="m-0 grid list-none gap-1 p-0 text-sm">
                  {lobby.teams
                    .filter((row) => row.placement != null)
                    .map((row) => (
                      <li key={row.id}>
                        #{row.placement} {row.team.name} · {row.kills} kills ·{" "}
                        {matchPoints(row.placement ?? 0, row.kills)} pts
                      </li>
                    ))}
                </ul>
              </article>
            ))}
          </div>
        )
      ) : (
      <AdminMatchesBoard
        matches={matches}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
      />
      )}
    </div>
  );
}
