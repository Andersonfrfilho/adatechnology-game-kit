import { describe, expect, it } from 'vitest'

import { GAS_LAYOUT } from '../src/utilities/gas'
import type { StructuredResult } from '../src'
import { engine } from './support'

const SEEDS = 80
const TEMPLATES = ['single_storey_a', 'mid_modern_single_storey', 'townhouse']
const NEAR = 0.15

type Box = readonly number[]
const generate = (template: string, seed: number, extra: Record<string, unknown> = {}): StructuredResult => engine.generate(template, { seed, state: 'normal', ...extra }) as StructuredResult
const cylindersOf = (result: StructuredResult) => result.items.filter((item) => item.type === 'cooking_gas_cylinder')
const inside = (x: number, z: number, box: Box, margin = 0): boolean => x >= box[0]! - margin && x <= box[2]! + margin && z >= box[1]! - margin && z <= box[3]! + margin
const overlap = (a: Box, b: Box): boolean => a[0]! < b[2]! - 1e-6 && a[2]! > b[0]! + 1e-6 && a[1]! < b[3]! - 1e-6 && a[3]! > b[1]! + 1e-6

describe('the gas cylinder stands in an outdoor shelter by default; in the kitchen beside the stove only when asked for', () => {
  const shelters: { result: StructuredResult; cylinder: ReturnType<typeof cylindersOf>[number] }[] = []

  for (const template of TEMPLATES) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const result = generate(template, seed)
      const gas = result.utilities.gas
      if (!gas || gas.type !== 'cylinder') continue
      for (const cylinder of cylindersOf(result)) if (cylinder.placement === 'outdoor_shelter') shelters.push({ result, cylinder })
    }
  }

  it('the default is the outdoor shelter in every seed of every residential template: never beside the stove', () => {
    const residential = ['single_storey_a', 'mid_modern_single_storey', 'townhouse', 'apartment_basic', 'apartment_modern']
    for (const template of residential) {
      for (const seed of [1, 2, 3]) {
        const result = generate(template, seed)
        for (const cylinder of cylindersOf(result)) {
          const where = `${template}#${seed}`
          expect(cylinder.placement, where).toBe('outdoor_shelter')
          expect(cylinder.outdoor, where).toBe(true)
          expect(cylinder.shelter, where).toBeDefined()
          const footprint = result.rooms.filter((room) => room.floor === 0).flatMap((room) => room.parts as Box[])
          expect(footprint.some((part) => inside(cylinder.x, cylinder.z, part)), `${where} outside the building`).toBe(false)
        }
      }
    }
  })

  it('the shelter stands outside the house, ventilated high and low (NBR 13523), backed on an exterior wall of the kitchen', () => {
    expect(shelters.length).toBeGreaterThan(10)
    for (const { result, cylinder } of shelters) {
      const shelter = cylinder.shelter as { standard: string; ventilated: boolean; ventilation: { low: boolean; high: boolean }; aabb: Box }
      const where = `${result.template}#${result.seed}`
      expect(cylinder.outdoor, where).toBe(true)
      expect(cylinder.floor, where).toBe(-1)
      expect(shelter.standard).toBe('NBR 13523')
      expect(shelter.ventilated).toBe(true)
      expect(shelter.ventilation).toEqual({ low: true, high: true })
      expect(inside(cylinder.x, cylinder.z, shelter.aabb), `${where} the cylinder is in its shelter`).toBe(true)
      expect(result.rooms.filter((room) => room.floor === 0).flatMap((room) => room.parts as Box[]).some((part) => overlap(shelter.aabb, [part[0]! + 0.075, part[1]! + 0.075, part[2]! - 0.075, part[3]! - 0.075])), `${where} outside every room`).toBe(false)
      const wall = result.walls.find((w) => w.exterior && w.floor === 0 && (w.axis === 'u' ? Math.abs(cylinder.z - w.v0) < 0.5 && cylinder.x >= w.u0 && cylinder.x <= w.u1 : Math.abs(cylinder.x - w.u0) < 0.5 && cylinder.z >= w.v0 && cylinder.z <= w.v1))
      expect(wall, `${where} backed on an exterior wall`).toBeDefined()
    }
  })

  it('a copper line goes from the shelter, through the wall, to the valve at the stove', () => {
    for (const { result, cylinder } of shelters) {
      const where = `${result.template}#${result.seed}`
      const pipe = cylinder.pipe as { material: string; diameterMm: number; route: [number, number, number][]; valve: string }
      const valve = cylinder.valve as { id: string; x: number; z: number; y: number }
      const stove = result.items.find((item) => item.id === cylinder.link)!
      const shelter = cylinder.shelter as { aabb: Box }
      expect(pipe.material, where).toBe('copper')
      expect(pipe.diameterMm).toBeGreaterThan(0)
      expect(pipe.valve).toBe(valve.id)
      expect(inside(pipe.route[0]![0], pipe.route[0]![1], shelter.aabb), `${where} starts in the shelter`).toBe(true)
      const [through] = pipe.route.slice(1, 2)
      expect(result.walls.some((w) => w.exterior && (w.axis === 'u' ? through![1] === w.v0 && through![0] >= w.u0 && through![0] <= w.u1 : through![0] === w.u0 && through![1] >= w.v0 && through![1] <= w.v1)), `${where} crosses an exterior wall`).toBe(true)
      const end = pipe.route[pipe.route.length - 1]!
      expect([end[0], end[1], end[2]], `${where} ends at the valve`).toEqual([valve.x, valve.z, valve.y])
      expect(inside(valve.x, valve.z, stove.aabb as Box, NEAR), `${where} the valve is at the stove`).toBe(true)
      expect(stove.gasValve).toEqual(valve)
      expect(valve.y).toBeGreaterThan(0.3)
      expect(valve.y).toBeLessThan(1.2)
    }
  })

  it('the kitchen variant is an explicit option: beside the stove, with a hose and no shelter or copper line', () => {
    const indoors: { result: StructuredResult; cylinder: ReturnType<typeof cylindersOf>[number] }[] = []
    for (let seed = 1; seed <= 20; seed++) {
      const result = generate('single_storey_a', seed, { gasLayout: GAS_LAYOUT.INDOOR_BESIDE_STOVE })
      expect(result.utilities.gas?.layout ?? GAS_LAYOUT.INDOOR_BESIDE_STOVE).toBe(GAS_LAYOUT.INDOOR_BESIDE_STOVE)
      for (const cylinder of cylindersOf(result)) if (cylinder.placement === 'beside') indoors.push({ result, cylinder })
    }
    expect(indoors.length).toBeGreaterThan(0)
    for (const { result, cylinder } of indoors) {
      const where = `${result.template}#${result.seed}`
      const stove = result.items.find((item) => item.id === cylinder.link)!
      expect(cylinder.outdoor, where).toBe(false)
      expect(cylinder.shelter).toBeUndefined()
      expect(cylinder.pipe).toBeUndefined()
      expect(cylinder.room).toBe(stove.room)
      expect(inside(cylinder.x, cylinder.z, stove.aabb as Box, 0.6), `${where} beside the stove`).toBe(true)
      expect(cylinder.hose).toBeDefined()
    }
  })

  it('the Visor golden keeps its niche with a hose: no shelter, no copper line', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const result = generate('single_storey_a', seed, { visorSections: true })
      expect(result.utilities.gas?.layout).toBeUndefined()
      for (const cylinder of cylindersOf(result)) {
        expect(cylinder.placement).not.toBe('outdoor_shelter')
        expect(cylinder.shelter).toBeUndefined()
        expect(cylinder.pipe).toBeUndefined()
      }
    }
  })
})
