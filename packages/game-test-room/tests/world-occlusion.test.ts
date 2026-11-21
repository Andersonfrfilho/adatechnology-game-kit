import { describe, expect, it, vi } from 'vitest'
import type { AudioEngineOptions } from '@adatechnology/game-audio'
import { createDestruction } from '@adatechnology/game-destruction'
import { createTerrain, createTerrainImpl } from '@adatechnology/game-terrain'
import type { SurfaceRay, SurfaceRayHit } from '@adatechnology/game-contracts'
import type { DestructibleImpl, DestructibleSpec, ObjectState, RaycastOptions } from '@adatechnology/game-destruction'
import { OCCLUDER_MIN_RADIUS } from '../src/world-occlusion'
import { makeRoom } from './helpers'

const captured: AudioEngineOptions[] = []

vi.mock('@adatechnology/game-audio', async (importOriginal) => {
  const real = await importOriginal<typeof import('@adatechnology/game-audio')>()
  return { ...real, createAudioEngine: (options?: AudioEngineOptions) => (captured.push(options ?? {}), real.createAudioEngine(options)) }
})

describe('the room hears through its walls', () => {
  it('passes an occlusion query over its destruction world to the engine it makes', () => {
    makeRoom()
    const occlusion = captured.at(-1)?.occlusion
    expect(typeof occlusion).toBe('object')
    expect(typeof (occlusion as { query: unknown }).query).toBe('function')
  })

  it('the query sees the target wall between the source and the listener, with its material, and nothing in the open', () => {
    const room = makeRoom()
    const occlusion = captured.at(-1)?.occlusion as { query: (from: [number, number, number], to: [number, number, number]) => readonly { material?: string; thickness?: number }[] }
    const wall = room.world.raycast([0, 1.2, 0], [0, 0, -1])
    expect(wall).not.toBeNull()
    const z = wall!.point[2]
    const through = occlusion.query([0, 1.2, z - 3], [0, 1.2, z + 3])
    expect(through.length).toBeGreaterThan(0)
    expect(through[0]?.material).toBeTypeOf('string')
    expect(through[0]?.thickness).toBeGreaterThan(0)
    expect(occlusion.query([0, 1.2, z + 1], [0, 1.2, z + 4])).toEqual([])
  })

  it('a host engine is left as it is', () => {
    const before = captured.length
    makeRoom({ audio: false })
    expect(captured.length).toBe(before)
  })
})

describe('createWorldOcclusion over a plain slab', () => {
  const slab = { minZ: -5.12, maxZ: -5 }
  const world = {
    raycast(origin: [number, number, number], direction: [number, number, number], maxDistance = Infinity) {
      if (direction[2] === 0) return null
      const near = (direction[2] < 0 ? slab.maxZ : slab.minZ) - origin[2]
      const distance = near / direction[2]
      if (distance < 0 || distance > maxDistance) return null
      return { object: 'wall', part: 'slab', point: [origin[0], origin[1], origin[2] + direction[2] * distance] as [number, number, number], normal: [0, 0, 1] as [number, number, number], distance }
    },
    part: (object: string, part: string) => (object === 'wall' && part === 'slab' ? { material: 'brick' } : null),
  }

  it('measures the thickness from the way in and the way out, and counts nothing when the path is clear', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const query = createWorldOcclusion(world)
    const hits = query([0, 1, 0], [0, 1, -10])
    expect(hits).toHaveLength(1)
    expect(hits[0]?.material).toBe('brick')
    expect(hits[0]?.thickness).toBeCloseTo(0.12, 6)
    expect(query([0, 1, 0], [0, 1, -4])).toEqual([])
    expect(query([0, 1, 0], [0, 1, 0])).toEqual([])
  })
})

describe('createWorldOcclusion with layers side by side', () => {
  type Layer = { readonly part: string; readonly material: string; readonly near: number; readonly far: number }
  const layers: readonly Layer[] = [
    { part: 'brick', material: 'brick', near: -5, far: -5.12 },
    { part: 'glass', material: 'glass', near: -5.122, far: -5.126 },
  ]
  const world = {
    raycast(origin: [number, number, number], direction: [number, number, number], maxDistance = Infinity) {
      let best: { part: string; distance: number } | null = null
      for (const layer of layers) {
        const entering = direction[2] < 0 ? layer.near : layer.far
        const distance = (entering - origin[2]) / direction[2]
        if (distance < 0 || distance > maxDistance || (best && distance >= best.distance)) continue
        best = { part: layer.part, distance }
      }
      return best && { object: 'wall', part: best.part, point: [origin[0], origin[1], origin[2] + direction[2] * best.distance] as [number, number, number], normal: [0, 0, 1] as [number, number, number], distance: best.distance }
    },
    part: (_object: string, part: string) => ({ material: layers.find((layer) => layer.part === part)?.material ?? 'brick' }),
  }

  it('does not step over a thin layer right behind the one before it', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const hits = createWorldOcclusion(world)([0, 1, 0], [0, 1, -10])
    expect(hits.map((hit) => hit.material)).toEqual(['brick', 'glass'])
    expect(hits[1]?.thickness).toBeCloseTo(0.004, 6)
  })
})

