export type AvatarGender = "male" | "female";

export type AvatarConfig = {
  gender: AvatarGender;
  bodyType: "slim" | "regular" | "broad";
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  beardStyle: string;
  beardColor: string;
  clothing: string;
  clothingColor: string;
  eyeColor: string;
  accessories: string[];
};

export type AvatarCategory =
  | "base"
  | "hair-back"
  | "hair-front"
  | "beard"
  | "clothing"
  | "face"
  | "accessory";

export type AvatarAnchor = {
  x: number;
  y: number;
};

export type AvatarAsset = {
  id: string;
  gender: AvatarGender | "any";
  category: AvatarCategory;
  src: string;
  zIndex: number;
  canvas: { width: number; height: number };
  anchor: AvatarAnchor;
  recolorable: "skin" | "hair" | "beard" | "clothing" | null;
  label: string;
  styleId?: string;
};

export type AvatarManifest = {
  version: number;
  canvas: { width: number; height: number };
  assets: AvatarAsset[];
};

export const AVATAR_CANVAS = { width: 1024, height: 1024 } as const;
export const LOCAL_AVATAR_KEY = "mm_avatar_config";
