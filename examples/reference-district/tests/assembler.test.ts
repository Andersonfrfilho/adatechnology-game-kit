import { describe, expect, it } from 'vitest'

import { engine } from '@adatechnology/game-floorplan'

import { blocksToFill } from '../src/game/blocks'
import { groundLayoutOf, terrainBoundsOf } from '../src/game/ground'
import { lotPlacement, overflowOf } from '../src/game/placement'
import { pointsIn, zoneCounts } from '../src/game/horde-plan'
import { labelLines } from '../src/game/missing'
import { polePointsOf, roadStretchesOf } from '../src/game/roads'
import { seedOf } from '../src/game/seed'
import { stateOfLot, registerPacks } from '../src/game/assemble/houses'
import { districtOptionsOf, parsePageChoice, scriptOf, yawToward, zonesOfScript } from '../src/test/scenario'
import { createUrbanForTest, plan, scripts, site } from './helpers'

describe('ground', () => {
  it('lays the districts, then the sidewalks and roads, then the river is under the roads', () => {
    const layout = groundLayoutOf(plan)
    const surfaces = (layout.zones ?? []).map((zone) => zone.surface)
    expect(layout.surface).toBe('lawn')
    expect(surfaces.slice(0, 2)).toEqual(['concrete_slab', 'dirt'])
    expect(surfaces.indexOf('shallow_water')).toBeLessThan(surfaces.indexOf('road'))
    expect(surfaces.filter((surface) => surface === 'road')).toHaveLength(2)
  })

  it('bounds hold every district and line with a margin', () => {
    const [x0, z0, x1, z1] = terrainBoundsOf(plan)
    expect([x0, z0, x1, z1]).toEqual([-235, -160, 240, 160])
  })
})

describe('roads', () => {
  it('cuts the main street at the crossing and at the river', () => {
    const main = roadStretchesOf(plan).filter((stretch) => stretch.along === 'x')
    expect(main.length).toBe(3)
    const spans = main.map((stretch) => [stretch.x - stretch.length / 2, stretch.x + stretch.length / 2]).sort((a, b) => (a[0] as number) - (b[0] as number))
    expect(spans[0]?.[1]).toBeCloseTo(-105)
    expect(spans[1]?.[0]).toBeCloseTo(-95)
    expect(spans[1]?.[1]).toBeCloseTo(-35)
    expect(spans[2]?.[0]).toBeCloseTo(-5)
  })

  it('puts no pole in the river', () => {
    for (const point of polePointsOf({ plan, spacing: 32, offset: 6.25 })) expect(point.x > -35 && point.x < -5 && Math.abs(point.z) < 140).toBe(false)
  })
})

describe('placement', () => {
  const size = { width: 10, depth: 8 }
  it('turns the front toward the street and centres the house on the lot', () => {
    expect(lotPlacement([0, 0, 12, 25], 'n', size)).toEqual({ x: 1, z: 0, ry: 0 })
    expect(lotPlacement([0, 0, 12, 25], 's', size)).toEqual({ x: 11, z: 25, ry: Math.PI })
    expect(lotPlacement([0, 0, 25, 12], 'e', size).ry).toBeCloseTo(-Math.PI / 2)
    expect(lotPlacement([0, 0, 25, 12], 'w', size).ry).toBeCloseTo(Math.PI / 2)
  })

  it('says what overflows the lot', () => {
    expect(overflowOf([0, 0, 12, 25], 'n', { width: 14, depth: 30 })).toEqual({ along: 2, deep: 5 })
    expect(overflowOf([0, 0, 12, 25], 'n', size)).toEqual({ along: 0, deep: 0 })
  })

  it('every house of the site is placed inside the district', () => {
    registerPacks()
    for (const lot of site.lots) {
      const generated = engine.generate(lot.typology, { seed: seedOf(site.seed, lot.id), ...(stateOfLot(lot) === undefined ? {} : { state: stateOfLot(lot) }) })
      expect(Number(generated.w), lot.id).toBeGreaterThan(0)
      expect(Number(generated.d), lot.id).toBeGreaterThan(0)
    }
  })
})

