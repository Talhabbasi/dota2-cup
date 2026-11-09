import { DotaHomePage } from "@/components/home/dota-home-page";
import { CUP_DESCRIPTION, CUP_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export const revalidate = 30;

export const metadata: Metadata = {
  title: CUP_NAME,
  description: CUP_DESCRIPTION,
};

export default async function DotaCupHome() {
  return <DotaHomePage />;
}
