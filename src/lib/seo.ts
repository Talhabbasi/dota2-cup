import type { Metadata } from "next";

export const SITE_NAME = "MM Dota Cup";
export const SITE_URL = (
  process.env.NEXTAUTH_URL || "https://dota2-cup.vercel.app"
).replace(/\/+$/, "");

export const SITE_DESCRIPTION =
  "MM Dota Cup is an indoor Dota 2 tournament in Pakistan. Follow teams, weekend schedules, playoffs, auction results, predictions, and match scores.";

export function pageMeta(title: string, description: string): Metadata {
  return { title, description };
}
