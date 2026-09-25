import { redirect, notFound } from "next/navigation";
import { authSession } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/site-admin";

/** True only for organizer Discord ids/roles or credentials admin. */
export async function sessionIsAdmin() {
  const session = await authSession();
  if (!session?.user) return { session: null, isAdmin: false };
  if (session.user.isAdmin === true) {
    return { session, isAdmin: true };
  }
  const discordId = session.user.discordId ?? null;
  if (discordId && (await isSiteAdmin(discordId))) {
    return { session, isAdmin: true };
  }
  return { session, isAdmin: false };
}

/**
 * Server-side gate for /admin/* pages.
 * Unauthenticated → sign-in. Authenticated non-admin → 404 (no leak).
 */
export async function requireAdmin() {
  const { session, isAdmin } = await sessionIsAdmin();
  if (!session?.user) {
    redirect("/admin");
  }
  if (!isAdmin) {
    notFound();
  }
  return session;
}
