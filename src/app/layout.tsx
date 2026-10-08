import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Oxanium, Sora } from "next/font/google";
import { ClosedBanner } from "@/components/closed-banner";
import { NavigationLoader } from "@/components/navigation-loader";
import { Providers } from "@/components/providers";
import { SiteChrome } from "@/components/site-chrome";
import { CUP_ICON_PATH } from "@/lib/brand";
import { isPubgSeason } from "@/lib/games";
import { SITE_URL, liveCupBrand } from "@/lib/seo";
import {
  countCompletedSeasons,
  getCurrentSeasonSafe,
  getLiveSeason,
  listPublicSeasons,
  liveSeasonLabel,
} from "@/lib/seasons";
import { currentPlayer } from "@/lib/auth";
import "./globals.css";

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await liveCupBrand();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${brand.name} | ${brand.titleSuffix}`,
      template: `%s | ${brand.name}`,
    },
    description: brand.description,
    icons: {
      icon: CUP_ICON_PATH,
      apple: CUP_ICON_PATH,
    },
    openGraph: {
      type: "website",
      locale: "en_PK",
      siteName: brand.name,
      description: brand.description,
      images: [CUP_ICON_PATH],
    },
    twitter: {
      card: "summary",
      description: brand.description,
      images: [CUP_ICON_PATH],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [live, seasons, { player }, completedCount] = await Promise.all([
    getLiveSeason(),
    listPublicSeasons(),
    currentPlayer(),
    countCompletedSeasons(),
  ]);
  const game = isPubgSeason(live) ? "PUBG" : "DOTA";
  const seasonLabel = live
    ? liveSeasonLabel(live)
    : seasons.length > 0
      ? "Season archive"
      : liveSeasonLabel(await getCurrentSeasonSafe());

  return (
    <html
      lang="en"
      data-game={game === "PUBG" ? "pubg" : "dota"}
      className={`${oxanium.variable} ${sora.variable} ${bebas.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <NavigationLoader />
          <SiteChrome
            seasonLabel={seasonLabel}
            game={game}
            showRegister={!player}
            showSeasons={completedCount > 0}
            banner={<ClosedBanner />}
          >
            {children}
          </SiteChrome>
        </Providers>
        <div className="film-grain" aria-hidden />
      </body>
    </html>
  );
}
