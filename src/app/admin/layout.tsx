import { authSession } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/site-admin";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

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

  return <AdminShell userLabel={userLabel}>{children}</AdminShell>;
}
