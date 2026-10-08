"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminActivity, playerDisplayName } from "@/lib/admin-log";
import {
  adminAddCaptain,
  adminChangeCaptain,
  adminRenameTeam,
  adminRemoveCaptain,
} from "@/lib/captains";
import {
  adminAddPlayerToTeam,
  adminEnrollPlayerInLiveSeason,
  adminRemovePlayerFromTeam,
  adminSetRosterSlot,
  adminUpdatePlayerProfile,
} from "@/lib/players-admin";
import { registerPlayer } from "@/lib/register";
import {
  createScheduledMatch,
  deleteScheduledMatch,
  updateScheduledMatch,
} from "@/lib/schedule-crud";
import {
  adminLinkMatchPlayer,
  adminMarkMatchStandIn,
  adminClearMatchStandIn,
  adminRegisterPlayerBySteam,
  adminSetAuctionSoldPrice,
  adminSetMatchTeams,
} from "@/lib/match-admin";
import { updateCupFeatureSettings } from "@/lib/cup-features";
import { addPlayerAlias } from "@/lib/player-aliases";
import { revalidatePublicPages } from "@/lib/page-cache";
import { adminClearPaid, adminMarkPaid } from "@/lib/payments";
import { uploadMatchScreenshot, isObjectStorageConfigured } from "@/lib/object-storage";
import { ingestScoreboardScreenshot, listScoreboardKnownNames } from "@/lib/scoreboard-shot";
import { recordManualSeriesWinner } from "@/lib/results";
import { prisma } from "@/lib/prisma";
import { MEDALS, type Medal } from "@/lib/constants";
import {
  activateSeason,
  createSeasonAdmin,
  deleteSeasonAdmin,
  endSeasonArchive,
  getLiveSeason,
  updateSeasonAdmin,
} from "@/lib/seasons";
import {
  adminCreateManualTeam,
  adminUpdateTeamMeta,
  createCaptainAccount,
  revokeCaptainAccount,
  adminSetPlayerAuctionMeta,
} from "@/lib/captain-accounts";
import {
  startWebAuction,
  pauseWebAuction,
  resumeWebAuction,
  startWebTimer,
  resetWebTimer,
  confirmWebSold,
  passWebUnsold,
  introduceNextWebPlayer,
} from "@/lib/web-auction";

function revalidateAdmin() {
  revalidatePublicPages();
  revalidatePath("/admin", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/matches");
  revalidatePath("/admin/players");
  revalidatePath("/admin/teams");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/auction");
  revalidatePath("/admin/predictions");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/insights");
  revalidatePath("/admin/logs");
  revalidatePath("/admin/seasons");
  revalidatePath("/player-insight");
  revalidatePath("/predictions");
}

async function note(
  session: Session,
  action: string,
  summary: string,
  meta?: Record<string, unknown>,
) {
  await logAdminActivity(session, { action, summary, meta });
}

/** Prefer steam name in log text; fall back to discord id. */
async function who(discordId: string) {
  const name = await playerDisplayName(discordId);
  return name || discordId.split(":")[0] || "player";
}

export async function actionLinkMatchPlayer(formData: FormData) {
  const session = await requireAdmin();
  const matchPlayerId = String(formData.get("matchPlayerId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const result = await adminLinkMatchPlayer({ matchPlayerId, playerId });
  const board = result.boardName?.trim();
  const who = result.playerName?.trim() || "player";
  await note(
    session,
    "match.link_player",
    board ? `Linked “${board}” → ${who}` : `Linked seat → ${who}`,
    { matchPlayerId, playerId, boardName: board || undefined },
  );
  revalidateAdmin();
}

export async function actionMarkStandIn(formData: FormData) {
  const session = await requireAdmin();
  const matchPlayerId = String(formData.get("matchPlayerId") ?? "");
  const result = await adminMarkMatchStandIn(matchPlayerId);
  const board = result.boardName?.trim();
  await note(
    session,
    "match.stand_in",
    board ? `Marked “${board}” as stand-in` : "Marked seat as stand-in",
    { matchPlayerId, alsoFixed: result.alsoFixed, boardName: board || undefined },
  );
  revalidateAdmin();
}

export async function actionClearStandIn(formData: FormData) {
  const session = await requireAdmin();
  const matchPlayerId = String(formData.get("matchPlayerId") ?? "");
  const result = await adminClearMatchStandIn(matchPlayerId);
  const board = result.boardName?.trim();
  await note(
    session,
    "match.stand_out",
    board ? `Cleared stand-in on “${board}”` : "Cleared stand-in on seat",
    { matchPlayerId, alsoFixed: result.alsoFixed, boardName: board || undefined },
  );
  revalidateAdmin();
}

export async function actionSetMatchTeams(formData: FormData) {
  const session = await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const radiantTeamId = String(formData.get("radiantTeamId") ?? "") || null;
  const direTeamId = String(formData.get("direTeamId") ?? "") || null;
  const winnerRaw = String(formData.get("winnerSide") ?? "");
  const winnerSide =
    winnerRaw === "radiant" || winnerRaw === "dire" ? winnerRaw : null;
  await adminSetMatchTeams({
    matchId,
    radiantTeamId,
    direTeamId,
    winnerSide,
  });
  const teams = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      radiantTeam: { select: { name: true } },
      direTeam: { select: { name: true } },
    },
  });
  const a = teams?.radiantTeam?.name ?? "Radiant";
  const b = teams?.direTeam?.name ?? "Dire";
  const winner =
    winnerSide === "radiant" ? a : winnerSide === "dire" ? b : "no winner";
  await note(
    session,
    "match.set_result",
    `Set ${a} vs ${b} — winner: ${winner}`,
    { matchId, radiantTeamId, direTeamId, winnerSide },
  );
  revalidateAdmin();
}

