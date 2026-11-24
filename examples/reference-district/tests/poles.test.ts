import { describe, expect, it } from 'vitest'

import type { StructuredResult } from '@adatechnology/game-floorplan-structure'
import type { PlanRect } from '@adatechnology/game-urban'

import { planLots } from '../src/game/assemble/houses'
import { poleIdAt } from '../src/game/assemble/streets'
import { lineRects } from '../src/game/geometry'
import { createReferenceUrban } from '../src/game/plan'
import { POLE_MIN_GAP, POLE_SPACING, polePointsOf, STREET_LIGHT_CURB_SETBACK } from '../src/game/roads'
import { entrancePostOf, entranceRectsOf, frontOpeningsOf, keepOutOf, SERVICE_DROP_HEIGHT, SERVICE_DROP_MAX, serviceDropOf, toWorld } from '../src/game/service'
import { plan, SIDEWALK_WIDTH, site } from './helpers'

const lines = plan.lines ?? []
const streets = lines.filter((line) => line.kind === 'street' || line.kind === 'avenue')
const roadBands = [...streets, ...lines.filter((line) => line.kind === 'river')].flatMap((line) => lineRects(line).map((rect) => ({ line: line.id, rect })))
const isInside = (x: number, z: number, rect: PlanRect): boolean => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3]
const roadUnder = (x: number, z: number): string | undefined => roadBands.find((band) => isInside(x, z, band.rect))?.line

const lots = planLots(site)
const poles = polePointsOf({ plan, spacing: POLE_SPACING, setback: STREET_LIGHT_CURB_SETBACK, avoid: keepOutOf(lots, POLE_MIN_GAP) })
const posts = lots.flatMap((house) => {
  const post = entrancePostOf(house)
  return post ? [{ lot: house.lot.id, x: post[0], z: post[1] }] : []
})
/** How far a street pole stands from the curb of its own street (the road's edge, half the street's width from its axis). */
const fromCurb = (point: { readonly x: number; readonly z: number; readonly line: string }): number => {
  const street = streets.find((line) => line.id === point.line)!
  const axis = street.points[0]!
  const along = street.points[1]![1] === axis[1] ? 'x' : 'z'
  return Math.abs(along === 'x' ? point.z - axis[1] : point.x - axis[0]) - street.width / 2
}

