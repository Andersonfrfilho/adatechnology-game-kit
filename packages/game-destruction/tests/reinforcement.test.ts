import { describe, expect, it } from 'vitest'
import { assemblyPart, createDestruction, sizeStructure } from '../src'
import type { DestructibleSpec, DestructionEvent } from '../src'
import { gateSpec, maxStage, ofType, runFor, wallWorld } from './wall-helpers'

const C4 = { energy: 345600, radius: 18 }
const RPG = { energy: 200000, radius: 16 }

describe('reinforced concrete wall', () => {
  it.each([['C4', C4], ['RPG-7', RPG]])('%s on a point of the wall: stage 2, rebar exposed inside the opening, the wall stays', (_name, blast) => {
    const w = wallWorld('reinforced_concrete')
    w.world.explode([0, 1, 0.12], blast.energy, blast.radius)
    expect(ofType(w.events, 'stage').map((e) => e.stage)).toEqual([1, 2])
    const stage = ofType(w.events, 'stage').find((e) => e.stage === 2)!
    const expose = ofType(w.events, 'expose')
    expect(expose).toHaveLength(1)
    const bars = expose[0]!.bars
    expect(bars.length).toBeGreaterThan(3)
    const { center, radius } = stage.opening!
    for (const [a, b] of bars) {
      for (const end of [a, b]) expect(Math.hypot(end[0] - center[0], end[1] - center[1])).toBeLessThanOrEqual(radius + 0.05 + 1e-9)
      expect(Math.abs(a[2])).toBeLessThan(1e-9)
    }
    expect(stage.fragments!.every((f) => f.size[0] <= 0.6 + 1e-9 && f.size[1] <= 0.42 + 1e-9)).toBe(true)
    const wall = w.world.part(w.objectId, 'wall')!
    expect(wall.status).not.toBe('broken')
    expect(wall.stripped).toBeUndefined()
  })

  it('bars are laid every 0.18 m in two grids at mid thickness', () => {
    const w = wallWorld('reinforced_concrete')
    w.world.hit(w.objectId, { type: 'blunt', point: [0, 1, 0.1], direction: [0, 0, -1], energy: 5e6, radius: 0.05 })
    const expose = ofType(w.events, 'expose')[0]!
    const vertical = expose.bars.filter(([a, b]) => Math.abs(a[0] - b[0]) < 1e-9)
    const horizontal = expose.bars.filter(([a, b]) => Math.abs(a[1] - b[1]) < 1e-9)
    expect(vertical.length + horizontal.length).toBe(expose.bars.length)
    expect(horizontal.length).toBe(12)
    expect(vertical.length).toBe(14)
    const xs = vertical.map(([a]) => a[0]).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(0.18, 6)
  })

  it('at 0 hp the concrete crumbles in 4 x 5 panels but the wall stays as its rebar cage', () => {
    const w = wallWorld('reinforced_concrete')
    const mass = w.world.part(w.objectId, 'wall')!.mass
    w.world.hit(w.objectId, { type: 'blunt', point: [0, 1, 0.1], direction: [0, 0, -1], energy: 5e6, radius: 0.05 })
    const fracture = ofType(w.events, 'fracture')
    expect(fracture).toHaveLength(1)
    expect(fracture[0]!.fragments).toHaveLength(20)
    expect(fracture[0]!.fragments.every((f) => Math.abs(f.size[0] - 0.6) < 1e-9 && Math.abs(f.size[1] - 0.42) < 1e-9)).toBe(true)
    const wall = w.world.part(w.objectId, 'wall')!
    expect(wall.stripped).toBe(true)
    expect(wall.status).toBe('damaged')
    expect(wall.stage).toBe(3)
    expect(wall.mass).toBeLessThan(mass * 0.05)
    expect(maxStage(w.events)).toBe(3)
    expect(w.world.state(w.objectId)!.destroyed).toBe(false)
  })

  it('a bare cage lets bullets through and the cage is lost when something finishes it', () => {
    const w = wallWorld('reinforced_concrete')
    w.world.hit(w.objectId, { type: 'blunt', point: [0, 1, 0.1], direction: [0, 0, -1], energy: 5e6, radius: 0.05 })
    const shot = w.world.shoot([0, 1, 3], [0, 0, -1], 400, 9)
    expect(shot[0]!.penetrated).toBe(true)
    expect(shot[0]!.exitEnergy).toBe(400)
    w.world.hit(w.objectId, { type: 'blunt', point: [0, 1, 0.1], direction: [0, 0, -1], energy: 5e8, radius: 0.05 })
    expect(w.world.part(w.objectId, 'wall')!.status).toBe('broken')
    expect(ofType(w.events, 'expose').at(-1)!.bars).toEqual([])
    expect(w.world.state(w.objectId)!.destroyed).toBe(true)
  })
})

const lastTime = (events: readonly DestructionEvent[], type: DestructionEvent['type'], part?: string): number =>
  Math.max(...events.filter((e) => e.type === type && (part === undefined || ('part' in e && e.part === part))).map((e) => e.time))

const gate = (residualCapacity?: number) => {
  const spec: DestructibleSpec = sizeStructure(gateSpec())
  if (residualCapacity !== undefined) for (const p of spec.parts) if (p.reinforcement) p.reinforcement = { ...p.reinforcement, residualCapacity }
  const world = createDestruction({ seed: 5 })
  const id = world.add(spec)
  const events: DestructionEvent[] = []
  world.on('*', (e) => events.push(e))
  return { world, id, events }
}

