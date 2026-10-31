import { describe, expect, it } from 'vitest'
import { ITEM_USES, LIQUIDS, createFluids, createItemUse, locales, resolveStrings, stainDirection } from '../src'
import type { FluidEvent, FluidWorld, Quat } from '../src'

/** Rotation of `angle` radians around Z. */
const tiltZ = (angle: number): Quat => [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)]

const FLOOR = { id: 'floor', point: [0, 0, 0] as [number, number, number], normal: [0, 1, 0] as [number, number, number], halfSize: [5, 5] as [number, number], porosity: 0.05 }

const cup = (world: FluidWorld, liquid = 'coffee', liters = 0.25, position: [number, number, number] = [0, 0.8, 0]) =>
  world.addContainer(
    { capacity: 0.25, liquid, liters, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 },
    { id: 'cup', position },
  )

const run = (world: FluidWorld, seconds: number, dt = 0.05): FluidEvent[] => {
  const events: FluidEvent[] = []
  for (let t = 0; t < seconds; t += dt) events.push(...world.update(dt))
  return events
}

describe('data', () => {
  it('ships the liquids and item uses', () => {
    const ids = LIQUIDS.map((l) => l.id)
    for (const id of ['water', 'coffee', 'tea', 'milk', 'soda', 'juice', 'beer', 'wine', 'spirits', 'fuel', 'diesel', 'motor_oil', 'cooking_oil', 'blood', 'old_blood', 'bile', 'sap', 'acid', 'paint', 'bleach', 'honey'])
      expect(ids).toContain(id)
    expect(LIQUIDS.find((l) => l.id === 'coffee')!.drink!.effects).toContain('caffeine')
    expect(LIQUIDS.find((l) => l.id === 'beer')!.drink!.effects).toContain('alcohol')
    expect(LIQUIDS.find((l) => l.id === 'fuel')!.drink!.effects).toContain('poison')
    expect(LIQUIDS.find((l) => l.id === 'blood')!.drink!.effects).toContain('disgust')
    expect(ITEM_USES.map((u) => u.id).sort()).toEqual(['chug', 'close', 'drink', 'eat', 'open', 'pour', 'pour_out', 'sip', 'unscrew'])
    expect(ITEM_USES.find((u) => u.id === 'sip')!.duration).toBe(1.2)
  })

  it('has en and pt-BR strings for every liquid', () => {
    for (const l of LIQUIDS) {
      expect(locales.en.liquids[l.id]).toBeTruthy()
      expect(locales['pt-BR'].liquids[l.id]).toBeTruthy()
    }
    expect(locales['pt-BR'].liquids.coffee).toBe('café')
    expect(resolveStrings('xx')).toBe(locales.en)
  })
})

describe('drinking', () => {
  it('three sips and a drink lower the level and emit drink events with caffeine', () => {
    const world = createFluids()
    cup(world)
    const before = world.container('cup')!.surfaceHeight
    const events: FluidEvent[] = []
    const sipped: number[] = []
    for (const id of ['sip', 'sip', 'sip', 'drink']) {
      const player = createItemUse(world, 'cup', ITEM_USES.find((u) => u.id === id)!)
      const used: FluidEvent[] = []
      while (!player.done) used.push(...player.update(1 / 30))
      events.push(...used)
      sipped.push(used.reduce((s, e) => s + (e.type === 'drink' ? e.liters : 0), 0))
    }
    expect(sipped.slice(0, 3).map((v) => Math.round(v * 1000) / 1000)).toEqual([0.03, 0.03, 0.03])
    const drinks = events.filter((e): e is Extract<FluidEvent, { type: 'drink' }> => e.type === 'drink')
    expect(drinks.length).toBeGreaterThanOrEqual(4)
    expect(drinks.every((d) => d.effects.includes('caffeine'))).toBe(true)
    const total = drinks.reduce((s, d) => s + d.liters, 0)
    // The cup only holds 0.25 l: the three sips take 0.09 l and the drink takes what is left.
    expect(total).toBeCloseTo(0.25, 5)
    expect(events.some((e) => e.type === 'empty')).toBe(true)
    expect(world.container('cup')!.liters).toBe(0)
    expect(before).toBeGreaterThan(0)
    expect(drinks.reduce((s, d) => s + d.thirst, 0)).toBeGreaterThan(0)
  })

  it('burns when the drink is hotter than 65 C and ends when empty', () => {
    const world = createFluids()
    world.addContainer({ capacity: 0.2, liquid: 'tea', liters: 0.05, temperature: 90, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 }, { id: 'mug' })
    expect(world.drink('mug', 0.03)!.burn).toBe(true)
    const empties: FluidEvent[] = []
    world.on('empty', (e) => empties.push(e))
    expect(world.drink('mug', 1)!.liters).toBeCloseTo(0.02, 6)
    expect(empties).toHaveLength(1)
    expect(world.drink('mug', 0.1)).toBeNull()
  })
})

