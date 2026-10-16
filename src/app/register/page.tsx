import Link from "next/link";
import { currentPlayer } from "@/lib/auth";
import { RegisterForm } from "@/components/register-form";
import { RegisterSignIn } from "@/components/register-signin";
import { isRegistrationOpen, formatEntryFee } from "@/lib/registration-status";
import { parseRolesJson } from "@/lib/roles";
import { livePageMeta } from "@/lib/seo";
import { steam32To64, steamProfileUrl } from "@/lib/steam";
import { isPubgSeason, rosterRules } from "@/lib/games";
import { getCupFeatureSettings } from "@/lib/cup-features";
import { labelForMedal, STARTING_ROLES, type StartingRole } from "@/lib/constants";
import { getLiveSeason } from "@/lib/seasons";
import {
  formatSeasonStartDate,
  seasonPlanLine,
  tournamentFormatLabel,
} from "@/lib/season-constants";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return livePageMeta("Register", (brand) => `Register for ${brand.name}.`);
}

export default async function RegisterPage() {
  const { session, player } = await currentPlayer();
  const [publicOpen, features, live] = await Promise.all([
    isRegistrationOpen(),
    getCupFeatureSettings(),
    getLiveSeason(),
  ]);
  const planLine = live
    ? seasonPlanLine({
        number: live.number,
        teamCount: live.teamCount,
        plannedStartAt: live.plannedStartAt,
        startedAt: live.startedAt,
        phase: live.phase,
      })
    : null;
  const startLabel = formatSeasonStartDate(live?.plannedStartAt);

  const pubg = isPubgSeason(live);
  const roster = rosterRules(live);
  const existingRoles = player
    ? parseRolesJson(player.rolesJson).filter((r): r is StartingRole =>
        (STARTING_ROLES as readonly string[]).includes(r),
      )
    : [];
  const existing = player
    ? {
        steamUrl:
          player.steam32 == null
            ? ""
            : steamProfileUrl(steam32To64(player.steam32)),
        pubgName: player.pubgName ?? "",
        medal: player.medal,
        roles: existingRoles.length ? existingRoles : (["mid"] as StartingRole[]),
        locked: Boolean(player.teamId),
      }
    : null;

  if (!publicOpen) {
    return (
      <div className="page register-page">
        <header className="teams-list-hero register-hero">
          <div className="team-hero-glow" aria-hidden />
          <div className="teams-list-hero-body">
            <p className="eyebrow">Sign-up{planLine ? ` · ${planLine}` : ""}</p>
            <h1>Registration closed</h1>
            <p className="lede">
              Registration is closed
              {live ? ` for ${live.name}` : ""}
              {startLabel ? ` · starts ${startLabel}` : ""}. Entry{" "}
              {formatEntryFee()} — ask an admin in Discord if you need a late add.
            </p>
            {player ? (
              <p className="lede" style={{ marginTop: "0.75rem" }}>
                You’re in as <strong>{player.steamName}</strong>.{" "}
                <Link href={`/players/${player.id}`} className="text-link">
                  Profile
                </Link>
              </p>
            ) : null}
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="page register-page">
      <header className="teams-list-hero register-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
            <p className="eyebrow">Sign-up{planLine ? ` · ${planLine}` : ""}</p>
            <h1>Register</h1>
            <p className="lede">
              {pubg
                ? `${roster.label} · ${formatEntryFee()} per player`
                : `Entry ${formatEntryFee()} · pay in Discord #payments`}
              {live
                ? ` · ${live.name} · ${tournamentFormatLabel(live.tournamentFormat)} · ${live.teamCount} teams`
                : ""}
              {startLabel ? ` · ${startLabel}` : ""}
              {features.maxMedalToApply
                ? ` · max ${labelForMedal(features.maxMedalToApply)}`
                : ""}
            </p>
        </div>
      </header>

      <section className="register-panel">
        {!session?.user ? (
          <div className="register-gate">
            <p>Sign in with Discord to register.</p>
            <RegisterSignIn />
          </div>
        ) : (
          <>
            {player ? (
              <p className="muted">
                Registered as{" "}
                <strong>{player.pubgName || player.steamName}</strong>.{" "}
                <Link href={`/players/${player.id}`} className="text-link">
                  Profile
                </Link>
              </p>
            ) : null}
            <RegisterForm
              discordName={session.user.name ?? "Discord"}
              existing={existing}
              pubg={pubg}
              rosterLabel={pubg ? roster.label : ""}
            />
          </>
        )}
      </section>
    </div>
  );
}
