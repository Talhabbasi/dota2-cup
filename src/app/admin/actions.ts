"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { PUBLIC_PAGE_TAG } from "@/lib/cache-tags";
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
  adminDeletePlayer,
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
import { addPlayerAlias, removePlayerAlias } from "@/lib/player-aliases";
import { revalidatePublicPages } from "@/lib/page-cache";
import { publicErrorMessage, rethrowFrameworkError } from "@/lib/public-error";
import { adminClearPaid, adminMarkPaid } from "@/lib/payments";
import {
  announceClearedPaidInDiscord,
  announceMarkedPaidInDiscord,
} from "@/lib/discord-payments-rest";
import { paymentsChannelName } from "@/lib/registration-status";
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
  endWebAuction,
} from "@/lib/web-auction";
import {
  assignPlayoffGroup,
  clearPlayoffFixtures,
  openPlayoffsFromGroups,
  seedPlayoffGroups,
} from "@/lib/playoff";
import { bookGroupStageRoundRobin, bookedGroupStageFromDb } from "@/lib/group-stage-schedule";
import {
  postGroupStageToMatchesRest,
  postPlayoffToMatchesRest,
} from "@/lib/discord-matches-rest";

function revalidateAdmin() {
  revalidatePublicPages();
  revalidatePath("/admin", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/matches");
  revalidatePath("/admin/players");
  revalidatePath("/admin/teams");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/playoffs");
  revalidatePath("/admin/auction");
  revalidatePath("/admin/predictions");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/insights");
  revalidatePath("/admin/logs");
  revalidatePath("/admin/seasons");
  revalidatePath("/player-insight");
  revalidatePath("/predictions");
  revalidatePath("/playoffs");
  revalidatePath("/schedule");
}

async function note(
  session: Session,
  action: string,
  summary: string,
  meta?: Record<string, unknown>,
) {
  await logAdminActivity(session, { action, summary, meta });
}

function failAction(label: string, error: unknown) {
  rethrowFrameworkError(error);
  console.error(`[admin] ${label}`, error);
  return {
    ok: false as const,
    error: publicErrorMessage(error, `${label} failed.`),
  };
}

/** Prefer steam name in log text; fall back to discord id. */
async function who(discordId: string) {
  const name = await playerDisplayName(discordId);
  return name || discordId.split(":")[0] || "player";
}

export async function actionLinkMatchPlayer(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Link match player", error);
  }
}

export async function actionMarkStandIn(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Mark stand-in", error);
  }
}

export async function actionClearStandIn(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Clear stand-in", error);
  }
}

export async function actionSetMatchTeams(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Set match teams", error);
  }
}

export async function actionRegisterPlayer(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "").trim();
    const discordName = String(formData.get("discordName") ?? "").trim();
    const steam = String(formData.get("steam") ?? "").trim();
    const pubgName = String(formData.get("pubgName") ?? "").trim();
    const medal = String(formData.get("medal") ?? "");
    const roles = formData.getAll("roles").map(String).filter(Boolean);
    const role = roles.length
      ? roles
      : String(formData.get("role") ?? "");
    const playWindow = String(formData.get("playWindow") ?? "both");
    if (discordId) {
      await registerPlayer({
        discordId,
        discordName: discordName || pubgName || discordId,
        steam,
        pubgName,
        medal,
        roles: role,
        playWindow,
        bypassCapacity: true,
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
        role: Array.isArray(role) ? role.join(",") : role,
        playWindow,
        displayName: discordName || pubgName || undefined,
      });
      await note(session, "player.register", `Registered Steam player ${discordName || steam}`, {
        steam,
      });
    }
    revalidateAdmin();
    } catch (error) {
    return failAction("Register player", error);
  }
}

export async function actionEnrollPlayerInSeason(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Link player to season", error);
  }
}

export async function actionAddToTeam(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "");
    const teamName = String(formData.get("teamName") ?? "");
    await adminAddPlayerToTeam({ discordId, teamName });
    await note(session, "team.add_player", `Added ${await who(discordId)} to ${teamName}`, {
      discordId,
      teamName,
    });
    revalidateAdmin();
    } catch (error) {
    return failAction("Add player to team", error);
  }
}

