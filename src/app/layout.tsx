import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, Oxanium, Rajdhani, Sora } from "next/font/google";
import { ClosedBanner } from "@/components/closed-banner";
import { NavigationLoader } from "@/components/navigation-loader";
import { Providers } from "@/components/providers";
import { SiteChrome } from "@/components/site-chrome";
import { CUP_ICON_PATH, HUB_DESCRIPTION, HUB_NAME } from "@/lib/brand";
import { readHubGameCookie } from "@/lib/hub-game-server";
import { CUP_GAME } from "@/lib/games";
import { SITE_URL, liveCupBrand } from "@/lib/seo";
import {
  countCompletedSeasons,
  getCurrentSeasonSafe,
  getFeaturedSeasonForGame,
  getLiveSeason,
  listPublicSeasons,
  liveSeasonLabel,
} from "@/lib/seasons";
import { auctionPayBlockForPlayer } from "@/lib/auction-payment";
import { currentPlayer } from "@/lib/auth";
import { isPlayerEnrolledInLiveSeason } from "@/lib/registration-status";
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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: true,
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await liveCupBrand();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${HUB_NAME} | ${brand.titleSuffix}`,
      template: `%s | ${HUB_NAME}`,
    },
    description: HUB_DESCRIPTION,
    icons: {
      icon: CUP_ICON_PATH,
      apple: CUP_ICON_PATH,
    },
    openGraph: {
      type: "website",
      locale: "en_PK",
      siteName: HUB_NAME,
      description: HUB_DESCRIPTION,
      images: [CUP_ICON_PATH],
    },
    twitter: {
      card: "summary",
      description: HUB_DESCRIPTION,
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
  const [live, seasons, { player }, completedCount, cookieGame, dotaFeatured, pubgFeatured] =
    await Promise.all([
      getLiveSeason(),
      listPublicSeasons(),
      currentPlayer(),
      countCompletedSeasons(),
      readHubGameCookie(),
      getFeaturedSeasonForGame(CUP_GAME.DOTA),
      getFeaturedSeasonForGame(CUP_GAME.PUBG),
    ]);
  const [enrolledInLiveSeason, auctionPay] = await Promise.all([
    player ? isPlayerEnrolledInLiveSeason(player.id) : Promise.resolve(false),
    auctionPayBlockForPlayer(player?.id),
  ]);
  const seasonLabel = live
    ? liveSeasonLabel(live)
    : seasons.length > 0
      ? "Season archive"
      : liveSeasonLabel(await getCurrentSeasonSafe());
  const dotaSeasonLabel = dotaFeatured.season
    ? liveSeasonLabel(dotaFeatured.season)
    : "Dota 2";
  const pubgSeasonLabel = pubgFeatured.season
    ? liveSeasonLabel(pubgFeatured.season)
    : "PUBG";

  return (
    <html
      lang="en"
      data-game={cookieGame === "PUBG" ? "pubg" : "dota"}
      className={`${oxanium.variable} ${sora.variable} ${bebas.variable} ${inter.variable} ${rajdhani.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <NavigationLoader />
          <SiteChrome
            seasonLabel={seasonLabel}
            dotaSeasonLabel={dotaSeasonLabel}
            pubgSeasonLabel={pubgSeasonLabel}
            cookieGame={cookieGame}
            liveGame={live?.game ?? null}
            showRegister={!enrolledInLiveSeason}
            showSeasons={completedCount > 0}
            auctionHref={
              !enrolledInLiveSeason || auctionPay.blocked
                ? null
                : player?.isCaptain
                  ? "/auction/captain"
                  : "/auction"
            }
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
