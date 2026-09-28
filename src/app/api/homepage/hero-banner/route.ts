import { NextResponse } from "next/server";
import { getHomepageHeroBanner } from "@/lib/homepage-hero";

export const revalidate = 30;

export async function GET() {
  try {
    const banner = await getHomepageHeroBanner();
    return NextResponse.json(banner);
  } catch (error) {
    console.error("[homepage/hero-banner]", error);
    return NextResponse.json(
      { activeSeason: null, pastChampions: [], slides: [] },
      { status: 200 },
    );
  }
}
