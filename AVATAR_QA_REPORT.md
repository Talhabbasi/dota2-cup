# Avatar maker QA report

Target: `http://127.0.0.1:3000/dev/avatar`

Date: 2026-11-09

Dev server was already running (`npm run dev` on port 3000). The page was opened in the browser, clicked through, and covered by Playwright.

## Results

| Suite | Result |
|---|---|
| Playwright `tests/e2e/avatar.spec.ts` | **10 passed**, 0 failed (final run) |
| `npx tsc --noEmit` | Passed |
| `npx eslint` on avatar files touched in this pass | Passed |
| Existing unit tests (`tests/*.ts`, auction integration) | Not run. They do not cover the avatar maker and need a database. |
| `npm run build` | Not run in this pass. Production prerender needs the Neon database. |

## Issue log

| Issue | Severity | Reproduction | Root Cause | Fix | Verification |
|---|---|---|---|---|---|
| Dark skin swatches crushed the whole portrait | P1 | Body → darkest swatch. Hair and shirt lost their lighting and the face became a silhouette. | Recolor multiplied every channel by the dark swatch. | Skin now shifts hue and undertone and keeps the painted lightness. | Browser pixel sample: hair brightness barely moved between light and dark skin. Playwright: light face average is more than 40 above the darkest swatch, and the dark face stays above 40. |
| Clothing color did not change the shirt | P1 | Clothes → red or blue. The torso stayed black. | Background removal deleted the black tee, so the “shirt” was the page background showing through a transparent hole. | `fillInteriorShirt` paints that interior gap and the remaining dark fabric with the selected clothing color. | Playwright samples opaque torso pixels: red shirt is redder than blue, blue shirt is bluer than red. Live page showed a red shirt after selecting `#C62828`. |
| `?tone=` did nothing | P2 | Open `/dev/avatar?tone=1`. | The dev page ignored the query. | Valid index `0–9` selects that skin tone once after mount. Missing or non-numeric values keep the default (`#D4A574`). | Playwright: `tone=1` activates `#E8C4A2`; `tone=nope` and a bare URL activate `#D4A574`. |
| Beard stayed warm brown when a dark or blue color was chosen | P1 | Beard → full → dark or blue. | Near-black beard colors were skipped, leaving the baked brown asset. | Beard layer is always tinted. | Playwright stores `beardStyle: "full"` then `none` after Clean-shaven. |
| Jersey and hoodie options drew broken fragments | P1 | Clothes → jersey or hoodie. | `shared/jersey.png` is two floating red patches. `shared/hoodie.png` does not match the shoulders. | Both stay hidden. Only T-shirt is selectable. Saved configs that still say hoodie/jersey are coerced back to `tshirt`. | Playwright expects no hoodie or jersey option. |
| Separate hair PNGs cannot be layered | P1 | Not exposed in the UI. | `public/avatars/male/hair/*.png` and female hair files include the wrong silhouette and do not align on the bald body. | Hairstyles stay baked into `*/base/*.png`. The loose hair files are unused. | Playwright switches Short, Spiky, Undercut, Long wavy, Bob, Ponytail and checks the active option. Alignment is the baked portrait, not a separate overlay. |
| No glasses, hats, caps, or headphones | P1 artwork | Look for an accessories tab. | No production assets exist. | Not invented. UI does not offer them. | Playwright asserts no Glasses or Accessories tab. |
| Stubble ran down the neck | P2 | Beard → stubble. | `stubble.png` alpha extended to y=649. | Alpha cleared below y=545. | Asset bounds checked in a script. Not re-screenshot after the crop in the final pass. |
| Export looked opaque | P2 | Export 512. | Canvas pixels outside the character were already transparent; the dark look was the CSS background. | No pixel change. Download still uses the canvas PNG. | Playwright waits for the download (`mm-avatar-…-512.png`) and checks the preview corner alpha is 0. |
| Refresh dropped the avatar | P2 | Change hair, reload `/dev/avatar`. | The dev page never read `localStorage`. | After mount, a valid `?tone=` wins; otherwise `mm_avatar_config` is restored. | Playwright sets Short, reloads, reads `hairStyle: "short"`, randomizes, resets male to spiky / clean-shaven / t-shirt. |
| Gender switch or repeat clicks blanked the canvas | P1 | Male ↔ Female several times. | Not reproduced on the current bases. | — | Playwright toggles male → female → male and checks Beard enables again. |
| Horizontal scroll on small screens | P2 | 320×640 through 1440×900. | Controls already wrap. | — | Playwright checks `scrollWidth` against `clientWidth` at 1440×900, 1280×800, 768×1024, 390×844, and 320×640. |
| Profile “Save avatar” in this browser session | — | Needs a signed-in profile. | Save on `/profile` posts `avatarConfig` JSON. The dev page persists locally and does not write the database. | Not changed. | Not verified while signed out. |