export async function actionRegisterPlayer(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "").trim();
  const discordName = String(formData.get("discordName") ?? "").trim();
  const steam = String(formData.get("steam") ?? "").trim();
  const pubgName = String(formData.get("pubgName") ?? "").trim();
  const medal = String(formData.get("medal") ?? "");
  const role = String(formData.get("role") ?? "");
  const playWindow = String(formData.get("playWindow") ?? "both");
  if (discordId) {
    await registerPlayer({
      discordId,
      discordName: discordName || pubgName || discordId,
      steam,
      pubgName,
      medal,
      role,
      playWindow,
    });
    await note(session, "player.register", `Registered player ${discordName || discordId}`, {
      discordId,
      steam,
    });
  } else {
    await adminRegisterPlayerBySteam({
      steam,
      pubgName,
      medal,
      role,
      playWindow,
      displayName: discordName || pubgName || undefined,
    });
    await note(session, "player.register", `Registered Steam player ${discordName || steam}`, {
      steam,
    });
  }
  revalidateAdmin();
}

export async function actionEnrollPlayerInSeason(formData: FormData) {
  const session = await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "").trim();
  if (!playerId) throw new Error("Pick a player to link.");
  const player = await adminEnrollPlayerInLiveSeason(playerId);
  await note(
    session,
    "player.enroll_season",
    `Linked ${player.steamName} into the live season`,
    { playerId },
  );
  revalidateAdmin();
}

export async function actionAddToTeam(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "");
  const teamName = String(formData.get("teamName") ?? "");
  await adminAddPlayerToTeam({ discordId, teamName });
  await note(session, "team.add_player", `Added ${await who(discordId)} to ${teamName}`, {
    discordId,
    teamName,
  });
  revalidateAdmin();
}

export async function actionRemoveFromTeam(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "");
  const name = await who(discordId);
  await adminRemovePlayerFromTeam(discordId);
  await note(session, "team.remove_player", `Removed ${name} from team`, {
    discordId,
  });
  revalidateAdmin();
}

export async function actionUpdatePlayer(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "");
  await adminUpdatePlayerProfile({
    discordId,
    steamName: String(formData.get("steamName") ?? "") || null,
    medal: String(formData.get("medal") ?? "") || null,
    role: String(formData.get("role") ?? "") || null,
    playWindow: String(formData.get("playWindow") ?? "") || null,
  });
  await note(session, "player.update", `Updated ${await who(discordId)}`, {
    discordId,
  });
  revalidateAdmin();
}

export async function actionSetRosterSlot(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "");
  const slotRaw = String(formData.get("slot") ?? "");
  const slot = slotRaw === "sub" ? "sub" : "starter";
  await adminSetRosterSlot({ discordId, slot });
  await note(
    session,
    "player.roster_slot",
    `Set ${await who(discordId)} to ${slot}`,
    { discordId, slot },
  );
  revalidateAdmin();
}

export async function actionAddAlias(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "");
  const alias = String(formData.get("alias") ?? "");
  await addPlayerAlias({ discordId, alias });
  await note(
    session,
    "player.alias",
    `Added alias “${alias}” for ${await who(discordId)}`,
    { discordId, alias },
  );
  revalidateAdmin();
}

