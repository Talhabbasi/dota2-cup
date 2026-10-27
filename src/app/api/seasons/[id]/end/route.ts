import { NextResponse } from "next/server";
import { sessionIsAdmin } from "@/lib/admin-auth";
import { publicErrorMessage } from "@/lib/public-error";
import { endSeasonArchive } from "@/lib/seasons";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { isAdmin } = await sessionIsAdmin();
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const season = await endSeasonArchive(id);
    try {
      const { clearAllTeamDiscordRoomsViaRest } = await import(
        "@/lib/discord-team-cleanup-rest"
      );
      const cleared = await clearAllTeamDiscordRoomsViaRest();
      console.info(`[season.end] ${cleared.detail}`);
    } catch (error) {
      console.warn(
        "[season.end] Discord team-channel cleanup failed:",
        error instanceof Error ? error.message : error,
      );
    }
    return NextResponse.json({ ok: true, season });
  } catch (error) {
    console.error("[seasons/end]", error);
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(error, "Could not archive season.") },
      { status: 400 },
    );
  }
}
