import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { isAdminDiscordId } from "@/lib/constants";
import { ingestMatch } from "@/lib/results";

export async function POST(request: Request) {
  const session = await authSession();
  const discordId = session?.user?.discordId;
  if (!discordId || !isAdminDiscordId(discordId)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { match?: string };
  if (!body.match) {
    return NextResponse.json({ error: "Missing match ID." }, { status: 400 });
  }

  try {
    const match = await ingestMatch({ raw: body.match });
    return NextResponse.json({ id: match.id, openDotaId: match.openDotaId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
