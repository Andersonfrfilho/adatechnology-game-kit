import type { generate } from '@adatechnology/game-vegetation'
import type { Providers, TerrainOptions, UrbanOptions } from '@adatechnology/game-urban'

import type { CanvasFactory } from '../text'
import type { VehicleBuilder } from '../resolvers'

export type UrbanTestOptions = {
  /** `en` or `pt-BR` (default). The room asks `items(locale)` and `scenarios(locale)` itself; this is the language of the bench and of the signs of the neighbourhoods. */
  readonly locale?: string
  /** Seed of the fixed samples of the area (default 7, the Galeria's). */
  readonly seed?: number
  /** Options of the urban kit the area draws with (packs, patches, removals): a game's own catalogues show up in the area. */
  readonly urban?: UrbanOptions
  /** The terrain of the terrain patch (default a small rolling plain with a river and a lake). */
  readonly terrain?: TerrainOptions
  /** Where canvases come from for the signs; default the page's `document`. */
  readonly document?: CanvasFactory
  /** Builds the vehicles of the fleet for the `vehicle` provider of the bench (`createVehiclesThree` of `game-vehicles-three`). Without it the bench parks no cars. */
  readonly vehicles?: (THREE: unknown) => VehicleBuilder
  /** The vehicle and plant providers of the bench's `providers` setting (`defaultUrbanProviders` of `game-kit-defaults`, or the game's own). Without one, that choice draws nothing. */
  readonly providers?: Pick<Providers, 'vehicle' | 'plant'>
  /** The generator spec of a species id, for the plants of the bench (`defaultPlantSpec` of `game-kit-defaults`). */
  readonly plantSpec: (id: string) => Parameters<typeof generate>[0]
  /** Where the bench draws its neighbourhood in the room, `[x, z]` (default `[0, -60]`). */
  readonly benchOrigin?: readonly [number, number]
}

/** What a scenario needs of the room: the pass/fail line and time. The checks of this area are on the kit's own numbers, so no object of the room is touched. */
export type UrbanContext = {
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
  step(seconds: number): void
}
