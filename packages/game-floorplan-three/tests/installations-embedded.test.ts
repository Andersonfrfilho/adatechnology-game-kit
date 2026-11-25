import { describe, expect, it } from 'vitest'

import { atticFloor, routingPlanOf } from '../src/construction-stages/installation-routes'
import { drainRoute } from '../src/utilities/drains'
import type { HouseRecord } from '../src/kernel-types'
import { houseOf, planOf, THREE } from './helpers/houses'

/** Houses of one storey and of two, budget to high end: each lays water, sewer, conduits and, most of them, a gas line from the shelter. */
const TEMPLATES = ['single_storey_a', 'townhouse', 'mid_modern_single_storey', 'budget_slab_house', 'mid_modern_townhouse', 'high_end_contemporary', 'budget_semi_detached'] as const

type Point = readonly [number, number, number]
type Stretch = { readonly network: string; readonly a: Point; readonly b: Point }

/** A door is clear up to this height, metres. */
const DOOR_HEIGHT = 2.1
/** How far a run may stand out of the box it lies in, metres (a pipe's centre in a chase 14 mm under the wall's planned face). */
const SLACK = 0.01
const SAMPLES = 12
/** How deep the top ceiling's slab may reach under the attic floor, metres. */
const TOP_SLAB = 0.25

type Plan = HouseRecord & {
  readonly items?: readonly { readonly pipe?: { readonly route: readonly (readonly number[])[] }; readonly valve?: unknown }[]
  readonly windows: readonly { readonly floor: number; readonly axis: 'u' | 'v'; readonly pos: number; readonly at: number; readonly width: number; readonly y0: number; readonly y1: number }[]
}

const shown = (o: THREE.Object3D): boolean => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true }

/** Every stretch of the embedded networks of a staged house: water and conduits as the house laid them, the sewer's drains, the gas line past the wall it enters by. */
function stretchesOf(house: { readonly group: THREE.Object3D }, plan: Plan): Stretch[] {
  const out: Stretch[] = []
  const push = (network: string, route: readonly Point[]): void => { for (let i = 0; i + 1 < route.length; i++) out.push({ network, a: route[i]!, b: route[i + 1]! }) }
  house.group.traverse((o) => {
    if (o.userData.part === 'wall_pipe') for (const r of (o.userData.routes ?? []) as number[][][]) push('water', r.map((p) => [p[0]!, p[1]!, p[2]!] as const))
    if (o.userData.part === 'wall_conduit' && !plan.utilities?.electrical?.exposed) push('conduit', ((o.userData.points ?? []) as number[][]).map((p) => [p[0]!, p[2]!, p[1]!] as const))
  })
  const routing = routingPlanOf(plan)
  for (const point of plan.utilities?.plumbing?.points ?? []) {
    const route = drainRoute(routing, point)
    if (route) push('sewer', route)
  }
  // the gas line: from where it is through the wall on (the shelter's outlet and the hole through the wall are outside), to the valve
  for (const item of plan.items ?? []) if (item.pipe) push('gas', item.pipe.route.slice(1).map((p) => [p[0]!, p[2]!, p[1]!] as const))
  return out
}

/** The point at t along a stretch. */
const along = (s: Stretch, t: number): Point => [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t, s.a[2] + (s.b[2] - s.a[2]) * t]

/** Where a point of an embedded run may be: inside a wall of its storey, inside a slab between storeys, over the top ceiling, or under the ground floor. */
function embedded(plan: Plan, [x, y, z]: Point): boolean {
  // the ground, the top slab (a double-height room's ceiling hangs from it) and the attic over it
  if (y <= 0.005 || y >= atticFloor(routingPlanOf(plan)) - TOP_SLAB) return true
  for (const [f, floor] of plan.floors.entries()) if (f > 0 && y >= floor.y0 - 0.15 && y <= floor.y0) return true
  return plan.walls.some((w) => {
    const floor = plan.floors[w.floor]
    if (!floor || y < floor.y0 - 0.15 || y > floor.y0 + floor.ceiling + SLACK) return false
    const half = (w.thickness ?? 0.15) / 2 + SLACK
    const [line, at, a0, a1] = w.axis === 'u' ? [w.v0, x, Math.min(w.u0, w.u1), Math.max(w.u0, w.u1)] : [w.u0, z, Math.min(w.v0, w.v1), Math.max(w.v0, w.v1)]
    const across = w.axis === 'u' ? z : x
    return Math.abs(across - line) <= half && at >= a0 - half && at <= a1 + half
  })
}

