import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Oxanium, Sora } from "next/font/google";
import { Nav } from "@/components/nav";
import { ClosedBanner } from "@/components/closed-banner";
import { NavigationLoader } from "@/components/navigation-loader";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Indoor Dota 2 Tournament in Pakistan`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/mm-dota-cup-icon.png",
    apple: "/mm-dota-cup-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_PK",
    siteName: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/mm-dota-cup-icon.png"],
  },
  twitter: {
    card: "summary",
    description: SITE_DESCRIPTION,
    images: ["/mm-dota-cup-icon.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${oxanium.variable} ${sora.variable} ${bebas.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <NavigationLoader />
          <Nav />
          <ClosedBanner />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
        <div className="film-grain" aria-hidden />
      </body>
    </html>
  );
}
