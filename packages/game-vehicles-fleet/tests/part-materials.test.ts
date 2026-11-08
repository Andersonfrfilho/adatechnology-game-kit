import { describe, expect, it } from 'vitest'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'

import { fleetVehicleIds } from '../src'
import { makeFleetKit } from './helpers/kit'

/** The materials of the destruction model a vehicle is made of (ids of `game-destruction`'s catalogue): no part generic or unknown. */
const VEHICLE_MATERIALS = new Set(['steel', 'aluminium', 'glass', 'plastic', 'rubber'])
/** Parts named as glazing are glass (CLAUDE.md §7: every glass drawn is a glass part), never the steel of the cab. */
const GLASS_NAME = /glass|pane|window|windshield|canopy_glass/i
const TYRE_NAME = /tyre|tire/i

describe('every part of every fleet vehicle has the material of what it is', () => {
  const kit = makeFleetKit('en')
  it.each([...fleetVehicleIds])('%s', (key) => {
    const item = buildVehicleItem(kit, key)
    const parts = createVehicleDestructible(kit, item.vehicle, { id: key, frame: item.root }).describe().parts
    const problems: string[] = []
    for (const part of parts) {
      if (!VEHICLE_MATERIALS.has(part.material)) problems.push(`${part.id}: unknown material ${part.material}`)
      if (GLASS_NAME.test(part.id) && part.material !== 'glass') problems.push(`${part.id}: glazing of ${part.material}`)
      if (TYRE_NAME.test(part.id) && part.material !== 'rubber') problems.push(`${part.id}: tyre of ${part.material}`)
    }
    expect(problems).toEqual([])
  })
})
