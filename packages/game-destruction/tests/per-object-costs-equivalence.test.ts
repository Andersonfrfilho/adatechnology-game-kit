import { describe, expect, it } from 'vitest'

import { assemblyPart, createDestruction, toLocal } from '../src'
import type { DestructibleSpec, DestructionEvent, JointSpec, PartSpec, Vec3 } from '../src'
import { planeAxes } from '../src/breach'
import { thinAxisOf } from '../src/layers'
import { aabbOf, shapeBound } from '../src/math'
import { nonFinitePaths } from '../../../test-support/non-finite'
import { houseSpec } from './wall-helpers'

/** How far (m) past the edge of a hole a hosted part still counts as in it (the value of `HOLE_SLACK` in world.ts). */
const HOLE_SLACK = 0.05
const IDENTITY: [number, number, number, number] = [0, 0, 0, 1]

type Snapshot = ReturnType<ReturnType<typeof createDestruction>['serialize']>
type PartStateOf = Snapshot['objects'][number]['state']['parts'][number]

const CHARGES = {
  c4: { energy: 345600, radius: 18, charge: { tnt: 0.76 } },
  m67: { energy: 200000, radius: 15, charge: { tnt: 0.24, casing: { mass: 0.19, material: 'steel', fragments: 1000, chargeMass: 0.18, gurneyVelocity: 2700 } } },
  pipe_bomb: { energy: 43200, radius: 10, charge: { tnt: 0.15, casing: { mass: 0.35, material: 'steel', fragments: 60, chargeMass: 0.15, gurneyVelocity: 2000, geometry: 'cylinder' } } },
} as const

const STRETCHES = [-2.25, -0.75, 0.75, 2.25] as const
const stretchId = (index: number): string => `pipe:${index}`

/** A plastered brick wall with a run of pipe stretches embedded in it (the shape of the hosted-parts tests). */
const hostedWallSpec = (): DestructibleSpec => {
  const wall = assemblyPart('brick_wall_plastered', { id: 'wall', width: 6, height: 2.1, position: [0, 1.05, 0] })
  const pipes: PartSpec[] = STRETCHES.map((x, index) => ({ id: stretchId(index), material: 'plastic', shape: { kind: 'box', size: [1.5, 0.1, 0.1] }, position: [x, 1, 0], mass: 1, hostedIn: 'wall', tags: ['pipe'] }))
  const clips: JointSpec[] = STRETCHES.map((_, index) => ({ a: stretchId(index), b: 'wall', kind: 'clip', bears: false }))
  const sockets: JointSpec[] = STRETCHES.slice(1).map((_, index) => ({ a: stretchId(index), b: stretchId(index + 1), kind: 'glue', bears: false }))
  return { parts: [{ ...wall, anchored: true }, ...pipes], joints: [...clips, ...sockets] }
}

const SCENARIOS = {
  hostedWall: { spec: hostedWallSpec, blasts: [[-0.75, 1, 0.3], [1.5, 1, -0.3]] as Vec3[] },
  house: { spec: houseSpec, blasts: [[0, 1.5, -3], [-2.4, 1, 2.5]] as Vec3[] },
}