/** The door or window whose opening a point lies in, if any (its sides 1 cm in: a run beside the jamb is in the wall). */
function openingAt(plan: Plan, [x, y, z]: Point): string | null {
  const openings = [...plan.doors.map((d) => ({ ...d, y0: 0, y1: DOOR_HEIGHT, kind: 'door' })), ...plan.windows.map((w) => ({ ...w, kind: 'window' }))]
  for (const o of openings) {
    const floor = plan.floors[o.floor]
    if (!floor || y <= floor.y0 + o.y0 || y >= floor.y0 + o.y1) continue
    const [across, at] = o.axis === 'u' ? [z, x] : [x, z]
    if (Math.abs(across - o.pos) <= 0.1 && Math.abs(at - o.at) < o.width / 2 - 0.01) return `${o.kind} ${o.floor}:${o.axis}${o.pos}@${o.at}`
  }
  return null
}

const describePoint = (p: Point): string => p.map((n) => n.toFixed(2)).join(',')

describe('the installations are embedded as a Brazilian house lays them (NBR 5626, 8160, 5410, 15526)', () => {
  for (const template of TEMPLATES) {
    it(`${template}: no stretch of water, sewer, conduit or gas runs through a room in the air or across a door or window`, () => {
      const plan = planOf(template, 1) as unknown as Plan
      const { house } = houseOf(plan, {}, { quality: 'game', constructionStages: true, constructionLevel: 8 })
      const stretches = stretchesOf(house, plan)
      expect(stretches.length).toBeGreaterThan(10)
      const inAir = new Set<string>(), across = new Set<string>()
      for (const s of stretches) for (let k = 0; k <= SAMPLES; k++) {
        const p = along(s, k / SAMPLES)
        if (!embedded(plan, p)) inAir.add(`${s.network} ${describePoint(s.a)} -> ${describePoint(s.b)}`)
        const opening = openingAt(plan, p)
        if (opening) across.add(`${s.network} ${describePoint(s.a)} -> ${describePoint(s.b)} through ${opening}`)
      }
      expect([...inAir]).toEqual([])
      expect([...across]).toEqual([])
    })
  }

  it('every drain starts at its fixture (in the wall behind it, or through the floor under it) and ends over the buried branch under the fixture', () => {
    for (const template of TEMPLATES) {
      const plan = planOf(template, 1) as unknown as Plan
      const routing = routingPlanOf(plan)
      for (const point of plan.utilities?.plumbing?.points ?? []) {
        const route = drainRoute(routing, point)
        if (!route) continue
        const first = route[0]!, last = route[route.length - 1]!
        expect(Math.hypot(first[0] - point.u, first[2] - point.v), `${template} ${point.id} starts by its fixture`).toBeLessThan(1.5)
        // it ends on the riser of the buried branch under the fixture: on its top, or at its side coming across the subfloor
        expect(Math.hypot(last[0] - point.u, last[2] - point.v), `${template} ${point.id} ends at its branch's riser`).toBeLessThanOrEqual(0.06)
        expect(last[1], `${template} ${point.id} ends under the floor`).toBeLessThan(0)
      }
    }
  })

  it('the gas line runs from the shelter to the valve at the stove, in the wall, and under the floor where a door is on its way', () => {
    let lines = 0
    for (const template of TEMPLATES) {
      const plan = planOf(template, 1) as unknown as Plan
      for (const item of plan.items ?? []) {
        if (!item.pipe) continue
        lines++
        const route = item.pipe.route, valve = item.valve as { x: number; z: number; y: number }
        expect(route[route.length - 1], `${template} ends at the valve`).toEqual([valve.x, valve.z, valve.y])
      }
    }
    expect(lines).toBeGreaterThan(0)
  })
})