export async function actionRemoveFromTeam(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "");
    const name = await who(discordId);
    await adminRemovePlayerFromTeam(discordId);
    await note(session, "team.remove_player", `Removed ${name} from team`, {
      discordId,
    });
    revalidateAdmin();
    } catch (error) {
    return failAction("Remove player from team", error);
  }
}

/** Permanently delete a player registration (same as Discord `/player delete`). */
export async function actionDeletePlayer(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "").trim();
    if (!discordId) throw new Error("Missing Discord id.");
    const removed = await adminDeletePlayer(discordId);
    await note(
      session,
      "player.delete",
      `Deleted registration for ${removed.name}${
        removed.teamName ? ` (was on ${removed.teamName})` : ""
      }`,
      { discordId, teamName: removed.teamName },
    );
    revalidateAdmin();
    revalidatePath("/players");
    revalidatePath("/players", "layout");
    revalidatePath("/teams");
    revalidatePath("/admin/players");
    revalidatePath("/admin/players", "layout");
    // Bust public ISR + Discord-driven caches on production.
    after(() =>
      import("@/lib/notify-site").then(({ notifySiteRefresh }) =>
        notifySiteRefresh(),
      ),
    );
    return { ok: true as const, name: removed.name };
    } catch (error) {
    return failAction("Delete player", error);
  }
}

export async function actionUpdatePlayer(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "");
    const roles = formData.getAll("roles").map(String).filter(Boolean);
    await adminUpdatePlayerProfile({
      discordId,
      discordName: String(formData.get("discordName") ?? "") || null,
      steam: String(formData.get("steam") ?? "") || null,
      steamName: String(formData.get("steamName") ?? "") || null,
      medal: String(formData.get("medal") ?? "") || null,
      role: roles.length
        ? roles.join(",")
        : String(formData.get("role") ?? "") || null,
      playWindow: String(formData.get("playWindow") ?? "") || null,
    });
    await note(session, "player.update", `Updated ${await who(discordId)}`, {
      discordId,
    });
    revalidateAdmin();
    } catch (error) {
    return failAction("Update player", error);
  }
}

export async function actionSetRosterSlot(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Set roster slot", error);
  }
}

export async function actionAddAlias(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "");
    const alias = String(formData.get("alias") ?? "");
    const result = await addPlayerAlias({ discordId, alias });
    await note(
      session,
      "player.alias",
      `Added alias “${result.alias.alias}” for ${result.player.steamName}`,
      { discordId, alias: result.alias.alias },
    );
    revalidateAdmin();
    revalidatePath(`/admin/players/${result.player.id}`);
    } catch (error) {
    return failAction("Add alias", error);
  }
}

export async function actionRemoveAlias(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "");
    const alias = String(formData.get("alias") ?? "");
    const result = await removePlayerAlias({ discordId, alias });
    await note(
      session,
      "player.unalias",
      `Removed alias “${result.alias.alias}” from ${result.player.steamName}`,
      { discordId, alias: result.alias.alias },
    );
    revalidateAdmin();
    revalidatePath(`/admin/players/${result.player.id}`);
    } catch (error) {
    return failAction("Remove alias", error);
  }
}

export async function actionAddCaptain(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Add captain", error);
  }
}

export async function actionChangeCaptain(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Change captain", error);
  }
}

export async function actionRenameTeam(formData: FormData) {
try {
  const session = await requireAdmin();
    const teamName = String(formData.get("teamName") ?? "");
    const newName = String(formData.get("newName") ?? "");
    await adminRenameTeam({ teamName, newName });
    await note(session, "team.rename", `Renamed team ${teamName} → ${newName}`, {
      teamName,
      newName,
    });
    revalidateAdmin();
    } catch (error) {
    return failAction("Rename team", error);
  }
}