## What was actually executed

Browser (manual, `http://127.0.0.1:3000/dev/avatar`):

- Page load, canvas present, no avatar-asset 404s observed in the checks that ran.
- All 10 skin swatches. Darkest face stayed readable; hair lighting stayed in the same band.
- Male Short / Spiky / Undercut and blue hair recolor.
- Female Long wavy / Bob / Ponytail. Beard tab disabled for female.
- Stubble, full, goatee, clean-shaven.
- T-shirt red and blue. Red torso sample was about rgb(110, 22, 22) before the seam repaint.
- Randomize, Reset, localStorage.
- Viewports used by Playwright, plus the in-app browser around 1440×900 and a narrow layout.

Playwright (final, 10 passed):

1. Page render, male selected, no `pageerror`, no `/avatars/` response ≥ 400
2. `tone=1`, `tone=nope`, missing tone
3. Light vs darkest skin
4. Male and female hairstyles and repeat gender toggle
5. Full beard and clean-shaven
6. Red vs blue shirt pixels; hoodie/jersey absent
7. Reload persistence, randomize, reset
8. Export 512 download and transparent corner
9. No accessory tabs
10. No horizontal overflow at five viewports

An earlier Playwright run also passed 10/10 before a bad boot rewrite. That rewrite was reverted. The final run above is the one that counts.

## Fixed in this pass

- Skin recolor no longer dims hair and clothes.
- Shirt hole is filled so clothing colors are real pixels.
- Dev page honors `?tone=` and restores localStorage.
- Beard tint is not skipped.
- Broken hoodie/jersey choices stay hidden.
- Stubble alpha cropped at the chin.
- Stable `data-testid` hooks for the maker.
- `renderAvatarToCanvas` size parameter typed as `number` so 512 and 1024 exports typecheck.

## Still open

These are missing or unsuitable artwork. They are not marked fixed.

- Glasses, hats, caps, headphones. Need separate transparent PNGs aligned to the 1024 canvas.
- Hoodie and jersey. Current files are fragments and must not be turned on.
- Loose hair overlays (`public/avatars/*/hair/*.png`). They do not match the bases. Hairstyles today are full portraits, not front/back layers.
- The repaired tee is a flat color fill inside the body silhouette. It does not have collar stitching or fabric folds from a real clothing layer. A shoulder-aligned shirt PNG would replace the fill.
- Concept sheets are not individual layers. Cropping them does not produce aligned parts.
- Signed-in profile save was not exercised.

## Assets checked

| Path | Finding |
|---|---|
| `male/base/{short,spiky,undercut}.png` | Transparent PNG portraits. Black tee center was transparent. |
| `female/base/{long-wavy,bob,ponytail}.png` | Same class of portrait. |
| `shared/tshirt.png` | Small misaligned shirt. Not used as the live layer. |
| `shared/jersey.png` | Two red shoulder scraps. Hidden. |
| `shared/hoodie.png` | Does not sit on the shoulders. Hidden. |
| `male/beard/{full,goatee,stubble}.png` | Transparent beard strokes. Stubble was too tall; cropped. |
| `*/hair/*.png` | Not production layers. Unused. |

## Files modified

- `src/lib/avatar/recolor.ts`
- `src/lib/avatar/manifest.ts`
- `src/lib/avatar/defaults.ts`
- `src/components/avatar/avatar-canvas.tsx`
- `src/components/avatar/avatar-maker.tsx`
- `src/app/dev/avatar/page.tsx`
- `public/avatars/male/beard/stubble.png`
- `public/avatars/male/base/*.png` and `public/avatars/female/base/*.png` (intermediate fill was reverted to the transparent-hole originals; spiky was restored from the pre-edit copy)
- `playwright.config.ts`
- `tests/e2e/avatar.spec.ts`
- `package.json` / `package-lock.json` (`@playwright/test`)

## Screenshots

Captured in the browser session while the page was open, including the default male portrait, a red shirt, light and dark skin, and the clothes tab. They were not copied into the repo.
