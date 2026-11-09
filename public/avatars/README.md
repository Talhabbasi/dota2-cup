# Avatar rendering — current implementation

The live editor, PlayerAvatar, and PNG exports now use `src/lib/avatar/portrait.ts` through `avatar-canvas.tsx`. This is a new layered vector illustration, rasterized at the requested export size. The illustrated style intentionally replaces the damaged painted assets below.

Hair (back/front), skin, clothing, facial features, and beard are separate shapes on one 512-unit coordinate system. Hair changes do not change face geometry. Each color controls its own region; there is no color-threshold segmentation or transparent-shirt repair. User configuration and saved hairstyle IDs remain compatible.

The PNGs in this folder, `recolor.ts`, and `beard-placement.ts` are retained as legacy work, but are not used by the live renderer. The catalog in `manifest.ts` still supplies option IDs/labels to the editor and profile validation. Its PNG layer resolver is legacy only.

Verification: `node --import tsx --test tests/avatar-rendering.test.ts` and `npx playwright test tests/e2e/avatar.spec.ts`. Tests check opaque torso coverage, independent coloring, consistent beard geometry, the reported white-hair/purple-beard/blue-shirt combination, and actual PNG export dimensions/transparency.

## Historical asset notes (superseded)

# Layered esports avatars

Concept sheet used as the **visual standard** only. It is not a production sprite sheet.

## Phase 3 (shipped)

Transparent PNG layers on a shared 1024×1024 canvas:

- Male bases: `short`, `spiky`, `undercut` (face + hair + default tee)
- Female bases: `long-wavy`, `bob`, `ponytail`
- Male beards: `stubble`, `full`, `goatee` (overlay)
- Clothing overlays: `hoodie`, `jersey` (t-shirt is baked into each base)
- Skin / hair / beard / clothing recolor via canvas (shading preserved)

See `manifest.json` for ids, z-order, and anchors.

## Not production-ready yet

Full catalogs (extra hairstyles, face parts, accessories, jackets) are listed in code catalogs but stay hidden until aligned transparent assets exist.