describe('createWorldOcclusion from a source buried in the ground', () => {
  type Vec = [number, number, number]
  // the terrain answers a point inside it with a hit on its own surface at distance 0, as the ground impl does
  const GROUND = { near: -10, far: 3 }
  const GLASS = { near: 3.002, far: 3.006 }
  let rays = 0
  const world = {
    raycast(origin: Vec, direction: Vec, maxDistance = Infinity, options?: RaycastOptions) {
      rays++
      const z = origin[2]
      const forward = direction[2] > 0
      const layers = [
        { part: 'ground', ...GROUND },
        { part: 'glass', ...GLASS },
      ]
      let best: { part: string; distance: number } | null = null
      for (const layer of layers) {
        if (options?.ignoreParts?.some((ignored) => ignored.object === 'scene' && ignored.part === layer.part)) continue
        const isInside = z >= layer.near && z <= layer.far
        const entering = forward ? layer.near : layer.far
        const distance = isInside ? 0 : (entering - z) / direction[2]
        if (distance < 0 || distance > maxDistance || (best && distance >= best.distance)) continue
        best = { part: layer.part, distance }
      }
      return best && { object: 'scene', part: best.part, point: [origin[0], origin[1], z + direction[2] * best.distance] as Vec, normal: [0, 0, 1] as Vec, distance: best.distance }
    },
    part: (_object: string, part: string) => ({ material: part === 'glass' ? 'glass' : 'dirt' }),
  }

  it('leaves the ground in a few rays, not one per millimetre, and still finds the glass right behind it', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    rays = 0
    const hits = createWorldOcclusion(world)([0, -0.5, -9], [0, -0.5, 8])
    expect(hits.map((hit) => hit.material)).toEqual(['dirt', 'glass'])
    expect(rays).toBeLessThan(200)
  })
})

describe('createWorldOcclusion over a destruction world after a blast', () => {
  const wallSpec = (): DestructibleSpec => ({ name: 'wall', parts: [{ id: 'bricks', material: 'brick', shape: { kind: 'box', size: [4, 2.6, 0.12] }, position: [0, 0, 0] }] })
  const brickSpec = (): DestructibleSpec => ({ name: 'brick', parts: [{ id: 'unit', material: 'brick', shape: { kind: 'box', size: [0.19, 0.09, 0.057] }, position: [0, 0, 0] }] })
  const boards = (): DestructibleSpec => ({
    name: 'boards',
    parts: [
      { id: 'front', material: 'wood_hard', shape: { kind: 'box', size: [1.2, 1, 0.04] }, position: [0, 0, 0.3] },
      { id: 'back', material: 'wood_hard', shape: { kind: 'box', size: [1.2, 1, 0.04] }, position: [0, 0, -0.3] },
    ],
    joints: [{ id: 'clip', a: 'front', b: 'back', kind: 'clip' }],
  })
  const SOURCE: [number, number, number] = [0, 1.2, -8]
  const EAR: [number, number, number] = [0, 1.2, 8]

  it('counts the wall with the same loss as before, and neither the debris nor the loose piece lying on the path', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const { totalLossDb } = await import('@adatechnology/game-audio')
    const bare = createDestruction()
    bare.add(wallSpec(), { position: [0, 1.3, 0] })
    const before = createWorldOcclusion(bare)(SOURCE, EAR)
    expect(before.map((hit) => hit.material)).toEqual(['brick'])

    const after = createDestruction()
    after.add(wallSpec(), { position: [0, 1.3, 0] })
    const bricks = [0, 1, 2, 3, 4].map((index) => after.add(brickSpec(), { position: [0, 1.2, -6 + index] }))
    const whole = after.add(boards(), { position: [0, 1.2, 4] })
    after.disassemble(whole, 'clip', 'hand', 10)
    const group = after.state(whole)?.groups.findIndex((names) => names.includes('back')) ?? -1
    const loose = after.splitGroup(whole, group)
    // the raw rays meet the bricks and the loose board first
    expect(bricks).toContain(after.raycast(SOURCE, [0, 0, 1])?.object)
    expect(after.raycast([0, 1.2, 3.5], [0, 0, 1])?.object).toBe(loose)

    const through = createWorldOcclusion(after)(SOURCE, EAR)
    // the board left standing still occludes; the bricks on the floor and the loose board do not
    expect(through.map((hit) => hit.material)).toEqual(['brick', 'wood_hard'])
    expect(through[0]).toEqual(before[0])
    expect(totalLossDb(through.slice(0, 1))).toBe(totalLossDb(before))
  })
})

