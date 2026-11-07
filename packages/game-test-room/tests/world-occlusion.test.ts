import { describe, expect, it, vi } from 'vitest'
import type { AudioEngineOptions } from '@adatechnology/game-audio'
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
