import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionWorld, JointSpec, PartSpec, Vec3 } from '../src'

/**
 * A split builds its halves from what the world remembers of the specs (contacts, spans, cast members, sections shot away, what a part's spec gives). This
 * walks the ways that memory must be left aside or measured again between splits: a slab and later its bond beam moved (`setPartPose`), a pillar shot so
 * the units out of it grow across two splits, a bond beam broken along a stretch over a void, and a half set back as it was (`reset`). The hash was
 * recorded on the code that measured everything again at every split.
 */
const LENGTH = 10
const DEPTH = 4
const PILLARS = [0, 3.5, 6.5, 10]
const UNITS: PartSpec['units'] = { size: [0.19, 0.09, 0.14], bond: 'running', mortar: 'mortar' }
const STEEL: PartSpec['reinforcement'] = { material: 'steel', spacing: 0.1, diameter: 0.01 }
/** The concrete of a cast member as 0.1 m blocks, as the houses lay it: rounds wear its section away block by block. */
const MEMBER_UNITS: PartSpec['units'] = { size: [0.1, 0.1, 0.15], bond: 'stack', mortar: 'concrete' }

const rests = (a: string, b: string, kind: JointSpec['kind'] = 'mortar'): JointSpec => ({ a, b, kind, bears: 'a_on_b' })

/** Two walls of units on ground beams, cast pillars and bond beams, a slab on both: a void under one breaks its bond beam over the opening only. */
const twoWallHouse = (): DestructibleSpec => {
  const line = (pre: string, z: number): PartSpec[] => [
    { id: `${pre}gb`, material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [LENGTH, 0.3, 0.15] }, position: [LENGTH / 2, -0.15, z] },
    { id: `${pre}wall`, material: 'brick', structure: { role: 'wall' }, units: UNITS, shape: { kind: 'box', size: [LENGTH, 2.8, 0.15] }, position: [LENGTH / 2, 1.4, z] },
    ...PILLARS.map((x, k): PartSpec => ({ id: `${pre}p${k}`, material: 'concrete', structure: { role: 'column' }, reinforcement: STEEL, units: MEMBER_UNITS, shape: { kind: 'box', size: [0.15, 2.8, 0.15] }, position: [x, 1.4, z] })),
    { id: `${pre}cinta`, material: 'concrete', structure: { role: 'beam' }, reinforcement: STEEL, shape: { kind: 'box', size: [LENGTH, 0.2, 0.15] }, position: [LENGTH / 2, 2.9, z] },
  ]
  const lineJoints = (pre: string): JointSpec[] => [
    rests(`${pre}gb`, 'ground', 'rebar'), ...PILLARS.map((_, k) => rests(`${pre}p${k}`, 'ground', 'rebar')), rests(`${pre}wall`, `${pre}gb`), rests(`${pre}cinta`, `${pre}wall`),
    ...PILLARS.map((_, k) => rests(`${pre}cinta`, `${pre}p${k}`)), ...PILLARS.map((_, k): JointSpec => ({ a: `${pre}wall`, b: `${pre}p${k}`, kind: 'mortar', bears: false })),
  ]
  return {
    name: 'two-walls',
    tags: ['structure'],
    parts: [
      { id: 'ground', material: 'concrete', anchored: true, hp: 1e12, structure: { role: 'foundation' }, tags: ['terrain'], shape: { kind: 'box', size: [LENGTH + 12, 0.5, DEPTH + 12] }, position: [LENGTH / 2, -0.25, DEPTH / 2] },
      ...line('s_', 0), ...line('n_', DEPTH),
      { id: 'slab', material: 'concrete', structure: { role: 'slab' }, reinforcement: { material: 'steel', spacing: 0.15, diameter: 0.008 }, shape: { kind: 'box', size: [LENGTH, 0.1, DEPTH] }, position: [LENGTH / 2, 3.05, DEPTH / 2] },
    ],
    joints: [...lineJoints('s_'), ...lineJoints('n_'), rests('slab', 's_cinta'), rests('slab', 'n_cinta')],
  }
}

