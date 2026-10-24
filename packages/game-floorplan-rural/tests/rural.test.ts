import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { describe, expect, it } from 'vitest'

import { register, ruralTemplateIds } from '../src'

registerResidential(engine)
register(engine)

const SEEDS = Array.from({ length: 30 }, (_, index) => index + 1)
const STATES = ['normal', 'fortified', 'abandoned'] as const

type Variant = { name: string; id: string; options: Record<string, unknown> }
const VARIANTS: Variant[] = [
  { name: 'wood_frame_house, 1 floor', id: 'wood_frame_house', options: { floors: 1 } },
  { name: 'wood_frame_house, 2 floors', id: 'wood_frame_house', options: { floors: 2 } },
  { name: 'wood_frame_house, 2 floors, basement and fireplace', id: 'wood_frame_house', options: { floors: 2, basement: 'basement', fireplace: true, garage: false } },
  { name: 'wood_frame_house, 4 bedrooms', id: 'wood_frame_house', options: { floors: 1, bedrooms: 4 } },
  { name: 'a_frame_chalet, stilts', id: 'a_frame_chalet', options: { foundation: 'stilts' } },
  { name: 'a_frame_chalet, slab', id: 'a_frame_chalet', options: { foundation: 'slab' } },
  { name: 'log_cabin, one room off the grid', id: 'log_cabin', options: { rooms: 1, power: 'offgrid' } },
  { name: 'log_cabin, two rooms, indoor bathroom', id: 'log_cabin', options: { rooms: 2, bathroom: 'indoor', power: 'grid' } },
  { name: 'log_cabin, two rooms, well', id: 'log_cabin', options: { rooms: 2, water: 'well' } },
  { name: 'shack, one room', id: 'shack', options: { rooms: 1 } },
  { name: 'shack, two rooms, indoor bathroom', id: 'shack', options: { rooms: 2, bathroom: 'indoor' } },
  { name: 'campsite, one tent', id: 'campsite', options: { tents: 1 } },
  { name: 'campsite, four tents', id: 'campsite', options: { tents: 4 } },
]

describe('registration', () => {
  it('registers the five templates with the rural style, the region tag and the structure ids', () => {
    const listed = engine.listTemplates().map((template) => template.id)
    for (const id of ruralTemplateIds) expect(listed).toContain(id)
    const constructions = ruralTemplateIds.map((id) => engine.templates[id]?.construction)
    expect(constructions).toEqual(['wood_frame', 'wood_frame', 'log', 'improvised', 'canvas'])
    for (const id of ruralTemplateIds) {
      expect(engine.templates[id]?.region).toBe('br')
      expect(engine.templates[id]?.style).toBe('rural')
      expect(engine.templates[id]?.place).toBeTruthy()
    }
  })

  it('names every template, room and floor in both languages (no key falls back to itself)', () => {
    for (const locale of ['en', 'pt-BR']) {
      for (const id of ruralTemplateIds) expect(engine.translate('templates', id, locale)).not.toBe(id)
      for (const { id, options } of VARIANTS) {
        const plan = engine.generate(id, { seed: 3, locale, ...options })
        for (const room of plan.rooms) expect(room.name, `${id} ${room.id} (${locale})`).not.toBe(room.label)
        for (const floor of plan.floors) expect(floor.name, `${id} floor (${locale})`).not.toBe(floor.label)
        for (const zone of plan.lot.zones) expect(zone.name, `${id} zone ${zone.id} (${locale})`).not.toBe(zone.label)
      }
    }
  })

  it('fails with a clear message when the residential pack is missing', () => {
    expect(() => register({ ...engine, libraries: {} } as typeof engine)).toThrow(/residential/)
  })
})

describe('generated plans', () => {
  for (const { name, id, options } of VARIANTS) {
    it(`${name}: valid, with every door on a path and the entrance reachable, for ${SEEDS.length} seeds x 3 states`, () => {
      const problems: string[] = []
      for (const seed of SEEDS)
        for (const state of STATES) {
          const plan = engine.generate(id, { seed, state, ...options })
          const tag = `${name}#${seed}/${state}`
          for (const message of engine.validate(plan)) problems.push(`${tag}: ${message}`)
          for (const door of plan.doors.filter((x: { exterior: boolean; floor: number }) => x.exterior && x.floor === 0)) {
            if (!plan.lot.paths.some((path: { to: string }) => path.to === door.id)) problems.push(`${tag}: door ${door.id} has no path`)
          }
        }
      expect(problems.slice(0, 5)).toEqual([])
    })
  }

  it('the same seed gives the same plan, and different seeds give different ones', () => {
    for (const id of ruralTemplateIds) {
      const first = JSON.stringify(engine.generate(id, { seed: 7, state: 'normal' }))
      expect(JSON.stringify(engine.generate(id, { seed: 7, state: 'normal' }))).toBe(first)
      const others = new Set(SEEDS.map((seed) => JSON.stringify(engine.generate(id, { seed, state: 'normal' }).items.map((item: { x: number; z: number }) => [item.x, item.z]))))
      expect(others.size).toBeGreaterThan(1)
    }
  })

  it('leaves no required item missing and no door narrower than 0.7 m', () => {
    for (const { id, options } of VARIANTS) {
      const plan = engine.generate(id, { seed: 11, ...options })
      expect(plan.missing).toEqual([])
      for (const door of plan.doors) expect(door.width).toBeGreaterThanOrEqual(0.7)
    }
  })
})

