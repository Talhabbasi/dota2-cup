import Link from "next/link";
import { currentPlayer } from "@/lib/auth";
import { RegisterForm } from "@/components/register-form";
import { RegisterSignIn } from "@/components/register-signin";
import { isRegistrationOpen, formatEntryFee } from "@/lib/registration-status";
import { parseRolesJson } from "@/lib/roles";
import { playWindowOrBoth } from "@/lib/play-window";
import { livePageMeta } from "@/lib/seo";
import { steam32To64, steamProfileUrl } from "@/lib/steam";
import { COMMUNITY_NAME } from "@/lib/brand";
import { isPubgSeason, rosterRules } from "@/lib/games";
import { getCupFeatureSettings } from "@/lib/cup-features";
import { labelForMedal } from "@/lib/constants";
import { getLiveSeason } from "@/lib/seasons";
import {
  formatSeasonStartDate,
  seasonPlanLine,
  tournamentFormatLabel,
} from "@/lib/season-constants";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return livePageMeta("Register to Play", (brand) =>
    brand.game === "PUBG"
      ? `Register for ${brand.name} with Discord and your PUBG name. Indoor PUBG tournament sign-up in Pakistan.`
      : `Register for ${brand.name} with Discord and Steam. Indoor Dota 2 tournament sign-up for Pakistan weekend matches.`,
  );
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
  const existing = player
    ? {
        steamUrl:
          player.steam32 == null
            ? ""
            : steamProfileUrl(steam32To64(player.steam32)),
        pubgName: player.pubgName ?? "",
        medal: player.medal,
        role: parseRolesJson(player.rolesJson)[0] ?? "mid",
        playWindow: playWindowOrBoth(player.playWindow),
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
              Public registration is closed
              {live ? ` for ${live.name}` : ""}
              {startLabel ? ` (planned start ${startLabel})` : ""}. This is an
              indoor tournament for players who have played with {COMMUNITY_NAME}.
              Outdoor members are not allowed. Entry fee is {formatEntryFee()} per
              starter — pay in Discord #payments after an admin registers you.
            </p>
            {player ? (
              <p className="lede" style={{ marginTop: "0.75rem" }}>
                You are registered as <strong>{player.steamName}</strong>.{" "}
                <Link href={`/players/${player.id}`} className="text-link">
                  View your profile
                </Link>
                .
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
                ? `Sign up with Discord, your PUBG name, your Steam profile, and your PUBG rank. One Discord links to one Steam, same as the Dota cup. This cup is ${roster.label}. Entry fee is ${formatEntryFee()} per player (${roster.teamFeePkr.toLocaleString("en-PK")} PKR for a full entry).`
                : "Link one Discord account to one Steam account."}{" "}
              Same rules as <code>/register</code> in Discord — either place works.
              {!pubg ? (
                <>
                  {" "}
                  Entry fee is {formatEntryFee()} per starter (subs free).
                </>
              ) : null}{" "}
              After you register, post the payment screenshot in Discord #payments.
              {live
                ? ` ${live.name} is ${tournamentFormatLabel(live.tournamentFormat).toLowerCase()} · ${live.teamCount} teams${
                    startLabel ? ` · starts ${startLabel}` : ""
                  }.`
                : ""}
              {features.maxMedalToApply
                ? ` Max medal: ${labelForMedal(features.maxMedalToApply)} and below.`
                : ""}
            </p>
        </div>
      </header>

      <section className="register-panel">
        {!session?.user ? (
          <div className="register-gate">
            <p>
              {pubg
                ? "Sign in with Discord, then add your PUBG name, Steam profile, and rank."
                : "Sign in with Discord, then add your Steam profile, medal, role, and weekend window."}
            </p>
            <RegisterSignIn />
          </div>
        ) : (
          <>
            {player ? (
              <p className="muted">
                You are already registered as{" "}
                <strong>{player.pubgName || player.steamName}</strong>.{" "}
                <Link href={`/players/${player.id}`} className="text-link">
                  View your profile
                </Link>
                .
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