export async function actionRemoveCaptain(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "");
    const name = await who(discordId);
    await adminRemoveCaptain(discordId);
    await note(session, "team.remove_captain", `Removed captain ${name}`, {
      discordId,
    });
    revalidateAdmin();
    } catch (error) {
    return failAction("Remove captain", error);
  }
}

export async function actionCreateFixture(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Create fixture", error);
  }
}

export async function actionUpdateFixture(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Update fixture", error);
  }
}

export async function actionDeleteFixture(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Delete fixture", error);
  }
}

/** Record who won an upcoming fixture (played or walkover / no-show). */
export async function actionRecordFixtureWinner(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Record fixture winner", error);
  }
}

export async function actionSetSoldPrice(formData: FormData) {
try {
  const session = await requireAdmin();
    const lotId = String(formData.get("lotId") ?? "");
    const soldPrice = Number(formData.get("soldPrice"));
    await adminSetAuctionSoldPrice({ lotId, soldPrice });
    await note(session, "auction.sold_price", `Set auction sold price to ${soldPrice}`, {
      lotId,
      soldPrice,
    });
    revalidateAdmin();
    } catch (error) {
    return failAction("Set sold price", error);
  }
}

export async function actionUpdateCupSwitches(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Update cup switches", error);
  }
}

export async function actionSetUnpaidAuctionAllowed(formData: FormData) {
  try {
    const session = await requireAdmin();
    const raw = String(formData.get("unpaidAuctionAllowed") ?? "");
    if (raw !== "on" && raw !== "off") {
      return failAction(
        "Auction payment switch",
        new Error("Choose on or off."),
      );
    }
    const unpaidAuctionAllowed = raw === "on";
    await updateCupFeatureSettings({ unpaidAuctionAllowed });
    await note(
      session,
      "cup.switches",
      unpaidAuctionAllowed
        ? "Unpaid players can join the auction"
        : "Unpaid players are blocked from the auction",
      { unpaidAuctionAllowed },
    );
    revalidateAdmin();
    revalidatePath("/auction");
    revalidatePath("/auction/captain");
    revalidatePath("/auction/queue");
    revalidatePath("/auction/results");
  } catch (error) {
    return failAction("Auction payment switch", error);
  }
}

export async function actionMarkPaid(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "");
    const seasonId = String(formData.get("seasonId") ?? "");
    const result = await adminMarkPaid(discordId, "web-admin", seasonId);
    const name = result.player.steamName;
    if (result.skipped) {
      await note(session, "payment.mark", `${name} is a substitute — no fee`, {
        discordId,
      });
      revalidateAdmin();
      return;
    }
    if (result.alreadyPaid) {
      await note(session, "payment.mark", `${name} was already paid`, { discordId });
      revalidateAdmin();
      return;
    }
  
    const discord = await announceMarkedPaidInDiscord({
      discordId,
      steamName: name,
      teamId: result.player.teamId,
    });
    const channel = paymentsChannelName();
    const discordNote = discord.ok ? `posted in #${channel}` : discord.reason;
    await note(session, "payment.mark", `Marked ${name} as paid · ${discordNote}`, {
      discordId,
    });
    revalidateAdmin();
    if (!discord.ok) {
      return {
        ok: false as const,
        saved: true as const,
        error: `Marked paid, but #${channel} was not updated: ${discord.reason}`,
      };
    }
    } catch (error) {
    return failAction("Mark paid", error);
  }
}

export async function actionClearPaid(formData: FormData) {
try {
  const session = await requireAdmin();
    const discordId = String(formData.get("discordId") ?? "");
    const seasonId = String(formData.get("seasonId") ?? "");
    const result = await adminClearPaid(discordId, seasonId);
    const name = result.player.steamName;
    if (!result.cleared) {
      await note(session, "payment.clear", `${name} was not paid`, { discordId });
      revalidateAdmin();
      return;
    }
  
    const discord = await announceClearedPaidInDiscord({
      discordId,
      steamName: name,
      teamId: result.player.teamId,
    });
    const channel = paymentsChannelName();
    const discordNote = discord.ok ? `posted in #${channel}` : discord.reason;
    await note(session, "payment.clear", `Cleared payment for ${name} · ${discordNote}`, {
      discordId,
    });
    revalidateAdmin();
    if (!discord.ok) {
      return {
        ok: false as const,
        saved: true as const,
        error: `Payment cleared, but #${channel} was not updated: ${discord.reason}`,
      };
    }
    } catch (error) {
    return failAction("Clear payment", error);
  }
}

