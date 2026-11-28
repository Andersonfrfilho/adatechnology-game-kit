import { describe, expect, it } from 'vitest'
import { createDestruction, MATERIALS, rotateVec } from '../src'
import type { DestructionEvent, Fragment } from '../src'
import { planFragments } from '../src/fracture'

type Vec3 = [number, number, number]

const board = (size: Vec3, material: string) => ({ parts: [{ id: 'b', material, shape: { kind: 'box' as const, size }, position: [0, 0, 0] as Vec3 }] })
const fracture = (events: DestructionEvent[]) => events.find((e): e is Extract<DestructionEvent, { type: 'fracture' }> => e.type === 'fracture')
const shot = (y: number) => ({ type: 'ballistic' as const, point: [0, y, 0.05] as Vec3, direction: [0, 0, -1] as Vec3, energy: 527, caliber: 9 })
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}

/** Shoot the middle of a board until it breaks and answer its fragments. */
const breakBoard = (size: Vec3, material: string): Fragment[] => {
  const w = createDestruction()
  const id = w.add(board(size, material))
  for (let n = 0; n < 400; n++) {
    const f = fracture(w.hit(id, shot(0.3)).events)
    if (f) return f.fragments
  }
  throw new Error(`${material} did not break`)
}

describe('wood comes apart by how it is made (MaterialDef.splitForm)', () => {
  it('the built-in woods say how they split: solid wood in slivers, plywood in plies, MDF in granules', () => {
    const form = (id: string) => MATERIALS.find((m) => m.id === id)?.splitForm
    expect([form('wood_soft'), form('wood_hard'), form('green_wood')]).toEqual(['slivers', 'slivers', 'slivers'])
    expect(form('plywood')).toBe('plies')
    expect(form('mdf')).toBe('granules')
  })

  it('solid wood splinters along the grain in many lengths and widths, not a stack of equal slats', () => {
    const plan = planFragments({ style: 'splinter', dims: [0.1, 1, 0.03], thickness: 0.03, hit: [0, 0, 0], fragmentSize: [0.03, 0.15], maxFragments: 24, rnd: rng(3), form: 'slivers' })
    expect(plan.every((p) => p.shape === 'splinter')).toBe(true)
    expect(plan.length).toBeLessThanOrEqual(24)
    const lengths = plan.map((p) => p.size[0])
    const sections = plan.map((p) => p.size[1] * p.size[2])
    expect(Math.max(...lengths) / Math.min(...lengths)).toBeGreaterThan(2.5)
    expect(Math.max(...sections) / Math.min(...sections)).toBeGreaterThan(1.5)
    // each splinter is long along the grain
    expect(plan.every((p) => p.size[0] > p.size[1] && p.size[0] > p.size[2])).toBe(true)
  })

  it('a board of solid wood broken across leaves two stubs whose torn end (their +x) faces the break', () => {
    const fragments = breakBoard([0.3, 2, 0.02], 'wood_soft')
    const stubs = fragments.filter((f) => f.shape === 'slab')
    expect(stubs).toHaveLength(2)
    for (const stub of stubs) {
      const end = rotateVec(stub.rotation, [1, 0, 0])
      // the board lies along y and broke near y = 0.3: the torn end of each stub points at it
      expect(Math.abs(end[1])).toBeCloseTo(1, 3)
      expect(Math.sign(end[1])).toBe(Math.sign(0.3 - stub.center[1]))
      expect(stub.size[0]).toBeCloseTo(Math.max(...stub.size), 6)
    }
  })

  it('an MDF panel cracks from where it was hit: its slabs meet at that point, the lumps lie round it, all as thin as the panel', () => {
    const hit: Vec3 = [0.004, 0.12, -0.08]
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = planFragments({ style: 'snap', dims: [0.018, 0.8, 0.45], thickness: 0.018, hit, fragmentSize: [0.08, 0.35], maxFragments: 18, rnd: rng(seed), form: 'granules' })
      const slabs = plan.filter((p) => p.shape === 'slab')
      expect(slabs.length).toBeGreaterThanOrEqual(4)
      for (const p of plan) expect(Math.min(...p.size)).toBeLessThanOrEqual(0.018)
      // four slabs have a corner on the hit, along the two long axes of the panel
      const cornered = slabs.filter((p) => [1, 2].every((a) => Math.abs(Math.abs(p.center[a]! - hit[a]!) - p.size[a]! / 2) < 1e-9))
      expect(cornered.length).toBe(4)
      // the slabs tile the panel
      const area = slabs.reduce((sum, p) => sum + p.size[1]! * p.size[2]!, 0)
      expect(area).toBeCloseTo(0.8 * 0.45, 9)
      const lumps = plan.filter((p) => p.shape === 'chunk')
      expect(lumps.length).toBeGreaterThan(0)
      for (const l of lumps) expect(Math.hypot(l.center[1]! - hit[1]!, l.center[2]! - hit[2]!)).toBeLessThan(0.2)
    }
  })

  it('plywood peels apart: thin splinters and sheets in two or three layers that start apart', () => {
    const fragments = breakBoard([0.3, 1, 0.012], 'plywood')
    expect(fragments.length).toBeLessThanOrEqual(64)
    const sheets = fragments.filter((f) => f.shape === 'scrap')
    const splinters = fragments.filter((f) => f.shape === 'splinter')
    expect(sheets.length).toBeGreaterThan(2)
    expect(splinters.length).toBeGreaterThan(0)
    // the layers lie at different depths of the board, further apart than the plies they were (12 mm board)
    const depths = [...new Set(sheets.map((f) => Math.round(f.center[2] * 1000)))]
    expect(depths.length).toBeGreaterThanOrEqual(2)
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(6)
    // a splinter of plywood is thinner than the board
    expect(Math.min(...splinters.map((f) => f.size[2]))).toBeLessThan(0.006)
  })

  it('a block of plywood (a kennel drawn as one box) comes apart in thin sheets through its depth, not in blocks', () => {
    const plan = planFragments({ style: 'snap', dims: [0.6, 0.5, 0.64], thickness: 0.64, hit: [0, 0, 0], fragmentSize: [0.1, 0.4], maxFragments: 24, rnd: rng(5), form: 'plies' })
    expect(plan.length).toBeGreaterThan(4)
    expect(Math.max(...plan.map((p) => Math.min(...p.size)))).toBeLessThanOrEqual(0.012)
    const depths = new Set(plan.map((p) => Math.round(p.center[1] * 100)))
    expect(depths.size).toBeGreaterThanOrEqual(2)
  })

  it('MDF crumbles: lumps and no splinters, as it has no grain', () => {
    const fragments = breakBoard([0.3, 1, 0.018], 'mdf')
    expect(fragments.some((f) => f.shape === 'splinter')).toBe(false)
    expect(fragments.filter((f) => f.shape === 'chunk').length).toBeGreaterThanOrEqual(5)
  })

  it('a round tears thinner splinters off plywood than off solid wood', () => {
    const torn = (material: string): Fragment[] => {
      const world = createDestruction({ seed: 3 })
      world.add({ parts: [{ id: 'board', material, shape: { kind: 'box', size: [0.8, 0.018, 0.3] }, position: [0, 1, 0], mass: 2.5 }] }, { id: 's' })
      const fragments: Fragment[] = []
      world.on('chip', (e) => fragments.push(...(e as Extract<DestructionEvent, { type: 'chip' }>).fragments))
      for (let i = 0; i < 4; i++) world.shoot([i * 0.1, 2, 0], [0, -1, 0], 500, 9, 'test')
      return fragments
    }
    const thinnest = (fragments: Fragment[]) => fragments.reduce((sum, f) => sum + Math.min(...f.size), 0) / fragments.length
    const ply = torn('plywood')
    const solid = torn('wood_soft')
    expect(ply.length).toBeGreaterThan(0)
    expect(solid.length).toBeGreaterThan(0)
    expect(thinnest(ply)).toBeLessThan(thinnest(solid))
  })
})