describe('event delivery', () => {
  it('delivers a direct-call event exactly once, and update returns only what it produced', () => {
    const world = createFluids()
    cup(world)
    const heard: FluidEvent[] = []
    world.on('*', (e) => heard.push(e))
    const returned: FluidEvent[] = []
    const ev = world.drink('cup', 0.03)
    if (ev) returned.push(ev)
    returned.push(...world.update(0.05))
    const all = [...returned]
    expect(all.filter((e) => e.type === 'drink')).toHaveLength(1)
    expect(heard.filter((e) => e.type === 'drink')).toHaveLength(1)
    expect(world.update(0.05)).toEqual([])
  })
})

describe('spilling', () => {
  it('a full cup tilted 90 degrees spills and leaves a stain on the floor', () => {
    const world = createFluids({ seed: 3 })
    world.addSurface(FLOOR)
    cup(world)
    world.setTransform('cup', [0, 0.8, 0], tiltZ(-Math.PI / 2))
    const events = run(world, 0.2)
    expect(events.some((e) => e.type === 'spill')).toBe(true)
    expect(world.streams().some((s) => s.cause === 'spill')).toBe(true)
    run(world, 2)
    const stains = world.stains()
    expect(stains.length).toBeGreaterThan(0)
    expect(stains[0].surface).toBe('floor')
    expect(world.container('cup')!.liters).toBeLessThan(0.1)
  })

  it('an upright cup does not spill, and neither does a closed bottle upright or tilted', () => {
    const world = createFluids()
    world.addSurface(FLOOR)
    cup(world)
    world.addContainer({ capacity: 1, liquid: 'water', liters: 1, shape: { kind: 'cylinder', radius: 0.035, height: 0.25 }, opening: 0.012, closed: true }, { id: 'bottle', position: [1, 0.8, 0] })
    run(world, 1)
    expect(world.streams()).toHaveLength(0)
    world.setTransform('bottle', [1, 0.8, 0], tiltZ(Math.PI / 2))
    run(world, 2)
    expect(world.streams()).toHaveLength(0)
    expect(world.container('bottle')!.liters).toBeCloseTo(1, 6)
    world.open('bottle')
    run(world, 0.3)
    expect(world.streams().some((s) => s.cause === 'spill')).toBe(true)
  })

  it('pour moves liquid out of the opening and into another container', () => {
    const world = createFluids()
    world.addContainer({ capacity: 1, liquid: 'water', liters: 1, shape: { kind: 'cylinder', radius: 0.035, height: 0.25 }, opening: 0.012 }, { id: 'bottle', position: [0, 1, 0] })
    world.addContainer({ capacity: 0.3, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 }, { id: 'glass' })
    let out = 0
    for (let i = 0; i < 30; i++) out += world.pour('bottle', 1 / 30, 'glass')
    expect(out).toBeGreaterThan(0.1)
    expect(world.container('glass')!.liters).toBeCloseTo(out, 6)
    expect(world.container('bottle')!.liters).toBeCloseTo(1 - out, 6)
  })

  it('fill mixes liquids (the bigger volume wins) and clamps to capacity', () => {
    const world = createFluids()
    world.addContainer({ capacity: 0.5, liquid: 'water', liters: 0.1, shape: { kind: 'cylinder', radius: 0.04, height: 0.2 }, opening: 0.04 }, { id: 'jug' })
    const events: FluidEvent[] = []
    world.on('*', (e) => events.push(e))
    expect(world.fill('jug', 'milk', 0.2)).toBeCloseTo(0.2, 9)
    expect(events.find((e) => e.type === 'mix')).toMatchObject({ from: 'water', into: 'milk' })
    expect(world.container('jug')!.liquid).toBe('milk')
    expect(world.fill('jug', 'milk', 5)).toBeCloseTo(0.2, 9)
    expect(world.container('jug')!.liters).toBeCloseTo(0.5, 9)
  })
})

