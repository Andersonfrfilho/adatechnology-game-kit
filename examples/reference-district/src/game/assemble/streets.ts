import type * as THREE_NS from 'three'

import type { RainCoverFootprint } from '@adatechnology/game-contracts'
import type { LightBudget } from '@adatechnology/game-render-three'
import type { CityPlanInput, PlanRect, UrbanKit } from '@adatechnology/game-urban'
import { createUrbanThree } from '@adatechnology/game-urban-three'
import type { DrawnUrban } from '@adatechnology/game-urban-three'

import { blocksToFill } from '../blocks'
import { roadStretchesOf } from '../roads'
import type { Site } from '../site'

const STREET_MARGIN = 10
export type StreetsParams = {
  readonly THREE: typeof THREE_NS
  readonly urban: UrbanKit
  readonly plan: CityPlanInput
  readonly site: Site
  readonly lights: LightBudget
  readonly seed: number
}

export type Streets = {
  readonly drawn: DrawnUrban
  /** The footprint of every building the city placed (what `fillBlock` returns), with its height: the gaps between them are open ground. */
  readonly buildings: ReadonlyArray<{ readonly rect: PlanRect; readonly height: number }>
  /** The roofs of the city (buildings, towers): the rain keeps off what they cover (`world.rainCover`). */
  readonly covers: readonly RainCoverFootprint[]
}

/**
 * The roads and the blocks of the plan, built by `game-urban` and drawn by `game-urban-three`: the roads from the plan's lines (`streets.road`) and every block of a district the site leaves free filled with the district's buildings (`cities.fillBlock`). The terrain zones under the roads come from the
 * same lines (`groundLayoutOf`); nothing here is a shape of the game.
 */
export function drawStreets({ THREE, urban, plan, site, lights, seed }: StreetsParams): Streets {
  const b = urban.builder({ seed })
  const layout = urban.cities.layout(plan)
  const streets = (plan.lines ?? []).filter((line) => line.kind === 'street')
  if (streets.length === 0) throw new Error(`the plan "${plan.id}" has no street to draw`)
  for (const road of roadStretchesOf(plan)) urban.streets.road(b, road.x, road.z, road.width, road.length, road.along)
  const buildings: Array<{ rect: PlanRect; height: number }> = []
  for (const district of layout.districts) {
    for (const block of blocksToFill(layout.blocks(district.id, { street: STREET_MARGIN }), site)) {
      for (const building of urban.cities.fillBlock(b, block)) buildings.push({ rect: [building.x - building.width / 2, building.z - building.depth / 2, building.x + building.width / 2, building.z + building.depth / 2], height: building.height })
    }
  }
  const drawn = createUrbanThree(THREE, { document, lights, physicalLights: true, flickerLenses: true }).draw(b.scene())
  return { drawn, buildings, covers: b.covers }
}
