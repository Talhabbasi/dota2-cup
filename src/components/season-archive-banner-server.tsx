import { resolveViewSeason } from "@/lib/season-view";
import { SeasonArchiveBanner } from "@/components/season-archive-banner";

export async function SeasonArchiveBannerServer({
  season,
}: {
  season?: string;
}) {
  const view = await resolveViewSeason({ season });
  return <SeasonArchiveBanner view={view} />;
}
