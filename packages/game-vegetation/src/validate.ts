import { GENERATORS } from './generate'

const ENUMS: Record<string, readonly string[]> = {
  crownShape: ['round', 'spreading', 'columnar', 'weeping'],
  leafShape: ['clump', 'sparse'],
  crownStyle: ['dome', 'lumpy', 'cloud', 'sphere', 'umbrella', 'willow', 'sparse_high'],
  variant: ['coconut', 'royal', 'fan', 'areca', 'date'],
  shape: ['cone', 'candelabra', 'round', 'hedge', 'loose', 'terracotta', 'cylinder', 'square', 'cachepot'],
  flowerType: ['daisy', 'rose', 'tulip', 'sunflower', 'hibiscus', 'cluster', 'lily', 'bird_of_paradise', 'pompom', 'hydrangea'],
  form: ['agave', 'sword', 'aloe', 'echeveria'],
  armStyle: ['candelabra', 'saguaro', 'sprawl'],
  style: ['dots', 'clusters', 'hibiscus', 'bell', 'bract', 'passion'],
}
const POSITIVE = [
  'height', 'trunkRadius', 'crownRadius', 'radius', 'length', 'width', 'frondLength', 'padSize', 'leafSize', 'flowerSize', 'size', 'tiers', 'ribs', 'branchLevels',
  'clumpSize', 'frondCount', 'leafCount', 'stemCount', 'stems', 'generations', 'count',
]
const SEASONS = ['spring', 'summer', 'autumn', 'winter']

function isColor(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffff
}

/**
 * Validate a plant spec. Returns a list of problems (empty when valid). It checks the archetype, numeric ranges, enum values,
 * color integers (0xRRGGBB) and nested specs (potted).
 */
export function validateSpec(spec: unknown, path = 'spec'): string[] {
  const errors: string[] = []
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) return [`${path}: must be an object`]
  const obj = spec as Record<string, unknown>
  if (typeof obj.archetype !== 'string' || !(obj.archetype in GENERATORS)) {
    errors.push(`${path}.archetype: unknown archetype "${String(obj.archetype)}"`)
    return errors
  }
  const walk = (o: Record<string, unknown>, p: string): void => {
    for (const [k, v] of Object.entries(o)) {
      const here = `${p}.${k}`
      if (k === 'plant') {
        errors.push(...validateSpec(v, here))
        continue
      }
      if (v === null || v === undefined) continue
      if (/colou?rs?$/i.test(k) && k !== 'colors' && !Array.isArray(v) && typeof v !== 'object') {
        if (!isColor(v)) errors.push(`${here}: must be an integer color 0..0xffffff`)
      } else if (k === 'colors' || k === 'leafColor' || k === 'petalColors') {
        if (Array.isArray(v)) {
          if (v.length === 0) errors.push(`${here}: must not be empty`)
          v.forEach((c, i) => {
            if (!isColor(c)) errors.push(`${here}[${i}]: must be an integer color 0..0xffffff`)
          })
        } else if (k !== 'colors' && !isColor(v)) errors.push(`${here}: must be a color or an array of colors`)
      } else if (k === 'seasons') {
        if (!Array.isArray(v) || v.some((s) => !SEASONS.includes(s as string))) errors.push(`${here}: must be a list of seasons`)
      } else if (k === 'arms') {
        if (!(typeof v === 'number' || (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number')))) errors.push(`${here}: must be a number or [min, max]`)
      } else if (k === 'host') {
        const h = v as Record<string, unknown>
        if (!('path' in h) && !('wall' in h)) errors.push(`${here}: needs path or wall`)
      } else if (k in ENUMS) {
        if (typeof v === 'string' && !ENUMS[k].includes(v)) errors.push(`${here}: "${v}" is not one of ${ENUMS[k].join(', ')}`)
      } else if (POSITIVE.includes(k)) {
        if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) errors.push(`${here}: must be a positive number`)
      }
      if (typeof v === 'object' && !Array.isArray(v) && k !== 'host') walk(v as Record<string, unknown>, here)
    }
  }
  walk(obj, path)
  return errors
}
