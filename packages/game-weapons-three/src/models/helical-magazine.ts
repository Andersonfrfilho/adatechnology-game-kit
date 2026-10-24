import type { RifleContext } from './rifle-context'

const PI = Math.PI
const LENGTH = 0.26
const RADIUS = 0.026
const TURNS = 11

/** The helical magazine of the PP-19 Bizon: a drum along the barrel, under it, with the ridge of the helix drawn as slanted bands. Returns the x of its middle. */
export function buildHelicalMagazine(context: RifleContext): number {
  const { kit, group, parts, receiverEnd, barrelY, barrelRadius } = context
  const { M, cylinderX, box } = kit
  const x = receiverEnd + LENGTH / 2 + 0.02
  const y = barrelY - barrelRadius - RADIUS - 0.012
  const magazine = kit.pivot(group, x, y, 0)
  parts.mag = magazine
  cylinderX(magazine, RADIUS, LENGTH, M.dark, 0, 0, 0, 20)
  cylinderX(magazine, RADIUS * 1.06, 0.01, M.metal, -LENGTH / 2, 0, 0, 20)
  cylinderX(magazine, RADIUS * 1.06, 0.01, M.metal, LENGTH / 2, 0, 0, 20)
  for (let i = 0; i < TURNS; i++) box(magazine, 0.012, RADIUS * 2.15, 0.014, M.metal, -LENGTH / 2 + ((i + 0.5) * LENGTH) / TURNS, 0, 0, 0, 0, (i * PI) / 4)
  box(magazine, 0.05, 0.03, 0.03, M.dark, -LENGTH / 2 - 0.02, RADIUS * 0.4, 0)
  parts.magDrop = 0.16
  return x
}
