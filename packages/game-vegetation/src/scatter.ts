import type { Placement } from './types'
import { Rng, hashMix, toSeed } from './rng'
import { TAU, clamp } from './math'

export type Point2 = [number, number]
/** `rect.x` / `rect.z` is the minimum corner; `w` runs along x and `d` along z. */
export type Region = { polygon: Point2[] } | { rect: { x: number; z: number; w: number; d: number } }

export interface ScatterRule {
  /** species id, a list (uniform pick) or weighted ids */
  species: string | string[] | { id: string; weight: number }[]
  /** plants per square meter */
  density: number
  /** minimum distance between plants of this rule, meters */
  minDistance: number
  /** areas where this rule must not place anything (paths, house footprint, ...) */
  exclude?: Region[]
  /** `edge` hugs the boundary (hedges, flowerbeds against walls), `center` avoids it */
  prefer?: 'edge' | 'center' | 'any'
  /** how fast the edge preference falls off with distance from the boundary (meters, default max(0.4, 0.8 * minDistance)) */
  edgeWidth?: number
  /** random scale range (default [1, 1]) */
  scale?: [number, number]
  /** random rotation about y: true = full circle (default), false = none, or [min, max] radians */
  rotate?: boolean | [number, number]
  /** cap on the number of placements of this rule */
  maxCount?: number
}

export interface ScatterOptions {
  seed: number | string
  /** exclusions applied to every rule */
  exclude?: Region[]
}

export function regionPolygon(r: Region): Point2[] {
  if ('polygon' in r) return r.polygon
  const { x, z, w, d } = r.rect
  return [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]
}

export function pointInPolygon(x: number, z: number, poly: Point2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function polygonArea(poly: Point2[]): number {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1])
  return Math.abs(a) / 2
}

/** Distance from a point to the boundary of a polygon. */
export function distanceToBoundary(x: number, z: number, poly: Point2[]): number {
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j]
    const [bx, bz] = poly[i]
    const dx = bx - ax
    const dz = bz - az
    const l2 = dx * dx + dz * dz
    const t = l2 === 0 ? 0 : clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1)
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t))
    if (d < best) best = d
  }
  return best
}

function pickSpecies(rule: ScatterRule, rng: Rng): string {
  const s = rule.species
  if (typeof s === 'string') return s
  if (s.length === 0) throw new Error('game-vegetation: scatter rule has no species')
  if (typeof s[0] === 'string') return rng.pick(s as string[])
  const w = s as { id: string; weight: number }[]
  const total = w.reduce((a, b) => a + b.weight, 0)
  let r = rng.next() * total
  for (const it of w) {
    r -= it.weight
    if (r <= 0) return it.id
  }
  return w[w.length - 1].id
}

/**
 * Poisson-disc style placement (dart throwing with a spatial hash) inside a polygon or rectangle.
 * Deterministic for a given seed. Rules are processed in order, so earlier rules keep their spots.
 */
export function scatter(area: Region, rules: ScatterRule[], opts: ScatterOptions): Placement[] {
  const poly = regionPolygon(area)
  const seed = toSeed(opts.seed)
  const area2 = polygonArea(poly)
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const [x, z] of poly) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  const globalEx = (opts.exclude ?? []).map(regionPolygon)
  const cell = Math.max(0.05, ...rules.map((r) => r.minDistance))
  const grid = new Map<string, { x: number; z: number; md: number }[]>()
  const key = (cx: number, cz: number): string => cx + ',' + cz
  const out: Placement[] = []
  const inradius = Math.max(0.5, Math.sqrt(area2) * 0.5)
  rules.forEach((rule, ri) => {
    const rng = new Rng(hashMix(seed, ri + 1))
    const ex = [...globalEx, ...(rule.exclude ?? []).map(regionPolygon)]
    let target = Math.round(area2 * rule.density)
    if (rule.maxCount !== undefined) target = Math.min(target, rule.maxCount)
    const prefer = rule.prefer ?? 'any'
    const edgeW = rule.edgeWidth ?? Math.max(0.4, rule.minDistance * 0.8)
    const sc = rule.scale ?? [1, 1]
    let placed = 0
    const attempts = target * 60 + 300
    for (let a = 0; a < attempts && placed < target; a++) {
      const x = rng.range(minX, maxX)
      const z = rng.range(minZ, maxZ)
      const accept = rng.next()
      const spec = pickSpecies(rule, rng)
      const sd = rng.seed()
      const ry = rule.rotate === false ? 0 : Array.isArray(rule.rotate) ? rng.range(rule.rotate[0], rule.rotate[1]) : rng.range(0, TAU)
      const scale = rng.range(sc[0], sc[1])
      if (!pointInPolygon(x, z, poly)) continue
      let blocked = false
      for (const e of ex) {
        if (pointInPolygon(x, z, e)) {
          blocked = true
          break
        }
      }
      if (blocked) continue
      if (prefer !== 'any') {
        const d = distanceToBoundary(x, z, poly)
        const p = prefer === 'edge' ? Math.max(0.02, Math.exp(-d / edgeW)) : Math.max(0.05, clamp(d / inradius, 0, 1))
        if (accept > p) continue
      }
      const cx = Math.floor(x / cell)
      const cz = Math.floor(z / cell)
      let ok = true
      for (let ix = cx - 2; ix <= cx + 2 && ok; ix++) {
        for (let iz = cz - 2; iz <= cz + 2 && ok; iz++) {
          const items = grid.get(key(ix, iz))
          if (!items) continue
          for (const it of items) {
            const need = (it.md + rule.minDistance) / 2
            if ((it.x - x) ** 2 + (it.z - z) ** 2 < need * need) {
              ok = false
              break
            }
          }
        }
      }
      if (!ok) continue
      const k = key(cx, cz)
      const list = grid.get(k)
      if (list) list.push({ x, z, md: rule.minDistance })
      else grid.set(k, [{ x, z, md: rule.minDistance }])
      out.push({ species: spec, x, z, ry, scale, seed: sd })
      placed++
    }
  })
  return out
}
