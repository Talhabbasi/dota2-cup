import { PrismaClient } from "@prisma/client";
import { STARTING_PURSE } from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  await prisma.bid.deleteMany();
  await prisma.auctionLot.deleteMany();
  await prisma.matchPlayer.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.auctionState.deleteMany();
  await prisma.auctionState.create({ data: { id: "singleton" } });

  const wolves = await prisma.team.create({
    data: {
      name: "Night Wolves",
      captainId: "seed-captain-1",
      purse: STARTING_PURSE,
    },
  });
  const ember = await prisma.team.create({
    data: {
      name: "Ember Court",
      captainId: "seed-captain-2",
      purse: STARTING_PURSE,
    },
  });

  const captainA = await prisma.player.create({
    data: {
      discordId: "seed-cap-a",
      discordName: "WolfLead",
      steam32: 111111,
      steamName: "Wolf.Ceb",
      medal: "divine",
      rolesJson: JSON.stringify(["mid"]),
      teamId: wolves.id,
      rosterRole: "mid",
      isCaptain: true,
    },
  });
  const captainB = await prisma.player.create({
    data: {
      discordId: "seed-cap-b",
      discordName: "EmberLead",
      steam32: 222222,
      steamName: "Court.Yatoro",
      medal: "immortal",
      rolesJson: JSON.stringify(["safelane"]),
      teamId: ember.id,
      rosterRole: "safelane",
      isCaptain: true,
    },
  });

  await prisma.team.update({
    where: { id: wolves.id },
    data: { captainId: captainA.id },
  });
  await prisma.team.update({
    where: { id: ember.id },
    data: { captainId: captainB.id },
  });

  const unsigned = [
    ["seed-1", "MidOne", 333001, "Nisha", "immortal", ["mid"]],
    ["seed-2", "SafeTwo", 333002, "Skiter", "divine", ["safelane"]],
    ["seed-3", "OffThree", 333003, "AMMAR", "ancient", ["offlane"]],
    ["seed-4", "SoftFour", 333004, "Boxi", "legend", ["soft_support"]],
    ["seed-5", "HardFive", 333005, "Insania", "legend", ["hard_support"]],
    ["seed-6", "FlexSix", 333006, "Quinn", "divine", ["flex"]],
    ["seed-7", "HeraldSeven", 333007, "Pubstar", "herald", ["mid", "offlane"]],
  ] as const;

  for (const [discordId, discordName, steam32, steamName, medal, roles] of unsigned) {
    await prisma.player.create({
      data: {
        discordId,
        discordName,
        steam32,
        steamName,
        medal,
        rolesJson: JSON.stringify(roles),
      },
    });
  }

  console.log("Seeded 2 captains and 7 unsigned players.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