describe('leaks', () => {
  it('a jerrycan punctured near the bottom leaks until the level falls under the hole', () => {
    const world = createFluids()
    world.addSurface(FLOOR)
    world.addContainer({ capacity: 18, liquid: 'fuel', liters: 10, shape: { kind: 'box', size: [0.3, 0.4, 0.15] }, opening: 0.02, closed: true }, { id: 'can', position: [0, 0.5, 0] })
    world.puncture('can', [0.15, 0.03, 0], [1, 0, 0], 0.02)
    const events = run(world, 1)
    expect(events.some((e) => e.type === 'leak')).toBe(true)
    expect(world.streams().filter((s) => s.cause === 'leak')).toHaveLength(1)
    expect(world.stains().length).toBeGreaterThan(0)
    run(world, 120)
    expect(world.streams()).toHaveLength(0)
    const left = world.container('can')!.liters
    // The liquid below the hole stays: 0.03 m of a 0.4 m tall 18 l box.
    expect(left).toBeCloseTo((0.03 / 0.4) * 18, 1)
    run(world, 30)
    expect(world.container('can')!.liters).toBeCloseTo(left, 6)
  })
})

describe('stains', () => {
  const spillOnFloor = (world: FluidWorld, liquid: string) => {
    world.addContainer({ capacity: 0.5, liquid, liters: 0.5, shape: { kind: 'cylinder', radius: 0.05, height: 0.12 }, opening: 0.05 }, { id: 'c', position: [0, 0.4, 0] })
    world.setTransform('c', [0, 0.4, 0], tiltZ(-Math.PI / 2))
  }

  it('has an irregular outline and is not a circle', () => {
    const world = createFluids({ seed: 11 })
    world.addSurface(FLOOR)
    spillOnFloor(world, 'water')
    run(world, 3)
    const s = world.stains()[0]
    expect(s.front).toHaveLength(16)
    const max = Math.max(...s.front)
    const min = Math.min(...s.front)
    expect(min).toBeGreaterThan(0)
    expect((max - min) / ((max + min) / 2)).toBeGreaterThan(0.1)
  })

  it('runs downhill on a sloped surface', () => {
    const world = createFluids({ seed: 5 })
    const a = 0.35
    const normal: [number, number, number] = [Math.sin(a), Math.cos(a), 0]
    world.addSurface({ id: 'ramp', point: [0, 0, 0], normal, halfSize: [4, 4], porosity: 0 })
    world.splash('water', [0, 0.01, 0], 0.3)
    run(world, 4)
    const s = world.stains()[0]
    const down = [Math.cos(a), -Math.sin(a), 0] // the direction along which the plane descends
    let downR = 0
    let upR = 0
    let bestDown = -2
    let bestUp = 2
    for (let i = 0; i < 16; i++) {
      const d = stainDirection(s, i)
      const align = d[0] * down[0] + d[1] * down[1] + d[2] * down[2]
      if (align > bestDown) {
        bestDown = align
        downR = s.front[i]
      }
      if (align < bestUp) {
        bestUp = align
        upR = s.front[i]
      }
    }
    expect(bestDown).toBeGreaterThan(0.9)
    expect(downR).toBeGreaterThan(upR * 1.5)
  })

  it('dries from the edge in; coffee leaves a mark and water does not', () => {
    const world = createFluids({ seed: 2 })
    world.addSurface(FLOOR)
    world.splash('water', [-1, 0.01, 0], 0.1)
    world.splash('coffee', [1, 0.01, 0], 0.1)
    run(world, 0.5)
    expect(world.stains().every((s) => s.wetness === 1 && s.wetRadius === 1)).toBe(true)
    run(world, 100, 1)
    const mid = world.stains()
    expect(mid).toHaveLength(2)
    for (const s of mid) {
      expect(s.wetRadius).toBeLessThan(1)
      expect(s.wetRadius).toBeGreaterThan(0)
      expect(s.wetness).toBeLessThan(1)
    }
    const events = run(world, 2000, 5)
    const left = world.stains()
    expect(left).toHaveLength(1)
    expect(left[0].liquid).toBe('coffee')
    expect(left[0].wetness).toBe(0)
    expect(left[0].mark).toBe(true)
    expect(events).toContainEqual(expect.objectContaining({ type: 'dried', mark: true }))
    expect(events).toContainEqual(expect.objectContaining({ type: 'dried', mark: false }))
  })

  it('porous surfaces soak the pool', () => {
    const world = createFluids()
    world.addSurface({ ...FLOOR, id: 'rug', porosity: 1 })
    world.splash('water', [0, 0.01, 0], 0.2)
    run(world, 0.5)
    const early = world.stains()[0]
    run(world, 10)
    const late = world.stains()[0]
    expect(late.soaked).toBeGreaterThan(early.soaked)
    expect(late.liters).toBeLessThan(early.liters)
  })

  it('respects maxStains and merges nearby landings', () => {
    const world = createFluids({ maxStains: 3 })
    world.addSurface(FLOOR)
    world.splash('water', [0, 0.01, 0], 0.05)
    world.splash('water', [0.05, 0.01, 0], 0.05)
    expect(world.stains()).toHaveLength(1)
    for (let i = 1; i <= 5; i++) world.splash('water', [i, 0.01, 0], 0.05)
    expect(world.stains().length).toBeLessThanOrEqual(3)
  })
})

