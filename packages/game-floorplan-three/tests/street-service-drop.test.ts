import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

/** Where the street's drop leaves the street pole, in the house's frame: 9 m along the facade and 6 m out over the road, 6.8 m up. */
const FROM = [9, 6.8, -6] as const

const partIds = (house: ReturnType<typeof houseOf>['house']): string[] => house.structure.parts.map((part) => part.id)

describe('a house on a street that brings its own poles (`serviceFrom`)', () => {
  it('draws no grid poles of its own: one drop sags from the street pole to the entrance post, which stands inside the lot', () => {
    const plan = planOf('single_storey_a', 1, 'normal', { streetPoles: true })
    const entrance = plan.utilities.electrical.serviceEntrance!
    expect(entrance.pole, 'the house has a front yard for its post').not.toBeNull()
    expect(entrance.pole!.v).toBeGreaterThan(plan.lot!.rect[1])
    const { house } = houseOf(plan, {}, { quality: 'game', serviceFrom: FROM })
    const ids = partIds(house)
    expect(ids.filter((id) => id.startsWith('pole:')), 'only the entrance post').toEqual(['pole:' + entrance.pole!.u.toFixed(1)])
    expect(ids.some((id) => id.startsWith('wiring:grid'))).toBe(false)
    const drop = house.structure.parts.filter((part) => part.id.startsWith('wiring:service:'))
    expect(drop.length).toBeGreaterThanOrEqual(8)
    // it runs from the street pole to the post's head and never dips toward the ground: its lowest point is far over a person's head
    const xs = drop.flatMap((part) => [part.aabb[0], part.aabb[2]])
    expect(Math.min(...xs)).toBeLessThanOrEqual(Math.min(FROM[0], entrance.pole!.u) + 0.05)
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(Math.max(FROM[0], entrance.pole!.u) - 0.05)
    expect(Math.min(...drop.map((part) => part.y0))).toBeGreaterThan(5)
  })

  it('a building with no front yard has no post: the drop lands on the facade over its meter', () => {
    const plan = planOf('drugstore', 3, 'normal', { streetPoles: true })
    const entrance = plan.utilities.electrical.serviceEntrance!
    expect(entrance.pole).toBeNull()
    const { house } = houseOf(plan, {}, { quality: 'game', serviceFrom: FROM })
    const ids = partIds(house)
    expect(ids.some((id) => id.startsWith('pole:'))).toBe(false)
    const drop = house.structure.parts.filter((part) => part.id.startsWith('wiring:service:'))
    expect(drop.length).toBeGreaterThanOrEqual(8)
    expect(Math.min(...drop.map((part) => part.y0))).toBeGreaterThan(2.5)
  })

  it('without `serviceFrom` the house keeps its own grid, as before', () => {
    const { house } = houseOf(planOf('single_storey_a', 1), {}, { quality: 'game' })
    expect(partIds(house).filter((id) => id.startsWith('pole:')).length).toBe(3)
  })
})

describe('a house on a street with a utility network (`street: \'network\'`)', () => {
  const plan = planOf('single_storey_a', 1, 'normal', { street: 'network' })
  const entrance = plan.utilities.electrical.serviceEntrance!
  const kit = { GameInteractables, GameInteractablesHousehold, GameInteractablesThree }
  const entrances = (house: ReturnType<typeof houseOf>['house']): number => [...house.interactives!.entries.values()].filter((entry) => entry.type === 'service_entrance').length

  it('draws its meter post once and no pole of the street, with or without the network\'s drop', () => {
    expect(entrance.street).toBe('network')
    for (const build of [{ quality: 'game' as const }, { quality: 'game' as const, serviceFrom: FROM }]) {
      const ids = partIds(houseOf(plan, {}, build).house)
      expect(ids.filter((id) => id.startsWith('pole:')), 'only the meter post').toEqual(['pole:' + entrance.pole!.u.toFixed(1)])
      expect(ids.some((id) => id.startsWith('wiring:grid'))).toBe(false)
    }
  })

  it('with the interactables the kit draws the post (one entrance object) and the house none', () => {
    for (const build of [{ quality: 'game' as const }, { quality: 'game' as const, serviceFrom: FROM }]) {
      const { house } = houseOf(plan, { interactives: kit }, build)
      expect(partIds(house).some((id) => id.startsWith('pole:')), 'the house draws no pole').toBe(false)
      expect(entrances(house), 'one entrance object').toBe(1)
      expect(house.interactives!.plane.items.filter((item) => item.type === 'service_entrance').length).toBe(1)
    }
  })

  it('hangs the network\'s drop from where it leaves the street pole to the anchor on the post', () => {
    const { house } = houseOf(plan, { interactives: kit }, { quality: 'game', serviceFrom: FROM })
    const drop = house.structure.parts.filter((part) => part.id.startsWith('wiring:service:')).sort((a, b) => Number(a.id.split(':')[2]) - Number(b.id.split(':')[2]))
    const anchor = entrance.drop[0]!
    const first = drop[0]!.aabb
    const last = drop[drop.length - 1]!.aabb
    const holds = (box: readonly number[], x: number, z: number): boolean => x >= box[0]! - 0.02 && x <= box[2]! + 0.02 && z >= box[1]! - 0.02 && z <= box[3]! + 0.02
    expect(holds(first, FROM[0], FROM[2]), 'starts at the street pole').toBe(true)
    expect(holds(last, anchor[0], anchor[1]), 'ends on the post').toBe(true)
    expect(Math.max(...drop.map((part) => part.y1))).toBeLessThanOrEqual(FROM[1] + 0.05)
  })

  it('each house has its own interactables world: an outage of one lot (`power.setGrid(false)`) leaves its neighbour lit', () => {
    const one = houseOf(plan, { interactives: kit }).house
    const other = houseOf(planOf('single_storey_a', 2, 'normal', { street: 'network' }), { interactives: kit }).house
    expect(one.interactives!.world).not.toBe(other.interactives!.world)
    one.interactives!.world.power.setGrid(false)
    expect(one.interactives!.world.power.grid).toBe(false)
    expect(other.interactives!.world.power.grid).toBe(true)
  })
})
