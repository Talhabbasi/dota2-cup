import { authSession } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/site-admin";
import { cookies } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { listAdminSeasonOptions } from "@/lib/admin-season-view";
import { ADMIN_SEASON_COOKIE } from "@/lib/season-view-cookie";

export const dynamic = "force-dynamic";
/** Scoreboard OCR (Gemini) needs headroom beyond the default serverless limit. */
export const maxDuration = 120;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authSession();
  const discordId = session?.user?.discordId ?? null;
  const isAdmin =
    session?.user?.isAdmin === true ||
    (discordId ? await isSiteAdmin(discordId) : false);

  if (!isAdmin) {
    return <>{children}</>;
  }

  const userLabel =
    session?.user?.name?.trim() ||
    session?.user?.email?.trim() ||
    "Organizer";

  const [seasonOptions, cookieStore] = await Promise.all([
    listAdminSeasonOptions(),
    cookies(),
  ]);

  return (
    <AdminShell
      userLabel={userLabel}
      seasonOptions={seasonOptions}
      savedSeasonId={cookieStore.get(ADMIN_SEASON_COOKIE)?.value ?? null}
    >
      {children}
    </AdminShell>
  );
}
