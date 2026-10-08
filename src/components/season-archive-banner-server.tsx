import { resolveViewSeason } from "@/lib/season-view";
import { SeasonArchiveBanner } from "@/components/season-archive-banner";

export async function SeasonArchiveBannerServer(_props?: {
  season?: string;
}) {
  const view = await resolveViewSeason();
  return <SeasonArchiveBanner view={view} />;
}
