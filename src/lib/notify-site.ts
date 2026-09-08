export async function notifySiteRefresh() {
  const base = (process.env.NEXTAUTH_URL || "https://dota2-cup.vercel.app").replace(
    /\/+$/,
    "",
  );
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return;

  await fetch(`${base}/api/revalidate`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    cache: "no-store",
  }).catch(() => {
    /* website may be down; Discord flow should still succeed */
  });
}
