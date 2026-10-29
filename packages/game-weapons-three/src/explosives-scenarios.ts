import type { DestructionEvent, ModuleScenario, Vec3 } from '@adatechnology/game-contracts'
import { EXPLOSIVES_AREA_ID } from './explosives-bench'
import type { ExplosivesBench, ExplosivesRoom } from './explosives-bench'
import { explosivesTextOf, fillText } from './explosives-text'
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


/** Loose things laid around a blast to be measured: the kind and the item of the goods catalogue (the distances are in PUSH_LAYOUT). */
const PUSH_KINDS: ReadonlyArray<{ readonly kind: 'can' | 'bottle' | 'chair'; readonly item: string }> = [
  { kind: 'can', item: 'item_canned_beans' },
  { kind: 'bottle', item: 'item_water_bottle' },
  { kind: 'chair', item: 'dining_chair' },
]
/** Seconds after the blast at which the shove is read: the bodies are still flying, not yet piled against each other. */
const PUSH_READ_AT = 0.8
/** Metres a body must move to count as moved. */
const MOVED = 0.15
/** The heavy, free furniture of the area that the blast also reaches (a table too heavy to grab, not fixed). */
const HEAVY_ITEMS = ['camp_table']

interface Placed {
  readonly kind: string
  readonly objectId: string
  readonly itemId: string
  readonly from: Vec3
  readonly root: { readonly position: { readonly x: number; readonly y: number; readonly z: number } }
}

const flat = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[2] - b[2])

const bearing = (centre: Vec3, distance: number, degrees: number): Vec3 => [centre[0] + Math.sin((degrees * Math.PI) / 180) * distance, 0, centre[2] + Math.cos((degrees * Math.PI) / 180) * distance]

/** Where each kind lies, as [distance from the centre, bearing in degrees from +z]: no two of one kind on the same bearing, and none on the line of fire (the player shoots along the axis) or on the line to the zombie or the survivor of the area. */
const PUSH_LAYOUT: Record<(typeof PUSH_KINDS)[number]['kind'], ReadonlyArray<readonly [number, number]>> = {
  can: [[2.5, -52], [5, 12], [8, 78]],
  bottle: [[2.5, 26], [5, -62], [8, -78]],
  chair: [[2.5, -18], [5, 60], [8, -42]],
}

