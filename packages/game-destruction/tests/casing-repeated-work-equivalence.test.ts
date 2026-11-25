import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { assemblyPart, createDestruction } from '../src'
import type { DestructibleSpec, DestructionEvent, JointSpec, PartSpec, Quat, Vec3 } from '../src'
import { planeAxes, unitGrid, unitRowsWithin } from '../src/breach'
import { nonFinitePaths } from '../../../test-support/non-finite'
import { houseSpec } from './wall-helpers'

/**
 * A casing blast wears the same joints and chips the same units hit after hit: what depends only on a part (a joint's overlap length, the units of a wall near
 * the blow) is kept between hits. The hashes were recorded on the code that measured both again at every hit (the same events, in the same order, and the same
 * world), so a cache that goes stale, or a scan that skips a unit it should have visited, changes one. Record them again only for a change meant to alter what a
 * blast does, never to make this test pass: `PRINT_CASING_HASH=1` prints the hash of each case.
 */
const CHARGES = {
  m67: { energy: 200000, radius: 15, charge: { tnt: 0.24, casing: { mass: 0.19, material: 'steel', fragments: 1000, chargeMass: 0.18, gurneyVelocity: 2700 } } },
  pipe_bomb: { energy: 43200, radius: 10, charge: { tnt: 0.15, casing: { mass: 0.35, material: 'steel', fragments: 60, chargeMass: 0.15, gurneyVelocity: 2000, geometry: 'cylinder' } } },
} as const

/** A long brick wall on a ground beam and two cast pillars: a joint far longer than the reach of one blow, units to chip along it. */
const longWallSpec = (): DestructibleSpec => {
  const wall = assemblyPart('brick_wall_plastered', { id: 'wall', width: 8, height: 2.8, position: [0, 1.4, 0] })
  const parts: PartSpec[] = [
    { id: 'beam', material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [8, 0.3, 0.2] }, position: [0, -0.15, 0] },
    { ...wall, structure: { role: 'wall' } },
    { id: 'pillar_west', material: 'concrete', structure: { role: 'column' }, shape: { kind: 'box', size: [0.2, 2.8, 0.2] }, position: [-4, 1.4, 0] },
    { id: 'pillar_east', material: 'concrete', structure: { role: 'column' }, shape: { kind: 'box', size: [0.2, 2.8, 0.2] }, position: [4, 1.4, 0] },
  ]
  const joints: JointSpec[] = [
    { a: 'wall', b: 'beam', kind: 'mortar', bears: 'a_on_b' },
    { a: 'pillar_west', b: 'beam', kind: 'rebar', bears: 'a_on_b' },
    { a: 'pillar_east', b: 'beam', kind: 'rebar', bears: 'a_on_b' },
    { a: 'wall', b: 'pillar_west', kind: 'mortar', bears: false },
    { a: 'wall', b: 'pillar_east', kind: 'mortar', bears: false },
  ]
  return { parts, joints }
}

type Scenario = { readonly spec: () => DestructibleSpec; readonly blasts: readonly Vec3[]; readonly moved: { readonly position: Vec3; readonly rotation: Quat; readonly then: Vec3 }; readonly posed: { readonly part: string; readonly position: Vec3 } }

const quatAbout = (axis: Vec3, angle: number): Quat => {
  const length = Math.hypot(...axis)
  const s = Math.sin(angle / 2) / length
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]
}

/** A turn about no axis of the world: the world box of a turned part is not the turned box of its own, so a length kept from before it is wrong. */
const SKEW = quatAbout([0.3, 1, 0.2], 0.61)

const SCENARIOS: Record<string, Scenario> = {
  house: { spec: houseSpec, blasts: [[0, 1.5, -3], [-2.4, 1, 2.5]], moved: { position: [3, 0.2, -1], rotation: SKEW, then: [3.5, 1.5, -3] }, posed: { part: 'wall_back', position: [0.01, 1.2, -1.79] } },
  longWall: { spec: longWallSpec, blasts: [[-2, 1.2, 0.8], [2.5, 1.4, -0.8]], moved: { position: [1, 0, 2], rotation: SKEW, then: [2, 1.4, 2.7] }, posed: { part: 'pillar_east', position: [4.01, 1.1, 0.005] } },
}

/** Fragment ids carry a counter shared by every world of the process (`#t<N>-`): numbered here by first appearance, so a hash does not depend on what ran before. */
const hashOf = (parts: readonly string[]): string => {
  const order = new Map<string, number>()
  const text = parts.join('\n').replace(/#t(\d+)-/g, (_match, counter: string) => {
    if (!order.has(counter)) order.set(counter, order.size)
    return `#t${order.get(counter)}-`
  })
  return createHash('sha256').update(text).digest('hex')
}

const run = (scenarioName: string, chargeName: keyof typeof CHARGES, seed: number): { hash: string; events: DestructionEvent[]; state: unknown } => {
  const scenario = SCENARIOS[scenarioName]!
  const charge = CHARGES[chargeName]
  const world = createDestruction({ seed })
  const id = world.add(scenario.spec())
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  const log: string[] = []
  const blast = (point: Vec3): void => {
    world.explode(point, charge.energy, charge.radius, 'player', { charge: charge.charge as never })
    for (let step = 0; step < 5; step++) world.update(0.1)
    log.push(JSON.stringify(world.serialize()))
  }
  for (const point of scenario.blasts) blast(point)
  world.setPartPose(id, scenario.posed.part, scenario.posed.position)
  blast(scenario.blasts[0]!)
  world.setTransform(id, scenario.moved.position, scenario.moved.rotation)
  blast(scenario.moved.then)
  log.push(JSON.stringify(events))
  return { hash: hashOf(log), events, state: world.serialize() }
}

