import type { ObjectSpec, Vec3 } from '@adatechnology/game-interactables'
import { createHousehold, createRecorder, cornersOf, type Household, type HouseholdItem, type HouseholdRecorder } from '../src'
import type { Primitive } from '@adatechnology/game-props3d'

export const SEEDS = [1, 7, 'seed-c']
export const REGIONS = ['br', 'us']

const cache = new Map<string, Household>()
export function pack(region = 'br', locale = 'en'): Household {
  const k = `${region}/${locale}`
  let h = cache.get(k)
  if (!h) {
    h = createHousehold({ region, locale })
    cache.set(k, h)
  }
  return h
}

export interface Built {
  spec: ObjectSpec
  rec: HouseholdRecorder
  item: HouseholdItem
  dims: { w: number; d: number; h: number; y0: number }
}

export function build(type: string, item: HouseholdItem = {}, region = 'br'): Built {
  const hh = pack(region)
  const def = hh.types.find((t) => t.id === type)!
  const rec = createRecorder()
  const spec = hh.build(type, item, rec.api)
  return { spec, rec, item, dims: { w: item.w ?? def.w, d: item.d ?? def.d, h: item.h ?? def.h, y0: item.y ?? def.y } }
}

/** Corners of every static primitive and every closed-part primitive, in object-local coordinates. */
export function closedPoints(b: Built): Vec3[] {
  const out: Vec3[] = []
  for (const p of b.rec.primitives) out.push(...cornersOf(p))
  for (const part of Object.values(b.rec.parts)) {
    for (const p of part.primitives) for (const c of cornersOf(p)) out.push([c[0] + part.pivot[0], c[1] + part.pivot[1], c[2] + part.pivot[2]])
  }
  return out
}

export function partPoints(b: Built, id: string): Vec3[] {
  const part = b.rec.parts[id]
  const out: Vec3[] = []
  for (const p of part.primitives) for (const c of cornersOf(p)) out.push([c[0] + part.pivot[0], c[1] + part.pivot[1], c[2] + part.pivot[2]])
  return out
}

/** A primitive placed in object-local coordinates (part primitives get the pivot added). */
export function localPrims(b: Built, partId?: string): Primitive[] {
  if (!partId) return b.rec.primitives
  const part = b.rec.parts[partId]
  return part.primitives.map((p) => ({ ...p, x: p.x + part.pivot[0], y: p.y + part.pivot[1], z: p.z + part.pivot[2] }) as Primitive)
}

export function boxes(prims: Primitive[]): Array<Extract<Primitive, { kind: 'box' }>> {
  return prims.filter((p): p is Extract<Primitive, { kind: 'box' }> => p.kind === 'box')
}

export function bbox(points: Vec3[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const p of points) for (let i = 0; i < 3; i++) {
    if (p[i] < min[i]) min[i] = p[i]
    if (p[i] > max[i]) max[i] = p[i]
  }
  return { min, max }
}