/** Every loose group of every object becomes an object of its own, logged. */
const splitAll = (world: DestructionWorld, log: string[]): string[] => {
  const made: string[] = []
  for (const id of world.serialize().objects.map((o) => o.id)) {
    for (let guard = 0; guard < 64 && (world.state(id)?.groups.length ?? 0) > 1; guard++) {
      const piece = world.splitGroup(id, 1)
      made.push(piece)
      log.push(`split ${id} -> ${piece} ${JSON.stringify(world.state(piece)?.parts.map((p) => p.id))}`)
    }
  }
  return made
}

const steps = (world: DestructionWorld, log: string[], frames: number): void => {
  for (let i = 0; i < frames; i++) for (const e of world.update(0.1)) log.push(`${e.type} ${e.object} ${'part' in e ? String(e.part) : ''}`)
}

/** Rounds into the pillar at the west end of the south wall: its section wears away where they land (`chipped`). */
const shootPillar = (world: DestructionWorld, log: string[], rounds: number, y: number): void => {
  for (let i = 0; i < rounds; i++) log.push(JSON.stringify(world.shoot([0.02, y, -5], [0, 0, 1], 3300, 7.62, 'test').map((r) => [r.object, r.part])))
}

/** A fan of rays across the house: what they meet says where the cast members of the walls are and what still stands. */
const rays = (world: DestructionWorld): unknown[] => {
  const out: unknown[] = []
  for (let a = 0; a < 48; a++) {
    for (const y of [0.4, 1.4, 2.5]) {
      const angle = (a / 48) * Math.PI * 2
      const origin: Vec3 = [LENGTH / 2 + Math.cos(angle) * 12, y, DEPTH / 2 + Math.sin(angle) * 12]
      const hit = world.raycast(origin, [-Math.cos(angle), 0, -Math.sin(angle)], 24)
      out.push(hit ? [hit.object, hit.part, ...hit.point] : null)
    }
  }
  return out
}

const scenario = (): { hash: string; log: string[] } => {
  const world = createDestruction({ seed: 3 })
  const id = world.add(twoWallHouse())
  const log: string[] = []
  // the slab moved a millimetre: what touches it is measured again
  world.setPartPose(id, 'slab', [LENGTH / 2, 3.051, DEPTH / 2])
  shootPillar(world, log, 40, 1.0)
  steps(world, log, 5)
  // a void under the south wall breaks its bond beam over the opening; the pillars over it fall
  world.groundLoss({ x: 5, z: 0, radius: 3.6, depth: 1.5, source: 'crater' })
  steps(world, log, 200)
  const first = splitAll(world, log)
  // the bond beam the slab rests on moved too, then more rounds on the pillar: its units out grow after the split
  world.setPartPose(id, 'n_cinta', [LENGTH / 2, 2.901, DEPTH])
  shootPillar(world, log, 40, 0.6)
  steps(world, log, 10)
  const second = splitAll(world, log)
  // a half set back as it was, then a blast that splits again
  const half = first[0] ?? second[0]
  if (half !== undefined) world.reset(half)
  world.explode([LENGTH / 2, 1, DEPTH + 1], 2e7, 8, 'test')
  steps(world, log, 10)
  splitAll(world, log)
  steps(world, log, 10)
  log.push(JSON.stringify(world.serialize()))
  log.push(JSON.stringify(rays(world)))
  return { hash: createHash('sha256').update(log.join('\n')).digest('hex'), log }
}

describe('split caches: the same world as measuring everything again', () => {
  it('poses, sections shot across splits, a broken bond beam and a reset half', () => {
    const { hash, log } = scenario()
    if (process.env.PRINT_SPLIT_HASH) console.log(`[HASH] ${hash}\n[LOG] ${log.filter((l) => l.startsWith('split')).join('\n')}`)
    expect(hash).toBe('c7802280ec74529876a29f526126f4e6df23e56ca4f43de92d05814f5999f0c8')
  })
})
