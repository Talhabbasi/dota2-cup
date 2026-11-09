/** Grand-final closing lineups. Art is original illustration of those five heroes. */
const CHAMPION_ART: Record<
  string,
  { src: string; alt: string; lineup: string }
> = {
  "DOTA-2": {
    src: "/seasons/dota-s2-champions.jpg",
    alt: "Team Grand_Master grand final: Primal Beast, Terrorblade, Slardar, Skywrath Mage, and Ogre Magi standing as a team",
    lineup: "Grand final · Primal Beast, Terrorblade, Slardar, Skywrath Mage, Ogre Magi",
  },
  "DOTA-1": {
    src: "/seasons/dota-s1-champions.jpg",
    alt: "Team Toji grand final: Kez, Dragon Knight, Brewmaster, Grimstroke, and Ring Master standing as a team",
    lineup: "Grand final · Kez, Dragon Knight, Brewmaster, Grimstroke, Ring Master",
  },
};

export function championRosterArt(game: string, number: number) {
  return CHAMPION_ART[`${game}-${number}`] ?? null;
}