/** The decision `holeReaches` of world.ts takes, read from serialized state: the slow reference the guard must agree with. */
const referenceHoleReaches = (host: PartStateOf, hostSpec: PartSpec, box: { min: Vec3; max: Vec3 }): boolean => {
  if (host.status === 'broken' || host.status === 'melted' || host.status === 'ashes' || host.status === 'collapsed') return true
  const size = hostSpec.shape.kind === 'box' ? hostSpec.shape.size : [1, 1, 1]
  const [u, v] = planeAxes(thinAxisOf([size[0]!, size[1]!, size[2]!]))
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => toLocal(hostSpec.position, IDENTITY, [i & 1 ? box.max[0] : box.min[0], i & 2 ? box.max[1] : box.min[1], i & 4 ? box.max[2] : box.min[2]]))
  const lo = [0, 1, 2].map((k) => Math.min(...corners.map((c) => c[k]!)))
  const hi = [0, 1, 2].map((k) => Math.max(...corners.map((c) => c[k]!)))
  const clamp = (x: number, a: number, b: number): number => Math.min(Math.max(x, a), b)
  const op = host.opening
  if (op) {
    const lc = toLocal(hostSpec.position, IDENTITY, op.center)
    if (Math.hypot(clamp(lc[u]!, lo[u]!, hi[u]!) - lc[u]!, clamp(lc[v]!, lo[v]!, hi[v]!) - lc[v]!) <= op.radius + HOLE_SLACK) return true
  }
  return (host.chipped ?? []).some((cell) => [u, v].every((k) => cell.center[k]! + cell.size[k]! / 2 + HOLE_SLACK >= lo[k]! && cell.center[k]! - cell.size[k]! / 2 - HOLE_SLACK <= hi[k]!))
}

const hostedSignature = (world: ReturnType<typeof createDestruction>): string =>
  JSON.stringify(world.serialize().objects.map((o) => o.state.parts.map((p) => [p.id, p.status, p.exposed, p.opening, p.chipped])))

/** Updates until the hosts and the hosted parts stop changing, so a reveal that was due has run on the state that is there now. */
const settle = (world: ReturnType<typeof createDestruction>, events: DestructionEvent[]): void => {
  let previous = hostedSignature(world)
  for (let step = 0; step < 300; step++) {
    events.push(...world.update(0.1))
    const now = hostedSignature(world)
    if (now === previous) return
    previous = now
  }
  throw new Error('the world never settled')
}

const build = (spec: () => DestructibleSpec, seed: number, extra: number) => {
  const world = createDestruction({ seed })
  const primary = spec()
  const id = world.add(primary)
  for (let index = 0; index < extra; index++) world.add(spec(), { id: `extra_${index}`, position: [40 * (1 + (index % 4)), 0, 40 * Math.floor(index / 4)] })
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  return { world, id, primary, events }
}

const hostedUnexposed = (world: ReturnType<typeof createDestruction>, id: string, primary: DestructibleSpec) => {
  const state = world.serialize().objects.find((o) => o.id === id)!.state
  const byId = new Map(state.parts.map((p) => [p.id, p]))
  const specs = new Map(primary.parts.map((p) => [p.id, p]))
  return primary.parts.filter((p) => p.hostedIn !== undefined).map((p) => ({ part: p, host: byId.get(p.hostedIn!)!, hostSpec: specs.get(p.hostedIn!)!, exposed: byId.get(p.id)!.exposed === true }))
}

describe('a hosted part shows exactly when the hole of its host reaches it', () => {
  for (const [scenarioName, scenario] of Object.entries(SCENARIOS)) {
    for (const [chargeName, c] of Object.entries(CHARGES)) {
      for (const seed of [3, 11]) {
        it(`${scenarioName} / ${chargeName} / seed ${seed}, with distant objects in the world`, () => {
          const { world, id, primary, events } = build(scenario.spec, seed, 6)
          for (const point of scenario.blasts) {
            world.explode(point, c.energy, c.radius, 'player', { charge: c.charge as never })
            settle(world, events)
            for (const { part, host, hostSpec, exposed } of hostedUnexposed(world, id, primary)) {
              const box = aabbOf(part.shape, part.position, IDENTITY)
              expect(exposed, `${part.id} after blast at ${point.join(',')}`).toBe(referenceHoleReaches(host, hostSpec, box))
            }
          }
          expect(nonFinitePaths(world.serialize())).toEqual([])
          expect(nonFinitePaths(events)).toEqual([])
        })
      }
    }
  }

  it('the hosted wall scenario does reveal parts, so the equivalence above is not about an empty case', () => {
    const { world, events } = build(hostedWallSpec, 3, 0)
    world.explode([-0.75, 1, 0.3], CHARGES.c4.energy, CHARGES.c4.radius, 'player', { charge: CHARGES.c4.charge })
    settle(world, events)
    expect(events.filter((event) => event.type === 'reveal').length).toBeGreaterThan(0)
  })
})

