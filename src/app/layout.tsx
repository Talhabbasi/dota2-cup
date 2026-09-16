import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Oxanium, Sora } from "next/font/google";
import { Nav } from "@/components/nav";
import { ClosedBanner } from "@/components/closed-banner";
import { NavigationLoader } from "@/components/navigation-loader";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { hasCrownedSeason } from "@/lib/seasons";
import "./globals.css";

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MM Dota Cup",
  description:
    "Indoor MM Dota cup — eight franchises, group stage, live playoff graph, and weekend kickoffs in Pakistan time.",
  icons: {
    icon: "/mm-dota-cup-icon.png",
    apple: "/mm-dota-cup-icon.png",
  },
  openGraph: {
    title: "MM Dota Cup",
    description:
      "Indoor MM Dota cup — eight franchises, group stage, live playoff graph, and weekend kickoffs in Pakistan time.",
    images: ["/mm-dota-cup-icon.png"],
  },
  twitter: {
    card: "summary",
    title: "MM Dota Cup",
    images: ["/mm-dota-cup-icon.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const showSeasons = await hasCrownedSeason();
  return (
    <html
      lang="en"
      className={`${oxanium.variable} ${sora.variable} ${bebas.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <NavigationLoader />
          <Nav showSeasons={showSeasons} />
          <ClosedBanner />
          <main className="flex-1">{children}</main>
          <SiteFooter showSeasons={showSeasons} />
        </Providers>
        <div className="film-grain" aria-hidden />
      </body>
    </html>
  );
}