describe('temperature', () => {
  it('hot coffee steams and stops steaming once cooled', () => {
    const world = createFluids()
    world.addContainer({ capacity: 0.25, liquid: 'coffee', liters: 0.25, temperature: 92, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 }, { id: 'cup' })
    const events = run(world, 1)
    expect(events).toContainEqual({ type: 'steam', container: 'cup', on: true })
    expect(world.container('cup')!.steaming).toBe(true)
    const later = run(world, 3600, 10)
    expect(later).toContainEqual({ type: 'steam', container: 'cup', on: false })
    expect(world.container('cup')!.steaming).toBe(false)
    expect(world.container('cup')!.temperature).toBeLessThan(60)
  })

  it('an insulated container cools about ten times slower', () => {
    const world = createFluids()
    const spec = { capacity: 0.25, liquid: 'coffee', liters: 0.25, temperature: 90, shape: { kind: 'cylinder' as const, radius: 0.04, height: 0.1 }, opening: 0.04 }
    world.addContainer(spec, { id: 'a' })
    world.addContainer({ ...spec, insulated: true }, { id: 'b' })
    run(world, 600, 10)
    const drop = (id: string) => 90 - world.container(id)!.temperature
    expect(drop('a')).toBeGreaterThan(drop('b') * 5)
    const before = world.container('b')!.temperature
    world.heat('b', 5)
    expect(world.container('b')!.temperature).toBeCloseTo(before + 5, 9)
  })
})

