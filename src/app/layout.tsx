import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Oxanium, Sora } from "next/font/google";
import { ClosedBanner } from "@/components/closed-banner";
import { NavigationLoader } from "@/components/navigation-loader";
import { Providers } from "@/components/providers";
import { SiteChrome } from "@/components/site-chrome";
import { CUP_ICON_PATH, CUP_TITLE_SUFFIX } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  getCurrentSeasonSafe,
  getLiveSeason,
  listPublicSeasons,
  liveSeasonLabel,
} from "@/lib/seasons";
import { resolveViewSeason } from "@/lib/season-view";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | ${CUP_TITLE_SUFFIX}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: CUP_ICON_PATH,
    apple: CUP_ICON_PATH,
  },
  openGraph: {
    type: "website",
    locale: "en_PK",
    siteName: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [CUP_ICON_PATH],
  },
  twitter: {
    card: "summary",
    description: SITE_DESCRIPTION,
    images: [CUP_ICON_PATH],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [live, seasons, { player }, view] = await Promise.all([
    getLiveSeason(),
    listPublicSeasons(),
    currentPlayer(),
    resolveViewSeason(),
  ]);
  const seasonLabel = live
    ? liveSeasonLabel(live)
    : seasons.length > 0
      ? "Season archive"
      : liveSeasonLabel(await getCurrentSeasonSafe());

  const viewSeasonNumber =
    view && !view.isLive ? view.number : null;

  return (
    <html
      lang="en"
      className={`${oxanium.variable} ${sora.variable} ${bebas.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <NavigationLoader />
          <SiteChrome
            seasonLabel={seasonLabel}
            showRegister={!player}
            showSeasons={seasons.length > 0}
            seasons={seasons}
            liveSeasonId={live?.id ?? null}
            viewSeasonNumber={viewSeasonNumber}
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
