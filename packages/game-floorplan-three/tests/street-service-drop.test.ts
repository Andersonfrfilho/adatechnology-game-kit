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
