import { describe, expect, it } from 'vitest'

import { createDestruction, DEBRIS_EVENTS, debrisFamily, debrisLook, fragmentTone, MATERIALS, WOOD_ONLY_COLORS } from '../src'
import type { DebrisFamily, DebrisKind, DestructionEvent, MaterialDef } from '../src'

const ALL: readonly MaterialDef[] = MATERIALS
const BY_ID = new Map(ALL.map((def) => [def.id, def]))
const byId = (id: string): MaterialDef => BY_ID.get(id)!

/** The family each material of the catalogue belongs to, written out so a new material or a changed tag is a decision, not an accident. */
const EXPECTED_FAMILY: Readonly<Record<string, DebrisFamily>> = {
  steel: 'metal', cast_iron: 'metal', aluminium: 'metal', copper: 'metal',
  wood_soft: 'wood', wood_hard: 'wood', plywood: 'wood', mdf: 'wood', green_wood: 'wood',
  glass: 'glass', tempered_glass: 'glass',
  ceramic: 'masonry', concrete: 'masonry', brick: 'masonry', plaster: 'masonry', stone: 'masonry', asphalt: 'masonry', mortar: 'masonry', cobble: 'masonry', paver: 'masonry',
  plastic: 'soft', rubber: 'soft', fabric: 'soft', foam: 'soft', leather: 'soft', paper: 'soft', foliage: 'soft', cactus: 'soft', flesh_fruit: 'soft', wax: 'soft',
  soil: 'soil', sand: 'soil', gravel: 'soil', turf: 'soil', mud: 'soil', clay: 'soil', snow: 'soil',
}

/** What each family may throw on a hit and when it breaks. */
const HIT_DEBRIS: Readonly<Record<DebrisFamily, readonly DebrisKind[]>> = {
  wood: ['splinters', 'chips'],
  masonry: ['chips', 'dust'],
  glass: ['shards'],
  metal: ['sparks'],
  soft: ['fibers', 'leaves', 'drips', 'chips'],
  soil: ['dust', 'chips'],
}
const BREAK_DEBRIS: Readonly<Record<DebrisFamily, readonly DebrisKind[]>> = {
  wood: ['splinters', 'dust', 'leaves'],
  masonry: ['dust', 'chips', 'shards'],
  glass: ['shards'],
  metal: ['sparks', 'chips'],
  soft: ['fibers', 'leaves', 'drips', 'chips'],
  soil: ['dust', 'chips'],
}

const AK = { penetration: { steel: 6.5, concrete: 110, brick: 220, wood: 300 } }

describe('debris look by material', () => {
  it('puts every material of the catalogue in its family', () => {
    expect(Object.keys(EXPECTED_FAMILY).sort()).toEqual(ALL.map((def) => def.id).sort())
    for (const def of ALL) expect(debrisFamily(def), def.id).toBe(EXPECTED_FAMILY[def.id])
  })

  it('gives each material hit and break debris that suit its family', () => {
    for (const def of ALL) {
      const family = debrisFamily(def)
      expect(HIT_DEBRIS[family], `${def.id} hitDebris`).toContain(def.hitDebris)
      expect(BREAK_DEBRIS[family], `${def.id} breakDebris`).toContain(def.breakDebris)
    }
  })

  it('never gives a material that is not wood splinters or a wood colour, for any event', () => {
    for (const def of ALL) {
      const family = debrisFamily(def)
      for (const event of DEBRIS_EVENTS) {
        const look = debrisLook(def, event)
        expect(look.family).toBe(family)
        if (family === 'wood') continue
        expect(look.debris, `${def.id} ${event}`).not.toBe('splinters')
        expect(WOOD_ONLY_COLORS, `${def.id} ${event} debris colour`).not.toContain(look.color)
        if (look.dust !== undefined) expect(WOOD_ONLY_COLORS, `${def.id} ${event} dust colour`).not.toContain(look.dust)
      }
    }
  })

  it('throws the family debris at a hit, a stage and bare rebar, and the fracture style debris when it breaks', () => {
    expect(debrisLook(byId('concrete'), 'stage1')).toMatchObject({ debris: 'chips', color: 0x9b9a94, mark: 'crater', sparks: false, impact: 'concrete' })
    expect(debrisLook(byId('concrete'), 'expose').debris).toBe('chips')
    expect(debrisLook(byId('brick'), 'spall').color).toBe(0xb8693f)
    expect(debrisLook(byId('wood_soft'), 'stage1')).toMatchObject({ debris: 'splinters', color: 0xe0c393, mark: 'splintered_hole' })
    expect(debrisLook(byId('glass'), 'shot')).toMatchObject({ debris: 'shards', mark: 'star_crack', impact: 'glass' })
    expect(debrisLook(byId('steel'), 'shot')).toMatchObject({ debris: 'sparks', dust: undefined, mark: 'dent', sparks: true })
    expect(debrisLook(byId('fabric'), 'shot')).toMatchObject({ debris: 'fibers', mark: 'torn_hole', impact: undefined })
    // a painted plastic part throws pieces of its own colour, glass and metal never take the paint's
    expect(debrisLook(byId('plastic'), 'stage1', { partColor: 0x2266cc }).color).toBe(0x2266cc)
    expect(debrisLook(byId('steel'), 'fracture', { partColor: 0x2266cc }).color).toBe(0x8a8f96)
    expect(debrisLook(byId('concrete'), 'fracture', { style: 'crumble' }).debris).toBe('chips')
    expect(debrisLook(byId('plywood'), 'fracture', { style: 'splinter' }).debris).toBe('splinters')
    expect(debrisLook(byId('glass'), 'fracture', { style: 'shatter' }).debris).toBe('shards')
  })

  it('colours a fragment by its unit first, then its inside, then the part', () => {
    const brick = byId('brick')
    expect(fragmentTone(brick, { unit: true, inner: true }, 0x111111)).toBe(brick.visual!.unitColor)
    expect(fragmentTone(brick, { inner: true }, 0x111111)).toBe(brick.visual!.innerColor)
    expect(fragmentTone(brick, {}, 0x111111)).toBe(0x111111)
    expect(fragmentTone(byId('steel'), { unit: true, inner: true }, 0x222222)).toBe(0x222222)
  })
})

