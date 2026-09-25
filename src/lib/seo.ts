import type { Metadata } from "next";
import { CUP_DESCRIPTION, CUP_NAME, cupPublicUrl } from "./brand";

export const SITE_NAME = CUP_NAME;
export const SITE_URL = cupPublicUrl();

export const SITE_DESCRIPTION = CUP_DESCRIPTION;

export function pageMeta(title: string, description: string): Metadata {
  return { title, description };
}