const leakingTank = (position: Vec3): PartSpec => ({
  id: 'tank', material: 'steel', shape: { kind: 'cylinder', radius: 0.17, height: 0.49 }, position, thickness: 0.002, fill: 0.03, contains: { fluid: 'gas', liters: 24, pressurized: true },
})
const ballast = (position: Vec3): PartSpec => ({ id: 'ballast', material: 'concrete', shape: { kind: 'box', size: [0.5, 0.5, 0.5] }, position, mass: 100 })

describe('a blast lights the leaks inside its fireball and no other, wherever the objects were put or their parts moved to', () => {
  for (const [chargeName, c] of Object.entries(CHARGES)) {
    it(`${chargeName}: what is lit is every leak within one reach of the blast, by the part's own position`, () => {
      const world = createDestruction({ seed: 5 })
      const blast: Vec3 = [0, 0.5, 0]
      const tanks: Array<{ id: string }> = []
      // one tank per distance, put by a transform; one whose part was posed from far away next to the blast; one built far and moved with its object
      for (let index = 0; index < 24; index++) {
        const id = world.add({ parts: [leakingTank([0, 0.245, 0]), ballast([0.6, 0.25, 0])] }, { id: `ring_${index}`, position: [0.8 + index * 0.5, 0, 0] })
        world.vent(id, 'tank', { point: [0, 0.46, 0] })
        tanks.push({ id })
      }
      const posed: string = world.add({ parts: [leakingTank([60, 0.245, 0]), ballast([0, 0.25, 0])] }, { id: 'posed', position: [0, 0, 40] })
      world.vent(posed, 'tank', { point: [60, 0.46, 0] })
      world.setPartPose(posed, 'tank', [0, 0.245, 0])
      world.setTransform(posed, [0.8, 0, 0.2], [0, 0, 0, 1])
      tanks.push({ id: posed })
      const moved = world.add({ parts: [leakingTank([0, 0.245, 0]), ballast([30, 0.25, 0])] }, { id: 'moved', position: [100, 0, 0] })
      world.vent(moved, 'tank', { point: [0, 0.46, 0] })
      world.setTransform(moved, [0.9, 0, -0.2], [0, 0, 0, 1])
      tanks.push({ id: moved })
      const far = world.add({ parts: [leakingTank([0, 0.245, 0])] }, { id: 'far', position: [200, 0, 0] })
      world.vent(far, 'tank', { point: [0, 0.46, 0] })
      tanks.push({ id: far })

      world.explode(blast, c.energy, c.radius, 'player', { charge: c.charge as never })
      const snapshot = world.serialize()
      const rows = tanks.map(({ id }) => {
        const object = snapshot.objects.find((o) => o.id === id)!
        const tank = object.spec.parts.find((p) => p.id === 'tank')!
        const state = object.state
        // the pose the part was given, not its spec position, for the object that was posed
        const local: Vec3 = id === posed ? [0, 0.245, 0] : tank.position
        const centre: Vec3 = [state.position[0] + local[0], state.position[1] + local[1], state.position[2] + local[2]]
        const surface = Math.hypot(centre[0] - blast[0], centre[1] - blast[1], centre[2] - blast[2]) - shapeBound(tank.shape)
        return { id, surface, lit: (object.runtime?.parts.tank as { lit?: boolean } | undefined)?.lit === true }
      })
      const lit = rows.filter((r) => r.lit), unlit = rows.filter((r) => !r.lit)
      expect(lit.length).toBeGreaterThan(0)
      expect(unlit.length).toBeGreaterThan(0)
      expect(Math.max(...lit.map((r) => r.surface)), JSON.stringify(rows)).toBeLessThan(Math.min(...unlit.map((r) => r.surface)))
    })
  }
})
