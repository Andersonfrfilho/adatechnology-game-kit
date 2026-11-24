import { REFERENCE_HEIGHT_METRES } from '@adatechnology/game-characters'

/**
 * Unnormalised skull-top height of the Bestiário v17 and Retratos do Vale literal ports (metres):
 * head sphere centre `y = 1.80` + radius `0.165 × 1.1` = `1.9815 m` (measured `1.979–1.982 m` at `s = 1` in Spec 012 T0.1).
 */
export const RICH_PORT_SKULL_TOP_METRES = 1.8 + 0.165 * 1.1

/** Uniform normalisation factor applied to the Bestiário v17 and Retratos do Vale root rigs so factor 1 measures `REFERENCE_HEIGHT_METRES` (1.80 m). */
export const RICH_HEIGHT_NORM = REFERENCE_HEIGHT_METRES / RICH_PORT_SKULL_TOP_METRES

/**
 * Unnormalised skull-top height of the instanced crowd body literal port (`G 65367`, metres):
 * head sphere centre `y = 1.67` + radius `0.13 × 1.1` = `1.813 m` (measured `1.813 m` in Spec 012 T0.1).
 */
export const INSTANCED_PORT_SKULL_TOP_METRES = 1.67 + 0.13 * 1.1

/** Uniform normalisation factor applied to the instanced crowd body geometry so `heightMetres = 1.80` measures `1.80 m` at the skull top. */
export const INSTANCED_HEIGHT_NORM = REFERENCE_HEIGHT_METRES / INSTANCED_PORT_SKULL_TOP_METRES

/**
 * Unnormalised source frame of `person-kit` hats and extras (Retratos do Vale literal port coordinates),
 * used by `instanced/accessory.ts` to convert each accessory into a unit frame before fitting it to any baked body's measured bone bounds.
 */
export const PORT_ACCESSORY_REFERENCE = {
  head: { center: [0, REFERENCE_HEIGHT_METRES, 0] as const, height: 2 * 0.165 * 1.1, pivot: [0, 1.64, 0] as const },
  torso: { center: [0, 1.23, 0] as const, height: 0.74, pivot: [0, 0.9, 0] as const },
} as const

export type PortDeviation = {
  readonly id: string
  readonly target: 'best-builder' | 'person-builder' | 'body-geometry'
  readonly reason: string
  readonly decisionDate: string
  readonly factor?: number
}

/**
 * Recorded deviations from the literal team ports (Bestiário v17, Retratos do Vale, G 65367).
 * Each entry documents why the output differs from the raw team HTML page (Spec 012 D3 & CLAUDE.md §1/§13).
 */
export const PORT_DEVIATIONS: readonly PortDeviation[] = [
  {
    id: 'spec-012-best-height-norm',
    target: 'best-builder',
    reason: 'Normalise root scale so skull top matches declared heightMetres (±1 cm) without rewriting literal port coordinates.',
    decisionDate: '2026-11-19',
    factor: RICH_HEIGHT_NORM,
  },
  {
    id: 'spec-012-person-height-norm',
    target: 'person-builder',
    reason: 'Normalise survivor fig.scale so skull top matches declared heightMetres (±1 cm) without rewriting literal port coordinates.',
    decisionDate: '2026-11-19',
    factor: RICH_HEIGHT_NORM,
  },
  {
    id: 'spec-012-instanced-height-norm',
    target: 'body-geometry',
    reason: 'Normalise instanced crowd body vertices and joint pivots so skull top matches body.heightMetres (±1 cm).',
    decisionDate: '2026-11-19',
    factor: INSTANCED_HEIGHT_NORM,
  },
  {
    id: 'cl-13-bloater-z-fighting',
    target: 'best-builder',
    reason: 'CLAUDE.md §13: offset one bloater leg by 3 mm and extend neck by 4 mm to remove coincident faces.',
    decisionDate: '2026-11-12',
  },
] as const
