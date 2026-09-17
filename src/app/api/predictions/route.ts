import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { publicErrorMessage } from "@/lib/public-error";
import { revalidatePublicPages } from "@/lib/page-cache";
import { saveMatchPrediction } from "@/lib/predictions";

export async function POST(request: Request) {
  const { session, player } = await currentPlayer();
  if (!session?.user?.discordId) {
    return NextResponse.json(
      { error: "Sign in with Discord first." },
      { status: 401 },
    );
  }
  if (!player) {
    return NextResponse.json(
      { error: "Register for the cup before you pick winners." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    fixtureId?: string;
    teamId?: string;
  };
  if (!body.fixtureId?.trim() || !body.teamId?.trim()) {
    return NextResponse.json(
      { error: "Pick a match and a team." },
      { status: 400 },
    );
  }

  try {
    await saveMatchPrediction({
      playerId: player.id,
      fixtureId: body.fixtureId.trim(),
      teamId: body.teamId.trim(),
    });
    revalidatePublicPages();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "Could not save that pick.") },
      { status: 400 },
    );
  }
}
