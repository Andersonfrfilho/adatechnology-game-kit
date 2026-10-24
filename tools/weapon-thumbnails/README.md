# weapon-thumbnails

Writes the weapon thumbnails of `@adatechnology/game-weapons-three` into `packages/game-weapons-three/assets/weapon-svg/`.

```bash
pnpm --filter @adatechnology/weapon-thumbnails-tool build
node tools/weapon-thumbnails/dist/cli.js generate   # generated/<id>.svg for every weapon + manifest.json + CREDITS.md
node tools/weapon-thumbnails/dist/cli.js manifest   # only the manifest and credits (after adding or removing files in commons/)
```

## Generated silhouettes

For each weapon of the arsenal (but the body actions) and each explosive that stands in the world: build the model (`buildWeaponModelById`, the borrowed archetype model, or the box prop
the counters show; props lie flat, so they are seen from above), project it orthographically on the side plane with a software z-buffer, and trace the outline.

- 800x200 viewBox (4:1), 12 units of padding, `fill="currentColor"`, one lighter path (everything, `fill-opacity=".6"`: steel and the like) under one solid path (polymer, wood, paint).
- Tracing: cell edges with the filled side on the right (a right turn at the corners where two cells only touch), then Douglas-Peucker. No geometry dependency.
- Deterministic: same bytes every run (`tests/silhouette.test.ts` compares with the committed files). Each file is limited to 12 KB (about 2 KB in practice).

Every weapon keeps its generated file, including the ones that have a Commons file: those generated files are not referenced by the manifest, they are the fallback the weapon goes back to when its Commons file is removed (see `LICENSE-NOTE.md`).

## Wikimedia Commons

`scripts/` is the record of how the `commons/` files were chosen. Run from a scratch work folder, never inside the asset folder:

| Script | What |
|---|---|
| `commons-search.mjs <work>` | searches Commons per weapon (at most 3 searches, 0.55 s apart, descriptive User-Agent), keeps `image/svg+xml` with Public domain, CC0, CC BY or CC BY-SA, writes `search/<id>.json` after each weapon and the raw files in `raw/` |
| `commons-sheet.mjs <work> <png> <first> <count>` | contact sheet of the candidates, to choose by eye the side profile of that exact model |
| `commons-import.mjs <work>` | for each weapon in `<work>/picks.json`: sanitizes the download, draws it in Chromium (as an `<img>`: no script, no network), reduces it to tones, traces it with the same tracer and writes `commons/<id>.svg` and `commons-sources.json` |

Downloads are untrusted: the markup of a download is never published, only the traced outline (two paths). The licence of the original still applies to the traced file (see `LICENSE-NOTE.md`).