const MAX_SCOREBOARD_BYTES = 12 * 1024 * 1024;

export type ScoreboardUploadResult =
  | { ok: true; matchId: string }
  | { ok: false; error: string };

export type MatchScreenshotUploadResult =
  | { ok: true }
  | { ok: false; error: string };

function actionErrorMessage(error: unknown, fallback: string): string {
  return publicErrorMessage(error, fallback);
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
try {
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
      console.error("[admin] create season", error);
      return {
        ok: false as const,
        error: publicErrorMessage(error, "Could not create season."),
      };
    }
    } catch (error) {
    return failAction("Create Season", error);
  }
}

export async function actionUpdateSeason(formData: FormData) {
try {
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
      console.error("[admin] update season", error);
      return {
        ok: false as const,
        error: publicErrorMessage(error, "Could not update season."),
      };
    }
    } catch (error) {
    return failAction("Update Season", error);
  }
}

export async function actionDeleteSeason(formData: FormData) {
try {
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
      console.error("[admin] delete season", error);
      return {
        ok: false as const,
        error: publicErrorMessage(error, "Could not delete season."),
      };
    }
    } catch (error) {
    return failAction("Delete Season", error);
  }
}

export async function actionEndSeasonArchive(formData: FormData) {
try {
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
      console.error("[admin] archive season", error);
      return {
        ok: false as const,
        error: publicErrorMessage(error, "Could not archive season."),
      };
    }
    } catch (error) {
    return failAction("End Season Archive", error);
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
try {
  const session = await requireAdmin();
    const seasonId = String(formData.get("seasonId") ?? "").trim();
    if (!seasonId) throw new Error("Missing season.");
    try {
      const previous = await getLiveSeason();
      const season = await activateSeason(seasonId);
      const switched = !previous || previous.id !== season.id;
      // Activate + revalidate first so the Active badge flips immediately.
      // Discord room/role wipe can take many seconds (rate limits) — do it after.
      revalidateAdmin();
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
        await note(
          session,
          "season.set_active",
          `Set active ${season.name} · ${clearedDetail} · team rooms rebuilt`,
          { seasonId },
        );
      });
    } catch (error) {
      console.error("[admin] set active season", error);
      return {
        ok: false as const,
        error: publicErrorMessage(error, "Could not set active season."),
      };
    }
    } catch (error) {
    return failAction("Activate Season", error);
  }
}

export async function actionCreateManualTeam(formData: FormData) {
try {
  const session = await requireAdmin();
    try {
      const team = await adminCreateManualTeam({
        name: String(formData.get("name") ?? ""),
        tag: String(formData.get("tag") ?? "") || null,
        logoUrl: String(formData.get("logoUrl") ?? "") || null,
        captainDiscordId: String(formData.get("captainDiscordId") ?? "") || null,
        captainPlayerId: String(formData.get("captainPlayerId") ?? "") || null,
      });
      await note(
        session,
        "team.create_manual",
        `Created ${team.name} (${team.purse.toLocaleString()} purse from captain rank)`,
        { teamId: team.id, purse: team.purse },
      );
      revalidateAdmin();
      revalidatePath("/admin/teams");
      revalidatePath("/teams");
      return { ok: true as const, teamId: team.id, name: team.name, purse: team.purse };
    } catch (error) {
      // Return a serializable error — production digests strip thrown messages.
      return {
        ok: false as const,
        error: publicErrorMessage(error, "Could not create franchise."),
      };
    }
    } catch (error) {
    return failAction("Create Manual Team", error);
  }
}

export async function actionUpdateTeamMeta(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Update team", error);
  }
}

export async function actionSetPlayerAuctionMeta(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Update auction player", error);
  }
}