describe('determinism and snapshots', () => {
  const scenario = (seed: number) => {
    const world = createFluids({ seed })
    world.addSurface(FLOOR)
    cup(world)
    world.setTransform('cup', [0, 0.8, 0], tiltZ(-Math.PI / 2))
    run(world, 3)
    return world
  }

  it('same seed gives the same world, another seed another outline', () => {
    expect(scenario(7).serialize()).toEqual(scenario(7).serialize())
    expect(scenario(7).stains()[0].front).not.toEqual(scenario(8).stains()[0].front)
  })

  it('serialize and load round trip, and keep evolving identically', () => {
    const a = scenario(9)
    const snap = JSON.parse(JSON.stringify(a.serialize()))
    const b = createFluids({ seed: 1 })
    b.load(snap)
    expect(b.serialize()).toEqual(a.serialize())
    expect(b.stains()).toEqual(a.stains())
    run(a, 5)
    run(b, 5)
    expect(b.serialize()).toEqual(a.serialize())
  })

  it('describes events in the configured locale', () => {
    const world = createFluids({ locale: 'pt-BR' })
    cup(world)
    const e = world.drink('cup', 0.03)!
    expect(world.describe(e)).toContain('bebeu')
    expect(world.describe(e)).toContain('café')
  })
})

describe('taps', () => {
  const tapAt = (world: FluidWorld, extra: Record<string, unknown> = {}) =>
    world.addTap({ id: 'sink', position: [0, 1.2, 0], liquid: 'water', rate: 0.1, ...extra } as Parameters<FluidWorld['addTap']>[0])

  it('a running tap is a `tap` stream, with events when it is switched', () => {
    const world = createFluids()
    world.addSurface(FLOOR)
    const events: FluidEvent[] = []
    world.on('tap', (e) => events.push(e))
    expect(tapAt(world)).toBe('sink')
    const s = world.streams()
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ cause: 'tap', tap: 'sink', liquid: 'water', rate: 0.1 })
    expect(world.taps()[0]).toMatchObject({ id: 'sink', on: true, direction: [0, -1, 0] })
    run(world, 1)
    world.setTap('sink', false)
    expect(world.streams()).toHaveLength(0)
    world.setTap('sink', false)
    world.setTap('sink', true, 0.2)
    expect(world.streams()[0].rate).toBe(0.2)
    expect(events).toEqual([
      { type: 'tap', tap: 'sink', on: true },
      { type: 'tap', tap: 'sink', on: false },
      { type: 'tap', tap: 'sink', on: true },
    ])
    expect(world.describe(events[0])).toBe('tap: sink on')
    world.removeTap('sink')
    expect(world.streams()).toHaveLength(0)
    expect(world.taps()).toHaveLength(0)
  })

  it('fills the container it lands in, and makes a stain when nothing is below', () => {
    const world = createFluids()
    world.addSurface(FLOOR)
    world.addContainer({ capacity: 1, shape: { kind: 'cylinder', radius: 0.05, height: 0.12 }, opening: 0.05 }, { id: 'glass', position: [0, 0.8, 0] })
    tapAt(world)
    run(world, 3)
    const c = world.container('glass')!
    expect(c.liquid).toBe('water')
    expect(c.liters).toBeGreaterThan(0.2)
    expect(world.stains()).toHaveLength(0)
    world.removeContainer('glass')
    run(world, 2)
    expect(world.stains().length).toBeGreaterThan(0)
    expect(world.stains()[0].liquid).toBe('water')
  })

  it('starts off with `on: false`, supports other directions, and survives a snapshot', () => {
    const world = createFluids()
    world.addSurface(FLOOR)
    tapAt(world, { on: false, direction: [1, -1, 0], temperature: 60 })
    expect(world.streams()).toHaveLength(0)
    world.setTap('sink', true)
    expect(world.taps()[0].direction[0]).toBeCloseTo(Math.SQRT1_2, 5)
    run(world, 1)
    const b = createFluids()
    b.load(JSON.parse(JSON.stringify(world.serialize())))
    expect(b.taps()).toEqual(world.taps())
    run(world, 2)
    run(b, 2)
    expect(b.serialize()).toEqual(world.serialize())
    b.setTap('sink', false)
    expect(b.streams()).toHaveLength(0)
  })
})

