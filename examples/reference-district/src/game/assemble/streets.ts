import type * as THREE_NS from 'three'

import type { LightBudget } from '@adatechnology/game-render-three'
import type { CityPlanInput, PlanRect, UrbanKit } from '@adatechnology/game-urban'
import { createUrbanThree } from '@adatechnology/game-urban-three'
import type { DrawnUrban } from '@adatechnology/game-urban-three'

import { blocksToFill } from '../blocks'
import { SIDEWALK_WIDTH } from '../ground'
import { polePointsOf, roadStretchesOf } from '../roads'
import type { Site } from '../site'

const STREET_MARGIN = 10
const POLE_SPACING = 32
/** The pole of a street that crosses districts of two patterns: the pattern of the district the pole stands in decides it. */
const FALLBACK_POLE = 'concrete_arm'

export type StreetsParams = {
  readonly THREE: typeof THREE_NS
  readonly urban: UrbanKit
  readonly plan: CityPlanInput
  readonly site: Site
  readonly lights: LightBudget
  readonly seed: number
  readonly isNight: boolean
}

export type Streets = {
  readonly drawn: DrawnUrban
  /** The blocks the city filled with its own buildings (the ones a lot or a missing building does not stand on). */
  readonly filledBlocks: readonly PlanRect[]
}

/**
 * The roads, the poles and the blocks of the plan, built by `game-urban` and drawn by `game-urban-three`: the roads from the plan's lines (`streets.road`), the poles of the pattern of
 * each district along them, and every block of a district the site leaves free filled with the district's buildings (`cities.fillBlock`). The terrain zones under the roads come from the
 * same lines (`groundLayoutOf`); nothing here is a shape of the game.
 */
export function drawStreets({ THREE, urban, plan, site, lights, seed, isNight }: StreetsParams): Streets {
  const b = urban.builder({ seed })
  const layout = urban.cities.layout(plan)
  const streetWidth = Math.max(...(plan.lines ?? []).filter((line) => line.kind === 'street').map((line) => line.width))
  for (const road of roadStretchesOf(plan)) urban.streets.road(b, road.x, road.z, streetWidth, road.length, road.along)
  for (const point of polePointsOf({ plan, spacing: POLE_SPACING, offset: streetWidth / 2 + SIDEWALK_WIDTH / 2 })) {
    const district = layout.districtAt(point.x, point.z)
    const pattern = district?.pattern ? urban.neighbourhoods.get(district.pattern).pattern : undefined
    const pole = urban.poles.get(pattern?.pole || FALLBACK_POLE)
    pole.build(b, { x: point.x, z: point.z, on: isNight, dir: -point.side })
  }
  const filled: PlanRect[] = []
  for (const district of layout.districts) {
    for (const block of blocksToFill(layout.blocks(district.id, { street: STREET_MARGIN }), site)) {
      urban.cities.fillBlock(b, block)
      filled.push([block.x - block.size[0] / 2, block.z - block.size[1] / 2, block.x + block.size[0] / 2, block.z + block.size[1] / 2])
    }
  }
  const drawn = createUrbanThree(THREE, { document, lights }).draw(b.scene())
  return { drawn, filledBlocks: filled }
}
