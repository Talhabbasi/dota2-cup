import { NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { sessionIsAdmin } from "@/lib/admin-auth";
import { logAdminActivity } from "@/lib/admin-log";
import { revalidatePublicPages } from "@/lib/page-cache";
import { getLiveSeason, setActiveSeason } from "@/lib/seasons";

async function clearTeamDiscordRoomsSafe(label: string) {
  try {
    const { clearAllTeamDiscordRoomsViaRest } = await import(
      "@/lib/discord-team-cleanup-rest"
    );
    const cleared = await clearAllTeamDiscordRoomsViaRest();
    console.info(`[${label}] ${cleared.detail}`);
    return cleared;
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Discord cleanup failed";
    console.warn(`[${label}] Discord team-channel cleanup failed:`, detail);
    return { text: 0, voice: 0, roles: 0, detail };
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  const { session, isAdmin } = await sessionIsAdmin();
  if (!isAdmin || !session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { seasonId } = await context.params;
  const id = seasonId?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing season." }, { status: 400 });
  }

  try {
    const previous = await getLiveSeason();
    const season = await setActiveSeason(id);
    const switched = !previous || previous.id !== season.id;

    revalidatePath("/admin/seasons");
    revalidatePath("/");
    revalidatePath("/predictions");
    revalidatePath("/playoffs");
    revalidatePath("/schedule");
    revalidatePath("/player-insight");
    revalidatePath("/seasons");
    revalidatePublicPages();

    after(async () => {
      let clearedDetail = "Discord roles synced from the database";
      if (switched) {
        const cleared = await clearTeamDiscordRoomsSafe("season.activate");
        clearedDetail = `${cleared.detail} · roles reapplied from the database`;
      }
      const { pushDiscordRoleSync } = await import(
        "@/lib/discord-role-sync-rest"
      );
      const { pushDiscordTeamRooms } = await import(
        "@/lib/discord-team-rooms-rest"
      );
      await pushDiscordRoleSync();
      await pushDiscordTeamRooms({ all: true });
      await logAdminActivity(session, {
        action: "season.set_active",
        summary: `Set active ${season.name} · ${clearedDetail} · team rooms rebuilt`,
        meta: { seasonId: id },
      });
    });

    return NextResponse.json({
      ok: true,
      season: { id: season.id, name: season.name, isActive: season.isActive },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not set active season.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
