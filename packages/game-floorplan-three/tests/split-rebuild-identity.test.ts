import { createHash } from 'node:crypto'

import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

/**
 * The world's split (`splitGroup`) builds the halves from what it remembers of the specs (contacts, cast members, spans, what a part's spec gives): the
 * result is the one measuring everything again gave. The hashes were recorded on the code that measured everything at each split.
 */
const scenario = (template: string, seed: number): string => {
  const world = createDestruction({ seed: 5 })
  const { house } = houseOf(planOf(template, seed), { destruction: world })
  const d = house.destruction
  d.activate()
  const id = d.id as string
  for (let i = 0; i < 20; i++) world.update(0.05)
  const at = world.serialize().objects.find((o) => o.id === id)!.state.position
  const lines: string[] = []
  // the room's charge: by the house, half a metre up
  world.explode([at[0] - 2.5, 0.6, at[2]], 4e6, 6, 'test')
  for (let frame = 0; frame < 40; frame++) {
    world.update(1 / 60)
    for (const objectId of world.serialize().objects.map((o) => o.id)) {
      for (let guard = 0; guard < 64 && (world.state(objectId)?.groups.length ?? 0) > 1; guard++) lines.push(`${frame} ${objectId} -> ${world.splitGroup(objectId, 1)}`)
    }
  }
  lines.push(JSON.stringify(world.serialize()))
  lines.push(JSON.stringify(rays(world, at)))
  return createHash('sha256').update(lines.join('\n')).digest('hex')
}

/** A fan of rays through the house: what they meet says where the cast members of the walls are (`castIn`). */
const rays = (world: DestructionWorld, at: readonly number[]): unknown[] => {
  const out: unknown[] = []
  for (let a = 0; a < 48; a++) {
    for (const y of [0.4, 1.2, 2.2]) {
      const angle = (a / 48) * Math.PI * 2
      const origin: Vec3 = [at[0]! + Math.cos(angle) * 12, y, at[2]! + Math.sin(angle) * 12]
      const hit = world.raycast(origin, [-Math.cos(angle), 0, -Math.sin(angle)], 24)
      out.push(hit ? [hit.object, hit.part, ...hit.point] : null)
    }
  }
  return out
}

describe('split rebuild: the same world as measuring everything again', () => {
  it.each([
    ['single_storey_a', 1, 'e4789453939cf4d7ef9d0e6169b71dfc308b6628b80e916aefedc08f742594dd'],
    ['sobrado', 2, 'f7162ddade3fc8fe9a277756cb5f3c51ff5ed1b59db0ff3b83f937e9f7df6511'],
  ])('%s:%s', (template, seed, hash) => {
    const got = scenario(template, seed)
    if (process.env.PRINT_SPLIT_HASH) console.log(`[HASH] ${template}:${seed} ${got}`)
    expect(got).toBe(hash)
  })
})
