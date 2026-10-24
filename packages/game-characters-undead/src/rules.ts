/**
 * The numbers of the undead engine that are rules rather than catalog data. Every one is an option of `createUndead({ rules })`: a game changes them
 * without touching the engine. The source of each is the game's `jogo.js` (G) at the line named.
 */
export type UndeadRules = {
  /** The oldest age a type may spawn with (the runner: G 66752 `Math.min(ai, 1)`). */
  readonly ageLimit: Readonly<Record<string, string>>
  /** Where a body starts for a type that does not start upright (G 66771 `zSpecialSpawn`). */
  readonly specialSpawn: Readonly<Record<string, { readonly posture: 'playingDead' | 'submerged'; readonly chance: number; readonly color?: number; readonly skin?: number }>>
  /** Fixed look of a type (the charred are black: G 67260). */
  readonly fixedLook: Readonly<Record<string, { readonly color: number; readonly skin: number }>>
  /** Cloth colours of a civilian zombie (G 66744 `CIVIL_COR`). */
  readonly civilianColors: readonly number[]
  /** Seconds a heavy hit stuns: 0.45, or 0.25 for the brute (G 67059). */
  readonly stunSeconds: { readonly default: number; readonly byType: Readonly<Record<string, number>> }
  /** Build factor of a type that has a `scale` and no `build` (G 66761: `C.porte || (C.escala ? 1.3 : 1)`). */
  readonly scaledBuild: number
  /** A bloater's burst (G 67053 `inchadoBurst`): the cloud and its colour; the radii come from the type's abilities. */
  readonly burst: { readonly cloudColor: number; readonly cloudSeconds: number; }
}

export const DEFAULT_UNDEAD_RULES: UndeadRules = {
  ageLimit: { runner: 'recent' },
  specialSpawn: {
    stalker: { posture: 'playingDead', chance: 0.7 },
    drowned: { posture: 'submerged', chance: 1, color: 0x3a4a52 },
  },
  fixedLook: { charred: { color: 0x1a1410, skin: 1 } },
  civilianColors: [0x6d5a4a, 0x4d5d6b, 0x7a3b33, 0x5b6b4a, 0x8a7a5a, 0x3e4a5c, 0x6a4a6a, 0x9a8a70, 0x40403a],
  stunSeconds: { default: 0.45, byType: { brute: 0.25 } },
  scaledBuild: 1.3,
  burst: { cloudColor: 0x8a9a2a, cloudSeconds: 8 },
}

/** Speeds a type has besides the ones its data lists, per type (G 67357 `zChaseSpeed`: the stalker creeps at 1.4 until it pounces). */
export const DEFAULT_SPEED_OVERRIDES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  stalker: { stalk: 1.4 },
}