/** The shove of a blast on what lies around it, read 0.8 s after it: every body inside the reach moved away, the near ones more than the far ones, the people and the heavy furniture too. */
function pushScenario(all: ReturnType<typeof explosivesTextOf>, bench: ExplosivesBench, mode: 'p13' | 'grenade'): ModuleScenario<ScenarioContext> {
  const text = all.scenarios
  const things = all.things
  return {
    id: `explosives_push_${mode}`,
    name: mode === 'p13' ? text.push_p13 : text.push_grenade,
    run: ({ room, step, expect }) => {
      let centre: Vec3
      if (mode === 'p13') {
        room.openArea(EXPLOSIVES_AREA_ID)
        const cylinder = room.spawned().find((spawned) => spawned.itemId === CYLINDER_ITEM)
        const at = (cylinder?.root as { position: { x: number; z: number } } | undefined)?.position
        centre = [at?.x ?? 0, 0, at?.z ?? -10.66]
      } else {
        room.clear()
        centre = [0, 0, -6]
      }
      const placed: Placed[] = []
      const lay = (kind: string, item: string, at: Vec3): void => {
        try {
          const spawned = room.spawn(item, at, 0)
          placed.push({ kind, objectId: spawned.objectId, itemId: item, from: at, root: spawned.root as Placed['root'] })
        } catch {
          // the page does not carry this item (a room with a smaller catalogue): the others are still measured
        }
      }
      for (const { kind, item } of PUSH_KINDS) PUSH_LAYOUT[kind].forEach(([distance, degrees]) => lay(kind, item, bearing(centre, distance, degrees)))
      if (mode === 'grenade') {
        lay('zombie', 'zombie_walker', bearing(centre, 3.4, -34))
        lay('survivor', 'person_police_officer', bearing(centre, 7.5, 78))
        lay('camp_table', 'camp_table', bearing(centre, 3, 90))
      }
      step(0.6)
      const start = (body: Placed): Vec3 => [body.root.position.x, body.root.position.y, body.root.position.z]
      const origin = new Map(placed.map((body) => [body.objectId, start(body)] as const))
      // the loose things of the area itself that the blast reaches: the zombie, the survivor and the table
      for (const spawned of room.spawned()) {
        const known = placed.some((body) => body.objectId === spawned.objectId)
        const role = spawned.itemId.startsWith('zombie_') ? 'zombie' : spawned.itemId.startsWith('person_') ? 'survivor' : HEAVY_ITEMS.includes(spawned.itemId) ? spawned.itemId : undefined
        if (known || !role || mode !== 'p13') continue
        const root = spawned.root as Placed['root']
        const body: Placed = { kind: role, objectId: spawned.objectId, itemId: spawned.itemId, from: [root.position.x, root.position.y, root.position.z], root }
        placed.push(body)
        origin.set(body.objectId, body.from)
      }
      expect(placed.length > 0, fillText(text.push_found, { n: placed.length, kinds: [...new Set(placed.map((body) => body.kind))].join(', ') }), { placed: placed.map((body) => body.itemId) })
      if (mode === 'p13') bench.actions.shoot()
      else {
        room.setTool('frag_grenade')
        step(0.5)
        room.look([0, 1.6, 9.5], [0, 1, -2.5])
        room.use()
      }
      let waited = 0
      while (!bench.lastBlast() && waited < 9) {
        step(0.05)
        waited += 0.05
      }
      const blast = bench.lastBlast()
      expect(!!blast, text.push_told, { waited })
      if (!blast) return
      step(PUSH_READ_AT)
      const rows = placed.map((body) => {
        const from = origin.get(body.objectId) ?? body.from
        const now = start(body)
        const distance = flat(from, blast.point)
        const away = Math.max(1e-6, distance)
        const outward = ((now[0] - from[0]) * (from[0] - blast.point[0]) + (now[2] - from[2]) * (from[2] - blast.point[2])) / away
        return { ...body, distance, outward, moved: flat(now, from) }
      })
      const reached = rows.filter((row) => row.distance < blast.radius * 0.85)
      const movedAway = reached.filter((row) => row.outward >= MOVED)
      const least = reached.length === 0 ? 0 : Math.min(...reached.map((row) => row.outward))
      expect(reached.length > 0 && movedAway.length === reached.length, fillText(text.push_outward, { moved: movedAway.length, n: reached.length, least: least.toFixed(2) }), { rows: reached.map((row) => ({ kind: row.kind, distance: row.distance, outward: row.outward })) })
      for (const { kind } of PUSH_KINDS) {
        const ofKind = reached.filter((row) => row.kind === kind).sort((a, b) => a.distance - b.distance)
        if (ofKind.length < 2) continue
        const near = ofKind[0]!
        const far = ofKind[ofKind.length - 1]!
        expect(near.outward > far.outward, fillText(text.push_falloff, { what: things[kind] ?? kind, near: near.outward.toFixed(2), nearDistance: near.distance.toFixed(1), far: far.outward.toFixed(2), farDistance: far.distance.toFixed(1) }), { near: near.outward, far: far.outward })
      }
      for (const row of reached.filter((entry) => entry.kind === 'zombie' || entry.kind === 'survivor')) {
        expect(row.outward >= MOVED, fillText(text.push_person, { who: things[row.kind] ?? row.kind, distance: row.distance.toFixed(1), moved: row.outward.toFixed(2) }), { row })
      }
      const table = reached.find((row) => HEAVY_ITEMS.includes(row.kind))
      if (table) expect(table.moved >= MOVED, fillText(text.push_heavy, { what: things[table.itemId] ?? table.itemId, moved: table.moved.toFixed(2) }), { table })
    },
  }
}

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
    pushScenario(explosivesTextOf(locale), bench, 'p13'),
    pushScenario(explosivesTextOf(locale), bench, 'grenade'),
  ]
}