describe('the team defaults', () => {
  const liquid = (id: string) => LIQUIDS.find((l) => l.id === id)!

  it('ships blood, old blood and bile with the Padrão de Fluidos colours and drying times', () => {
    expect(liquid('blood')).toMatchObject({ stainColor: 0x3b1d14, dryTime: 600 })
    expect(liquid('old_blood')).toMatchObject({ color: 0x6c1c16, stainColor: 0x2a160e, dryTime: 360, leavesMark: true })
    expect(liquid('bile')).toMatchObject({ color: 0x8a9a2a, stainColor: 0x3e4220, dryTime: 900, leavesMark: true })
  })

  it('fuel evaporates in 60 s without a mark, water dries in 180 s and motor oil never dries', () => {
    expect(liquid('fuel')).toMatchObject({ dryTime: 60, leavesMark: false })
    expect(liquid('water').dryTime).toBe(180)
    expect(liquid('motor_oil').dryTime).toBe(0)
  })

  it('a game replaces a liquid by id and gets its old values back', () => {
    const world = createFluids({ liquids: [{ ...liquid('blood'), dryTime: 1200, stainColor: 0x4a0506 }] })
    expect(world.liquids.get('blood')).toMatchObject({ dryTime: 1200, stainColor: 0x4a0506 })
  })

  it('a splash can carry its own tint, and the latest one wins', () => {
    const world = createFluids({ seed: 3 })
    world.addSurface(FLOOR)
    world.splash('blood', [0, 0, 0], 0.01, [0, -1, 0], { tint: { fresh: 0x6c1c16, dry: 0x2a160e } })
    expect(world.stains()[0]!.tint).toEqual({ fresh: 0x6c1c16, dry: 0x2a160e })
    world.splash('blood', [0.02, 0, 0], 0.01, [0, -1, 0], { tint: { fresh: 0x7a0a0e, dry: 0x3b1d14 } })
    expect(world.stains()).toHaveLength(1)
    expect(world.stains()[0]!.tint).toEqual({ fresh: 0x7a0a0e, dry: 0x3b1d14 })
    const plain = createFluids({ seed: 3 })
    plain.addSurface(FLOOR)
    plain.splash('blood', [0, 0, 0], 0.01)
    expect(plain.stains()[0]!.tint).toBeUndefined()
  })

  it('a tint survives serialize and load', () => {
    const world = createFluids({ seed: 3 })
    world.addSurface(FLOOR)
    world.splash('bile', [0, 0, 0], 0.02, [0, -1, 0], { tint: { fresh: 1, dry: 2 } })
    const restored = createFluids({ seed: 3 })
    restored.load(world.serialize())
    expect(restored.stains()[0]!.tint).toEqual({ fresh: 1, dry: 2 })
  })
})

describe('unscrewing', () => {
  it('turns the cap during its turn keys and opens the container at its open key, after the turning', () => {
    const unscrew = ITEM_USES.find((u) => u.id === 'unscrew')!
    const turn = unscrew.keys.filter((k) => k.action === 'turn')
    const open = unscrew.keys.find((k) => k.action === 'open')!
    expect(turn.length).toBeGreaterThan(0)
    expect(open.t).toBeGreaterThan(Math.max(...turn.map((k) => k.t)))
    const world = createFluids()
    world.addContainer({ capacity: 0.3, liquid: 'water', liters: 0.3, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.03, closed: true }, { id: 'jar' })
    const player = createItemUse(world, 'jar', unscrew)
    while (player.time < open.t - 0.05) player.update(1 / 60)
    expect(world.container('jar')!.closed).toBe(true)
    while (!player.done) player.update(1 / 60)
    expect(world.container('jar')!.closed).toBe(false)
    expect(world.container('jar')!.liters).toBeCloseTo(0.3, 6)
  })
})
