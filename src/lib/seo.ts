import type { Metadata } from "next";
import {
  CUP_DESCRIPTION,
  CUP_NAME,
  cupBrand,
  cupPublicUrl,
  type CupBrand,
} from "./brand";
import { isPubgSeason } from "./games";
import { getLiveSeason } from "./seasons";

export const SITE_NAME = CUP_NAME;
export const SITE_URL = cupPublicUrl();

export const SITE_DESCRIPTION = CUP_DESCRIPTION;

export function pageMeta(title: string, description: string): Metadata {
  return { title, description };
}

export async function liveCupBrand(): Promise<CupBrand> {
  return cupBrand(isPubgSeason(await getLiveSeason()) ? "PUBG" : "DOTA");
}

/** Page metadata whose description follows the live cup's game. */
export async function livePageMeta(
  title: string,
  description: (brand: CupBrand) => string,
): Promise<Metadata> {
  return pageMeta(title, description(await liveCupBrand()));
}