describe('createWorldOcclusion walking out of a solid matches the walk of one millimetre at a time', () => {
  type Vec = [number, number, number]
  /** `ordinary`: answers only at its entry face, never from inside (a plain object, unlike an impl's surface). */
  type Layer = { part: string; near: number; far: number; ordinary?: true }
  const worldOf = (layers: readonly Layer[]) => {
    const counter = { rays: 0 }
    const world = {
      raycast(origin: Vec, direction: Vec, maxDistance = Infinity, options?: RaycastOptions) {
        counter.rays++
        const z = origin[2]
        let best: { part: string; distance: number } | null = null
        for (const layer of layers) {
          if (options?.ignoreParts?.some((ignored) => ignored.object === 'scene' && ignored.part === layer.part)) continue
          const isInside = !layer.ordinary && z >= layer.near && z <= layer.far
          const distance = isInside ? 0 : ((direction[2] > 0 ? layer.near : layer.far) - z) / direction[2]
          if (distance < 0 || distance > maxDistance || (best && distance >= best.distance)) continue
          best = { part: layer.part, distance }
        }
        return best && { object: 'scene', part: best.part, point: [origin[0], origin[1], z + direction[2] * best.distance] as Vec, normal: [0, 0, 1] as Vec, distance: best.distance }
      },
      part: (_object: string, part: string) => ({ material: part }),
    }
    return { world, counter }
  }
  /** The reference walk: one millimetre past every hit, the same layer counted once in a row. */
  const millimetreWalk = (layers: readonly Layer[], from: number, to: number): string[] => {
    const { world } = worldOf(layers)
    const found: string[] = []
    let travelled = 0
    const length = to - from
    while (found.length < 6 && travelled < length) {
      const hit = world.raycast([0, 0, from + travelled], [0, 0, 1], length - travelled)
      if (!hit) break
      if (found.at(-1) !== hit.part) found.push(hit.part)
      travelled += hit.distance + 0.001
    }
    return found
  }
  const CASES: readonly { name: string; layers: readonly Layer[]; from: number; to: number; maxRays?: number }[] = [
    { name: 'a wall in the valley between two rises of the same ground', layers: [{ part: 'ground', near: -10, far: -2 }, { part: 'wall', near: -1.8, far: -1.65 }, { part: 'ground', near: -1.4, far: 6 }], from: -9, to: 8 },
    { name: 'a valley half a metre wide with nothing in it', layers: [{ part: 'ground', near: -10, far: 0 }, { part: 'ground', near: 0.5, far: 6 }, { part: 'glass', near: 6.002, far: 6.006 }], from: -9, to: 8 },
    { name: 'source and listener both inside the ground', layers: [{ part: 'ground', near: -10, far: 10 }], from: -9, to: 8 },
    { name: 'an air gap of 5 cm between two stretches of the same ground, with a wall in it', layers: [{ part: 'ground', near: -10, far: 0 }, { part: 'wall', near: 0.02, far: 0.03 }, { part: 'ground', near: 0.05, far: 6 }], from: -9, to: 8 },
    { name: 'an air gap of 20 cm between two stretches of the same ground, with a wall in it', layers: [{ part: 'ground', near: -10, far: 0 }, { part: 'wall', near: 0.1, far: 0.12 }, { part: 'ground', near: 0.2, far: 6 }], from: -9, to: 8 },
    { name: 'an ordinary wall buried inside the ground', layers: [{ part: 'ground', near: -10, far: 6 }, { part: 'wall', near: 1, far: 1.2, ordinary: true }, { part: 'glass', near: 6.002, far: 6.006 }], from: -9, to: 8 },
    { name: 'an impl-like wall buried inside the ground', layers: [{ part: 'ground', near: -10, far: 6 }, { part: 'wall', near: 1, far: 1.2 }, { part: 'glass', near: 6.002, far: 6.006 }], from: -9, to: 8, maxRays: 1500 },
    { name: 'a wall that starts inside the ground and ends in the air past it', layers: [{ part: 'ground', near: -10, far: 2 }, { part: 'wall', near: 1, far: 2.5 }], from: -9, to: 8, maxRays: 12000 },
    { name: 'a wall that starts inside the ground and ends inside it (the mirror)', layers: [{ part: 'ground', near: -10, far: 6 }, { part: 'wall', near: -2, far: 2.5 }, { part: 'glass', near: 6.002, far: 6.006 }], from: -9, to: 8, maxRays: 40000 },
    { name: 'a wall that starts before the ground and ends inside it', layers: [{ part: 'wall', near: -9.5, far: -8 }, { part: 'ground', near: -9.9, far: 4 }], from: -9.8, to: 8, maxRays: 15000 },
    { name: 'a layer thinner than the step right at the source', layers: [{ part: 'film', near: -9, far: -8.9995 }, { part: 'wall', near: -5, far: -4.8 }], from: -9, to: 8 },
  ]
  for (const scene of CASES) {
    it(scene.name, async () => {
      const { createWorldOcclusion } = await import('../src/world-occlusion')
      const { world, counter } = worldOf(scene.layers)
      const hits = createWorldOcclusion(world)([0, 0, scene.from], [0, 0, scene.to])
      expect(hits.map((hit) => hit.material)).toEqual(millimetreWalk(scene.layers, scene.from, scene.to))
      expect(counter.rays).toBeLessThan(scene.maxRays ?? 400)
    })
  }

  /** mulberry32: the scenes below are the same on every run. */
  const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const SCENE = { from: 0, to: 2.5 }
  /** One to five layers anywhere on the path (overlapping, touching, buried or apart), each 3 mm wide or more; about half answer from inside. */
  const randomScene = (random: () => number): Layer[] =>
    Array.from({ length: 1 + Math.floor(random() * 5) }, (_, index): Layer => {
      const near = -0.3 + random() * 2.6
      const width = 0.003 + random() ** 3
      return { part: `layer${index}`, near, far: near + width, ...(random() < 0.5 ? { ordinary: true as const } : {}) }
    })
  const mirrored = (layers: readonly Layer[]): Layer[] => layers.map((layer) => ({ ...layer, near: SCENE.from + SCENE.to - layer.far, far: SCENE.from + SCENE.to - layer.near }))

  it('counts the same layers as the walk of one millimetre over 300 seeded random scenes, each read both ways', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const random = seeded(20261120)
    for (let index = 0; index < 300; index++) {
      const scene = randomScene(random)
      for (const layers of [scene, mirrored(scene)]) {
        const hits = createWorldOcclusion(worldOf(layers).world)([0, 0, SCENE.from], [0, 0, SCENE.to])
        expect(hits.map((hit) => hit.material), `scene ${index}: ${JSON.stringify(layers)}`).toEqual(millimetreWalk(layers, SCENE.from, SCENE.to))
      }
    }
  })
})