// Auction controls return the new view for the desk instead of revalidating the admin
// page, so each click costs one auction transaction and not a full page re-render.
export async function actionWebAuctionStart(formData: FormData) {
try {
  const session = await requireAdmin();
    const medal = String(formData.get("medal") ?? "divine").trim();
    const view = await startWebAuction(medal);
    const label =
      medal === "all" || medal === "random"
        ? "all ranks · random"
        : medal;
    after(() =>
      note(session, "auction.web_start", `Started web auction (${label})`, {
        medal,
      }),
    );
    return view;
    } catch (error) {
    return failAction("Start auction", error);
  }
}

function auctionControl(formData: FormData) {
  const lotId = String(formData.get("lotId") ?? "");
  const revision = Number(formData.get("revision"));
  if (!lotId || !Number.isSafeInteger(revision) || revision < 0) throw new Error("Refresh the auction before using controls.");
  return { lotId, revision };
}

export async function actionWebAuctionPause(formData: FormData) {
try {
  await requireAdmin();
    return pauseWebAuction(auctionControl(formData));
    } catch (error) {
    return failAction("Pause auction", error);
  }
}

export async function actionWebAuctionResume(formData: FormData) {
try {
  await requireAdmin();
    return resumeWebAuction(auctionControl(formData));
    } catch (error) {
    return failAction("Resume auction", error);
  }
}

export async function actionWebAuctionTimer(formData: FormData) {
try {
  await requireAdmin();
    return startWebTimer(auctionControl(formData));
    } catch (error) {
    return failAction("Set auction timer", error);
  }
}

export async function actionWebAuctionResetTimer(formData: FormData) {
try {
  await requireAdmin();
    return resetWebTimer(auctionControl(formData));
    } catch (error) {
    return failAction("Reset auction timer", error);
  }
}

export async function actionWebAuctionSold(formData: FormData) {
try {
  const session = await requireAdmin();
    const { lotId, revision } = auctionControl(formData);
    const view = await confirmWebSold(lotId, revision);
    revalidateTag(PUBLIC_PAGE_TAG, "max");
    after(() =>
      note(session, "auction.web_sold", `Sold lot on web auction`, {
        player: view.lastSale?.playerName ?? view.currentPlayer?.steamName,
      }),
    );
    return view;
    } catch (error) {
    return failAction("Mark auction sold", error);
  }
}

export async function actionWebAuctionPass(formData: FormData) {
try {
  const session = await requireAdmin();
    const { lotId, revision } = auctionControl(formData);
    const view = await passWebUnsold(lotId, revision);
    after(() => note(session, "auction.web_pass", `Passed / unsold on web auction`));
    return view;
    } catch (error) {
    return failAction("Pass auction lot", error);
  }
}

export async function actionWebAuctionNext(formData: FormData) {
try {
  await requireAdmin();
    return introduceNextWebPlayer(auctionControl(formData));
    } catch (error) {
    return failAction("Advance auction", error);
  }
}

export async function actionWebAuctionEnd(formData: FormData) {
try {
  void formData;
    const session = await requireAdmin();
    const view = await endWebAuction();
    after(() => note(session, "auction.web_end", "Ended web auction (forced idle)"));
    return view;
    } catch (error) {
    return failAction("End auction", error);
  }
}

export async function actionSchedulePubgLobby(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Schedule PUBG lobby", error);
  }
}

export async function actionRecordPubgResult(formData: FormData) {
try {
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
    } catch (error) {
    return failAction("Record PUBG result", error);
  }
}

export async function actionSeedPlayoffGroups() {
try {
  const session = await requireAdmin();
    const view = await seedPlayoffGroups();
    await note(
      session,
      "playoff.groups",
      `Randomized groups (${view.groupA.length}+${view.groupB.length} teams)`,
      {
        groupA: view.groupA.map((t) => t.name),
        groupB: view.groupB.map((t) => t.name),
      },
    );
    revalidateAdmin();
    } catch (error) {
    return failAction("Seed playoff groups", error);
  }
}

