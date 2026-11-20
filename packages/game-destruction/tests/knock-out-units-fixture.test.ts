import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { countByType, wallWorld } from './wall-helpers'

const FIXTURE = join(__dirname, 'fixtures', 'knock-out-units.json')

type Recorded = { readonly events: number; readonly byType: Record<string, number>; readonly eventsHash: string; readonly stateHash: string }

const sha = (text: string): string => createHash('sha256').update(text).digest('hex')

/** A plastered brick wall shot first (holes in it), then blasted twice: every event in order and the serialized state, as hashes. */
const record = (): Recorded => {
  const { world, objectId, events } = wallWorld('brick_wall_plastered')
  for (const [x, y] of [[-0.8, 0.8], [-0.7, 1.0], [0.2, 1.4], [0.3, 0.6], [0.9, 1.2]] as const) {
    world.hitPart(objectId, 'wall', { type: 'ballistic', point: [x, y, 0.07], direction: [0, 0, -1], energy: 3500, caliber: 7.62 })
  }
  world.explode([-0.7, 1, 0.3], 60000, 4)
  world.explode([0.4, 0.8, 0.3], 90000, 5)
  for (let i = 0; i < 20; i++) world.update(0.05)
  return { events: events.length, byType: countByType(events), eventsHash: sha(JSON.stringify(events)), stateHash: sha(JSON.stringify(world.serialize())) }
}

describe('a wall of units with holes in it, blasted (knockOutUnits)', () => {
  it('gives the events and the state the version before the holes were measured once gave', () => {
    const now = record()
    if (process.env.UPDATE_KNOCK_OUT !== undefined || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, `${JSON.stringify(now, null, 2)}\n`)
    }
    const recorded = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Recorded
    expect(now.byType.chip ?? 0).toBeGreaterThan(0)
    expect(now.byType.hole ?? 0).toBeGreaterThan(0)
    expect(now).toEqual(recorded)
  })
})