describe('createWorldOcclusion from a source buried deep in the ground', () => {
  it('leaves 100 m of ground in tens of rays and still finds the glass past it', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    let rays = 0
    const layers = [{ part: 'ground', near: -100, far: 3 }, { part: 'glass', near: 3.002, far: 3.006 }]
    const world = {
      raycast(origin: [number, number, number], direction: [number, number, number], maxDistance = Infinity, options?: RaycastOptions) {
        rays++
        const z = origin[2]
        let best: { part: string; distance: number } | null = null
        for (const layer of layers) {
          if (options?.ignoreParts?.some((ignored) => ignored.object === 'scene' && ignored.part === layer.part)) continue
          const distance = z >= layer.near && z <= layer.far ? 0 : ((direction[2] > 0 ? layer.near : layer.far) - z) / direction[2]
          if (distance < 0 || distance > maxDistance || (best && distance >= best.distance)) continue
          best = { part: layer.part, distance }
        }
        return best && { object: 'scene', part: best.part, point: [origin[0], origin[1], z + direction[2] * best.distance] as [number, number, number], normal: [0, 0, 1] as [number, number, number], distance: best.distance }
      },
      part: (_object: string, part: string) => ({ material: part }),
    }
    const hits = createWorldOcclusion(world)([0, 0, -99], [0, 0, 8])
    expect(hits.map((hit) => hit.material)).toEqual(['ground', 'glass'])
    expect(rays).toBeLessThan(40)
  })
})

