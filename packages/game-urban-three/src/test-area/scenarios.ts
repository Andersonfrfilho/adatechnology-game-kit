import { createPlantProvider, createUrban, createVehicleProvider } from '@adatechnology/game-urban'
import type { PlacementPart, TerrainOptions, UrbanOptions, UrbanPart } from '@adatechnology/game-urban'
import type { ModuleScenario } from '@adatechnology/game-contracts'

import { fill } from './text'
import type { UrbanText } from './text'
import type { UrbanContext } from './types'

/** The heights of the five poles of the Galeria (m), the tops measured on the page's scenes. A game's own poles are not checked. */
export const POLE_TOPS: Readonly<Record<string, number>> = { led_double: 9, concrete_arm: 8, cast_iron: 4.8, wood_crossarm: 7, flood_tower: 12.55 }

// the scenario checks the mechanics of the providers, so it hands them its own small fleet and species instead of a content pack
const STAND_IN_VEHICLE_IDS: readonly string[] = ['stand_in_car_a', 'stand_in_car_b', 'stand_in_van']
const standInSpecies = (context: string, key: string): string => `stand_in_${context}_${key.length % 3}`

export type ScenarioDeps = {
  readonly text: UrbanText
  readonly urban: UrbanOptions | undefined
  readonly terrain: TerrainOptions
}

const topOf = (parts: readonly UrbanPart[]): number => Math.max(...parts.map((part) => ('height' in part && 'y' in part ? part.y + part.height / 2 : 0)))
const placements = (parts: readonly UrbanPart[], kind: PlacementPart['kind']): PlacementPart[] => parts.filter((part): part is PlacementPart => part.shape === 'placement' && part.kind === kind)
const round = (value: number, digits = 3): number => Math.round(value * 10 ** digits) / 10 ** digits

/**
 * The scenarios of the urban area: checks on the numbers the kit promises (the poles' heights, the light budget, the dashes of a road,
 * the heights of a block, the determinism of a neighbourhood, burnt-out lamps, the terrain, the providers). They need no object of the
 * room, so a game that patches the catalogues sees at once what it changed.
 */
