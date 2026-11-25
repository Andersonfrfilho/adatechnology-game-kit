import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { coincidentFacesOf } from '@adatechnology/game-shapes-three'
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

  it('draws no overhead drop of its own: the network draws the drop to the anchor on the post', () => {
    for (const build of [{ quality: 'game' as const }, { quality: 'game' as const, serviceFrom: FROM }]) {
      for (const options of [{}, { interactives: kit }]) {
        const ids = partIds(houseOf(plan, options, build).house)
        expect(ids.some((id) => id.startsWith('wiring:service:')), 'no drop from the street pole').toBe(false)
        expect(ids.some((id) => id.startsWith('wiring:drop:')), 'no wire from the post to the meter').toBe(false)
      }
    }
  })

  it('draws the padrão as a slim post (no crossarm), the meter box at its foot and the conduit down its face', () => {
    const { house } = houseOf(plan, {}, { quality: 'game' })
    const post = house.structure.parts.find((part) => part.id === 'pole:' + entrance.pole!.u.toFixed(1))!
    expect(post.aabb[2] - post.aabb[0], 'slim').toBeLessThanOrEqual(0.25)
    expect(post.aabb[3] - post.aabb[1], 'slim').toBeLessThanOrEqual(0.25)
    expect(post.y1).toBeLessThanOrEqual(entrance.pole!.h + 0.01)
    expect(entrance.meter?.place).toBe('post')
  })

  it('the padrão (post, bracket, meter box, conduit) has no coincident faces, with and without the interactables', () => {
    for (const options of [{}, { interactives: kit }]) {
      const { house } = houseOf(plan, options, { quality: 'game' })
      house.group.updateMatrixWorld(true)
      const near = (point: readonly number[]): boolean => Math.hypot(point[0]! - entrance.pole!.u, point[2]! - entrance.pole!.v) < 0.3
      const hits = coincidentFacesOf(house.group, { maxHits: Number.POSITIVE_INFINITY }).filter((hit) => near(hit.point))
      expect(hits.map((hit) => `${hit.labelA} x ${hit.labelB}`)).toEqual([])
    }
  })

  it('draws the meter post or the facade mast (pontalete), never both and never none, with or without the interactables', () => {
    let mastsSeen = 0
    for (const template of ['single_storey_a', 'drugstore', 'pharmacy', 'townhouse']) {
      const network = planOf(template, 3, 'normal', { street: 'network' })
      const own = network.utilities.electrical.serviceEntrance!
      const plain = partIds(houseOf(network, {}, { quality: 'game', serviceFrom: FROM }).house)
      const posts = plain.filter((id) => id.startsWith('pole:')).length
      const masts = plain.filter((id) => id.startsWith('mast:')).length
      expect(posts + masts, `${template}: one entrance drawn by the house`).toBe(1)
      expect(masts, template).toBe(own.mast ? 1 : 0)
      mastsSeen += masts
      const { house } = houseOf(network, { interactives: kit }, { quality: 'game', serviceFrom: FROM })
      const ids = partIds(house)
      expect(ids.some((id) => id.startsWith('pole:') || id.startsWith('mast:')), `${template}: the kit draws it, not the house`).toBe(false)
      const types = [...house.interactives!.entries.values()].map((entry) => entry.type)
      expect(types.filter((type) => type === 'service_entrance' || type === 'service_mast').length, `${template}: one entrance object`).toBe(1)
      if (own.mast) expect(types.includes('conduit_run') && [...house.interactives!.entries.keys()].includes('conduit_descent'), `${template}: the mast is the descent`).toBe(false)
    }
    expect(mastsSeen, 'a building at the lot front has a mast').toBeGreaterThan(0)
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

describe('a house on a street whose power runs underground (`street: \'network_underground\'`)', () => {
  const kit = { GameInteractables, GameInteractablesHousehold, GameInteractablesThree }

  it('draws no post, no mast, no pole and no wire of the street, with or without the interactables; the meter box stays', () => {
    for (const template of ['single_storey_a', 'drugstore', 'pharmacy', 'townhouse']) {
      const underground = planOf(template, 3, 'normal', { street: 'network_underground' })
      for (const options of [{}, { interactives: kit }]) {
        const { house } = houseOf(underground, options, { quality: 'game', serviceFrom: FROM })
        const ids = partIds(house)
        expect(ids.filter((id) => id.startsWith('pole:') || id.startsWith('mast:') || id.startsWith('wiring:')), template).toEqual([])
        if (house.interactives) expect([...house.interactives.entries.values()].some((entry) => entry.type === 'service_entrance' || entry.type === 'service_mast'), template).toBe(false)
      }
    }
  })

  it('adds no coincident face at its meter box and the conduit from the ground: none the same house on its own street does not have, with and without the interactables', () => {
    const underground = planOf('single_storey_a', 3, 'normal', { street: 'network_underground' })
    const own = planOf('single_storey_a', 3, 'normal')
    const meter = underground.utilities.electrical.serviceEntrance!.meter!
    const near = (point: readonly number[]): boolean => Math.hypot(point[0]! - meter.u, point[2]! - meter.v) < 0.4
    const hitsOf = (plan: typeof own, options: object): string[] => {
      const { house } = houseOf(plan, options, { quality: 'game' })
      house.group.updateMatrixWorld(true)
      return coincidentFacesOf(house.group, { maxHits: Number.POSITIVE_INFINITY }).filter((hit) => near(hit.point)).map((hit) => `${hit.labelA} x ${hit.labelB} @ ${hit.point.map((value) => value.toFixed(2)).join(',')}`)
    }
    for (const options of [{}, { interactives: kit }]) {
      const before = new Set(hitsOf(own, options))
      expect(hitsOf(underground, options).filter((hit) => !before.has(hit))).toEqual([])
    }
  })
})