export async function actionAddCaptain(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "");
  const teamName = String(formData.get("teamName") ?? "");
  await adminAddCaptain({ discordId, teamName });
  await note(
    session,
    "team.add_captain",
    `Set ${await who(discordId)} as captain of ${teamName}`,
    { discordId, teamName },
  );
  revalidateAdmin();
}

export async function actionChangeCaptain(formData: FormData) {
  const session = await requireAdmin();
  const teamName = String(formData.get("teamName") ?? "");
  const discordId = String(formData.get("discordId") ?? "");
  await adminChangeCaptain({ teamName, discordId });
  await note(
    session,
    "team.change_captain",
    `Changed ${teamName} captain to ${await who(discordId)}`,
    { discordId, teamName },
  );
  revalidateAdmin();
}

export async function actionRenameTeam(formData: FormData) {
  const session = await requireAdmin();
  const teamName = String(formData.get("teamName") ?? "");
  const newName = String(formData.get("newName") ?? "");
  await adminRenameTeam({ teamName, newName });
  await note(session, "team.rename", `Renamed team ${teamName} → ${newName}`, {
    teamName,
    newName,
  });
  revalidateAdmin();
}

export async function actionRemoveCaptain(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "");
  const name = await who(discordId);
  await adminRemoveCaptain(discordId);
  await note(session, "team.remove_captain", `Removed captain ${name}`, {
    discordId,
  });
  revalidateAdmin();
}