describe('lot state', () => {
  it('leaves `draw` to the plugin and maps `none` to the normal house', () => {
    const lot = site.lots[0]!
    expect(stateOfLot({ ...lot, state: 'draw' })).toBeUndefined()
    expect(stateOfLot({ ...lot, state: 'none' })).toBe('normal')
    expect(stateOfLot({ ...lot, state: 'fortified' })).toBe('fortified')
  })
})

describe('blocks', () => {
  it('leaves out the blocks a lot or a missing building stands on', () => {
    const layout = createUrbanForTest().cities.layout(plan)
    const all = layout.districts.flatMap((district) => layout.blocks(district.id, { street: 10 }))
    const kept = blocksToFill(all, site)
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThan(all.length)
    for (const lot of site.lots) {
      for (const block of kept) {
        const [x0, z0, x1, z1] = [block.x - block.size[0] / 2, block.z - block.size[1] / 2, block.x + block.size[0] / 2, block.z + block.size[1] / 2]
        expect(x0 < lot.rect[2] && lot.rect[0] < x1 && z0 < lot.rect[3] && lot.rect[1] < z1, `${lot.id}`).toBe(false)
      }
    }
  })
})

describe('horde', () => {
  it('shares the zombies by the share of each zone and loses none', () => {
    const counts = zoneCounts(site.hordes.filter((zone) => zone.id.startsWith('street')), 500)
    expect(counts.get('street_far')).toBe(200)
    expect(counts.get('street_east')).toBe(300)
    expect([...zoneCounts(site.hordes, 501).values()].reduce((sum, count) => sum + count, 0)).toBe(501)
  })

  it('draws points inside the zone and drops the blocked ones', () => {
    let seed = 1
    const random = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const points = pointsIn({ rect: [0, 0, 10, 10], count: 50, random, isFree: (x) => x < 5 })
    expect(points).toHaveLength(50)
    expect(points.every((point) => point.x < 5 && point.z >= 0 && point.z <= 10)).toBe(true)
  })
})

describe('missing boxes', () => {
  it('say what, who and which task', () => {
    const bridge = site.missing.find((entry) => entry.id === 'bridge')!
    expect(labelLines(bridge)).toEqual(['Ponte de concreto destrutível', 'dono: game-floorplan-structure, game-urban', 'tarefa T3.3'])
  })
})

describe('scenario', () => {
  it('reads the address and falls back to the typical scenario in third person', () => {
    expect(parsePageChoice('?cena=caos&camera=first')).toMatchObject({ scenario: 'caos', camera: 'first' })
    expect(parsePageChoice('?cena=nada&camera=top')).toMatchObject({ scenario: 'tipico', camera: 'shoulder', physics: 'jolt' })
    expect(parsePageChoice('?solver=own').physics).toBe('own')
  })

  it('runs the street for tipico and pior, the crossing for caos', () => {
    expect(scriptOf(scripts, 'tipico').id).toBe('street')
    expect(scriptOf(scripts, 'pior').id).toBe('street')
    expect(scriptOf(scripts, 'caos').id).toBe('crossing')
    expect(zonesOfScript(scriptOf(scripts, 'caos'))).toEqual(['cross_north', 'cross_east'])
  })

  it('takes zombies, weather and hour from the scripts file', () => {
    const container = {} as HTMLElement
    const pior = districtOptionsOf({ scripts, choice: parsePageChoice('?cena=pior'), container })
    expect(pior).toMatchObject({ zombies: 2000, weather: 'heavy_rain', hour: 23, camera: 'shoulder' })
    const tipico = districtOptionsOf({ scripts, choice: parsePageChoice('?cena=tipico&camera=first'), container })
    expect(tipico).toMatchObject({ zombies: 500, weather: 'overcast', hour: 14, camera: 'first' })
    expect(tipico.start?.x).toBe(20)
  })

  it('looks along the path: east is yaw -pi/2', () => {
    expect(yawToward({ x: 0, z: 0 }, { x: 10, z: 0 })).toBeCloseTo(-Math.PI / 2)
    expect(yawToward({ x: 0, z: 0 }, { x: 0, z: -10 })).toBeCloseTo(0)
  })
})

describe('seed', () => {
  it('is stable and differs by id', () => {
    expect(seedOf(11, 'a')).toBe(seedOf(11, 'a'))
    expect(seedOf(11, 'a')).not.toBe(seedOf(11, 'b'))
  })
})