describe('createWorldOcclusion over air narrower than the old stride between two stretches of the same ground', () => {
  type Vec = [number, number, number]
  // wherever the walk out of the ground happens to land, the wall in the gap is counted: the 1 mm walk always sees it
  for (const gap of [0.05, 0.2]) {
    it(`a gap of ${gap * 100} cm with a wall in it, from any source offset`, async () => {
      const { createWorldOcclusion } = await import('../src/world-occlusion')
      const layers = [{ part: 'ground', near: -10, far: 0 }, { part: 'wall', near: gap / 2 - 0.004, far: gap / 2 + 0.004 }, { part: 'ground', near: gap, far: 6 }]
      const world = {
        raycast(origin: Vec, direction: Vec, maxDistance = Infinity, options?: RaycastOptions) {
          const z = origin[2]
          let best: { part: string; distance: number } | null = null
          for (const layer of layers) {
            if (options?.ignoreParts?.some((ignored) => ignored.object === 'scene' && ignored.part === layer.part)) continue
            const distance = z >= layer.near && z <= layer.far ? 0 : (layer.near - z) / direction[2]
            if (distance < 0 || distance > maxDistance || (best && distance >= best.distance)) continue
            best = { part: layer.part, distance }
          }
          return best && { object: 'scene', part: best.part, point: [origin[0], origin[1], z + direction[2] * best.distance] as Vec, normal: [0, 0, 1] as Vec, distance: best.distance }
        },
        part: (_object: string, part: string) => ({ material: part }),
      }
      const query = createWorldOcclusion(world, { maxHits: 6 })
      for (let offset = 0; offset < 0.3; offset += 0.0071) {
        const materials = query([0, 0, -9 - offset], [0, 0, 8]).map((hit) => hit.material)
        expect(materials, `offset ${offset}`).toEqual(['ground', 'wall', 'ground'])
      }
    })
  }
})

describe('createWorldOcclusion over a destruction world with the real terrain', () => {
  type Vec = [number, number, number]
  const wallSpec = (height: number): DestructibleSpec => ({ name: 'wall', parts: [{ id: 'bricks', material: 'brick', shape: { kind: 'box', size: [0.2, height, 4] }, position: [0, 0, 0] }] })
  const sceneWith = (walls: readonly Vec[], heights: readonly number[]) => {
    const world = createDestruction()
    world.register(createTerrainImpl(createTerrain({ bounds: [-20, -20, 20, 20], layout: { surface: 'dirt' } }), { id: 'ground' }))
    walls.forEach((position, index) => world.add(wallSpec(heights[index] ?? 2), { position }))
    return world
  }
  /** The walk of one millimetre at a time, the part of the same layer counted once in a row. */
  const millimetreWalk = (world: ReturnType<typeof createDestruction>, from: Vec, to: Vec): string[] => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const direction: Vec = [(to[0] - from[0]) / length, (to[1] - from[1]) / length, (to[2] - from[2]) / length]
    const skip: RaycastOptions = { skipLoose: true, minObjectRadius: OCCLUDER_MIN_RADIUS }
    const found: string[] = []
    let travelled = 0
    while (found.length < 6 && travelled < length) {
      const hit = world.raycast([from[0] + direction[0] * travelled, from[1] + direction[1] * travelled, from[2] + direction[2] * travelled], direction, length - travelled, skip)
      if (!hit) break
      const key = `${hit.object}/${hit.part}`
      if (found.at(-1) !== key) found.push(key)
      travelled += hit.distance + 0.001
    }
    return found
  }
  const CASES: readonly { name: string; walls: readonly Vec[]; heights?: readonly number[]; from: Vec; to: Vec }[] = [
    { name: 'a source buried in the ground looking up at a wall standing on it', walls: [[0, 1, 0]], from: [-8, -1, 0], to: [8, 1.5, 0] },
    { name: 'a path inside the ground with a wall buried across it', walls: [[0, -1.2, 0]], heights: [1], from: [-8, -1, 0], to: [8, -1, 0] },
    { name: 'a wall straddling the ground level', walls: [[0, 0, 0]], from: [-8, -1, 0], to: [8, 1, 0] },
  ]
  for (const scene of CASES) {
    it(scene.name, async () => {
      const { createWorldOcclusion } = await import('../src/world-occlusion')
      const world = sceneWith(scene.walls, scene.heights ?? [])
      const counted = createWorldOcclusion(world)(scene.from, scene.to).length
      const reference = millimetreWalk(world, scene.from, scene.to)
      expect(counted, JSON.stringify(reference)).toBe(reference.length)
    })
  }
})

