import { describe, expect, it } from 'vitest'

import { NETWORK_POST, connectionsInWorld } from '../src'
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
      for (const point of [sewer!, water!]) expect(point.at[2], `${template} ${point.network} inside the lot`).toBeGreaterThanOrEqual(result.lot.rect[1])
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
})
