/** Mouth and chin landmarks measured on the shipped 1024px artwork.
 * Hair choices are different portraits, so one shared beard transform cannot fit them.
 */
const faces: Record<string, { x: number; mouth: number; chin: number; width: number }> = {
  short: { x: 517, mouth: 477, chin: 565, width: 242 },
  spiky: { x: 512, mouth: 438, chin: 515, width: 224 },
  undercut: { x: 512, mouth: 411, chin: 489, width: 224 },
};
const beards: Record<string, { mouth: number; chin: number; bottom: number }> = {
  full: { mouth: 450, chin: 535, bottom: 548 },
  goatee: { mouth: 465, chin: 545, bottom: 550 },
  stubble: { mouth: 449, chin: 519, bottom: 522 },
};

export function beardPlacement(hairStyle: string, beardStyle: string) {
  const face = faces[hairStyle] ?? faces.spiky;
  const beard = beards[beardStyle] ?? beards.full;
  const scaleX = face.width / 230;
  const scaleY = (face.chin - face.mouth) / (beard.chin - beard.mouth);
  return {
    x: face.x - 515 * scaleX,
    y: face.mouth - beard.mouth * scaleY,
    width: 1024 * scaleX,
    height: beard.bottom * scaleY,
    sourceHeight: beard.bottom,
  };
}
