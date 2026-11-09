import { PubgHomePage } from "@/components/home/pubg-home-page";
import { cupBrand } from "@/lib/brand";
import type { Metadata } from "next";

export const revalidate = 30;

const brand = cupBrand("PUBG");

export const metadata: Metadata = {
  title: brand.name,
  description: brand.description,
};

export default async function PubgCupHome() {
  return <PubgHomePage />;
}
