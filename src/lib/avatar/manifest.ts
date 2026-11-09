import type {
  AvatarAsset,
  AvatarConfig,
  AvatarGender,
  AvatarManifest,
} from "./types";

const manifest: AvatarManifest = {
  version: 1,
  canvas: { width: 1024, height: 1024 },
  assets: [
    {
      id: "male-base-short",
      gender: "male",
      category: "base",
      styleId: "short",
      src: "/avatars/male/base/short.png?v=8",
      zIndex: 20,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "skin",
      label: "Short",
    },
    {
      id: "male-base-spiky",
      gender: "male",
      category: "base",
      styleId: "spiky",
      src: "/avatars/male/base/spiky.png?v=8",
      zIndex: 20,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "skin",
      label: "Spiky",
    },
    {
      id: "male-base-undercut",
      gender: "male",
      category: "base",
      styleId: "undercut",
      src: "/avatars/male/base/undercut.png?v=8",
      zIndex: 20,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "skin",
      label: "Undercut",
    },
    {
      id: "female-base-long-wavy",
      gender: "female",
      category: "base",
      styleId: "long-wavy",
      src: "/avatars/female/base/long-wavy.png?v=8",
      zIndex: 20,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "skin",
      label: "Long wavy",
    },
    {
      id: "female-base-bob",
      gender: "female",
      category: "base",
      styleId: "bob",
      src: "/avatars/female/base/bob.png?v=8",
      zIndex: 20,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "skin",
      label: "Bob",
    },
    {
      id: "female-base-ponytail",
      gender: "female",
      category: "base",
      styleId: "ponytail",
      src: "/avatars/female/base/ponytail.png?v=8",
      zIndex: 20,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "skin",
      label: "Ponytail",
    },
    {
      id: "male-beard-stubble",
      gender: "male",
      category: "beard",
      styleId: "stubble",
      src: "/avatars/male/beard/stubble.png?v=8",
      zIndex: 40,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "beard",
      label: "Stubble",
    },
    {
      id: "male-beard-full",
      gender: "male",
      category: "beard",
      styleId: "full",
      src: "/avatars/male/beard/full.png?v=8",
      zIndex: 40,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "beard",
      label: "Full beard",
    },
    {
      id: "male-beard-goatee",
      gender: "male",
      category: "beard",
      styleId: "goatee",
      src: "/avatars/male/beard/goatee.png?v=8",
      zIndex: 40,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "beard",
      label: "Goatee",
    },
    {
      id: "clothing-tshirt",
      gender: "any",
      category: "clothing",
      styleId: "tshirt",
      src: "/avatars/shared/tshirt.png",
      zIndex: 30,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "clothing",
      label: "T-shirt",
    },
    {
      id: "clothing-hoodie",
      gender: "any",
      category: "clothing",
      styleId: "hoodie",
      src: "/avatars/shared/hoodie.png?v=6",
      zIndex: 30,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "clothing",
      label: "Hoodie",
    },
    {
      id: "clothing-jersey",
      gender: "any",
      category: "clothing",
      styleId: "jersey",
      src: "/avatars/shared/jersey.png?v=6",
      zIndex: 30,
      canvas: { width: 1024, height: 1024 },
      anchor: { x: 512, y: 512 },
      recolorable: "clothing",
      label: "Esports jersey",
    },
  ],
};

/** Full catalogs from the product spec. Only IDs with assets are selectable. */
export const MALE_HAIR_CATALOG = [
  "short",
  "spiky",
  "fade",
  "undercut",
  "messy",
  "curly",
  "wavy",
  "side-part",
  "long",
  "mohawk",
  "buzz",
  "bald",
] as const;

export const FEMALE_HAIR_CATALOG = [
  "long-wavy",
  "bob",
  "ponytail",
  "bun",
  "curly",
  "wavy",
  "braided",
  "pixie",
  "shoulder",
  "twin-tails",
  "side-swept",
  "layered",
] as const;

export const BEARD_CATALOG = [
  "none",
  "stubble",
  "short",
  "full",
  "long",
  "goatee",
  "mustache",
  "van-dyke",
] as const;

export const CLOTHING_CATALOG = [
  "tshirt",
  "hoodie",
  "jersey",
  "jacket",
  "team-shirt",
] as const;

export function getManifest() {
  return manifest;
}

export function listAssets(category?: AvatarAsset["category"], gender?: AvatarGender) {
  return manifest.assets.filter((asset) => {
    if (category && asset.category !== category) return false;
    if (gender && asset.gender !== "any" && asset.gender !== gender) return false;
    return true;
  });
}

export function availableHairStyles(gender: AvatarGender) {
  return listAssets("base", gender)
    .map((asset) => asset.styleId!)
    .filter(Boolean);
}

export function availableBeardStyles() {
  return ["none", ...listAssets("beard", "male").map((asset) => asset.styleId!).filter(Boolean)];
}

export function availableClothingStyles() {
  return ["tshirt", "hoodie", "jersey"];
}

export function hairLabel(gender: AvatarGender, styleId: string) {
  return (
    listAssets("base", gender).find((asset) => asset.styleId === styleId)?.label ?? styleId
  );
}

export function resolveLayers(config: AvatarConfig): AvatarAsset[] {
  const layers: AvatarAsset[] = [];
  const base = listAssets("base", config.gender).find(
    (asset) => asset.styleId === config.hairStyle,
  ) ?? listAssets("base", config.gender)[0];
  if (base) layers.push(base);

  if (availableClothingStyles().includes(config.clothing) && config.clothing !== "tshirt") {
    const clothing = listAssets("clothing").find((asset) => asset.styleId === config.clothing);
    if (clothing) layers.push(clothing);
  }

  if (config.gender === "male" && config.beardStyle && config.beardStyle !== "none") {
    const beard = listAssets("beard", "male").find(
      (asset) => asset.styleId === config.beardStyle,
    );
    if (beard) layers.push(beard);
  }

  return layers.sort((a, b) => a.zIndex - b.zIndex);
}
