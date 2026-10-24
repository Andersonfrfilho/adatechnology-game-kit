import paintData from './data/paint.json'
import { military } from './groups'
import type { FleetGroupId } from './groups'

/** `[hex, weight]` pairs: a weighted colour table. */
export type PaintPalette = ReadonlyArray<readonly [string, number]>

/** The two palettes of the team: realistic civilian colours (13) and military greens and sands (5). Data in `data/paint.json`. */
export const paintPalettes: { readonly civil: PaintPalette; readonly military: PaintPalette } = {
  civil: paintData.civil as unknown as PaintPalette,
  military: paintData.military as unknown as PaintPalette,
}

const militaryIds: ReadonlySet<string> = new Set(military)

/** The palette a vehicle is painted from: military vehicles take the military one. */
export const paletteOf = (group: FleetGroupId | string): PaintPalette => (militaryIds.has(group) || group === 'military' ? paintPalettes.military : paintPalettes.civil)

const mulberry = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hashString = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * A colour picked from a weighted palette by a seed (a number or any string): the same seed gives the same colour, on every machine.
 * Port of `corDaSemente` (frota-leve.js 14177-14186).
 */
export const colorFromSeed = (seed: number | string, palette: PaintPalette = paintPalettes.civil): string => {
  const value = typeof seed === 'number' ? seed | 0 : hashString(String(seed))
  const random = mulberry(value ^ 0x9e3779b9)
  random()
  random()
  let total = 0
  for (const entry of palette) total += entry[1]
  let x = random() * total
  for (const entry of palette) {
    x -= entry[1]
    if (x < 0) return entry[0]
  }
  return (palette[0] as readonly [string, number])[0]
}