describe('createWorldOcclusion cost over overlapping solids', () => {
  const countRays = async (layers: readonly { part: string; near: number; far: number; ordinary?: true }[]): Promise<number> => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    let rays = 0
    const world = {
      raycast(origin: [number, number, number], direction: [number, number, number], maxDistance = Infinity, options?: RaycastOptions) {
        rays++
        const z = origin[2]
        let best: { part: string; distance: number } | null = null
        for (const layer of layers) {
          if (options?.ignoreParts?.some((ignored) => ignored.object === 'scene' && ignored.part === layer.part)) continue
          const distance = !layer.ordinary && z >= layer.near && z <= layer.far ? 0 : ((direction[2] > 0 ? layer.near : layer.far) - z) / direction[2]
          if (distance < 0 || distance > maxDistance || (best && distance >= best.distance)) continue
          best = { part: layer.part, distance }
        }
        return best && { object: 'scene', part: best.part, point: [origin[0], origin[1], z + direction[2] * best.distance] as [number, number, number], normal: [0, 0, 1] as [number, number, number], distance: best.distance }
      },
      part: (_object: string, part: string) => ({ material: part }),
    }
    createWorldOcclusion(world)([0, 0, -99], [0, 0, 8])
    return rays
  }

  it('costs tens of rays with nothing overlapping and a few thousand for 0.5 m of overlap between two parts that answer from inside, however long the ground', async () => {
    const clear = await countRays([{ part: 'ground', near: -100, far: 3 }, { part: 'wall', near: 1, far: 1.2, ordinary: true }])
    expect(clear).toBeLessThan(40)
    const overlap = await countRays([{ part: 'ground', near: -100, far: 2 }, { part: 'wall', near: 1.5, far: 2.5 }])
    expect(overlap).toBeGreaterThan(clear)
    expect(overlap).toBeLessThan(4000)
  })
})

describe('createWorldOcclusion step', () => {
  it('refuses a step that would never advance', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const world = { raycast: () => null, part: () => null }
    for (const step of [0, -0.001, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => createWorldOcclusion(world, { step })).toThrow(RangeError)
  })
})

