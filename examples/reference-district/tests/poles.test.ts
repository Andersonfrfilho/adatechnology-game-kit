import { describe, expect, it } from 'vitest'

import type { StructuredResult } from '@adatechnology/game-floorplan-structure'
import type { PlanRect } from '@adatechnology/game-urban'
import { DEFAULT_NETWORK_RULES } from '@adatechnology/game-urban/networks'

import { planLots } from '../src/game/assemble/houses'
import { buildNetworks } from '../src/game/assemble/networks'
import { lineRects } from '../src/game/geometry'
import { POLE_MIN_GAP } from '../src/game/roads'
import { entrancePostOf, entranceRectsOf, frontOpeningsOf, keepOutOf, networkDropOf, toWorld } from '../src/game/service'
import { plan, site } from './helpers'

const lines = plan.lines ?? []
const streets = lines.filter((line) => line.kind === 'street' || line.kind === 'avenue')
const roadBands = [...streets, ...lines.filter((line) => line.kind === 'river')].flatMap((line) => lineRects(line).map((rect) => ({ line: line.id, rect })))
const isInside = (x: number, z: number, rect: PlanRect): boolean => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3]
const roadUnder = (x: number, z: number): string | undefined => roadBands.find((band) => isInside(x, z, band.rect))?.line

const lots = planLots(site)
const generated = buildNetworks({ plan, site, lots, avoid: keepOutOf(lots, POLE_MIN_GAP) })
const { networks } = generated
const nodes = new Map(networks.nodes.map((node) => [node.id, node]))
/** The street poles of the network: the ones with a lamp (a pole the network adds to reach a lot off the streets has none). */
const poles = networks.nodes
  .filter((node) => node.kind === 'pole' && nodes.has(`light:${node.id}`))
  .map((node) => {
    const lamp = nodes.get(`light:${node.id}`)!
    return { id: node.id, x: node.at[0], z: node.at[2], lamp: [lamp.at[0], lamp.at[2]] as const, line: roadUnder(lamp.at[0], lamp.at[2]) }
  })
const posts = lots.flatMap((house) => {
  const post = entrancePostOf(house)
  return post ? [{ lot: house.lot.id, x: post[0], z: post[1] }] : []
})
/** How far a street pole stands from the curb of the street its lamp hangs over (the road's edge, half the street's width from its axis). */
const fromCurb = (point: { readonly x: number; readonly z: number; readonly line: string }): number => {
  const street = streets.find((line) => line.id === point.line)!
  const axis = street.points[0]!
  const along = street.points[1]![1] === axis[1] ? 'x' : 'z'
  return Math.abs(along === 'x' ? point.z - axis[1] : point.x - axis[0]) - street.width / 2
}

describe('the street poles are the network\'s, on the sidewalk by the curb, the way a Brazilian utility sets them', () => {
  it('every street pole\'s lamp hangs over a road, and its base lies 0.3 to 0.8 m from that curb, on the sidewalk, never on a road nor in the river', () => {
    expect(poles.length).toBeGreaterThan(10)
    for (const point of poles) {
      const where = `${point.id} (${point.x.toFixed(2)}, ${point.z.toFixed(2)})`
      expect(point.line, `${where}: lamp over a road`).toBeDefined()
      expect(roadUnder(point.x, point.z), where).toBeUndefined()
      expect(generated.surfaceAt(point.x, point.z), where).toBe('sidewalk')
      expect(fromCurb({ x: point.x, z: point.z, line: point.line! }), where).toBeGreaterThanOrEqual(0.3)
      expect(fromCurb({ x: point.x, z: point.z, line: point.line! }), where).toBeLessThanOrEqual(0.8)
    }
  })

  it('no two poles (the network\'s and the houses\' entrance posts) stand closer than 3 m', () => {
    const all = [...networks.nodes.filter((node) => node.kind === 'pole').map((node) => ({ id: node.id, x: node.at[0], z: node.at[2] })), ...posts.map((post) => ({ id: post.lot, x: post.x, z: post.z }))]
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        const [p, q] = [all[a]!, all[b]!]
        expect(Math.hypot(p.x - q.x, p.z - q.z), `${p.id} (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) and ${q.id} (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('no pole stands in front of a door or a gate of any lot', () => {
    const fronts = entranceRectsOf(lots)
    expect(fronts.length, 'the site has doors and gates on its fronts').toBeGreaterThan(lots.length)
    for (const node of networks.nodes.filter((item) => item.kind === 'pole')) for (const rect of fronts) expect(isInside(node.at[0], node.at[2], rect), node.id).toBe(false)
    for (const house of lots) expect(frontOpeningsOf(house.plan).length, house.lot.id).toBeGreaterThan(0)
  })
})

describe('each house is fed by the network\'s drop', () => {
  it('the entrance post stands inside its lot, behind the lot\'s front edge, never on the sidewalk', () => {
    expect(posts.length).toBeGreaterThan(0)
    for (const post of posts) {
      const lot = site.lots.find((item) => item.id === post.lot)!
      expect(isInside(post.x, post.z, lot.rect), `${post.lot} (${post.x.toFixed(2)}, ${post.z.toFixed(2)})`).toBe(true)
    }
  })

  it('the drop is the network\'s: from its pole, at the low voltage on it, to where the entrance takes it (the meter post\'s head or the facade meter), never to the ground', () => {
    let fed = 0
    for (const house of lots) {
      const drop = networkDropOf({ house, lot: house.lot.id, networks })
      const entrance = (house.plan as StructuredResult).utilities.electrical.serviceEntrance
      if (!entrance) continue
      // every lot is fed: one on no street of the plan (the church, 70 m north) by the extra pole the network stands within the drop's reach
      fed++
      expect(drop, house.lot.id).toBeDefined()
      expect(entrance.street, house.lot.id).toBe('network')
      const landing = entrance.drop[0]!
      const [x, z] = toWorld(house.placement, landing[0], landing[1])
      expect(drop!.to[0], house.lot.id).toBeCloseTo(x, 3)
      expect(drop!.to[1], house.lot.id).toBe(landing[2])
      expect(drop!.to[2], house.lot.id).toBeCloseTo(z, 3)
      expect(drop!.to[1], `${house.lot.id}: lands high`).toBeGreaterThan(2.5)
      const edge = networks.edges.find((item) => item.id === `drop:${house.lot.id}`)!
      const pole = networks.nodes.find((node) => node.id === edge.from)!
      expect(pole.kind, house.lot.id).toBe('pole')
      expect(drop!.from, house.lot.id).toEqual([pole.at[0], edge.heights![0], pole.at[2]])
      expect(Math.hypot(drop!.from[0] - x, drop!.from[2] - z), `${house.lot.id}: a drop no longer than a utility allows`).toBeLessThanOrEqual(DEFAULT_NETWORK_RULES.power.dropMaxLength)
      if (entrance.pole) {
        expect(landing[0], `${house.lot.id}: on the post`).toBe(entrance.pole.u)
        expect(Math.abs(landing[1] - entrance.pole.v), `${house.lot.id}: on the post's street face`).toBeLessThanOrEqual(0.15)
      }
      else expect([landing[0], landing[1]], `${house.lot.id}: on the facade mast`).toEqual([entrance.mast?.u, entrance.mast?.v])
    }
    expect(fed, 'every lot with an entrance is fed').toBe(lots.length)
  })
})