/** V8 changed the last bit of `Math.pow` between Node 22 and 24 (the CI's `goldens-node-24`): the house, whose materials go through it, has a hash for each. */
const NEWER_POW = Number(process.versions.node.split('.')[0]) >= 24

const PINNED: Record<string, string> = {
  'house/m67/3': NEWER_POW ? 'd541fced868d294757bfbec78950e2b46b88d43b025b491610739f460f9b1948' : 'f5fd9a06972921f02aecbf1870ab8b5b4807648b0a3fe93af47592069edb6cec',
  'house/m67/11': NEWER_POW ? '056f0f14743795d7b77a65b77f7af1df598287737bb288bbcb25e49426d8d73d' : 'a939258816d8415d3212e4002d19eebc9fcc83fdc2d4d92d36ed453d38aaa2a4',
  'house/pipe_bomb/3': NEWER_POW ? '603465f311f16a8fec56895f2a59c01a427aae2250d8db30b3ece49278b24e2e' : 'b09032664124d2ea069a02cde5d84bbe586c9917ab133648aedbe0847e839a47',
  'house/pipe_bomb/11': NEWER_POW ? '9ff7774db0f76c2a1d9498de63a718f615422c5a5b7eb6447383a5fad3af524b' : 'cab8eaeb743fbf18d56996051059f9be82c6fed7d901ba65aaff49dcabe3f045',
  'longWall/m67/3': 'a202522342bd836b1370c692451ea5a0b52903700528940e190611905c41b5f0',
  'longWall/m67/11': '3df0b91045f7e256df3ef4a910436135acab3beda7970d90b0e618c702fbac19',
  'longWall/pipe_bomb/3': 'f6ac36c395a93663ca760f6546b6ba805ff6f24c666f84cdfb929ef694564929',
  'longWall/pipe_bomb/11': 'be73fdfc5b0d0b17987caba02fa76f0cebe4fd54fe345d85c88c94360f01d2b7',
}

describe('a casing blast measures the same as measuring everything again at every hit', () => {
  for (const scenarioName of Object.keys(SCENARIOS)) {
    for (const chargeName of Object.keys(CHARGES) as Array<keyof typeof CHARGES>) {
      for (const seed of [3, 11]) {
        const key = `${scenarioName}/${chargeName}/${seed}`
        it(`${key}: two blasts, a part posed, then the object turned and moved`, () => {
          const { hash, events, state } = run(scenarioName, chargeName, seed)
          if (process.env.PRINT_CASING_HASH) console.log(`[HASH] ${key} ${hash} events=${events.length} chips=${events.filter((e) => e.type === 'chip').length}`)
          expect(nonFinitePaths(state)).toEqual([])
          expect(nonFinitePaths(events)).toEqual([])
          expect(hash).toBe(PINNED[key])
        })
      }
    }
  }
})

describe('the rows of a unit grid that can be within reach of a blow', () => {
  const lcg = (seed: number) => {
    let state = seed
    return (): number => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296
  }
  const GRIDS = [
    { name: 'running bond', dims: [4.5, 0.2, 2.8] as Vec3, thin: 1, units: { size: [0.19, 0.09] as [number, number], bond: 'running' as const } },
    { name: 'stack, merged', dims: [8, 2.8, 0.2] as Vec3, thin: 2, units: { size: [0.1, 0.1] as [number, number], bond: 'stack' as const } },
    { name: 'thin along x', dims: [0.2, 3, 5] as Vec3, thin: 0, units: { size: [0.3, 0.12] as [number, number], bond: 'running' as const } },
  ]
  for (const grid of GRIDS) {
    it(`${grid.name}: every unit within reach is visited, once, in ascending order`, () => {
      const cells = unitGrid(grid.dims, grid.thin, grid.units as never, 400)
      const [u, v] = planeAxes(grid.thin)
      const next = lcg(7)
      for (let trial = 0; trial < 400; trial++) {
        const point: Vec3 = [0, 0, 0]
        point[u] = (next() - 0.5) * grid.dims[u] * 1.4
        point[v] = (next() - 0.5) * grid.dims[v] * 1.4
        const radius = next() < 0.1 ? 0 : next() * 1.2
        const visited = unitRowsWithin(cells, grid.thin, point, radius).flatMap(([from, to]) => Array.from({ length: to - from }, (_, k) => from + k))
        expect(visited).toEqual([...visited].sort((a, b) => a - b))
        expect(new Set(visited).size).toBe(visited.length)
        const reference = cells.flatMap((cell, i) => (Math.hypot(Math.max(0, Math.abs(point[u]! - cell.center[u]!) - cell.size[u]! / 2), Math.max(0, Math.abs(point[v]! - cell.center[v]!) - cell.size[v]! / 2)) > radius ? [] : [i]))
        expect(visited.filter((i) => reference.includes(i))).toEqual(reference)
      }
    })
    it(`${grid.name}: a point or a radius that is not finite leaves the whole grid to visit`, () => {
      const cells = unitGrid(grid.dims, grid.thin, grid.units as never, 400)
      const [u, v] = planeAxes(grid.thin)
      for (const [axis, bad] of [[u, NaN], [v, NaN], [u, Infinity], [v, -Infinity]] as const) {
        const point: Vec3 = [0, 0, 0]
        point[axis] = bad
        expect(unitRowsWithin(cells, grid.thin, point, 0.5)).toEqual([[0, cells.length]])
      }
      expect(unitRowsWithin(cells, grid.thin, [0, 0, 0], NaN)).toEqual([[0, cells.length]])
      expect(unitRowsWithin(cells, grid.thin, [0, 0, 0], Infinity)).toEqual([[0, cells.length]])
    })
  }
})
