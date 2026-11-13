import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

interface PlanWall { readonly u0: number; readonly v0: number; readonly u1: number; readonly v1: number; readonly axis: 'u' | 'v'; readonly thickness?: number; readonly exterior?: boolean; readonly floor: number; readonly type?: string }
interface Outbuilding { readonly aabb: readonly number[]; readonly walls: readonly Omit<PlanWall, 'floor'>[] }
interface Plan { readonly walls: readonly PlanWall[]; readonly floors: readonly { readonly y0: number; readonly ceiling: number }[]; readonly outbuildings?: readonly Outbuilding[] }
/** A wall and the middle of the building it closes (its inside is towards it). */
interface Host extends PlanWall { readonly centre: readonly [number, number] }

/** How far a run may stand off the brick face it is cut into, metres (the conduit's own radius in its chase). */
const TOLERANCE = 0.001

/** Every stretch of a run that goes plumb down or up (a descent to a box, a riser from the panel): where it stands in plan and how long it is. */
function descentsOf(points: readonly (readonly number[])[]): { readonly u: number; readonly v: number; readonly y0: number; readonly y1: number }[] {
  const out: { u: number; v: number; y0: number; y1: number }[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!, b = points[i + 1]!
    if (Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!) > 1e-3 || Math.abs(a[2]! - b[2]!) < 0.2) continue
    out.push({ u: a[0]!, v: a[1]!, y0: Math.min(a[2]!, b[2]!), y1: Math.max(a[2]!, b[2]!) })
  }
  return out
}

describe('every conduit that goes down a wall goes down inside it, on the room side, never on the outer face', () => {
  for (const template of ['single_storey_a', 'townhouse', 'mid_modern_single_storey', 'high_end_contemporary']) {
    it(template, () => {
      const plan = planOf(template, 1) as unknown as Plan
      const { house } = houseOf(plan as never, {}, { quality: 'game', constructionStages: true, constructionLevel: 4 })
      const houseWalls = plan.walls.filter((w) => w.type === undefined || w.type === 'wall')
      const exterior = houseWalls.filter((w) => w.exterior)
      const centre: [number, number] = [(Math.min(...exterior.map((w) => Math.min(w.u0, w.u1))) + Math.max(...exterior.map((w) => Math.max(w.u0, w.u1)))) / 2, (Math.min(...exterior.map((w) => Math.min(w.v0, w.v1))) + Math.max(...exterior.map((w) => Math.max(w.v0, w.v1)))) / 2]
      // the outbuilding's walls are all outer walls of their own building
      const walls: Host[] = [
        ...houseWalls.map((w) => ({ ...w, centre })),
        ...(plan.outbuildings ?? []).flatMap((o) => o.walls.map((w): Host => ({ ...w, floor: 0, exterior: true, centre: [(o.aabb[0]! + o.aabb[2]!) / 2, (o.aabb[1]! + o.aabb[3]!) / 2] }))),
      ]
      const problems: string[] = []
      let count = 0
      house.group.traverse((o) => {
        if (o.userData.part !== 'wall_conduit' || !Array.isArray(o.userData.points)) return
        for (const d of descentsOf(o.userData.points as number[][])) {
          // a stretch under the ground (to the yard, the outbuilding) is not in a wall, nor the drop through a ceiling slab to a light
          if (d.y1 <= 0.05) continue
          if (plan.floors.some((f) => d.y0 >= f.y0 + f.ceiling - 0.35 && d.y0 <= f.y0 + f.ceiling + 0.35)) continue
          count++
          const floor = Math.max(0, plan.floors.findIndex((f, k) => d.y0 + 0.01 >= f.y0 && (plan.floors[k + 1] === undefined || d.y0 + 0.01 < plan.floors[k + 1]!.y0)))
          const host = walls.filter((w) => w.floor === floor).find((w) => {
            const alongU = w.axis === 'u'
            const along = alongU ? d.u : d.v, a0 = alongU ? Math.min(w.u0, w.u1) : Math.min(w.v0, w.v1), a1 = alongU ? Math.max(w.u0, w.u1) : Math.max(w.v0, w.v1)
            const across = (alongU ? d.v - w.v0 : d.u - w.u0)
            return along >= a0 - 0.1 && along <= a1 + 0.1 && Math.abs(across) <= (w.thickness ?? 0.15) / 2 + TOLERANCE
          })
          if (!host) {
            problems.push(`${String(o.userData.id)} at ${d.u.toFixed(3)},${d.v.toFixed(3)}: in no wall`)
            continue
          }
          if (!host.exterior) continue
          const line = host.axis === 'u' ? host.v0 : host.u0
          const across = (host.axis === 'u' ? d.v : d.u) - line
          const inward = Math.sign((host.axis === 'u' ? host.centre[1] : host.centre[0]) - line)
          if (across * inward < -TOLERANCE) problems.push(`${String(o.userData.id)} at ${d.u.toFixed(3)},${d.v.toFixed(3)}: on the outer half of an exterior wall`)
        }
      })
      expect(count).toBeGreaterThan(0)
      expect(problems).toEqual([])
    })
  }
})

