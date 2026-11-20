import { describeHouseSweep } from './helpers/z-fighting-sweep'

/**
 * Every template the engine lists, at every construction level 0 to 8 and the seeds of the plan tests, drawn whole (structure, roof, gutters, downpipes,
 * installations, interactables, terrain, spoil mounds, trenches, pits and wall chases) and walked through the near-coplanar detector of `game-shapes`
 * (depth-buffer precision of the game camera at 30 m, about 1.07 mm). Every conflict is listed, by template and pair of parts, with where it is.
 * The houses draw none: any conflict fails, whatever pair it is. Seed 1 (and the frameless windows) is this file; seeds 2 and 3 are
 * `z-fighting-houses-seed-2.test.ts` and `-seed-3.test.ts`, so the three run in parallel workers.
 *   ZFIGHT_TEMPLATES=a,b   only these templates (the pre-commit's run, `tools/z-fighting/houses.mjs`)
 *   ZFIGHT_SEEDS=1         only these seeds (the same)
 *   ZFIGHT_DUMP=<file>     writes every conflict found, one line each, and the count of each pair (`<file>.json`)
 */
describeHouseSweep([1], { hasFramelessCheck: true })