describe('createWorldOcclusion ignoring one part of one object at a time', () => {
  type Vec = [number, number, number]
  /** `ordinary`: answers only at its entry face. Two layers may share a part name under different objects. */
  type Layer = { object: string; part: string; near: number; far: number; ordinary?: true }
  const sceneOf = (layers: readonly Layer[]) => {
    const ignoredLists: (readonly { object: string; part: string }[])[] = []
    const world = {
      raycast(origin: Vec, direction: Vec, maxDistance = Infinity, options?: RaycastOptions) {
        if (options?.ignoreParts) ignoredLists.push(options.ignoreParts)
        const z = origin[2]
        let best: { layer: Layer; distance: number } | null = null
        for (const layer of layers) {
          if (options?.ignoreParts?.some((ignored) => ignored.object === layer.object && ignored.part === layer.part)) continue
          const isInside = !layer.ordinary && z >= layer.near && z <= layer.far
          const distance = isInside ? 0 : ((direction[2] > 0 ? layer.near : layer.far) - z) / direction[2]
          if (distance < 0 || distance > maxDistance || (best && distance >= best.distance)) continue
          best = { layer, distance }
        }
        return best && { object: best.layer.object, part: best.layer.part, point: [origin[0], origin[1], z + direction[2] * best.distance] as Vec, normal: [0, 0, 1] as Vec, distance: best.distance }
      },
      part: (object: string, part: string) => ({ material: `${object}/${part}` }),
    }
    return { world, ignoredLists }
  }
  const FROM: Vec = [0, 0, -9]
  const TO: Vec = [0, 0, 8]

  it('ignores the object and the part of the layer it stands in, never a part of the same name in another object', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    // the ground and the wall past it both call their part `body`: a world that compared the part alone would lose the wall with the ground
    const { world, ignoredLists } = sceneOf([{ object: 'ground', part: 'body', near: -10, far: 0 }, { object: 'wall', part: 'body', near: 0.5, far: 0.62, ordinary: true }])
    const hits = createWorldOcclusion(world)(FROM, TO)
    expect(hits.map((hit) => hit.material)).toEqual(['ground/body', 'wall/body'])
    expect(hits[1]?.thickness).toBeCloseTo(0.12, 6)
    expect(ignoredLists.length).toBeGreaterThan(0)
    for (const list of ignoredLists) expect(list.map(({ object, part }) => ({ object, part }))).toEqual([{ object: 'ground', part: 'body' }])
  })

  it('stops at maxHits when the last one counted is found by the ray that ignores the part it is in', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const layers: Layer[] = [
      { object: 'ground', part: 'body', near: -10, far: 0 },
      { object: 'first', part: 'slab', near: 0.5, far: 0.6, ordinary: true },
      { object: 'second', part: 'slab', near: 1, far: 1.1, ordinary: true },
      { object: 'third', part: 'slab', near: 1.5, far: 1.6, ordinary: true },
    ]
    const all = ['ground/body', 'first/slab', 'second/slab', 'third/slab']
    for (const maxHits of [1, 2, 3, 4, 6]) {
      const { world, ignoredLists } = sceneOf(layers)
      const hits = createWorldOcclusion(world, { maxHits })(FROM, TO)
      expect(hits.map((hit) => hit.material), `maxHits ${maxHits}`).toEqual(all.slice(0, maxHits))
      // with one hit allowed the walk ends on the ground and never asks what is past it
      expect(ignoredLists.length > 0, `maxHits ${maxHits}`).toBe(maxHits > 1)
    }
  })

  it('cut short by maxHits, the way in and the way out count different layers and no thickness is paired', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const { world } = sceneOf([
      { object: 'ground', part: 'body', near: -10, far: 0 },
      { object: 'first', part: 'slab', near: 0.5, far: 0.6, ordinary: true },
      { object: 'second', part: 'slab', near: 1, far: 1.1, ordinary: true },
    ])
    // in: ground, first. Out (from the listener): second, first. Paired by place, only `first` would match the wrong layer, so nothing is measured
    const hits = createWorldOcclusion(world, { maxHits: 2 })(FROM, TO)
    expect(hits).toEqual([{ material: 'ground/body' }, { material: 'first/slab' }])
  })

  it('walks back the same way: an ordinary part buried in the ground is counted from neither end, and the ground and the glass keep their thickness', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const { world } = sceneOf([
      { object: 'ground', part: 'body', near: -10, far: 6 },
      { object: 'pipe', part: 'shell', near: 1, far: 1.2, ordinary: true },
      { object: 'pane', part: 'glass', near: 6.002, far: 6.006, ordinary: true },
    ])
    const hits = createWorldOcclusion(world)(FROM, TO)
    expect(hits.map((hit) => hit.material)).toEqual(['ground/body', 'pane/glass'])
    // the source is inside the ground: its way in is the source itself
    expect(hits[0]?.thickness).toBeCloseTo(15, 6)
    expect(hits[1]?.thickness).toBeCloseTo(0.004, 6)
  })

  it('walks back the same way: a part that answers from inside, buried in the ground, is counted from neither end', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const { world } = sceneOf([
      { object: 'ground', part: 'body', near: -10, far: 6 },
      { object: 'rock', part: 'body', near: 1, far: 1.2 },
      { object: 'pane', part: 'glass', near: 6.002, far: 6.006, ordinary: true },
    ])
    const hits = createWorldOcclusion(world)(FROM, TO)
    expect(hits.map((hit) => hit.material)).toEqual(['ground/body', 'pane/glass'])
    expect(hits[0]?.thickness).toBeCloseTo(15, 6)
    expect(hits[1]?.thickness).toBeCloseTo(0.004, 6)
  })

  it('a part half buried in the ground is paired from both ends: the overlap goes to the ground, the rest to the part', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const { world } = sceneOf([{ object: 'ground', part: 'body', near: -10, far: 2 }, { object: 'rock', part: 'body', near: 1, far: 2.5 }])
    const hits = createWorldOcclusion(world)(FROM, TO)
    expect(hits.map((hit) => hit.material)).toEqual(['ground/body', 'rock/body'])
    // each end finds the face of the ground within one step (1 mm)
    expect(hits[0]?.thickness).toBeGreaterThan(11 - 0.0011)
    expect(hits[0]?.thickness).toBeLessThan(11 + 0.0011)
    expect(hits[1]?.thickness).toBeGreaterThan(0.5 - 0.0011)
    expect(hits[1]?.thickness).toBeLessThan(0.5 + 0.0011)
  })
})