describe('progressive collapse of a reinforced frame', () => {
  const rpgOnColumn = (g: ReturnType<typeof gate>) => g.world.hit(g.id, { type: 'explosive', point: [-1.5, 1.5, 0.15], energy: RPG.energy, radius: 1.5 })

  it('an RPG on a column exposes its cage, overloads it, and the slab and roof come down some seconds later', () => {
    const g = gate()
    rpgOnColumn(g)
    const column = g.world.part(g.id, 'c0')!
    expect(column.stripped).toBe(true)
    expect(column.status).toBe('damaged')
    expect(ofType(g.events, 'expose')[0]).toMatchObject({ part: 'c0' })
    expect(column.stress!).toBeGreaterThan(1)
    expect(g.events.some((e) => e.type === 'collapse')).toBe(false)
    const blastTime = g.world.time
    const after = runFor(g.world, 30)
    const collapse = ofType(after, 'collapse')
    expect(collapse.length).toBeGreaterThan(0)
    expect(collapse.flatMap((e) => e.parts)).toEqual(expect.arrayContaining(['slab', 'roof']))
    expect(collapse[0]!.time - blastTime).toBeGreaterThan(2)
    expect(collapse[0]!.time - blastTime).toBeLessThan(20)
    const kinds = g.events.map((e) => e.type)
    expect(kinds.indexOf('expose')).toBeLessThan(kinds.indexOf('stress'))
    expect(kinds.indexOf('stress')).toBeLessThan(kinds.indexOf('collapse'))
    expect(lastTime(g.events, 'stage', 'slab')).toBeGreaterThanOrEqual(collapse[0]!.time)
  })

  it('the spent cage is lost (broken) before the next member fails: the collapse is progressive', () => {
    const g = gate()
    rpgOnColumn(g)
    runFor(g.world, 30)
    expect(g.world.part(g.id, 'c0')!.status).toBe('broken')
    expect(g.world.part(g.id, 'c1')!.stripped).toBe(true)
    const lostC0 = ofType(g.events, 'expose').find((e) => e.part === 'c0' && e.bars.length === 0)!
    const exposedC1 = ofType(g.events, 'expose').find((e) => e.part === 'c1')!
    expect(exposedC1.time).toBeGreaterThan(lostC0.time)
  })

  it('a cage that keeps most of the capacity carries the load and nothing falls', () => {
    const g = gate(0.9)
    rpgOnColumn(g)
    expect(g.world.part(g.id, 'c0')!.stress!).toBeLessThan(1)
    const after = runFor(g.world, 60)
    expect(after.some((e) => e.type === 'collapse')).toBe(false)
    expect(g.world.part(g.id, 'c0')!.status).toBe('damaged')
  })

  it('a bare cage that carries nothing is cut by the torch, joint by joint', () => {
    const world = createDestruction({ seed: 5 })
    const spec: DestructibleSpec = {
      parts: [
        { id: 'f', material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [0, -0.15, 0], structure: { role: 'foundation' } },
        {
          id: 'col', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [0, 1.5, 0], structure: { role: 'column' },
          reinforcement: { material: 'steel', spacing: 0.18, diameter: 0.008 }, breach: {},
        },
      ],
      joints: [{ a: 'col', b: 'f', kind: 'rebar', bears: 'a_on_b' }],
    }
    const id = world.add(spec)
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    world.hit(id, { type: 'explosive', point: [0, 1.5, 0.15], energy: RPG.energy, radius: 1.5 })
    expect(world.part(id, 'col')!.stripped).toBe(true)
    expect(world.part(id, 'col')!.stress!).toBeLessThan(1)
    expect(world.workableJoints(id, 'cutting_torch').map((j) => j.id)).toEqual(['col~f'])
    expect(world.workableJoints(id, 'saw').map((j) => j.id)).toEqual(['col~f'])
    expect(world.disassemble(id, 'col~f', 'hammer', 1)).toBe(-1)
    let progress = 0
    for (let second = 0; second < 25 && progress < 1; second++) progress = world.disassemble(id, 'col~f', 'cutting_torch', 1)
    expect(progress).toBe(1)
    expect(ofType(events, 'detach')[0]).toMatchObject({ joint: 'col~f', by: 'tool' })
    expect(world.state(id)!.groups.length).toBe(2)
  })
})

describe('assembly parts in a frame', () => {
  it('an assembly part with a structural role carries its own mass and falls when its support goes', () => {
    const world = createDestruction()
    const id = world.add({
      parts: [
        { id: 'f', material: 'concrete', shape: { kind: 'box', size: [3, 0.3, 0.6] }, position: [0, -0.15, 0], structure: { role: 'foundation' } },
        assemblyPart('brick_wall_plastered', { id: 'w', width: 2.4, height: 2.1, position: [0, 1.05, 0], structure: { role: 'wall' } }),
      ],
      joints: [{ a: 'w', b: 'f', kind: 'mortar', bears: 'a_on_b' }],
    })
    expect(world.part(id, 'w')!.load).toBeCloseTo(world.part(id, 'w')!.mass, 6)
    expect(world.part(id, 'w')!.stress!).toBeGreaterThan(0)
  })
})
