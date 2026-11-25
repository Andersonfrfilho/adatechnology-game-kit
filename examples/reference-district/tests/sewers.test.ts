import { describe, expect, it } from 'vitest'

import { TERRAIN_PROFILES } from '@adatechnology/game-terrain'
import type { TerrainProfile } from '@adatechnology/game-terrain'
import { coverOf, pipePiecesOf, surfacePiecesOf } from '@adatechnology/game-urban/networks'

import { planLots } from '../src/game/assemble/houses'
import { buildNetworks } from '../src/game/assemble/networks'
import { groundLayoutOf, SIDEWALK_SURFACE, SIDEWALK_WIDTH } from '../src/game/ground'
import { lineRects } from '../src/game/geometry'
import { POLE_MIN_GAP } from '../src/game/roads'
import { keepOutOf } from '../src/game/service'
import { plan, site } from './helpers'

const lots = planLots(site)
const generated = buildNetworks({ plan, site, lots, avoid: keepOutOf(lots, POLE_MIN_GAP) })
const pipes = pipePiecesOf(generated.networks)
const layout = groundLayoutOf(plan)
const profile = (id: string): TerrainProfile => TERRAIN_PROFILES.find((entry) => entry.id === id)!

/** The material of the layer a depth under the surface falls in, or `below` past the bottom of the profile's column. */
function layerAt(profileId: string, depth: number): string {
  let top = 0
  for (const stratum of profile(profileId).strata) {
    if (depth < top + stratum.thickness) return stratum.material
    top += stratum.thickness
  }
  return 'below'
}

describe('every street has a sidewalk on both sides', () => {
  const streets = (plan.lines ?? []).filter((line) => line.kind === 'street' || line.kind === 'avenue')

  it('lays the sidewalk zone under the road zone of every stretch of every street, SIDEWALK_WIDTH wider than the road on each side', () => {
    expect(streets.length).toBe(2)
    const zones = layout.zones ?? []
    const sameRect = (zoneRect: readonly number[], rect: readonly number[]): boolean => rect.every((value, index) => Math.abs(value - (zoneRect[index] as number)) < 1e-9)
    for (const street of streets) {
      const roads = lineRects(street)
      const walks = lineRects(street, SIDEWALK_WIDTH)
      roads.forEach((road, index) => {
        const sidewalk = zones.findIndex((zone) => zone.surface === SIDEWALK_SURFACE && sameRect(zone.rect, walks[index]!))
        const roadZone = zones.findIndex((zone) => zone.surface === 'road' && sameRect(zone.rect, road))
        expect(sidewalk, `${street.id} sidewalk`).toBeGreaterThanOrEqual(0)
        expect(roadZone, `${street.id} road`).toBeGreaterThan(sidewalk)
        const walk = walks[index]!
        expect([road[0] - walk[0], road[1] - walk[1], walk[2] - road[2], walk[3] - road[3]]).toEqual([SIDEWALK_WIDTH, SIDEWALK_WIDTH, SIDEWALK_WIDTH, SIDEWALK_WIDTH])
      })
    }
  })

  it('makes the sidewalk of the road\'s own layers: a pavement over a gravel bed over soil, as deep as the road', () => {
    const [road, sidewalk] = [profile('road'), profile(SIDEWALK_SURFACE)]
    expect(sidewalk.strata.map((stratum) => stratum.material)).toEqual(['concrete', 'gravel', 'soil'])
    expect(road.strata.map((stratum) => stratum.material)).toEqual(['asphalt', 'gravel', 'soil'])
    const depth = (entry: TerrainProfile): number => entry.strata.reduce((sum, stratum) => sum + stratum.thickness, 0)
    expect(depth(sidewalk)).toBeCloseTo(depth(road), 9)
  })
})

describe('the pipes lie in the layers of the street', () => {
  const onRoad = (kind: string) => pipes.filter((pipe) => pipe.kind === kind && generated.surfaceAt((pipe.from[0] + pipe.to[0]) / 2, (pipe.from[2] + pipe.to[2]) / 2) === 'road')
  const onSidewalk = (kind: string) => pipes.filter((pipe) => pipe.kind === kind && generated.surfaceAt((pipe.from[0] + pipe.to[0]) / 2, (pipe.from[2] + pipe.to[2]) / 2) === 'sidewalk')

  it('puts the water main under the sidewalk, its top in the soil under the base, 0.6 to 0.8 m down', () => {
    const mains = onSidewalk('water_main')
    expect(mains.length).toBeGreaterThan(3)
    for (const pipe of mains) {
      const top = coverOf(pipe, 0.5)
      expect(top, pipe.id).toBeGreaterThanOrEqual(0.55)
      expect(top, pipe.id).toBeLessThanOrEqual(0.85)
      expect(layerAt(SIDEWALK_SURFACE, top), pipe.id).toBe('soil')
    }
  })

  it('puts the gallery and the inlets\' laterals under the asphalt and its base, in the soil (a deep one past the bottom of the column)', () => {
    for (const kind of ['storm_gallery', 'storm_lateral']) {
      const found = onRoad(kind)
      expect(found.length, kind).toBeGreaterThan(5)
      for (const pipe of found) expect(['soil', 'below'], pipe.id).toContain(layerAt('road', Math.min(coverOf(pipe, 0), coverOf(pipe, 1))))
    }
  })

  it('puts the sewer main at the bottom of the road\'s column or under it: a blast that digs the whole column reaches its top and no deeper', () => {
    const mains = onRoad('sewer_main')
    expect(mains.length).toBeGreaterThan(3)
    const column = profile('road').strata.reduce((sum, stratum) => sum + stratum.thickness, 0)
    for (const pipe of mains.filter((entry) => entry.ground[0] === 0 && entry.ground[1] === 0)) expect(Math.min(coverOf(pipe, 0), coverOf(pipe, 1)), pipe.id).toBeGreaterThanOrEqual(column - 0.2)
  })

  it('has a pit under every cover that goes down to its pipe', () => {
    const covers = surfacePiecesOf(generated.networks).filter((piece) => piece.kind === 'manhole_cover' || piece.kind === 'inlet_grate')
    expect(covers.length).toBeGreaterThan(20)
    for (const piece of covers) {
      expect(piece.shaft, piece.id).toBeDefined()
      expect(piece.shaft!.top - piece.shaft!.bottom, piece.id).toBeGreaterThan(0.5)
    }
  })
})