describe('createWorldOcclusion over a destruction world with an impl of several parts', () => {
  type Vec = [number, number, number]
  const SPANS = [
    { part: 'soil', near: -5, far: 2 },
    { part: 'rock', near: 1, far: 6 },
  ] as const
  /** A hosted body of two parts that overlap from z = 1 to z = 2; each answers a point inside it at distance 0, as the ground does, and honours `ignored`. */
  const strata = (): DestructibleImpl => {
    const spec: DestructibleSpec = {
      name: 'strata',
      parts: [
        { id: 'soil', material: 'dirt', shape: { kind: 'box', size: [10, 10, 7] }, position: [0, 0, -1.5] },
        { id: 'rock', material: 'concrete', shape: { kind: 'box', size: [10, 10, 5] }, position: [0, 0, 3.5] },
      ],
    }
    return {
      id: 'strata',
      describe: () => spec,
      hit: () => [],
      update: () => [],
      // the world reads a hosted part's material from its state
      state: (): ObjectState => ({
        id: 'strata', position: [0, 0, 0], rotation: [0, 0, 0, 1], groups: [['soil', 'rock']], destroyed: false, joints: [],
        parts: spec.parts.map((part) => ({ id: part.id, material: part.material, status: 'intact', hp: 1, maxHp: 1, mass: 0, temperature: 0, burning: false, fuel: 0, char: 0, melt: 0, dents: [], holes: [], cracks: [], group: 0 })),
      }),
      surfaceRay(ray: SurfaceRay): SurfaceRayHit | null {
        const z = ray.origin[2]
        let best: SurfaceRayHit | null = null
        for (const span of SPANS) {
          if (ray.ignored?.(span.part)) continue
          const distance = z >= span.near && z <= span.far ? 0 : ((ray.direction[2] > 0 ? span.near : span.far) - z) / ray.direction[2]
          if (!(distance >= 0) || distance > ray.maxDistance || (best && distance >= best.distance)) continue
          best = { part: span.part, point: [ray.origin[0], ray.origin[1], z + ray.direction[2] * distance], normal: [0, 0, -Math.sign(ray.direction[2])], distance, pathLen: span.far - span.near }
        }
        return best
      },
    }
  }
  const IN_BOTH: Vec = [0, 0, 1.5]
  const AHEAD: Vec = [0, 0, 1]

  it('with one part ignored its sister answers at distance 0 from inside the overlap, and with both ignored the ray goes on', () => {
    const world = createDestruction()
    world.register(strata())
    const wall = world.add({ name: 'wall', parts: [{ id: 'slab', material: 'brick', shape: { kind: 'box', size: [4, 4, 0.1] }, position: [0, 0, 0] }] }, { position: [0, 0, 7] })
    expect(world.raycast(IN_BOTH, AHEAD)).toMatchObject({ object: 'strata', part: 'soil', distance: 0 })
    expect(world.raycast(IN_BOTH, AHEAD, undefined, { ignoreParts: [{ object: 'strata', part: 'soil' }] })).toMatchObject({ object: 'strata', part: 'rock', distance: 0 })
    expect(world.raycast(IN_BOTH, AHEAD, undefined, { ignoreParts: [{ object: 'strata', part: 'rock' }] })).toMatchObject({ object: 'strata', part: 'soil', distance: 0 })
    const past = world.raycast(IN_BOTH, AHEAD, undefined, { ignoreParts: [{ object: 'strata', part: 'soil' }, { object: 'strata', part: 'rock' }] })
    expect(past).toMatchObject({ object: wall, part: 'slab' })
    expect(past?.distance).toBeCloseTo(5.45, 6)
  })

  it('the occlusion counts both parts once each and pairs their thickness from both ends', async () => {
    const { createWorldOcclusion } = await import('../src/world-occlusion')
    const world = createDestruction()
    world.register(strata())
    const hits = createWorldOcclusion(world)([0, 0, -8], [0, 0, 9])
    expect(hits.map((hit) => hit.material)).toEqual(['dirt', 'concrete'])
    // the overlap is the soil's from both ends (it answers first), within one step
    expect(Math.abs((hits[0]?.thickness ?? Number.NaN) - 7)).toBeLessThan(0.0011)
    expect(Math.abs((hits[1]?.thickness ?? Number.NaN) - 4)).toBeLessThan(0.0011)
  })
})
