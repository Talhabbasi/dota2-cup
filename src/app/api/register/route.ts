import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { publicErrorMessage } from "@/lib/public-error";
import { revalidatePublicPages } from "@/lib/page-cache";
import { isRegistrationOpen } from "@/lib/registration-status";
import { isPubgSeason } from "@/lib/games";
import { registerPlayer } from "@/lib/register";
import { getCurrentSeasonSafe, getLiveSeason } from "@/lib/seasons";

export async function POST(request: Request) {
  const session = await authSession();
  const discordId = session?.user?.discordId;
  if (!discordId) {
    return NextResponse.json(
      { error: "Sign in with Discord first." },
      { status: 401 },
    );
  }
  if (!(await isRegistrationOpen())) {
    return NextResponse.json(
      { error: "Registration is closed." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    steam?: string;
    pubgName?: string;
    medal?: string;
    role?: string | string[];
    roles?: string | string[];
    playWindow?: string;
  };
  const live = await getLiveSeason();
  const pubg = isPubgSeason(live);
  const roles = body.roles ?? body.role;
  if (
    pubg
      ? !body.pubgName?.trim() || !body.steam?.trim() || !body.medal
      : !body.steam?.trim() || !body.medal || roles == null || roles === ""
  ) {
    return NextResponse.json(
      {
        error: pubg
          ? "PUBG name, Steam profile, and rank are required."
          : "Steam profile, medal, and at least one role are required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await registerPlayer({
      discordId,
      discordName: session.user?.name ?? session.user?.email ?? "Player",
      steam: body.steam,
      pubgName: body.pubgName,
      medal: body.medal,
      roles,
      playWindow: body.playWindow || "both",
    });
    revalidatePublicPages();
    const season = await getCurrentSeasonSafe();
    return NextResponse.json({
      id: result.player.id,
      created: result.created,
      openDotaLinked: result.openDotaLinked,
      season: season
        ? { number: season.number, name: season.name, status: season.status }
        : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: publicErrorMessage(error, "Registration failed.") },
      { status: 400 },
    );
  }
}
