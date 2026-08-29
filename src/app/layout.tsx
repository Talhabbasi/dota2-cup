import type { Metadata } from "next";
import { Oxanium, Sora } from "next/font/google";
import { Nav } from "@/components/nav";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${oxanium.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="footer">
            <strong>MM Dota Cup</strong>
            <div>Draft. Play. Dominate.</div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
