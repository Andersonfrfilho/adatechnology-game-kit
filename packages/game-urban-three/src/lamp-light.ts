import type { LightPart } from '@adatechnology/game-urban'

/**
 * The beat of a failing lamp, the page's formula: dim to `dim` while `sin(t·fast + phase) > fastAbove` or `sin(t·slow + phase) > slowAbove`. The phase comes from the part
 * (`flickerPhase`), rounded to one of `groups` steps so the lenses of a scene share `groups` materials per colour.
 */
export const LAMP_FLICKER = { dim: 0.15, fast: 23, slow: 3.1, fastAbove: 0.3, slowAbove: 0.85, groups: 4 } as const

const TURN = 2 * Math.PI

/** The step of `LAMP_FLICKER.groups` a phase falls in, 0 to groups - 1. */
export const flickerGroupOf = (phase: number): number => Math.floor((((phase % TURN) + TURN) % TURN) / TURN * LAMP_FLICKER.groups) % LAMP_FLICKER.groups

/** The phase of a group: what the lens and the light of every lamp of that group flicker on. */
export const flickerGroupPhase = (group: number): number => (group / LAMP_FLICKER.groups) * TURN

/** How bright a failing lamp is at time `t` (seconds of the frame's present time), 1 or `LAMP_FLICKER.dim`. */
export const flickerLevel = (t: number, phase: number): number =>
  Math.sin(t * LAMP_FLICKER.fast + phase) > LAMP_FLICKER.fastAbove || Math.sin(t * LAMP_FLICKER.slow + phase) > LAMP_FLICKER.slowAbove ? LAMP_FLICKER.dim : 1

/**
 * The team's lamps were tuned on three.js r128 without physically correct lights: the light reached the ground as `intensity · (1 − d / distance)^decay`, with no inverse square and a
 * diffuse term without the 1/π. Today's renderer (r155+) lights by `intensity / d^decay · (1 − (d / distance)^4)^2` and a Lambert of albedo/π, so the same numbers light almost nothing
 * (a 1.3 sodium lamp 7 m up gave the street ~0.5 and now gives ~0.01). This is the intensity that lights the ground at `reference` metres exactly as the page did (default the foot of the lamp, d = its height `y`; a searchlight passes the length of its beam to where it lands);
 * nearer it is brighter and farther it falls off faster than the page, as a real lamp does.
 */
export function physicalIntensityOf(part: Pick<LightPart, 'intensity' | 'distance' | 'decay' | 'y'>, reference: number = part.y): number {
  const foot = Math.max(reference, 0.5)
  const legacyFalloff = part.distance > 0 ? Math.max(0, 1 - foot / part.distance) ** part.decay : 1
  const window = part.distance > 0 ? Math.max(1e-6, 1 - (foot / part.distance) ** 4) ** 2 : 1
  return (part.intensity * Math.PI * legacyFalloff * foot ** part.decay) / window
}
