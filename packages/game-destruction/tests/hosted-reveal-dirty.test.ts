import { describe, expect, it } from 'vitest'

import { assemblyPart, createDestruction } from '../src'
import type { DestructibleSpec, DestructionEvent, JointSpec, PartSpec } from '../src'
import { ofType } from './wall-helpers'

const STRETCHES = [-2.25, -0.75, 0.75, 2.25] as const
const stretchId = (index: number): string => `pipe:${index}`

const pipeSpec = (index: number, x: number): PartSpec => ({
  id: stretchId(index), material: 'plastic', shape: { kind: 'box', size: [1.5, 0.1, 0.1] }, position: [x, 1, 0], mass: 1, hostedIn: 'wall', tags: ['pipe'],
})

const hostedWallSpec = (): DestructibleSpec => {
  const wall = assemblyPart('brick_wall_plastered', { id: 'wall', width: 6, height: 2.1, position: [0, 1.05, 0] })
  const clips: JointSpec[] = STRETCHES.map((_, index) => ({ a: stretchId(index), b: 'wall', kind: 'clip', bears: false }))
  const sockets: JointSpec[] = STRETCHES.slice(1).map((_, index) => ({ a: stretchId(index), b: stretchId(index + 1), kind: 'glue', bears: false }))
  return { parts: [{ ...wall, anchored: true }, ...STRETCHES.map((x, index) => pipeSpec(index, x))], joints: [...clips, ...sockets] }
}

const collapseHostSpec = (): DestructibleSpec => ({
  parts: [
    { id: 'base', material: 'concrete', shape: { kind: 'box', size: [2, 1, 0.4] }, position: [0, 0.5, 0], anchored: true, structure: { role: 'wall' } },
    { id: 'upper', material: 'concrete', shape: { kind: 'box', size: [2, 1, 0.4] }, position: [0, 1.5, 0], structure: { role: 'wall' } },
    { id: 'wire', material: 'plastic', shape: { kind: 'box', size: [0.6, 0.1, 0.1] }, position: [0, 1.5, 0], mass: 0.5, hostedIn: 'upper' },
  ],
  joints: [
    { a: 'base', b: 'upper', kind: 'mortar', bears: true },
    { a: 'wire', b: 'upper', kind: 'clip', bears: false },
  ],
})

/** A reveal the world still owes: a copy loaded from its snapshot checks every damaged host on its first operation, so anything it reveals was missed. */
const missedReveals = (world: ReturnType<typeof createDestruction>): string[] => {
  const copy = createDestruction({ seed: 7 })
  copy.load(world.serialize())
  const events: DestructionEvent[] = []
  copy.on('reveal', (event) => events.push(event))
  copy.update(0)
  return ofType(events, 'reveal').map((event) => `${event.object}/${event.part}`)
}