export async function actionCreateFixture(formData: FormData) {
  const session = await requireAdmin();
  const teamA = String(formData.get("teamA") ?? "");
  const teamB = String(formData.get("teamB") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const kind = String(formData.get("kind") ?? "") || undefined;
  const bestOfRaw = String(formData.get("bestOf") ?? "").trim();
  const bestOf =
    bestOfRaw === "1" || bestOfRaw === "3" ? Number(bestOfRaw) : undefined;
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  await createScheduledMatch({ teamA, teamB, date, time, kind, bestOf, seasonId });
  await note(
    session,
    "schedule.create",
    `Booked ${kind ?? "group"}${bestOf ? ` Bo${bestOf}` : ""}: ${teamA} vs ${teamB} (${date} ${time}:00 PKT)`,
    { teamA, teamB, date, time, kind, bestOf },
  );
  revalidateAdmin();
}

export async function actionUpdateFixture(formData: FormData) {
  const session = await requireAdmin();
  const fixtureId = String(formData.get("fixtureId") ?? "");
  const teamA = String(formData.get("teamA") ?? "") || undefined;
  const teamB = String(formData.get("teamB") ?? "") || undefined;
  const date = String(formData.get("date") ?? "") || undefined;
  const time = String(formData.get("time") ?? "") || undefined;
  await updateScheduledMatch({ fixtureId, teamA, teamB, date, time });
  await note(
    session,
    "schedule.update",
    `Updated fixture ${teamA ?? "?"} vs ${teamB ?? "?"}`,
    { fixtureId, teamA, teamB, date, time },
  );
  revalidateAdmin();
}

export async function actionDeleteFixture(formData: FormData) {
  const session = await requireAdmin();
  const fixtureId = String(formData.get("fixtureId") ?? "");
  const deleted = await deleteScheduledMatch(fixtureId);
  await note(
    session,
    "schedule.delete",
    `Deleted fixture ${deleted.radiantTeam.name} vs ${deleted.direTeam.name}`,
    { fixtureId },
  );
  revalidateAdmin();
}

/** Record who won an upcoming fixture (played or walkover / no-show). */
export async function actionRecordFixtureWinner(formData: FormData) {
  const session = await requireAdmin();
  const fixtureId = String(formData.get("fixtureId") ?? "");
  const winnerName = String(formData.get("winnerName") ?? "");
  const walkover = String(formData.get("walkover") ?? "") === "1";
  if (!fixtureId || !winnerName) {
    throw new Error("Pick a fixture and a winning team.");
  }
  const recorded = await recordManualSeriesWinner({
    fixtureId,
    winnerName,
    walkover,
  });
  await note(
    session,
    walkover ? "schedule.walkover" : "schedule.winner",
    walkover
      ? `Walkover: ${recorded.winner} beat ${recorded.winner === recorded.radiant ? recorded.dire : recorded.radiant}`
      : `Recorded winner: ${recorded.winner} (${recorded.radiant} vs ${recorded.dire})`,
    { fixtureId, winnerName, walkover },
  );
  revalidateAdmin();
}

export async function actionSetSoldPrice(formData: FormData) {
  const session = await requireAdmin();
  const lotId = String(formData.get("lotId") ?? "");
  const soldPrice = Number(formData.get("soldPrice"));
  await adminSetAuctionSoldPrice({ lotId, soldPrice });
  await note(session, "auction.sold_price", `Set auction sold price to ${soldPrice}`, {
    lotId,
    soldPrice,
  });
  revalidateAdmin();
}

export async function actionUpdateCupSwitches(formData: FormData) {
  const session = await requireAdmin();
  const auction = String(formData.get("auctionEnabled") ?? "");
  const complete = String(formData.get("completeTeamRequired") ?? "");
  const predictions = String(formData.get("predictionsEnabled") ?? "");
  const maxMedal = String(formData.get("maxMedalToApply") ?? "");
  const registration = String(formData.get("registrationOpen") ?? "");
  const patch: Partial<{
    auctionEnabled: boolean;
    completeTeamRequired: boolean;
    predictionsEnabled: boolean;
    maxMedalToApply: Medal | null;
  }> = {};
  if (auction === "on" || auction === "off") {
    patch.auctionEnabled = auction === "on";
  }
  if (complete === "on" || complete === "off") {
    patch.completeTeamRequired = complete === "on";
  }
  if (predictions === "on" || predictions === "off") {
    patch.predictionsEnabled = predictions === "on";
  }
  if (maxMedal === "none") patch.maxMedalToApply = null;
  else if ((MEDALS as readonly string[]).includes(maxMedal)) {
    patch.maxMedalToApply = maxMedal as Medal;
  }
  await updateCupFeatureSettings(patch);
  if (registration === "on" || registration === "off") {
    const { setRegistrationOpen } = await import("@/lib/registration-status");
    await setRegistrationOpen(registration === "on");
  }
  const bits: string[] = [];
  if (registration === "on" || registration === "off") {
    bits.push(`registration ${registration === "on" ? "open" : "closed"}`);
  }
  if (patch.predictionsEnabled !== undefined) {
    bits.push(`predictions ${patch.predictionsEnabled ? "unlocked" : "locked"}`);
  }
  if (patch.auctionEnabled !== undefined) {
    bits.push(`auction ${patch.auctionEnabled ? "on" : "off"}`);
  }
  if (patch.completeTeamRequired !== undefined) {
    bits.push(`complete-team ${patch.completeTeamRequired ? "on" : "off"}`);
  }
  if (patch.maxMedalToApply !== undefined) {
    bits.push(`max medal ${patch.maxMedalToApply ?? "none"}`);
  }
  await note(
    session,
    "cup.switches",
    bits.length ? `Cup switches: ${bits.join(", ")}` : "Updated cup switches",
    { ...patch, registrationOpen: registration === "on" || registration === "off" ? registration === "on" : undefined },
  );
  revalidateAdmin();
  revalidatePath("/predictions");
  revalidatePath("/register");
  revalidatePath("/");
}

export async function actionMarkPaid(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  await adminMarkPaid(discordId, "web-admin", seasonId);
  await note(session, "payment.mark", `Marked ${await who(discordId)} as paid`, {
    discordId,
  });
  revalidateAdmin();
}

export async function actionClearPaid(formData: FormData) {
  const session = await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");
  const name = await who(discordId);
  await adminClearPaid(discordId, seasonId);
  await note(session, "payment.clear", `Cleared payment for ${name}`, {
    discordId,
  });
  revalidateAdmin();
}

const MAX_SCOREBOARD_BYTES = 12 * 1024 * 1024;

export type ScoreboardUploadResult =
  | { ok: true; matchId: string }
  | { ok: false; error: string };

export type MatchScreenshotUploadResult =
  | { ok: true }
  | { ok: false; error: string };

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

/** Upload scoreboard → S3 first → OCR ingest. Returns new match id.
 * Prefer passing fixtureId from Schedule so rematches bind to that series. */
export async function actionIngestScoreboardScreenshot(
  formData: FormData,
): Promise<ScoreboardUploadResult> {
  try {
    const session = await requireAdmin();
    const fixtureId = String(formData.get("fixtureId") ?? "").trim() || null;
    if (!fixtureId) {
      return {
        ok: false,
        error:
          "Open the match from Schedule and upload the scoreboard there (not from Matches).",
      };
    }
    const fixture = await prisma.scheduledFixture.findUnique({
      where: { id: fixtureId },
      select: { id: true, status: true },
    });
    if (!fixture || fixture.status !== "scheduled") {
      return {
        ok: false,
        error: "That fixture is missing or already completed.",
      };
    }
    const file = formData.get("screenshot");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a SCOREBOARD screenshot to upload." };
    }
    if (file.size > MAX_SCOREBOARD_BYTES) {
      return { ok: false, error: "Image is too large (max 12 MB)." };
    }
    const mime = file.type || "image/jpeg";
    if (!mime.startsWith("image/")) {
      return { ok: false, error: "Upload an image file (PNG or JPEG)." };
    }
    if (!isObjectStorageConfigured()) {
      return {
        ok: false,
        error:
          "S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET.",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let uploaded: Awaited<ReturnType<typeof uploadMatchScreenshot>>;
    let knownNames: string[] = [];
    try {
      const [uploadResult, names] = await Promise.all([
        uploadMatchScreenshot({
          buffer,
          mime,
          keyHint: `fixture-${fixtureId.slice(0, 8)}`,
        }),
        listScoreboardKnownNames().catch(() => [] as string[]),
      ]);
      uploaded = uploadResult;
      knownNames = names;
    } catch (error) {
      console.error("Scoreboard S3 upload failed:", error);
      return {
        ok: false,
        error: actionErrorMessage(
          error,
          "Could not upload the screenshot to S3. Check AWS credentials and bucket permissions.",
        ),
      };
    }

    let result: Awaited<ReturnType<typeof ingestScoreboardScreenshot>>;
    try {
      result = await ingestScoreboardScreenshot({
        buffer: uploaded.buffer,
        mime: uploaded.mime,
        screenshotPath: uploaded.screenshotPath,
        sourceId: `admin-${fixtureId.slice(0, 8)}-${Date.now()}`,
        knownNames,
        fixtureId,
      });
    } catch (error) {
      console.error("Scoreboard OCR ingest failed:", error);
      return {
        ok: false,
        error: actionErrorMessage(
          error,
          "Could not read that scoreboard screenshot. Use the SCOREBOARD tab (heroes, K/D/A, LH/DN, GPM).",
        ),
      };
    }

    const m = result.match;
    const a = m.radiantTeam?.name ?? "Radiant";
    const b = m.direTeam?.name ?? "Dire";
    const score =
      m.radiantScore != null && m.direScore != null
        ? ` ${m.radiantScore}–${m.direScore}`
        : "";
    await note(
      session,
      "match.ingest_scoreboard",
      `Uploaded scoreboard: ${a} vs ${b}${score}`,
      { matchId: m.id, fixtureId },
    );
    revalidateAdmin();
    revalidatePath(`/matches/${result.match.id}`);
    revalidatePath(`/admin/matches/${result.match.id}`);
    revalidatePath(`/admin/schedule/${fixtureId}`);
    return { ok: true, matchId: result.match.id };
  } catch (error) {
    console.error("Scoreboard ingest action failed:", error);
    return {
      ok: false,
      error: actionErrorMessage(
        error,
        "Upload failed. Try again in a moment.",
      ),
    };
  }
}

/** Upload image to S3 and set Match.screenshotPath (no re-OCR). */
export async function actionAttachMatchScreenshot(
  formData: FormData,
): Promise<MatchScreenshotUploadResult> {
  try {
    const session = await requireAdmin();
    const matchId = String(formData.get("matchId") ?? "");
    if (!matchId) return { ok: false, error: "Missing match." };
    const file = formData.get("screenshot");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a screenshot to upload." };
    }
    if (file.size > MAX_SCOREBOARD_BYTES) {
      return { ok: false, error: "Image is too large (max 12 MB)." };
    }
    const mime = file.type || "image/jpeg";
    if (!mime.startsWith("image/")) {
      return { ok: false, error: "Upload an image file (PNG or JPEG)." };
    }
    if (!isObjectStorageConfigured()) {
      return {
        ok: false,
        error:
          "S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET.",
      };
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return { ok: false, error: "Match not found." };

    const buffer = Buffer.from(await file.arrayBuffer());
    let uploaded: Awaited<ReturnType<typeof uploadMatchScreenshot>>;
    try {
      uploaded = await uploadMatchScreenshot({
        buffer,
        mime,
        keyHint: `match-${matchId.slice(0, 8)}`,
      });
    } catch (error) {
      console.error("Match screenshot S3 upload failed:", error);
      return {
        ok: false,
        error: actionErrorMessage(
          error,
          "Could not upload the screenshot to S3. Check AWS credentials and bucket permissions.",
        ),
      };
    }

    await prisma.match.update({
      where: { id: matchId },
      data: { screenshotPath: uploaded.screenshotPath },
    });
    const teams = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        radiantTeam: { select: { name: true } },
        direTeam: { select: { name: true } },
      },
    });
    const label = `${teams?.radiantTeam?.name ?? "Radiant"} vs ${teams?.direTeam?.name ?? "Dire"}`;
    await note(session, "match.attach_screenshot", `Attached screenshot: ${label}`, {
      matchId,
    });
    revalidateAdmin();
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/admin/matches/${matchId}`);
    return { ok: true };
  } catch (error) {
    console.error("Match screenshot attach failed:", error);
    return {
      ok: false,
      error: actionErrorMessage(error, "Upload failed. Try again."),
    };
  }
}

export async function actionCreateSeason(formData: FormData) {
  const session = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const plannedRaw = String(formData.get("plannedStartAt") ?? "").trim();
  const tournamentFormat = String(formData.get("tournamentFormat") ?? "").trim();
  const teamCount = Number(String(formData.get("teamCount") ?? "8"));
  const game = String(formData.get("game") ?? "").trim();
  const pubgMode = String(formData.get("pubgMode") ?? "").trim();
  const plannedStartAt = plannedRaw
    ? new Date(`${plannedRaw}T12:00:00.000Z`)
    : null;
  try {
    const season = await createSeasonAdmin({
      name,
      plannedStartAt,
      tournamentFormat,
      teamCount,
      game,
      pubgMode,
    });
    await note(session, "season.create", `Created ${season.name}`, {
      seasonId: season.id,
      number: season.number,
    });
    revalidateAdmin();
    revalidatePath("/admin/seasons");
    revalidatePath("/seasons");
  } catch (error) {
    throw error instanceof Error ? error : new Error("Could not create season.");
  }
}

export async function actionUpdateSeason(formData: FormData) {
  const session = await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const plannedRaw = String(formData.get("plannedStartAt") ?? "").trim();
  const tournamentFormat = String(formData.get("tournamentFormat") ?? "").trim();
  const teamCount = Number(String(formData.get("teamCount") ?? "8"));
  const game = String(formData.get("game") ?? "").trim();
  const pubgMode = String(formData.get("pubgMode") ?? "").trim();
  if (!seasonId) throw new Error("Missing season.");
  try {
    const season = await updateSeasonAdmin({
      seasonId,
      name,
      plannedStartAt: plannedRaw ? new Date(`${plannedRaw}T12:00:00.000Z`) : null,
      tournamentFormat,
      teamCount,
      game,
      pubgMode,
    });
    await note(session, "season.update", `Updated ${season.name}`, { seasonId });
    revalidateAdmin();
    revalidatePath("/admin/seasons");
    revalidatePath("/seasons");
    revalidatePublicPages();
  } catch (error) {
    throw error instanceof Error ? error : new Error("Could not update season.");
  }
}

export async function actionDeleteSeason(formData: FormData) {
  const session = await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const force = String(formData.get("force") ?? "") === "1";
  if (!seasonId) throw new Error("Missing season.");
  try {
    const season = await deleteSeasonAdmin(seasonId, { force });
    await note(session, "season.delete", `Deleted ${season.name}`, {
      seasonId,
      force,
    });
    revalidateAdmin();
    revalidatePath("/admin/seasons");
    revalidatePath("/");
    revalidatePath("/seasons");
    revalidatePublicPages();
  } catch (error) {
    throw error instanceof Error ? error : new Error("Could not delete season.");
  }
}

export async function actionEndSeasonArchive(formData: FormData) {
  const session = await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  if (!seasonId) throw new Error("Missing season.");
  try {
    const season = await endSeasonArchive(seasonId);
    const cleared = await clearTeamDiscordRoomsSafe("season.end");
    await note(
      session,
      "season.end",
      `Archived ${season.name} · ${cleared.detail}`,
      { seasonId, ...cleared },
    );
    revalidateAdmin();
    revalidatePath("/admin/seasons");
    revalidatePath("/");
    revalidatePath("/seasons");
    revalidatePublicPages();
  } catch (error) {
    throw error instanceof Error ? error : new Error("Could not archive season.");
  }
}

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

export async function actionActivateSeason(formData: FormData) {
  const session = await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  if (!seasonId) throw new Error("Missing season.");
  try {
    const previous = await getLiveSeason();
    const season = await activateSeason(seasonId);
    // Switching cups (or re-activating) must wipe Season 1 team rooms —
    // "Set active" used to skip Discord cleanup, which left Team Chat/Voice behind.
    let clearedDetail = "Discord cleanup skipped (same season)";
    if (!previous || previous.id !== season.id) {
      const cleared = await clearTeamDiscordRoomsSafe("season.activate");
      clearedDetail = cleared.detail;
    }
    await note(
      session,
      "season.set_active",
      `Set active ${season.name} · ${clearedDetail}`,
      { seasonId },
    );
    revalidateAdmin();
    revalidatePath("/admin/seasons");
    revalidatePath("/");
    revalidatePath("/predictions");
    revalidatePath("/playoffs");
    revalidatePath("/schedule");
    revalidatePath("/player-insight");
    revalidatePath("/seasons");
    revalidatePublicPages();
  } catch (error) {
    throw error instanceof Error ? error : new Error("Could not set active season.");
  }
}

export async function actionCreateManualTeam(formData: FormData) {
  const session = await requireAdmin();
  const team = await adminCreateManualTeam({
    name: String(formData.get("name") ?? ""),
    tag: String(formData.get("tag") ?? "") || null,
    logoUrl: String(formData.get("logoUrl") ?? "") || null,
    captainDiscordId: String(formData.get("captainDiscordId") ?? "") || null,
    captainPlayerId: String(formData.get("captainPlayerId") ?? "") || null,
    purse: Number(formData.get("purse") || 0),
  });
  await note(session, "team.create_manual", `Created ${team.name}`, {
    teamId: team.id,
  });
  revalidateAdmin();
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
}

export async function actionUpdateTeamMeta(formData: FormData) {
  const session = await requireAdmin();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const team = await adminUpdateTeamMeta({
    teamId,
    tag: String(formData.get("tag") ?? "") || null,
    logoUrl: String(formData.get("logoUrl") ?? "") || null,
    name: String(formData.get("name") ?? "") || null,
  });
  await note(session, "team.update_meta", `Updated ${team.name}`, { teamId });
  revalidateAdmin();
  revalidatePath(`/admin/teams/${teamId}`);
  revalidatePath("/teams");
}

export async function actionCreateCaptainAccount(formData: FormData) {
  const session = await requireAdmin();
  const teamId = String(formData.get("teamId") ?? "").trim();
  const loginName = String(formData.get("loginName") ?? "").trim() || undefined;
  const passcode = String(formData.get("passcode") ?? "").trim() || undefined;
  const created = await createCaptainAccount({ teamId, loginName, passcode });
  await note(
    session,
    "captain.credential",
    `Captain login ${created.loginName} for ${created.teamName}`,
    { teamId, accountId: created.accountId },
  );
  revalidatePath("/admin/auction");
  revalidatePath("/admin/teams");
  return created;
}

export async function actionRevokeCaptainAccount(formData: FormData) {
  const session = await requireAdmin();
  const accountId = String(formData.get("accountId") ?? "").trim();
  await revokeCaptainAccount(accountId);
  await note(session, "captain.revoke", `Revoked captain login`, { accountId });
  revalidatePath("/admin/auction");
}

export async function actionSetPlayerAuctionMeta(formData: FormData) {
  const session = await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "").trim();
  const auctionStatus = String(formData.get("auctionStatus") ?? "").trim();
  const baseRaw = String(formData.get("basePrice") ?? "").trim();
  await adminSetPlayerAuctionMeta({
    playerId,
    auctionStatus: auctionStatus || undefined,
    basePrice: baseRaw === "" ? undefined : Number(baseRaw),
  });
  await note(session, "player.auction_meta", `Updated auction meta`, {
    playerId,
    auctionStatus,
  });
  revalidatePath("/admin/auction");
  revalidatePath("/admin/players");
}

export async function actionWebAuctionStart(formData: FormData) {
  const session = await requireAdmin();
  const medal = String(formData.get("medal") ?? "divine").trim();
  await startWebAuction(medal);
  await note(session, "auction.web_start", `Started web auction (${medal})`, {
    medal,
  });
  revalidatePath("/admin/auction");
  revalidatePath("/auction");
  revalidatePath("/auction/live");
}

function auctionControl(formData: FormData) {
  const lotId = String(formData.get("lotId") ?? "");
  const revision = Number(formData.get("revision"));
  if (!lotId || !Number.isSafeInteger(revision) || revision < 0) throw new Error("Refresh the auction before using controls.");
  return { lotId, revision };
}

export async function actionWebAuctionPause(formData: FormData) {
  await requireAdmin();
  await pauseWebAuction(auctionControl(formData));
  revalidatePath("/admin/auction");
  revalidatePath("/auction/live");
}

export async function actionWebAuctionResume(formData: FormData) {
  await requireAdmin();
  await resumeWebAuction(auctionControl(formData));
  revalidatePath("/admin/auction");
  revalidatePath("/auction/live");
}

export async function actionWebAuctionTimer(formData: FormData) {
  await requireAdmin();
  await startWebTimer(auctionControl(formData));
  revalidatePath("/admin/auction");
  revalidatePath("/auction/live");
}

export async function actionWebAuctionResetTimer(formData: FormData) {
  await requireAdmin();
  await resetWebTimer(auctionControl(formData));
  revalidatePath("/admin/auction");
  revalidatePath("/auction/live");
}

export async function actionWebAuctionSold(formData: FormData) {
  const session = await requireAdmin();
  const view = await confirmWebSold(auctionControl(formData).lotId, auctionControl(formData).revision);
  await note(session, "auction.web_sold", `Sold lot on web auction`, {
    player: view.lastSale?.playerName ?? view.currentPlayer?.steamName,
  });
  revalidatePath("/admin/auction");
  revalidatePath("/auction");
  revalidatePath("/auction/live");
  revalidatePublicPages();
}

export async function actionWebAuctionPass(formData: FormData) {
  const session = await requireAdmin();
  await passWebUnsold(auctionControl(formData).lotId, auctionControl(formData).revision);
  await note(session, "auction.web_pass", `Passed / unsold on web auction`);
  revalidatePath("/admin/auction");
  revalidatePath("/auction/live");
}

export async function actionWebAuctionNext(formData: FormData) {
  await requireAdmin();
  await introduceNextWebPlayer(auctionControl(formData));
  revalidatePath("/admin/auction");
  revalidatePath("/auction/live");
}

export async function actionSchedulePubgLobby(formData: FormData) {
  const session = await requireAdmin();
  const { schedulePubgLobby } = await import("@/lib/pubg-lobby");
  const playedRaw = String(formData.get("playedAt") ?? "").trim();
  const teamIds = formData.getAll("teamIds").map((value) => String(value));
  const label = String(formData.get("label") ?? "");
  const lobby = await schedulePubgLobby({
    seasonId: String(formData.get("seasonId") ?? ""),
    label,
    map: String(formData.get("map") ?? ""),
    playedAt: new Date(playedRaw),
    teamIds,
  });
  await note(
    session,
    "schedule.create",
    `Booked PUBG lobby ${label} on ${lobby.map} · ${lobby.teams.length} teams`,
    { lobbyId: lobby.id, seasonId: lobby.seasonId },
  );
  revalidateAdmin();
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/pubg");
}

export async function actionRecordPubgResult(formData: FormData) {
  const session = await requireAdmin();
  const { parseLobbyPlayerLines, recordPubgTeamResult } = await import("@/lib/pubg-lobby");
  const playedRaw = String(formData.get("playedAt") ?? "").trim();
  const playersRaw = String(formData.get("players") ?? "");
  const file = formData.get("screenshot");
  let sourceImagePath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const { uploadImageToS3 } = await import("@/lib/object-storage");
    const uploaded = await uploadImageToS3({
      buffer: Buffer.from(await file.arrayBuffer()),
      mime: file.type,
      keyHint: String(formData.get("label") ?? "lobby"),
      folder: "pubg",
    });
    sourceImagePath = uploaded.screenshotPath;
  }
  const result = await recordPubgTeamResult({
    seasonId: String(formData.get("seasonId") ?? ""),
    label: String(formData.get("label") ?? ""),
    map: String(formData.get("map") ?? ""),
    playedAt: playedRaw ? new Date(playedRaw) : new Date(),
    teamName: String(formData.get("teamName") ?? ""),
    placement: Number(formData.get("placement") ?? ""),
    kills: Number(formData.get("kills") ?? ""),
    players: playersRaw.trim() ? parseLobbyPlayerLines(playersRaw) : [],
    sourceImagePath,
  });
  await note(
    session,
    "match.set_result",
    `PUBG ${String(formData.get("teamName") ?? "")} place ${String(formData.get("placement") ?? "")} · ${result.points} pts`,
    { lobbyId: result.lobbyId },
  );
  revalidateAdmin();
  revalidatePath("/admin/pubg");
  revalidatePath("/table");
  revalidatePath("/player-insight");
}
