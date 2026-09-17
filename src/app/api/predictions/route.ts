import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { publicErrorMessage } from "@/lib/public-error";
import { saveMatchPredictions } from "@/lib/predictions";

type PredictionBody = {
  fixtureId?: string;
  teamId?: string;
  picks?: { fixtureId?: string; teamId?: string }[];
};

function picksFromBody(body: PredictionBody) {
  if (Array.isArray(body.picks) && body.picks.length > 0) {
    return body.picks.map((pick) => ({
      fixtureId: pick.fixtureId?.trim() ?? "",
      teamId: pick.teamId?.trim() ?? "",
    }));
  }
  if (body.fixtureId?.trim() && body.teamId?.trim()) {
    return [
      {
        fixtureId: body.fixtureId.trim(),
        teamId: body.teamId.trim(),
      },
    ];
  }
  return [];
}

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

  const body = (await request.json().catch(() => ({}))) as PredictionBody;
  const picks = picksFromBody(body);
  if (picks.length === 0) {
    return NextResponse.json(
      { error: "Pick a match and a team." },
      { status: 400 },
    );
  }

  try {
    const result = await saveMatchPredictions(player.id, picks);
    return NextResponse.json({ ok: true, saved: result.saved });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "Could not save those picks.") },
      { status: 400 },
    );
  }
}
