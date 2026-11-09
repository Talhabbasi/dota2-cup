const SHOWCASE_ROLE: Record<string, string> = {
  safelane: "Carry",
  mid: "Mid lane",
  offlane: "Offlane",
  soft_support: "Soft support",
  hard_support: "Hard support",
};

export function showcaseRole(roleKeys: string[]) {
  for (const key of Object.keys(SHOWCASE_ROLE)) {
    if (roleKeys.includes(key)) return SHOWCASE_ROLE[key]!;
  }
  return "Player";
}
