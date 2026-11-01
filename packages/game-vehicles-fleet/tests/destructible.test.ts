import { describe, expect, it } from 'vitest'
import { checkAnimation, checkDestructible } from '@adatechnology/game-contracts'
import { buildVehicleItem, createVehicleDestructible } from '@adatechnology/game-vehicles'
import { makeFleetKit } from './helpers/kit'

const MATERIALS = ['steel', 'aluminium', 'glass', 'plastic', 'rubber']
const FAMILIES = {
  car: 'compact_hatch',
  sedan: 'midsize_sedan',
  pickup: 'midsize_pickup',
  motorcycle: 'sport_bike',
  truck: 'box_truck',
  bus: 'city_bus',
  tank: 'battle_tank',
  boat: 'speedboat',
  plane: 'single_engine_plane',
  helicopter: 'attack_helicopter',
}

describe('the destructible module on real fleet vehicles', () => {
  const kit = makeFleetKit('en')
  for (const [family, key] of Object.entries(FAMILIES)) {
    it(`${family} (${key}) follows the destruction contract`, () => {
      const item = buildVehicleItem(kit, key)
      const d = createVehicleDestructible(kit, item.vehicle, { id: `${key}_1`, frame: item.root })
      const r = checkDestructible(d, { materials: MATERIALS, cost: true })
      expect(r.problems).toEqual([])
      const ids = d.describe().parts.map((p) => p.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const clip of d.animations()) expect(checkAnimation(clip, ids).problems).toEqual([])
      expect(ids).toContain('battery')
    })
  }
})