describe('rural rules', () => {
  it('an off-grid cabin hangs oil lamps instead of ceiling lights, and every room has one', () => {
    const plan = engine.generate('log_cabin', { seed: 4, rooms: 2, power: 'offgrid', bathroom: 'indoor' })
    expect(plan.config.power).toBe('offgrid')
    expect(plan.items.some((item: { category: string }) => item.category === 'ceiling_light')).toBe(false)
    for (const room of plan.rooms.filter((r: { type: string }) => r.type !== 'porch')) expect(plan.items.some((item: { room: string; type: string }) => item.room === room.id && item.type === 'ceiling_oil_lamp')).toBe(true)
  })

  it('the shack taps the street line (the old `gato`): the plan says so and the rooms keep their ceiling lights', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const plan = engine.generate('shack', { seed })
      expect(plan.config.power).toBe('tap')
      expect(plan.config.solar).toBe(false)
      expect(plan.items.some((item: { category: string }) => item.category === 'ceiling_light')).toBe(true)
      expect(plan.items.some((item: { category: string }) => item.category === 'oil_lamp')).toBe(false)
    }
    for (const id of ['wood_frame_house', 'a_frame_chalet', 'campsite']) expect(engine.generate(id, { seed: 1 }).config.power).not.toBe('tap')
  })

  it('a cabin on the grid keeps the ceiling lights', () => {
    const plan = engine.generate('log_cabin', { seed: 4, rooms: 2, power: 'grid' })
    expect(plan.items.some((item: { category: string }) => item.category === 'ceiling_light')).toBe(true)
    expect(plan.items.some((item: { category: string }) => item.category === 'oil_lamp')).toBe(false)
  })

  it('the porch door has steps from the foundation elevation (slab 2, stilts 5), the garage door has none', () => {
    const stilts = engine.generate('a_frame_chalet', { seed: 2, foundation: 'stilts' })
    expect(stilts.doors.find((door: { type: string }) => door.type === 'steps').steps).toBe(5)
    const slab = engine.generate('a_frame_chalet', { seed: 2, foundation: 'slab' })
    expect(slab.doors.find((door: { type: string }) => door.type === 'steps').steps).toBe(2)
    const house = engine.generate('wood_frame_house', { seed: 2, floors: 2, garage: true })
    expect(house.doors.find((door: { model: string; exterior: boolean; width: number }) => door.exterior && door.width === 2.6).steps).toBe(0)
  })

  it('the chalet living room is double height and the mezzanine heights add up', () => {
    const plan = engine.generate('a_frame_chalet', { seed: 1 })
    expect(plan.rooms.find((room: { id: string }) => room.id === 'living').ceiling).toBe(4.4)
    expect(plan.floors[1].y0).toBe(2.6)
  })

  it('a campsite has no walls, one zip door per tent on the tent edge and its own paths from the gate', () => {
    const plan = engine.generate('campsite', { seed: 5, tents: 3 })
    expect(plan.walls).toEqual([])
    const tents = plan.rooms.filter((room: { type: string }) => room.type === 'tent')
    expect(tents).toHaveLength(3)
    expect(plan.doors.every((door: { model: string }) => door.model === 'zip')).toBe(true)
    expect(plan.lot.paths).toHaveLength(3)
    expect(plan.lot.zones.some((zone: { type: string }) => zone.type === 'camp')).toBe(true)
  })

  it('the rural palette follows the seed and stays within the facade table', () => {
    const palette = engine.palette({ seed: 3, style: 'rural' })
    expect(palette.meta.style).toBe('rural')
    expect(['natural_wood', 'worn_white', 'moss_green', 'bluish_grey', 'barn_red', 'wood_grey']).toContain(palette.meta.base)
  })

  it('the wood frame fireplace asks the lot to keep the chimney side free', () => {
    const plan = engine.generate('wood_frame_house', { seed: 1, floors: 2, fireplace: true })
    expect(plan.items.some((item: { type: string }) => item.type === 'fireplace')).toBe(true)
    const without = engine.generate('wood_frame_house', { seed: 1, floors: 2, fireplace: false })
    expect(without.items.some((item: { type: string }) => item.type === 'fireplace')).toBe(false)
  })
})
