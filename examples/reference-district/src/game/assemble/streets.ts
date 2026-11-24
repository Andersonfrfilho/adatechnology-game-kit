import type * as THREE_NS from 'three'

import type { LightBudget } from '@adatechnology/game-render-three'
import { lampStateOf } from '@adatechnology/game-urban'
import type { CityPlanInput, LampShares, PlanRect, UrbanKit } from '@adatechnology/game-urban'
import { createUrbanThree } from '@adatechnology/game-urban-three'
import type { DrawnUrban } from '@adatechnology/game-urban-three'

import { blocksToFill } from '../blocks'
import { polePointsOf, roadStretchesOf, STREET_LIGHT_CURB_SETBACK } from '../roads'
import type { Site } from '../site'

const STREET_MARGIN = 10
const POLE_SPACING = 32
/** The pole of a street that crosses districts of two patterns: the pattern of the district the pole stands in decides it. */
const FALLBACK_POLE = 'concrete_arm'
/** Every lamp works unless the scenario says otherwise. */
const ALL_LAMPS_WORK: LampShares = { lit: 1, flicker: 0 }

export type StreetsParams = {
  readonly THREE: typeof THREE_NS
  readonly urban: UrbanKit
  readonly plan: CityPlanInput
  readonly site: Site
  readonly lights: LightBudget
  readonly seed: number
  readonly isNight: boolean
  /** At night, the share of lamps that work and the share that flicker (the rest are burnt out). */
  readonly lamps?: LampShares
}

export type Streets = {
  readonly drawn: DrawnUrban
  /** The footprint of every building the city placed (what `fillBlock` returns), with its height: the gaps between them are open ground. */
  readonly buildings: ReadonlyArray<{ readonly rect: PlanRect; readonly height: number }>
}

/**
 * The roads, the poles and the blocks of the plan, built by `game-urban` and drawn by `game-urban-three`: the roads from the plan's lines (`streets.road`), the poles of the pattern of
 * each district along them, and every block of a district the site leaves free filled with the district's buildings (`cities.fillBlock`). The terrain zones under the roads come from the
 * same lines (`groundLayoutOf`); nothing here is a shape of the game.
 */
export function drawStreets({ THREE, urban, plan, site, lights, seed, isNight, lamps = ALL_LAMPS_WORK }: StreetsParams): Streets {
  const b = urban.builder({ seed })
  const layout = urban.cities.layout(plan)
  const streets = (plan.lines ?? []).filter((line) => line.kind === 'street')
  if (streets.length === 0) throw new Error(`the plan "${plan.id}" has no street to draw`)
  for (const road of roadStretchesOf(plan)) urban.streets.road(b, road.x, road.z, road.width, road.length, road.along)
  for (const point of polePointsOf({ plan, spacing: POLE_SPACING, setback: STREET_LIGHT_CURB_SETBACK })) {
    const district = layout.districtAt(point.x, point.z)
    const pattern = district?.pattern ? urban.neighbourhoods.get(district.pattern).pattern : undefined
    const pole = urban.poles.get(pattern?.pole ?? FALLBACK_POLE)
    const lamp = isNight ? lampStateOf({ seed, x: point.x, z: point.z, shares: lamps }) : { on: false, flicker: false }
    pole.build(b, { x: point.x, z: point.z, on: lamp.on, flicker: lamp.flicker, dir: -point.side })
  }
  const buildings: Array<{ rect: PlanRect; height: number }> = []
  for (const district of layout.districts) {
    for (const block of blocksToFill(layout.blocks(district.id, { street: STREET_MARGIN }), site)) {
      for (const building of urban.cities.fillBlock(b, block)) buildings.push({ rect: [building.x - building.width / 2, building.z - building.depth / 2, building.x + building.width / 2, building.z + building.depth / 2], height: building.height })
    }
  }
  const drawn = createUrbanThree(THREE, { document, lights, physicalLights: true, flickerLenses: true }).draw(b.scene())
  return { drawn, buildings }
}
