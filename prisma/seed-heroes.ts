import "../bot/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedHero = {
  id: number;
  slug: string;
  name: string;
  npcName: string;
  primaryAttr: string;
  attackType: string;
  roles: string[];
  imgPath: string;
  iconPath: string;
  stats: Record<string, unknown>;
};

type OpenDotaHero = {
  id: number;
  name: string;
  localized_name: string;
  primary_attr?: string;
  attack_type?: string;
  roles?: string[];
  img?: string;
  icon?: string;
};

const IDENTITY = new Set([
  "id",
  "name",
  "localized_name",
  "primary_attr",
  "attack_type",
  "roles",
  "img",
  "icon",
]);

function slugFromNpc(npcName: string) {
  return npcName.replace(/^npc_dota_hero_/, "");
}

function toSeedHero(h: OpenDotaHero): SeedHero {
  const slug = slugFromNpc(h.name);
  const stats: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(h)) {
    if (!IDENTITY.has(key)) stats[key] = value;
  }
  return {
    id: h.id,
    slug,
    name: h.localized_name,
    npcName: h.name,
    primaryAttr: h.primary_attr ?? "",
    attackType: h.attack_type ?? "",
    roles: h.roles ?? [],
    imgPath: h.img || `/apps/dota2/images/dota_react/heroes/${slug}.png`,
    iconPath: h.icon || `/apps/dota2/images/dota_react/heroes/icons/${slug}.png`,
    stats,
  };
}

async function loadFromOpenDota(): Promise<SeedHero[]> {
  const res = await fetch("https://api.opendota.com/api/constants/heroes");
  if (!res.ok) {
    throw new Error(`OpenDota returned ${res.status}`);
  }
  const data = (await res.json()) as Record<string, OpenDotaHero>;
  return Object.values(data).map(toSeedHero);
}

async function loadFromFile(): Promise<SeedHero[]> {
  const file = path.join(process.cwd(), "prisma/data/heroes.json");
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as SeedHero[];
}

async function main() {
  const fromApi = process.argv.includes("--fetch");
  const heroes = fromApi ? await loadFromOpenDota() : await loadFromFile();
  heroes.sort((a, b) => a.name.localeCompare(b.name));

  for (const hero of heroes) {
    await prisma.hero.upsert({
      where: { id: hero.id },
      create: {
        id: hero.id,
        slug: hero.slug,
        name: hero.name,
        npcName: hero.npcName,
        primaryAttr: hero.primaryAttr,
        attackType: hero.attackType,
        rolesJson: JSON.stringify(hero.roles),
        imgPath: hero.imgPath,
        iconPath: hero.iconPath,
        statsJson: JSON.stringify(hero.stats ?? {}),
      },
      update: {
        slug: hero.slug,
        name: hero.name,
        npcName: hero.npcName,
        primaryAttr: hero.primaryAttr,
        attackType: hero.attackType,
        rolesJson: JSON.stringify(hero.roles),
        imgPath: hero.imgPath,
        iconPath: hero.iconPath,
        statsJson: JSON.stringify(hero.stats ?? {}),
      },
    });
  }

  const count = await prisma.hero.count();
  console.log(
    `Seeded ${heroes.length} heroes (${fromApi ? "OpenDota" : "prisma/data/heroes.json"}). Database now has ${count}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
