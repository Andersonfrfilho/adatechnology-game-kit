import { describe, expect, it } from 'vitest'
import { createDestruction, sizeStructure } from '../src'
import type { Vec3 } from '../src'
import { matchGolden, recordGolden, recordWorld } from './golden-helpers'
import { gateSpec, houseSpec, runFor, wallSpec } from './wall-helpers'

/**
 * Self-goldens of the layered walls (no original from the team: the ARS and OFI artifacts have no simulation): the event sequence of each
 * behaviour, recorded by tools/golden under the seeded, portable-math environment so it is the same on Node 22 and 24.
 * `UPDATE_GOLDEN=1 pnpm --filter @adatechnology/game-destruction test` rewrites the fixtures after an intended change.
 */
const wallRun = (assembly: string, seed: number, act: (world: ReturnType<typeof createDestruction>, id: string) => void) => (recorder: Parameters<Parameters<typeof recordGolden>[2]>[0]) => {
  const world = createDestruction({ seed })
  const id = world.add(wallSpec(assembly))
  recordWorld(recorder, world)
  act(world, id)
}

const burst = (world: ReturnType<typeof createDestruction>, energy: number, caliber: number, rounds: number) => {
  for (let i = 0; i < rounds; i++) world.shoot([-0.4 + 0.2 * (i % 5), 0.8 + 0.15 * (i % 5 === 0 ? 0 : i % 4), 3], [0, 0, -1], energy, caliber)
}

describe('self-goldens: layered walls', () => {
  it('9 mm burst on plastered brick', () => {
    matchGolden(recordGolden('wall-9mm-brick', 101, wallRun('brick_wall_plastered', 101, (world) => burst(world, 486, 9, 30))))
  })

  it('7.62 burst on plastered brick', () => {
    matchGolden(recordGolden('wall-762-brick', 102, wallRun('brick_wall_plastered', 102, (world) => burst(world, 3300, 7.62, 20))))
  })

  it('7.62 burst on reinforced concrete', () => {
    matchGolden(recordGolden('wall-762-rc', 103, wallRun('reinforced_concrete', 103, (world) => burst(world, 3300, 7.62, 30))))
  })

  it('sledgehammer on plastered brick until it breaches, then a shot through the opening', () => {
    matchGolden(recordGolden('wall-sledge-brick', 104, wallRun('brick_wall_plastered', 104, (world, id) => {
      while ((world.part(id, 'wall')!.stage ?? 0) < 2) world.hit(id, { type: 'blunt', point: [0, 1, 0.065], direction: [0, 0, -1], energy: 128, radius: 0.05 })
      world.shoot([0, 1, 3], [0, 0, -1], 400, 9)
    })))
  })

  it('C4 on reinforced concrete', () => {
    matchGolden(recordGolden('wall-c4-rc', 105, wallRun('reinforced_concrete', 105, (world) => { world.explode([0, 1, 0.12], 345600, 18) })))
  })

  it('bullet holes, then the plastered brick wall falls in blocks', () => {
    matchGolden(recordGolden('wall-holes-fall', 106, wallRun('brick_wall_plastered', 106, (world, id) => {
      burst(world, 486, 9, 12)
      world.hit(id, { type: 'blunt', point: [0, 1, 0.065], direction: [0, 0, -1], energy: 3e6, radius: 0.05 })
    })))
  })

  it('RPG on a column of a frame: cage exposed, overload, slab and roof collapse', () => {
    matchGolden(recordGolden('gate-rpg-collapse', 107, (recorder) => {
      const world = createDestruction({ seed: 107 })
      const id = world.add(sizeStructure(gateSpec()))
      recordWorld(recorder, world)
      world.hit(id, { type: 'explosive', point: [-1.5, 1.5, 0.15], energy: 200000, radius: 1.5 })
      runFor(world, 30)
    }))
  })

  it('the six structural scenarios of the house area', () => {
    const spec = houseSpec()
    const at = (part: string): Vec3 => spec.parts.find((p) => p.id === part)!.position
    matchGolden(recordGolden('house-scenarios', 108, (recorder) => {
      const fresh = (scenario: string) => {
        const world = createDestruction({ seed: 108 })
        const id = world.add(spec)
        recordWorld(recorder, world, scenario)
        return { world, id }
      }
      const blunt = (w: ReturnType<typeof fresh>, part: string) => w.world.hitPart(w.id, part, { type: 'blunt', point: at(part), energy: 3e6, radius: 0.05 })
      const bullet = (w: ReturnType<typeof fresh>, part: string) => w.world.hitPart(w.id, part, { type: 'ballistic', point: at(part), direction: [0, 0, -1], energy: 600, caliber: 9 })
      let w = fresh('one_pillar')
      blunt(w, 'c0')
      runFor(w.world, 20)
      w = fresh('two_pillars')
      blunt(w, 'c0')
      blunt(w, 'c1')
      runFor(w.world, 90)
      w = fresh('partition')
      blunt(w, 'wall_back')
      runFor(w.world, 20)
      w = fresh('window_glass')
      for (let shot = 0; shot < 12 && w.world.part(w.id, 'window')!.status !== 'broken'; shot++) {
        bullet(w, 'window')
        runFor(w.world, 0.3)
      }
      w = fresh('tank_leak')
      bullet(w, 'tank')
      runFor(w.world, 40)
      w = fresh('gas_explodes')
      w.world.hitPart(w.id, 'bottle', { type: 'fire', point: at('bottle'), temperature: 900, radius: 0.6, duration: 8 })
      runFor(w.world, 12)
    }))
  })

  it('records the same events twice in a row', () => {
    const run = () => recordGolden('wall-repeat', 109, wallRun('brick_wall_plastered', 109, (world) => burst(world, 486, 9, 10)))
    expect(run().events).toEqual(run().events)
  })
})
