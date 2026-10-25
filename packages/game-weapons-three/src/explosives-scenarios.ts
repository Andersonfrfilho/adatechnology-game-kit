import type { DestructionEvent, ModuleScenario, Vec3 } from '@adatechnology/game-contracts'
import { EXPLOSIVES_AREA_ID } from './explosives-bench'
import type { ExplosivesBench, ExplosivesRoom } from './explosives-bench'
import { explosivesTextOf } from './explosives-text'
import { WORLD_EXPLOSIVE_PREFIX } from './world-explosives'

/** The members of the test room's `ScenarioContext` these scenarios use (structural: this package does not depend on the room). */
interface ScenarioContext {
  room: ExplosivesRoom
  step(seconds: number): void
  expect(ok: boolean, label: string, data?: Record<string, unknown>): void
}

/** The time the torch is expected after the hole and the longest the blast may take after a trigger of the shot chain (the chain says 1.4 s; the scenario allows a margin). */
const TORCH_WINDOW: [number, number] = [0.7, 1.0]
const BLAST_WITHIN = 1.6
const CYLINDER_ITEM = `${WORLD_EXPLOSIVE_PREFIX}propane_p13`

/**
 * Scenarios of the explosives area against the real cylinder, wall, furniture, zombie and survivor: a 9 mm through the shell, the open valve with and without a flame, the cylinder in a fire and a second
 * cylinder set off by the blast of the first. Each one runs the bench action a person would press, then reads the world's events and the state of what stood near.
 */
export function explosivesScenarios(locale: string, bench: ExplosivesBench): Array<ModuleScenario<ScenarioContext>> {
  const text = explosivesTextOf(locale).scenarios
  const record = (room: ExplosivesRoom): { events: Array<{ type: string; time: number; object: string }>; stop: () => void } => {
    const events: Array<{ type: string; time: number; object: string }> = []
    const stop = room.world.on('*', (event: DestructionEvent) => {
      if (event.object.startsWith(CYLINDER_ITEM)) events.push({ type: event.type, time: event.time, object: event.object })
    })
    return { events, stop }
  }
  const first = (events: Array<{ type: string; time: number }>, type: string, after = -Infinity): { type: string; time: number } | undefined => events.find((event) => event.type === type && event.time >= after)

  return [
    {
      id: 'explosives_p13_shot',
      name: text.shot,
      run: ({ room, step, expect }) => {
        room.openArea(EXPLOSIVES_AREA_ID)
        const { events, stop } = record(room)
        bench.actions.shoot()
        step(2.4)
        stop()
        const leak = first(events, 'leak')
        const explode = first(events, 'explode')
        const view = bench.vessel()
        expect(!!leak, text.shot_leak, { events: events.map((event) => event.type) })
        const torchAfter = view?.litAt !== undefined && view.leakAt !== undefined ? view.litAt - view.leakAt : -1
        expect(torchAfter >= TORCH_WINDOW[0] && torchAfter <= TORCH_WINDOW[1] + 0.05, `${text.shot_ignite} (${torchAfter.toFixed(2)} s)`, { torchAfter })
        const blastAfter = leak && explode ? explode.time - leak.time : -1
        expect(blastAfter > 0 && blastAfter <= BLAST_WITHIN, `${text.shot_explode} (${blastAfter.toFixed(2)} s)`, { blastAfter })
        const witnesses = bench.witnesses()
        const zombie = witnesses.find((w) => w.itemId.startsWith('zombie_'))
        expect(!!zombie && (zombie.alive === false || (zombie.vitality ?? 1) < 0.5), `${text.shot_zombie} (${zombie?.distance.toFixed(1)} m)`, { zombie })
        const survivor = witnesses.find((w) => w.kind === 'person' && !w.itemId.startsWith('zombie_'))
        expect(!!survivor && survivor.alive === true && (survivor.vitality ?? 1) < 1, `${text.shot_survivor} (${survivor?.distance.toFixed(1)} m, ${survivor?.alive ? 'alive' : 'dead'})`, { survivor })
        const wall = witnesses.find((w) => w.kind === 'wall')
        expect((wall?.marks ?? 0) + (wall?.broken ?? 0) + ((wall?.pieces ?? 1) - 1) > 0, text.shot_wall, { wall })
      },
    },
    {
      id: 'explosives_p13_valve',
      name: text.valve,
      run: ({ room, step, expect }) => {
        room.openArea(EXPLOSIVES_AREA_ID)
        const { events, stop } = record(room)
        bench.actions.valve()
        step(4)
        expect(!!first(events, 'leak'), text.valve_leak)
        expect(!first(events, 'primed') && !first(events, 'explode'), text.valve_quiet, { events: events.map((event) => event.type) })
        const before = room.world.time
        bench.actions.light()
        step(2.2)
        stop()
        expect(bench.vessel()?.lit === true || bench.vessel()?.litAt !== undefined, text.valve_lit)
        const explode = first(events, 'explode', before)
        expect(!!explode && explode.time - before <= BLAST_WITHIN, `${text.valve_explode} (${explode ? (explode.time - before).toFixed(2) : 'no blast'} s)`, { after: explode ? explode.time - before : null })
      },
    },
    {
      id: 'explosives_p13_fire',
      name: text.fire,
      run: ({ room, step, expect }) => {
        room.openArea(EXPLOSIVES_AREA_ID)
        const { events, stop } = record(room)
        bench.actions.fire()
        step(8)
        stop()
        expect(!!first(events, 'explode'), text.fire_explode, { events: events.map((event) => event.type) })
      },
    },
    {
      id: 'explosives_p13_chain',
      name: text.chain,
      run: ({ room, step, expect }) => {
        room.openArea(EXPLOSIVES_AREA_ID)
        const near: Vec3 = [1.0, 0, -10.0]
        const second = room.spawn(CYLINDER_ITEM, near, 0)
        const { events, stop } = record(room)
        bench.actions.shoot()
        step(4)
        stop()
        const blasts = events.filter((event) => event.type === 'explode')
        const other = blasts.find((event) => event.object === second.objectId)
        expect(blasts.length >= 2 && !!other, `${text.chain_explode} (${blasts.length} blasts)`, { blasts: blasts.map((event) => `${event.object}@${event.time.toFixed(2)}`) })
      },
    },
  ]
}