export const createScenarios = (deps: ScenarioDeps): ModuleScenario<UrbanContext>[] => {
  const { text } = deps
  const say = (id: string, ...values: unknown[]): string => fill(text.checks[id] as string, ...values)
  const scenario = (id: string, run: ModuleScenario<UrbanContext>['run']): ModuleScenario<UrbanContext> => ({ id, name: text.scenarios[id] ?? id, run })
  const kit = () => createUrban(deps.urban)

  return [
    scenario('urban_pole_heights', ({ expect }) => {
      const urban = kit()
      for (const id of urban.poles.ids()) {
        const expected = POLE_TOPS[id]
        if (expected === undefined) continue
        const b = urban.builder()
        urban.poles.get(id).build(b, { x: 0, z: 0 })
        const top = topOf(b.parts)
        expect(Math.abs(top - expected) < 1e-6, say('pole_top', id, round(top)), { pole: id, top })
      }
    }),
    scenario('urban_light_budget', ({ expect }) => {
      const urban = kit()
      const budget = 4
      const b = urban.builder({ budget })
      for (let index = 0; index < 8; index++) urban.poles.get('led_double').build(b, { x: index * 8, z: 0 })
      const real = b.parts.filter((part) => part.shape === 'light').length
      expect(real === budget, say('budget_real', 8, real, budget), { real, budget })
      expect(b.lights.left < 0, say('budget_left', b.lights.left), { left: b.lights.left })
    }),
    scenario('urban_road_dashes', ({ expect }) => {
      const urban = kit()
      const b = urban.builder()
      urban.streets.road(b, 0, 0, 7, 60, 'x')
      expect(b.items.length === 12 && b.items[0]?.x === -28 && b.items[1]?.x === -23, say('dashes', b.items.length, b.items[0]?.x), { dashes: b.items.length })
    }),
    scenario('urban_block_heights', ({ expect }) => {
      const urban = kit()
      const b = urban.builder({ seed: 3 })
      const placed = urban.block.fill(b, { cx: 0, cz: 0, size: 200, minHeight: 10, maxHeight: 50, k: 20, gap: 0.01 })
      const heights = placed.map((building) => building.height).sort((a, c) => a - c)
      const median = heights[Math.floor(heights.length / 2)] as number
      expect(heights.length > 0 && (heights[0] as number) >= 10 && (heights[heights.length - 1] as number) <= 50, say('heights_in_range', 10, 50), { count: heights.length })
      expect(median < 30, say('heights_median', round(median, 1), 30), { median })
    }),
    scenario('urban_neighbourhood_seed', ({ expect }) => {
      const urban = kit()
      const draw = (seed: number): string => {
        const b = urban.builder({ seed })
        urban.neighbourhoods.get(urban.neighbourhoods.ids()[1] as string).compose(b, { x: 0, z: 0 })
        return JSON.stringify(b.scene())
      }
      expect(draw(7) === draw(7), say('same_seed', 7))
      expect(draw(7) !== draw(8), say('other_seed', 8))
    }),
    scenario('urban_lamps_burnt', ({ expect }) => {
      const dark = createUrban({ ...deps.urban, patch: { ...deps.urban?.patch, neighbourhoods: { ...deps.urban?.patch?.neighbourhoods, suburb: { lit: 0 } } } })
      const suburb = dark.neighbourhoods.get('suburb').compose(dark.builder(), { x: 0, z: 0 })
      expect(suburb.poles.length > 0 && !suburb.poles.some((pole) => pole.on), say('lamps_none', suburb.poles.length), { poles: suburb.poles.length })
      const lit = kit()
      const downtown = lit.neighbourhoods.get('downtown').compose(lit.builder(), { x: 0, z: 0 })
      expect(downtown.poles.length > 0 && downtown.poles.every((pole) => pole.on), say('lamps_all', downtown.poles.length), { poles: downtown.poles.length })
    }),
    scenario('urban_terrain', ({ expect }) => {
      const urban = kit()
      const terrain = urban.terrain(deps.terrain)
      const grid = terrain.grid()
      const mid = (grid.segments / 2) * (grid.segments + 1) + grid.segments / 2
      const world = terrain.fromWorld(grid.x[mid] as number, grid.z[mid] as number)
      const height = terrain.heightAt(world[0], world[1])
      expect(Math.abs(height - (grid.heights[mid] as number)) < 1e-3, say('vertex_height', round(height), round(grid.heights[mid] as number)), { height })
      for (const river of deps.terrain.rivers) {
        if (!('fixed' in river.bed)) continue
        const point = river.points[Math.floor(river.points.length / 2)] as readonly [number, number]
        const bed = terrain.heightAt(point[0], point[1])
        expect(Math.abs(bed - river.bed.fixed) < 1e-6, say('river_bed', round(river.bed.fixed < 0 ? -river.bed.fixed : river.bed.fixed)), { river: river.id, bed })
      }
      for (const lake of deps.terrain.lakes) {
        const level = terrain.heightAt(lake.center[0], lake.center[1])
        expect(Math.abs(level - lake.level) < 1e-6, say('lake_level', round(level)), { lake: lake.id, level })
      }
    }),
    scenario('urban_providers', ({ expect }) => {
      const urban = kit()
      const cars = urban.builder()
      const downtown = urban.neighbourhoods.get('downtown').compose(cars, { x: 0, z: 0 }, { providers: { vehicle: createVehicleProvider({ ids: STAND_IN_VEHICLE_IDS }) } })
      const spots = placements(cars.parts, 'vehicle')
      expect(spots.length === downtown.vehicles.length && spots.length > 0, say('vehicles_placed', downtown.vehicles.length, spots.length))
      expect(spots.every((spot) => STAND_IN_VEHICLE_IDS.includes(spot.id)), say('vehicle_ids', [...new Set(spots.map((spot) => spot.id))].join(', ')))
      const trees = urban.builder()
      const mountain = urban.neighbourhoods.get('mountain_resort').compose(trees, { x: 0, z: 0 }, { providers: { plant: createPlantProvider({ pickSpecies: standInSpecies }) } })
      const planted = placements(trees.parts, 'plant')
      expect(planted.length === mountain.plants.length && planted.length > 0, say('plants_placed', mountain.plants.length, planted.length))
    }),
  ]
}
