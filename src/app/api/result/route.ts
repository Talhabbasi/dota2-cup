import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { isSiteAdmin } from "@/lib/site-admin";
import { publicErrorMessage } from "@/lib/public-error";
import { revalidatePublicPages } from "@/lib/page-cache";
import { ingestMatch } from "@/lib/results";

export async function POST(request: Request) {
  const session = await authSession();
  const discordId = session?.user?.discordId;
  const allowed =
    session?.user?.isAdmin === true ||
    (discordId ? await isSiteAdmin(discordId) : false);
  if (!allowed) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { match?: string };
  if (!body.match) {
    return NextResponse.json({ error: "Missing match ID." }, { status: 400 });
  }

  try {
    const match = await ingestMatch({ raw: body.match });
    revalidatePublicPages();
    return NextResponse.json({ id: match.id, openDotaId: match.openDotaId });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "Could not import that match.") },
      { status: 400 },
    );
  }
}
