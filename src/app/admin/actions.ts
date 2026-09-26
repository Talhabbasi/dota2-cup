"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import {
  adminAddCaptain,
  adminChangeCaptain,
  adminRenameTeam,
  adminRemoveCaptain,
} from "@/lib/captains";
import {
  adminAddPlayerToTeam,
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
  adminRegisterPlayerBySteam,
  adminSetAuctionSoldPrice,
  adminSetMatchTeams,
} from "@/lib/match-admin";
import { updateCupFeatureSettings } from "@/lib/cup-features";
import { addPlayerAlias } from "@/lib/player-aliases";
import { revalidatePublicPages } from "@/lib/page-cache";
import { adminClearPaid, adminMarkPaid } from "@/lib/payments";
import { uploadMatchScreenshot, isObjectStorageConfigured } from "@/lib/object-storage";
import { ingestScoreboardScreenshot } from "@/lib/scoreboard-shot";
import { prisma } from "@/lib/prisma";
import type { Medal } from "@/lib/constants";

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
  revalidatePath("/player-insight");
  revalidatePath("/predictions");
}

export async function actionLinkMatchPlayer(formData: FormData) {
  await requireAdmin();
  const matchPlayerId = String(formData.get("matchPlayerId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  await adminLinkMatchPlayer({ matchPlayerId, playerId });
  revalidateAdmin();
}

export async function actionMarkStandIn(formData: FormData) {
  await requireAdmin();
  const matchPlayerId = String(formData.get("matchPlayerId") ?? "");
  await adminMarkMatchStandIn(matchPlayerId);
  revalidateAdmin();
}

export async function actionSetMatchTeams(formData: FormData) {
  await requireAdmin();
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
  revalidateAdmin();
}

export async function actionRegisterPlayer(formData: FormData) {
  await requireAdmin();
  const discordId = String(formData.get("discordId") ?? "").trim();
  const discordName = String(formData.get("discordName") ?? "").trim();
  const steam = String(formData.get("steam") ?? "").trim();
  const medal = String(formData.get("medal") ?? "");
  const role = String(formData.get("role") ?? "");
  const playWindow = String(formData.get("playWindow") ?? "both");
  if (discordId) {
    await registerPlayer({
      discordId,
      discordName: discordName || discordId,
      steam,
      medal,
      role,
      playWindow,
    });
  } else {
    await adminRegisterPlayerBySteam({
      steam,
      medal,
      role,
      playWindow,
      displayName: discordName || undefined,
    });
  }
  revalidateAdmin();
}

export async function actionAddToTeam(formData: FormData) {
  await requireAdmin();
  await adminAddPlayerToTeam({
    discordId: String(formData.get("discordId") ?? ""),
    teamName: String(formData.get("teamName") ?? ""),
  });
  revalidateAdmin();
}

export async function actionRemoveFromTeam(formData: FormData) {
  await requireAdmin();
  await adminRemovePlayerFromTeam(String(formData.get("discordId") ?? ""));
  revalidateAdmin();
}

export async function actionUpdatePlayer(formData: FormData) {
  await requireAdmin();
  await adminUpdatePlayerProfile({
    discordId: String(formData.get("discordId") ?? ""),
    steamName: String(formData.get("steamName") ?? "") || null,
    medal: String(formData.get("medal") ?? "") || null,
    role: String(formData.get("role") ?? "") || null,
    playWindow: String(formData.get("playWindow") ?? "") || null,
  });
  revalidateAdmin();
}

export async function actionSetRosterSlot(formData: FormData) {
  await requireAdmin();
  const slotRaw = String(formData.get("slot") ?? "");
  const slot = slotRaw === "sub" ? "sub" : "starter";
  await adminSetRosterSlot({
    discordId: String(formData.get("discordId") ?? ""),
    slot,
  });
  revalidateAdmin();
}

export async function actionAddAlias(formData: FormData) {
  await requireAdmin();
  await addPlayerAlias({
    discordId: String(formData.get("discordId") ?? ""),
    alias: String(formData.get("alias") ?? ""),
  });
  revalidateAdmin();
}

export async function actionAddCaptain(formData: FormData) {
  await requireAdmin();
  await adminAddCaptain({
    discordId: String(formData.get("discordId") ?? ""),
    teamName: String(formData.get("teamName") ?? ""),
  });
  revalidateAdmin();
}

export async function actionChangeCaptain(formData: FormData) {
  await requireAdmin();
  await adminChangeCaptain({
    teamName: String(formData.get("teamName") ?? ""),
    discordId: String(formData.get("discordId") ?? ""),
  });
  revalidateAdmin();
}

export async function actionRenameTeam(formData: FormData) {
  await requireAdmin();
  await adminRenameTeam({
    teamName: String(formData.get("teamName") ?? ""),
    newName: String(formData.get("newName") ?? ""),
  });
  revalidateAdmin();
}

export async function actionRemoveCaptain(formData: FormData) {
  await requireAdmin();
  await adminRemoveCaptain(String(formData.get("discordId") ?? ""));
  revalidateAdmin();
}

export async function actionCreateFixture(formData: FormData) {
  await requireAdmin();
  await createScheduledMatch({
    teamA: String(formData.get("teamA") ?? ""),
    teamB: String(formData.get("teamB") ?? ""),
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
    kind: String(formData.get("kind") ?? "") || undefined,
  });
  revalidateAdmin();
}

export async function actionUpdateFixture(formData: FormData) {
  await requireAdmin();
  await updateScheduledMatch({
    fixtureId: String(formData.get("fixtureId") ?? ""),
    teamA: String(formData.get("teamA") ?? "") || undefined,
    teamB: String(formData.get("teamB") ?? "") || undefined,
    date: String(formData.get("date") ?? "") || undefined,
    time: String(formData.get("time") ?? "") || undefined,
  });
  revalidateAdmin();
}

export async function actionDeleteFixture(formData: FormData) {
  await requireAdmin();
  await deleteScheduledMatch(String(formData.get("fixtureId") ?? ""));
  revalidateAdmin();
}

export async function actionSetSoldPrice(formData: FormData) {
  await requireAdmin();
  await adminSetAuctionSoldPrice({
    lotId: String(formData.get("lotId") ?? ""),
    soldPrice: Number(formData.get("soldPrice")),
  });
  revalidateAdmin();
}

export async function actionUpdateCupSwitches(formData: FormData) {
  await requireAdmin();
  const auction = String(formData.get("auctionEnabled") ?? "");
  const complete = String(formData.get("completeTeamRequired") ?? "");
  const predictions = String(formData.get("predictionsEnabled") ?? "");
  const maxMedal = String(formData.get("maxMedalToApply") ?? "");
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
  else if (maxMedal) patch.maxMedalToApply = maxMedal as Medal;
  await updateCupFeatureSettings(patch);
  revalidateAdmin();
  revalidatePath("/predictions");
}

export async function actionMarkPaid(formData: FormData) {
  await requireAdmin();
  await adminMarkPaid(String(formData.get("discordId") ?? ""), "web-admin");
  revalidateAdmin();
}

export async function actionClearPaid(formData: FormData) {
  await requireAdmin();
  await adminClearPaid(String(formData.get("discordId") ?? ""));
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

/** Upload scoreboard → S3 first → OCR ingest. Returns new match id. */
export async function actionIngestScoreboardScreenshot(
  formData: FormData,
): Promise<ScoreboardUploadResult> {
  try {
    await requireAdmin();
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
    try {
      uploaded = await uploadMatchScreenshot({
        buffer,
        mime,
        keyHint: `admin-${Date.now()}`,
      });
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
        sourceId: `admin-${Date.now()}`,
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

    revalidateAdmin();
    revalidatePath(`/matches/${result.match.id}`);
    revalidatePath(`/admin/matches/${result.match.id}`);
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
    await requireAdmin();
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