describe('the feed to a building in the yard goes under the ground, never through the air (NBR 5410)', () => {
  const plan = planOf('single_storey_a', 1) as unknown as Plan & { readonly walls: readonly PlanWall[] }
  const { house } = houseOf(plan as never, {}, { quality: 'game', constructionStages: true, constructionLevel: 4 })
  const exterior = plan.walls.filter((w) => w.exterior)
  const footprint = [Math.min(...exterior.map((w) => Math.min(w.u0, w.u1))), Math.min(...exterior.map((w) => Math.min(w.v0, w.v1))), Math.max(...exterior.map((w) => Math.max(w.u0, w.u1))), Math.max(...exterior.map((w) => Math.max(w.v0, w.v1)))]
  const buildings = [footprint, ...(plan.outbuildings ?? []).map((o) => o.aabb)]
  const runs: number[][][] = []
  house.group.traverse((o) => { if (o.userData.part === 'wall_conduit' && Array.isArray(o.userData.points)) runs.push(o.userData.points as number[][]) })
  const stage = house.groups['stage:4:installations'] as unknown as { userData: Record<string, { pieces?: { points: number[][] }[]; runs?: { a: number[]; b: number[] }[]; boxes?: { u: number; v: number; size: number }[] }>; getObjectByName(name: string): unknown }
  // inside a building and its walls, or in a ground box at a wall's foot, a conduit may stand over the feed's depth
  // (the sleeve from a wall's foot into its box runs under the ground there)
  const sheltered = (u: number, v: number, y: number): boolean =>
    buildings.some((b) => u >= b[0]! - 0.1 && u <= b[2]! + 0.1 && v >= b[1]! - 0.1 && v <= b[3]! + 0.1) ||
    (y < 0 && buildings.some((b) => u >= b[0]! - 0.45 && u <= b[2]! + 0.45 && v >= b[1]! - 0.45 && v <= b[3]! + 0.45)) ||
    (stage.userData.feeds?.boxes ?? []).some((x) => Math.abs(x.u - u) <= x.size / 2 && Math.abs(x.v - v) <= x.size / 2)

  it('every stretch of conduit out of the buildings lies at least 0.6 m under the ground', () => {
    const inAir: string[] = []
    let yard = 0
    for (const points of runs) for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]!, b = points[i + 1]!
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!) / 0.05))
      for (let k = 0; k <= steps; k++) {
        const p = [0, 1, 2].map((j) => a[j]! + ((b[j]! - a[j]!) * k) / steps)
        if (sheltered(p[0]!, p[1]!, p[2]!)) continue
        yard++
        if (p[2]! > -0.6 + 1e-6) inAir.push(`${p.map((v) => v.toFixed(2))}`)
      }
    }
    expect(yard).toBeGreaterThan(0)
    expect([...new Set(inAir)]).toEqual([])
  })

  it('its trench is the electrical one: it never crosses a sewer or rain pipe at the same level, and has its warning tape over it', () => {
    const feeds = stage.userData.feeds!.runs!
    expect(feeds.length).toBeGreaterThan(0)
    expect(stage.getObjectByName('feed:warning_tape')).toBeDefined()
    const pipes = [...stage.userData.sewer!.pieces!, ...stage.userData.rain!.pieces!]
    const clashes: string[] = []
    for (const f of feeds) for (const p of pipes) for (let i = 0; i + 1 < p.points.length; i++) {
      const a = p.points[i]!, b = p.points[i + 1]!
      // plan crossing of the two segments (points are [x, y, z] here), then the heights at the crossing
      const d = (f.b[0]! - f.a[0]!) * (b[2]! - a[2]!) - (f.b[2]! - f.a[2]!) * (b[0]! - a[0]!)
      if (Math.abs(d) < 1e-9) continue
      const t = ((a[0]! - f.a[0]!) * (b[2]! - a[2]!) - (a[2]! - f.a[2]!) * (b[0]! - a[0]!)) / d
      const s = ((a[0]! - f.a[0]!) * (f.b[2]! - f.a[2]!) - (a[2]! - f.a[2]!) * (f.b[0]! - f.a[0]!)) / d
      if (t < 0 || t > 1 || s < 0 || s > 1) continue
      const yf = f.a[1]! + (f.b[1]! - f.a[1]!) * t, yp = a[1]! + (b[1]! - a[1]!) * s
      if (Math.abs(yf - yp) < 0.2) clashes.push(`feed at ${yf.toFixed(2)} crosses a pipe at ${yp.toFixed(2)}`)
    }
    expect(clashes).toEqual([])
  })
})
