import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { publicErrorMessage } from "@/lib/public-error";
import { registerPlayer } from "@/lib/register";

export async function POST(request: Request) {
  const session = await authSession();
  const discordId = session?.user?.discordId;
  if (!discordId) {
    return NextResponse.json(
      { error: "Sign in with Discord first." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    steam?: string;
    medal?: string;
    role?: string;
    playWindow?: string;
  };
  if (!body.steam?.trim() || !body.medal || !body.role || !body.playWindow) {
    return NextResponse.json(
      { error: "Steam profile URL, rank, role, and weekend window are required." },
      { status: 400 },
    );
  }

  try {
    const result = await registerPlayer({
      discordId,
      discordName: session.user?.name ?? session.user?.email ?? "Player",
      steam: body.steam,
      medal: body.medal,
      role: body.role,
      playWindow: body.playWindow,
    });
    return NextResponse.json({
      id: result.player.id,
      created: result.created,
      openDotaLinked: result.openDotaLinked,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "Registration failed.") },
      { status: 400 },
    );
  }
}
