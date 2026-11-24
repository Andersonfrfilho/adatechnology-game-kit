import { describe, expect, it } from 'vitest'

import { NETWORK_POST, connectionsInWorld, mastPathOf, WEATHERHEAD } from '../src'
import { INSPECTION_BOX, inspectionBoxV } from '../src/utilities/connections'
import type { StructuredResult } from '../src'
import { TOWER_TEMPLATES, engine } from './support'

const TEMPLATES = (engine.listTemplates().map((entry: { id: string }) => entry.id) as string[]).filter((id) => !TOWER_TEMPLATES.includes(id))
const plan = (template: string, seed: number, extra: Record<string, unknown> = {}): StructuredResult => engine.generate(template, { seed, state: 'normal', ...extra }) as StructuredResult
const NETWORKS = ['power', 'telecom', 'sewer', 'storm', 'water']

describe('a house on a street with a utility network (`street: \'network\'`)', () => {
  it('leaves the plan of every other house as it was: no mode, no connections', () => {
    for (const template of TEMPLATES) {
      const own = plan(template, 3)
      expect(own.utilities.connections, template).toBeUndefined()
      expect(own.utilities.electrical.serviceEntrance?.street, template).toBeUndefined()
    }
  })

  it('stands the meter post (padrão) of 6 m inside the lot, with the drop anchored on it, and declares the five connections in its plan', () => {
    let posts = 0
    for (const template of TEMPLATES) {
      const result = plan(template, 3, { street: 'network' })
      const entrance = result.utilities.electrical.serviceEntrance
      if (!entrance || !result.lot) continue
      expect(entrance.street, template).toBe('network')
      const connections = result.utilities.connections ?? []
      expect(connections.map((c) => c.network), template).toEqual(NETWORKS)
      const [power, telecom, sewer, storm, water] = connections
      const anchor = entrance.drop[0]!
      expect(power!.at, `${template}: the drop's anchor`).toEqual([anchor[0], anchor[2], anchor[1]])
      expect(power!.installedKva, template).toBeGreaterThan(0)
      expect(power!.at[1] - telecom!.at[1], template).toBeCloseTo(0.6)
      expect(sewer!.invert!, template).toBeLessThan(sewer!.at[1])
      expect(water!.at[2], `${template} water inside the lot`).toBeGreaterThanOrEqual(result.lot.rect[1])
      expect(storm!.at[2], `${template}: the downspout leaves at the lot's front edge`).toBe(result.lot.rect[1])
      if (!entrance.pole) continue
      posts++
      expect(entrance.pole.h, template).toBe(NETWORK_POST.h)
      expect(anchor[2], template).toBe(NETWORK_POST.anchor)
    }
    expect(posts).toBeGreaterThan(0)
  })

  it('places its connections on the lot, frame world, the downspout carried out to the kerb', () => {
    const result = plan('single_storey_a', 1, { street: 'network' })
    const placement = { x: 100, z: 20, ry: Math.PI }
    const world = connectionsInWorld({ plan: result, lot: 'lot_a', placement, kerb: 2.5 })
    expect(world.map((c) => [c.lot, c.frame])).toEqual(NETWORKS.map(() => ['lot_a', 'world']))
    const power = result.utilities.connections![0]!
    // turned half a circle: u and v change sign
    expect(world[0]!.at).toEqual([100 - power.at[0], power.at[1], 20 - power.at[2]])
    const storm = result.utilities.connections![3]!
    expect(world[3]!.at[2]).toBeCloseTo(20 - (storm.at[2] - 2.5))
    expect(world[2]!.invert).toBe(result.utilities.connections![2]!.invert)
  })

  it('has the meter post or the facade mast, never both and never none', () => {
    let masts = 0
    for (const template of TEMPLATES) {
      const entrance = plan(template, 3, { street: 'network' }).utilities.electrical.serviceEntrance
      if (!entrance) continue
      expect(Number(entrance.pole !== null) + Number(entrance.mast !== undefined), template).toBe(1)
      if (!entrance.mast) continue
      masts++
      const anchor = entrance.drop[0]!
      expect([anchor[0], anchor[1]], `${template}: the drop is anchored on the mast`).toEqual([entrance.mast.u, entrance.mast.v])
      expect(anchor[2], template).toBe(NETWORK_POST.anchor)
      expect(entrance.mast.y1, `${template}: the weatherhead over the anchor`).toBeGreaterThan(anchor[2])
    }
    expect(masts, 'a building with no front yard has a mast').toBeGreaterThan(0)
  })

  it('bends the mast\'s weatherhead half a circle toward the street, its open end pointing down', () => {
    const path = mastPathOf({ u: 2, v: -0.15, y0: 1.65, y1: 5.85 })
    expect(path[0]).toEqual([2, -0.15, 1.65])
    const end = path[path.length - 1]!
    expect(end[1]).toBeCloseTo(-0.15 - 2 * WEATHERHEAD.bend)
    expect(end[2]).toBeCloseTo(5.85)
    expect(Math.max(...path.map((point) => point[2]))).toBeCloseTo(5.85 + WEATHERHEAD.bend)
  })

  it('stands the inspection box in the front yard clear of the wall, or on the sidewalk just outside the facade, never under the wall', () => {
    const { half, facadeClear } = INSPECTION_BOX
    for (const front of [0, -0.3, -0.6, -0.9, -1.2, -3, -6]) {
      const v = inspectionBoxV(front)
      const inYard = v - half >= front - 1e-9 && v + half <= -facadeClear + 1e-9
      const outside = v + half <= Math.min(front, -facadeClear) + 1e-9
      expect(inYard || outside, `front ${front}: box at ${v}`).toBe(true)
    }
    expect(inspectionBoxV(0) + half, 'no front yard: on the sidewalk, just outside the facade').toBeLessThanOrEqual(-facadeClear)
    expect(inspectionBoxV(0) + half).toBeGreaterThan(-facadeClear - 0.1)
    expect(inspectionBoxV(-6), 'a deep yard: 1 m inside the front edge').toBe(-5)
  })
})