describe('revealHostedIn dirty tracking', () => {
  it('does not run revealHostedIn on idle steps when nothing hosted changed', () => {
    const world = createDestruction({ seed: 7 })
    for (let index = 0; index < 5; index++) world.add(hostedWallSpec(), { id: `wall_${index}`, position: [index * 40, 0, 0] })

    for (let step = 0; step < 10; step++) world.update(1 / 60)

    expect(world.hostedProbe()).toEqual({ runs: 0, objects: 0 })
  })

  it('checks only the affected object on blast and goes back to zero work once settled', () => {
    const world = createDestruction({ seed: 7 })
    const primary = world.add(hostedWallSpec(), { id: 'primary', position: [0, 0, 0] })
    for (let index = 0; index < 4; index++) world.add(hostedWallSpec(), { id: `far_${index}`, position: [60 + index * 40, 0, 0] })

    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))

    world.explode([-0.75, 1, 0.3], 20000, 15)
    world.update(0.1)

    const revealed = ofType(events, 'reveal').map((event) => event.part)
    expect(revealed).toContain(stretchId(1))
    expect(world.part(primary, stretchId(1))!.exposed).toBe(true)
    expect(world.hostedProbe().runs).toBeGreaterThan(0)
    // distant untouched walls must not be scanned
    expect(world.hostedProbe().objects).toBeLessThan(5)

    // settle any remaining activity, then verify idle steps do not run revealHostedIn
    for (let step = 0; step < 20; step++) world.update(0.1)
    const afterSettle = world.hostedProbe()
    for (let step = 0; step < 10; step++) world.update(1 / 60)
    expect(world.hostedProbe()).toEqual(afterSettle)
  })

  it('reveals hosted parts when the host breaks via direct damage', () => {
    const world = createDestruction({ seed: 7 })
    const id = world.add({
      parts: [
        { id: 'panel', material: 'concrete', shape: { kind: 'box', size: [2, 2, 0.2] }, position: [0, 1, 0], anchored: true, hp: 50 },
        { id: 'cable', material: 'plastic', shape: { kind: 'box', size: [0.5, 0.1, 0.1] }, position: [0, 1, 0], mass: 0.5, hostedIn: 'panel' },
      ],
      joints: [{ a: 'cable', b: 'panel', kind: 'clip', bears: false }],
    })
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))

    world.hitPart(id, 'panel', { type: 'blunt', energy: 3e6, point: [0, 1, 0.1], radius: 0.05 })
    expect(world.part(id, 'cable')!.exposed).toBe(true)
    expect(ofType(events, 'reveal').map((event) => event.part)).toEqual(['cable'])
  })

  it('reveals hosted parts when the host collapses structurally', () => {
    const world = createDestruction({ seed: 7 })
    const id = world.add(collapseHostSpec())
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))

    world.hitPart(id, 'base', { type: 'blunt', energy: 3e6, point: [0, 0.5, 0.2], radius: 0.05 })
    world.update(0.1)

    expect(world.part(id, 'upper')!.status).toBe('collapsed')
    expect(world.part(id, 'wire')!.exposed).toBe(true)
    expect(ofType(events, 'reveal').map((event) => event.part)).toEqual(['wire'])
  })

  it('reveals a hosted part moved into an existing host opening via setPartPose', () => {
    const world = createDestruction({ seed: 7 })
    const id = world.add(hostedWallSpec())
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))

    world.explode([-0.75, 1, 0.3], 20000, 15)
    world.update(0.1)
    expect(world.part(id, stretchId(3))!.exposed).toBeUndefined()

    // move the untouched far-right pipe stretch into the hole at x = -0.75
    world.setPartPose(id, stretchId(3), [-0.75, 1, 0])
    world.update(0.1)

    expect(world.part(id, stretchId(3))!.exposed).toBe(true)
    expect(ofType(events, 'reveal').map((event) => event.part)).toContain(stretchId(3))
  })

  it('reveals hosted parts after loading a snapshot with a damaged host and unexposed hosted part', () => {
    const world = createDestruction({ seed: 7 })
    const id = world.add(hostedWallSpec())
    world.explode([-0.75, 1, 0.3], 20000, 15)
    world.update(0.1)

    const snap = world.serialize()
    const targetObj = snap.objects.find((o) => o.id === id)!
    const stretch1 = targetObj.state.parts.find((p) => p.id === stretchId(1))!
    delete stretch1.exposed
    const clip1 = targetObj.state.joints.find((j) => j.id === `${stretchId(1)}~wall`)!
    clip1.open = false

    const restored = createDestruction({ seed: 7 })
    restored.load(snap)
    const events: DestructionEvent[] = []
    restored.on('*', (event) => events.push(event))

    restored.update(1 / 60)

    expect(restored.part(id, stretchId(1))!.exposed).toBe(true)
    expect(ofType(events, 'reveal').map((event) => event.part)).toContain(stretchId(1))
  })
  it('reveals in world order, as a full scan does, whatever order the objects were marked in', () => {
    const world = createDestruction({ seed: 7 })
    const first = world.add(hostedWallSpec(), { id: 'first', position: [0, 0, 0] })
    const second = world.add(hostedWallSpec(), { id: 'second', position: [40, 0, 0] })
    world.explode([-0.75, 1, 0.3], 20000, 15)
    world.explode([39.25, 1, 0.3], 20000, 15)
    world.update(0.1)
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))

    // marked second first: the reveals still come out in the order the objects were added
    world.setPartPose(second, stretchId(3), [-0.75, 1, 0])
    world.setPartPose(first, stretchId(3), [-0.75, 1, 0])
    world.update(1 / 60)

    expect(ofType(events, 'reveal').map((event) => event.object)).toEqual([first, second])
  })

  it('keeps an object dirty when the reveal of an earlier one throws, and reveals it on the next operation', () => {
    const world = createDestruction({ seed: 7 })
    const first = world.add(hostedWallSpec(), { id: 'first', position: [0, 0, 0] })
    const second = world.add(hostedWallSpec(), { id: 'second', position: [40, 0, 0] })
    world.explode([-0.75, 1, 0.3], 20000, 15)
    world.explode([39.25, 1, 0.3], 20000, 15)
    world.update(0.1)
    world.setPartPose(first, stretchId(3), [-0.75, 1, 0])
    world.setPartPose(second, stretchId(3), [-0.75, 1, 0])
    let thrown = false
    world.on('reveal', () => {
      if (thrown) return
      thrown = true
      throw new Error('listener failed')
    })

    expect(() => world.update(1 / 60)).toThrow('listener failed')
    world.update(1 / 60)

    expect(world.part(second, stretchId(3))!.exposed).toBe(true)
  })
  it('owes no reveal after any swing of a sledgehammer that chips and then breaches the host', () => {
    const world = createDestruction({ seed: 7 })
    const id = world.add(hostedWallSpec())
    let swings = 0
    for (; swings < 200 && world.part(id, stretchId(1))!.exposed !== true; swings++) {
      world.hit(id, { type: 'blunt', point: [-0.75, 1, 0.065], direction: [0, 0, -1], energy: 128, radius: 0.05 })
      expect(missedReveals(world)).toEqual([])
    }
    expect(world.part(id, stretchId(1))!.exposed).toBe(true)
  })

  it('owes no reveal after any shot that chips the host', () => {
    const world = createDestruction({ seed: 7 })
    const id = world.add(hostedWallSpec())
    for (let shot = 0; shot < 60 && world.part(id, stretchId(2))!.exposed !== true; shot++) {
      world.shoot([0.6 + (shot % 7) * 0.05, 0.95 + (shot % 3) * 0.05, 5], [0, 0, -1], 2100, 7.62, 'test')
      expect(missedReveals(world)).toEqual([])
    }
    expect(world.part(id, stretchId(2))!.exposed).toBe(true)
  })
  it('owes no reveal after any swing above the pipe, until the breach opening reaches it', () => {
    const world = createDestruction({ seed: 7 })
    const id = world.add(hostedWallSpec())
    for (let swing = 0; swing < 200 && (world.part(id, 'wall')!.stage ?? 0) < 2; swing++) {
      world.hit(id, { type: 'blunt', point: [-0.75, 1.3, 0.065], direction: [0, 0, -1], energy: 128, radius: 0.05 })
      expect(missedReveals(world)).toEqual([])
    }
    expect(world.part(id, 'wall')!.stage).toBe(2)
    expect(world.part(id, stretchId(1))!.exposed).toBe(true)
  })
})
