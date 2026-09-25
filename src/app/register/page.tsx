import Link from "next/link";
import { currentPlayer } from "@/lib/auth";
import { RegisterForm } from "@/components/register-form";
import { RegisterSignIn } from "@/components/register-signin";
import { isRegistrationOpen, formatEntryFee } from "@/lib/registration-status";
import { parseRolesJson } from "@/lib/roles";
import { playWindowOrBoth } from "@/lib/play-window";
import { pageMeta } from "@/lib/seo";
import { steam32To64, steamProfileUrl } from "@/lib/steam";
import { COMMUNITY_NAME, CUP_NAME } from "@/lib/brand";
import { getCupFeatureSettings } from "@/lib/cup-features";
import { MEDAL_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = pageMeta(
  "Register to Play",
  `Register for ${CUP_NAME} with Discord and Steam. Indoor Dota 2 tournament sign-up for Pakistan weekend matches.`,
);

export default async function RegisterPage() {
  const { session, player } = await currentPlayer();
  const [publicOpen, features] = await Promise.all([
    isRegistrationOpen(),
    getCupFeatureSettings(),
  ]);

  const existing = player
    ? {
        steamUrl: steamProfileUrl(steam32To64(player.steam32)),
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
            <p className="eyebrow">Sign-up</p>
            <h1>Registration closed</h1>
            <p className="lede">
              Public registration is closed. This is an indoor tournament for
              players who have played with {COMMUNITY_NAME}. Outdoor members are
              not allowed. Entry fee is {formatEntryFee()} per starter — pay in
              Discord #payments after an admin registers you.
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
          <p className="eyebrow">Sign-up</p>
          <h1>Register</h1>
          <p className="lede">
            Link one Discord account to one Steam account. This page works even
            when the Discord bot is offline — same rank, role, weekend window,
            and Steam rules as <code>/register</code> in #register. Entry fee is{" "}
            {formatEntryFee()} per starter (subs free). After you register, post
            the payment screenshot in Discord #payments.
            {features.maxMedalToApply
              ? ` Max medal: ${MEDAL_LABELS[features.maxMedalToApply]} and below.`
              : ""}
          </p>
        </div>
      </header>

      <section className="register-panel">
        {!session?.user ? (
          <div className="register-gate">
            <p>
              Sign in with Discord, then add your Steam profile, medal, role,
              and weekend window.
            </p>
            <RegisterSignIn />
          </div>
        ) : (
          <>
            {player ? (
              <p className="muted">
                You are already registered as{" "}
                <strong>{player.steamName}</strong>.{" "}
                <Link href={`/players/${player.id}`} className="text-link">
                  View your profile
                </Link>
                .
              </p>
            ) : null}
            <RegisterForm
              discordName={session.user.name ?? "Discord"}
              existing={existing}
            />
          </>
        )}
      </section>
    </div>
  );
}
