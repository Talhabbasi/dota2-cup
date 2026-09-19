import { cache } from "react";
import { prisma } from "./prisma";

export const getCupSettings = cache(async () => {
  try {
    return await prisma.cupSettings.findUnique({
      where: { id: "singleton" },
    });
  } catch {
    return null;
  }
});