describe('the street poles stand on the sidewalk by the curb, the way a Brazilian utility sets them', () => {
  it('every street pole base lies 0.3 to 0.8 m from its curb, on the sidewalk, never on a road nor in the river', () => {
    expect(poles.length).toBeGreaterThan(10)
    for (const point of poles) {
      const where = `${point.line} (${point.x.toFixed(2)}, ${point.z.toFixed(2)})`
      expect(roadUnder(point.x, point.z), where).toBeUndefined()
      expect(fromCurb(point), where).toBeGreaterThanOrEqual(0.3)
      expect(fromCurb(point), where).toBeLessThanOrEqual(0.8)
      expect(fromCurb(point), where).toBeLessThan(SIDEWALK_WIDTH)
    }
  })

  it('one side per street, evenly spaced: a pole that slid to clear an entrance moved no more than the slide allows', () => {
    for (const street of streets) {
      const own = poles.filter((point) => point.line === street.id)
      expect(new Set(own.map((point) => point.side)).size, street.id).toBe(1)
      const axis = street.points[0]!
      const along = street.points[1]![1] === axis[1] ? 'x' : 'z'
      const start = along === 'x' ? Math.min(...street.points.map((p) => p[0])) : Math.min(...street.points.map((p) => p[1]))
      for (const point of own) {
        const station = (along === 'x' ? point.x : point.z) - start - POLE_SPACING / 2
        const off = Math.abs(station - Math.round(station / POLE_SPACING) * POLE_SPACING)
        expect(off, `${street.id} (${point.x}, ${point.z})`).toBeLessThanOrEqual(6)
      }
    }
  })

  it('no two poles (the street poles and the houses\' entrance posts) stand closer than 3 m', () => {
    const all = [...poles.map((point) => ({ id: point.line, x: point.x, z: point.z })), ...posts.map((post) => ({ id: post.lot, x: post.x, z: post.z }))]
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        const [p, q] = [all[a]!, all[b]!]
        expect(Math.hypot(p.x - q.x, p.z - q.z), `${p.id} (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) and ${q.id} (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('no street pole stands in front of a door or a gate of any lot', () => {
    const fronts = entranceRectsOf(lots)
    expect(fronts.length, 'the site has doors and gates on its fronts').toBeGreaterThan(lots.length)
    for (const point of poles) for (const rect of fronts) expect(isInside(point.x, point.z, rect), `${point.line} (${point.x}, ${point.z})`).toBe(false)
    for (const house of lots) expect(frontOpeningsOf(house.plan).length, house.lot.id).toBeGreaterThan(0)
  })

  it('the arm of every street pole reaches over its road (the lamp hangs over the roadway, never over the houses)', () => {
    const urban = createReferenceUrban()
    for (const point of poles) {
      const b = urban.builder({ seed: 1 })
      urban.poles.get(poleIdAt(urban, plan, point)).build(b, { x: point.x, z: point.z, ry: point.ry })
      const lenses = b.parts.filter((part) => part.shape === 'box' && part.emissive)
      const band = lineRects(streets.find((line) => line.id === point.line)!)
      expect(lenses.length).toBeGreaterThan(0)
      // a box drawn in a turned group (the double arm) is placed by the group: turn it as the group does
      const group = b.parts.find((part) => part.shape === 'group')
      const tips = lenses.map((lens) => (lens.shape === 'box' && lens.parent >= 0 && group?.shape === 'group' ? [group.x + lens.x * Math.cos(group.ry) + lens.z * Math.sin(group.ry), group.z - lens.x * Math.sin(group.ry) + lens.z * Math.cos(group.ry)] : lens.shape === 'box' ? [lens.x, lens.z] : [0, 0]))
      expect(tips.some(([x, z]) => band.some((rect) => isInside(x!, z!, rect))), `${point.line} (${point.x}, ${point.z}): lamp at ${JSON.stringify(tips)}`).toBe(true)
    }
  })
})

describe('each house is fed by a drop from the nearest street pole', () => {
  it('the entrance post stands inside its lot, behind the lot\'s front edge, never on the sidewalk', () => {
    expect(posts.length).toBeGreaterThan(0)
    for (const post of posts) {
      const lot = site.lots.find((item) => item.id === post.lot)!
      expect(isInside(post.x, post.z, lot.rect), `${post.lot} (${post.x.toFixed(2)}, ${post.z.toFixed(2)})`).toBe(true)
    }
  })

  it('the drop runs from the nearest street pole, high on it, to where the entrance takes it (the post\'s head or the facade meter), never to the ground', () => {
    let fed = 0
    for (const house of lots) {
      const drop = serviceDropOf(house, poles)
      const entrance = (house.plan as StructuredResult).utilities.electrical.serviceEntrance
      if (!entrance) continue
      // a lot whose front is on the sidewalk of a street is fed; one on no street of the plan (the church, 70 m north) is out of every pole's reach
      const [x0, z0, x1, z1] = house.lot.rect
      const onStreet = streets.some((street) => lineRects(street, SIDEWALK_WIDTH + 0.01).some((rect) => rect[0] <= x1 && x0 <= rect[2] && rect[1] <= z1 && z0 <= rect[3]))
      if (!onStreet) {
        expect(drop, `${house.lot.id}: on no street`).toBeUndefined()
        continue
      }
      fed++
      expect(drop, house.lot.id).toBeDefined()
      const landing = entrance.drop[0]!
      const [x, z] = toWorld(house.placement, landing[0], landing[1])
      expect(drop!.to, house.lot.id).toEqual([x, landing[2], z])
      expect(drop!.to[1], `${house.lot.id}: lands high`).toBeGreaterThan(2.5)
      const nearest = Math.min(...poles.map((pole) => Math.hypot(pole.x - x, pole.z - z)))
      expect(Math.hypot(drop!.from[0] - x, drop!.from[2] - z), house.lot.id).toBeCloseTo(nearest)
      expect(drop!.from[1], house.lot.id).toBe(SERVICE_DROP_HEIGHT)
      expect(Math.hypot(drop!.from[0] - x, drop!.from[2] - z), `${house.lot.id}: a drop no longer than a utility allows`).toBeLessThanOrEqual(SERVICE_DROP_MAX)
      if (entrance.pole) expect([landing[0], landing[1]], house.lot.id).toEqual([entrance.pole.u, entrance.pole.v])
      else expect([landing[0], landing[1]], house.lot.id).toEqual([entrance.meter?.u, entrance.meter?.v])
    }
    expect(fed, 'the lots of the script street and downtown are fed').toBeGreaterThan(10)
  })
})