export async function actionAssignPlayoffGroup(formData: FormData) {
try {
  const session = await requireAdmin();
    const teamName = String(formData.get("teamName") ?? "");
    const group = String(formData.get("group") ?? "").toUpperCase();
    if (group !== "A" && group !== "B") throw new Error("Pick Group A or B.");
    const result = await assignPlayoffGroup({
      teamName,
      group: group as "A" | "B",
    });
    await note(
      session,
      "playoff.assign",
      `Assigned ${result.teamName} → Group ${result.group}`,
      { teamName: result.teamName, group: result.group },
    );
    revalidateAdmin();
    } catch (error) {
    return failAction("Assign playoff group", error);
  }
}

export async function actionBookGroupStage(formData: FormData) {
try {
  const session = await requireAdmin();
    const result = await bookGroupStageRoundRobin({
      saturday: String(formData.get("saturday") ?? "") || undefined,
      sunday: String(formData.get("sunday") ?? "") || undefined,
      force: formData.get("force") === "1",
    });
    const discord = await postGroupStageToMatchesRest(result);
    const discordNote = discord.ok ? discord.detail : `Discord: ${discord.reason}`;
    await note(
      session,
      "schedule.groups",
      `Booked group stage (${result.fixtures.length} matches) · ${discordNote}`,
      {
        saturday: result.saturday,
        sunday: result.sunday,
        matchCount: result.fixtures.length,
        discord: discord.ok ? discord.detail : discord.reason,
      },
    );
    revalidateAdmin();
    if (!discord.ok) {
      throw new Error(
        `Group stage booked (${result.fixtures.length} matches), but Discord sync failed: ${discord.reason}. Use Re-post schedule to Discord.`,
      );
    }
    } catch (error) {
    return failAction("Book group stage", error);
  }
}

export async function actionPostGroupStageDiscord() {
try {
  const session = await requireAdmin();
    const booked = await bookedGroupStageFromDb();
    if (!booked) throw new Error("No group fixtures booked yet.");
    const discord = await postGroupStageToMatchesRest(booked);
    if (!discord.ok) throw new Error(discord.reason);
    await note(session, "schedule.groups_discord", discord.detail);
    revalidateAdmin();
    } catch (error) {
    return failAction("Post group stage to Discord", error);
  }
}

export async function actionOpenPlayoffs() {
try {
  const session = await requireAdmin();
    const result = await openPlayoffsFromGroups();
    const discord = await postPlayoffToMatchesRest();
    const discordNote = discord.ok ? discord.detail : `Discord: ${discord.reason}`;
    await note(
      session,
      "playoff.open",
      result.created.length
        ? `Opened playoffs · booked ${result.created.join(", ")} · ${discordNote}`
        : `Playoffs already open · ${discordNote}`,
      { created: result.created, discord: discord.ok ? discord.detail : discord.reason },
    );
    revalidateAdmin();
    if (!discord.ok && result.created.length > 0) {
      throw new Error(
        `Playoffs opened, but Discord sync failed: ${discord.reason}. Use Post / refresh Discord.`,
      );
    }
    if (!discord.ok && result.created.length === 0) {
      throw new Error(discord.reason);
    }
    } catch (error) {
    return failAction("Open playoffs", error);
  }
}

export async function actionPostPlayoffsDiscord() {
try {
  const session = await requireAdmin();
    const discord = await postPlayoffToMatchesRest();
    if (!discord.ok) throw new Error(discord.reason);
    await note(session, "playoff.post", discord.detail);
    revalidateAdmin();
    } catch (error) {
    return failAction("Post playoffs to Discord", error);
  }
}

export async function actionClearPlayoffFixtures() {
try {
  const session = await requireAdmin();
    const n = await clearPlayoffFixtures();
    await note(
      session,
      "playoff.clear",
      n === 0
        ? "No pending playoff fixtures to clear"
        : `Cleared ${n} pending playoff fixtures`,
      { cleared: n },
    );
    revalidateAdmin();
    } catch (error) {
    return failAction("Clear playoff fixtures", error);
  }
}