describe('each piece shows from the stage of the work it belongs to', () => {
  const partsOf = (root: THREE.Object3D, test: (o: THREE.Object3D) => boolean): THREE.Object3D[] => { const out: THREE.Object3D[] = []; root.traverse((o) => { if (test(o)) out.push(o) }); return out }
  const { house } = houseOf(planOf('single_storey_a', 1), {}, { quality: 'game', constructionStages: true, constructionLevel: 8 })
  const downpipes = (): THREE.Object3D[] => partsOf(house.group, (o) => /^drain:downpipe_/.test(String(o.userData.id ?? '')) && shown(o))
  const sidewalk = (): THREE.Object3D[] => partsOf(house.group, (o) => (o as THREE.Mesh).isMesh && /\/sidewalk/.test(o.name) && /^f\d/.test(o.name) && shown(o))
  const embeddedRuns = (): THREE.Object3D[] => partsOf(house.group, (o) => (o.userData.part === 'wall_pipe' || o.userData.part === 'wall_conduit') && shown(o))

  it('the downpipes go up with the gutters and the tiles (level 6), the sidewalk and the facade\'s tiles last (level 8): never at the rough-in', () => {
    for (const level of [3, 4, 5]) {
      house.setConstructionLevel?.(level)
      expect(downpipes().length, `downpipes at level ${level}`).toBe(0)
    }
    for (const level of [6, 7, 8]) {
      house.setConstructionLevel?.(level)
      expect(downpipes().length, `downpipes at level ${level}`).toBeGreaterThan(0)
    }
    for (const level of [3, 4, 5, 6, 7]) {
      house.setConstructionLevel?.(level)
      expect(sidewalk().length, `sidewalk at level ${level}`).toBe(0)
    }
    house.setConstructionLevel?.(8)
    expect(sidewalk().length).toBeGreaterThan(0)
  })

  it('follows the order of a Brazilian work: foundation, frame, masonry, runs in it, roof timber, tiles, the render, then doors and windows and the sidewalk', () => {
    const first = (shownAt: (level: number) => boolean): number => [0, 1, 2, 3, 4, 5, 6, 7, 8].find((level) => { house.setConstructionLevel?.(level); return shownAt(level) }) ?? -1
    const group = (name: string) => (): boolean => { const g = (house.groups as Record<string, THREE.Object3D>)[name]; return !!g && shown(g) }
    const ofStage = (stage: string) => (): boolean => partsOf(house.group, (o) => o.userData.constructionStage === stage && shown(o)).length > 0
    expect({
      foundation: first(group('stage:1:foundation')),
      frame: first(group('stage:2:frame')),
      masonry: first(group('stage:3:masonry')),
      runs: first(() => embeddedRuns().length > 0),
      roofFraming: first(group('stage:7:roof_framing')),
      roof: first(group('roof')),
      downpipes: first(() => downpipes().length > 0),
      render: first(ofStage('finishes')),
      openings: first(ofStage('openings')),
      sidewalk: first(() => sidewalk().length > 0),
    }).toEqual({ foundation: 1, frame: 2, masonry: 3, runs: 4, roofFraming: 5, roof: 6, downpipes: 6, render: 7, openings: 8, sidewalk: 8 })
    // the bare work stays until the render covers it, never after
    house.setConstructionLevel?.(6)
    expect(group('stage:3:masonry')()).toBe(true)
    house.setConstructionLevel?.(7)
    expect(group('stage:3:masonry')()).toBe(false)
  })

  it('the runs in the walls are laid in the rough-in, before the render, and stay there', () => {
    house.setConstructionLevel?.(3)
    expect(embeddedRuns().length).toBe(0)
    for (const level of [4, 5, 8]) {
      house.setConstructionLevel?.(level)
      expect(embeddedRuns().length, `level ${level}`).toBeGreaterThan(0)
    }
  })

  it('the compacted bed of the foundation lies under the house only: no band of it outside the walls', () => {
    house.setConstructionLevel?.(4)
    house.group.updateMatrixWorld(true)
    // the foundation's own outer faces: the ground beams and footings the walls stand on
    const parts = ((planOf('single_storey_a', 1) as unknown as { structure: { parts: { id: string; floor?: number; aabb: number[] }[] } }).structure.parts).filter((p) => (p.floor ?? 0) === 0 && /^(ground_beam_|footing_)/.test(p.id))
    const box = [Math.min(...parts.map((p) => p.aabb[0]!)), Math.min(...parts.map((p) => p.aabb[1]!)), Math.max(...parts.map((p) => p.aabb[2]!)), Math.max(...parts.map((p) => p.aabb[3]!))]
    const bed = partsOf(house.group, (o) => (o as THREE.Mesh).isMesh && o.userData.structurePartId === 'foundation_dirt_bed')
    expect(bed.length).toBe(1)
    const extent = new THREE.Box3().setFromObject(bed[0]!)
    expect(extent.min.x).toBeGreaterThanOrEqual(box[0]!)
    expect(extent.min.z).toBeGreaterThanOrEqual(box[1]!)
    expect(extent.max.x).toBeLessThanOrEqual(box[2]!)
    expect(extent.max.z).toBeLessThanOrEqual(box[3]!)
  })
})
