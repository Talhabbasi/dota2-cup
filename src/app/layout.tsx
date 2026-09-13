import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { Oxanium, Sora } from "next/font/google";
import { Nav } from "@/components/nav";
import { ClosedBanner } from "@/components/closed-banner";
import { NavigationLoader } from "@/components/navigation-loader";
import { Providers } from "@/components/providers";
import "./globals.css";

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MM Dota Cup",
  description: "Auction, teams, and standings for MM Dota Cup.",
  icons: {
    icon: "/mm-dota-cup-icon.png",
    apple: "/mm-dota-cup-icon.png",
  },
  openGraph: {
    title: "MM Dota Cup",
    description: "Auction, teams, and standings for MM Dota Cup.",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${oxanium.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <NavigationLoader />
          <Nav />
          <ClosedBanner />
          <main className="flex-1">{children}</main>
          <footer className="footer">
            <strong className="footer-brand">
              <Image
                src="/mm-dota-cup-icon.png"
                alt=""
                width={22}
                height={22}
                className="footer-brand-icon"
              />
              MM Dota Cup
            </strong>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
