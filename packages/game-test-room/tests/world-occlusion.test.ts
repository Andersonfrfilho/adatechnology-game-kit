import { describe, expect, it, vi } from 'vitest'
import type { AudioEngineOptions } from '@adatechnology/game-audio'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
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
