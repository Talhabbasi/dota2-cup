import { avatarSvg } from "@/lib/avatar/portrait";
import { rosterAvatar, type TeamKit } from "@/lib/avatar/roster";

export function RosterAvatar({ playerId, saved, kit, name, className }: {
  playerId: string; saved?: string | null; kit?: TeamKit | null; name: string; className?: string;
}) {
  const config = rosterAvatar(playerId, saved, kit);
  // Inline vector art has no remote image request or Next image optimization step.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg(config))}`}
    width={512} height={512} alt={`${name}'s avatar`} className={className}
    data-player-avatar={playerId} data-avatar-config={JSON.stringify(config)} />;
}