/** The debris, fragments and stages a shot of an AK (7.62x39, 2 100 J) and a blast leave on one part of each material. */
function eventsOf(material: string, mode: 'shot' | 'blast'): DestructionEvent[] {
  const world = createDestruction({ seed: 1 })
  world.add({ parts: [{ id: 'p', material, shape: { kind: 'box', size: [0.2, 1, 1] }, position: [0, 0.5, 0], thickness: 0.2 }] })
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  if (mode === 'shot') for (let shot = 0; shot < 3; shot++) world.shoot([2, 0.5 + shot * 0.05, 0], [-1, 0, 0], 2100, 7.9, 'ak', AK)
  else world.explode([0.6, 0.5, 0], 400000, 3)
  for (let frame = 0; frame < 30; frame++) world.update(1 / 30)
  return events
}

describe('what the world throws, material by material', () => {
  for (const def of ALL) {
    for (const mode of ['shot', 'blast'] as const) {
      it(`${def.id}: ${mode}`, () => {
        const family = debrisFamily(def)
        for (const event of eventsOf(def.id, mode)) {
          if (event.type === 'debris') {
            const own = byId(event.material ?? def.id)
            expect([...HIT_DEBRIS[family], ...BREAK_DEBRIS[family]], `${def.id} ${mode} debris`).toContain(event.kind)
            expect(own.id, 'debris of the material hit').toBe(def.id)
          }
          if (event.type === 'chip' || event.type === 'fracture' || (event.type === 'stage' && event.fragments)) {
            for (const fragment of event.fragments ?? []) {
              expect(fragment.material, `${def.id} ${mode} ${event.type} fragment material`).toBe(def.id)
              if (family !== 'wood') expect(fragment.shape, `${def.id} ${mode} ${event.type} fragment shape`).not.toBe('splinter')
            }
          }
        }
      })
    }
  }

  it('a reinforced concrete beam shot by an AK throws concrete, never splinters', () => {
    const world = createDestruction({ seed: 1 })
    const rebar = { material: 'steel', spacing: 0.15, diameter: 0.016, residualCapacity: 0.15 }
    world.add({ parts: [
      { id: 'c1', material: 'concrete', shape: { kind: 'box', size: [0.2, 3, 0.2] }, position: [-2, 1.5, 0], structure: { role: 'column' }, reinforcement: rebar },
      { id: 'c2', material: 'concrete', shape: { kind: 'box', size: [0.2, 3, 0.2] }, position: [2, 1.5, 0], structure: { role: 'column' }, reinforcement: rebar },
      { id: 'beam', material: 'concrete', shape: { kind: 'box', size: [4.2, 0.4, 0.2] }, position: [0, 3.2, 0], structure: { role: 'beam' }, reinforcement: rebar },
    ] })
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))
    for (let shot = 0; shot < 30; shot++) {
      world.shoot([0.3 + shot * 0.01, 3.2, 3], [0, 0, -1], 2100, 7.9, 'ak', AK)
      world.update(1 / 30)
    }
    expect(events.some((event) => event.type === 'stage' && event.stage === 1)).toBe(true)
    for (const event of events) {
      if (event.type === 'debris') expect(['chips', 'dust'], 'beam debris').toContain(event.kind)
      if ('fragments' in event) for (const fragment of event.fragments ?? []) expect(fragment.shape).not.toBe('splinter')
    }
    const stage = events.find((event) => event.type === 'stage')!
    expect(debrisLook(byId('concrete'), 'stage1').debris).toBe('chips')
    expect(stage.type === 'stage' && stage.part).toBe('beam')
  })
})
