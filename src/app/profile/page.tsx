import { PageHeader } from "@/components/common";
import { ProfileForm } from "@/components/profile-form";
import { RegisterSignIn } from "@/components/register-signin";
import { currentPlayer } from "@/lib/auth";
import { STARTING_ROLES, type StartingRole } from "@/lib/constants";
import { parseRolesJson } from "@/lib/roles";
import { steam32To64 } from "@/lib/steam";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const { session, player } = await currentPlayer();
  const discordId = session?.user?.discordId;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Player"
        title="Profile"
        subtitle="Your account across every season. Set your name, roles, and roster character here. Discord and Steam stay fixed."
      />
      {!discordId ? (
        <div className="grid gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            Sign in with Discord to open your profile.
          </p>
          <RegisterSignIn callbackUrl="/profile" />
        </div>
      ) : (
        <ProfileForm
          profileName={player?.profileName || player?.steamName || ""}
          about={player?.about ?? ""}
          roles={parseRolesJson(player?.rolesJson ?? "[]").filter((role): role is StartingRole =>
            (STARTING_ROLES as readonly string[]).includes(role),
          )}
          avatarConfig={player?.avatarConfig ?? ""}
          avatarSeed={player?.id ?? discordId}
          discordId={player?.discordId || discordId}
          steamLabel={
            player?.steam32 == null
              ? "Not linked"
              : `${player.steam32} · ${steam32To64(player.steam32).toString()}`
          }
        />
      )}
    </div>
  );
}
