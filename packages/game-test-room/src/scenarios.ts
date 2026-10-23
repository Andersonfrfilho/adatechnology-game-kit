import { JOINT_DEFAULTS, rotateVec, toWorld } from '@adatechnology/game-destruction'
import type { Vec3 } from '@adatechnology/game-destruction'
import { resolveStrings } from './locale'
import type { ScenarioContext, TestRoom, TestRoomScenario } from './types'

type T = (key: string, vars?: Record<string, string | number>) => string
type Num = (n: number, digits?: number) => string

/** Built-in scripted checks over the generic `DEMO_ITEMS`. Names and check texts come from the room locale. */
export function makeScenarios(t: T, num: Num, _locale = 'en'): TestRoomScenario[] {
  const yn = (b: boolean): string => t(b ? 'yes' : 'no')
  const cn = (what: string, n: number): string => t(`count.${what}.${n === 1 ? 'one' : 'other'}`, { n })
  const pc = (n: number): string => t(n === 1 ? 'count.piece.one' : 'count.piece.other', { n })
  const sc = (id: string, run: (c: ScenarioContext) => void | Promise<void>): TestRoomScenario => ({ id, name: t(`sc.${id}`), run })

  const at = (room: TestRoom, itemId: string, x: number, z: number, y = 0, rot = 0): string => room.spawn(itemId, [x, y, z], rot).objectId
  const look = (room: TestRoom, from: Vec3, to: Vec3): void => room.look(from, to)
  const part = (room: TestRoom, id: string, p: string) => room.world.part(id, p)
  const count = (room: TestRoom, type: string, objectId?: string): number => room.log.entries({ type, objectId }).length
  const anyBurning = (room: TestRoom, id: string): boolean => (room.world.state(id)?.parts ?? []).some((p) => p.burning)
  const igniteHit = (room: TestRoom, id: string, point: Vec3, temperature = 900, seconds = 3): void => {
    room.world.hit(id, { type: 'fire', point, temperature, radius: 0.6, duration: seconds })
  }

  // columns of the demo `building_frame` placed at (0, 0, -6): x = -2 / 2, z = -8 / -4
  const COLUMN: Record<string, Vec3> = { column_0_0_0: [-2, 1.4, -8], column_0_1_0: [2, 1.4, -8], column_0_0_1: [-2, 1.4, -4], column_0_1_1: [2, 1.4, -4] }
  const killColumns = (room: TestRoom, id: string, ids: string[]): void => {
    for (const c of ids) room.world.hitPart(id, c, { type: 'blunt', point: COLUMN[c], energy: 3e6, radius: 0.05, source: 'test' })
  }
  const heavyCollapse = (room: TestRoom): number => room.log.entries({ type: 'collapse' }).reduce((m, e) => Math.max(m, Number(e.data?.massKg ?? 0)), 0)

  return [
    sc('steel_through_hole', ({ room, step, expect }) => {
      const id = at(room, 'steel_sheet', 0, -4)
      room.setTool('pistol_9mm')
      look(room, [0, 1.1, -1.5], [0, 1.1, -4])
      room.use()
      step(0.2)
      const p = part(room, id, 'sheet')
      const hole = p?.holes[0]
      expect(
        !!hole?.through,
        t('sc.steel_through_hole.check', { mm: num((hole?.diameter ?? 0) * 1000, 0), through: yn(!!hole?.through), holes: p?.holes.length ?? 0, hp: `${num(p?.hp ?? 0, 0)}/${num(p?.maxHp ?? 0, 0)}` }),
        { holes: p?.holes.length, through: hole?.through },
      )
    }),

    sc('concrete_stops_bullet', ({ room, step, expect }) => {
      const id = at(room, 'concrete_block', 0, -4)
      room.setTool('pistol_9mm')
      look(room, [0, 0.5, -1.5], [0, 0.2, -3.8])
      room.use()
      step(0.2)
      const p = part(room, id, 'block')
      const wall = part(room, 'target_wall', 'brick_1_4')
      const through = p?.holes.some((h) => h.through) ?? true
      expect(
        !through && (p?.holes.length ?? 0) + (p?.dents.length ?? 0) + (p?.cracks.length ?? 0) > 0 && (wall?.holes.length ?? 0) === 0,
        t('sc.concrete_stops_bullet.check', { through: yn(through), dents: cn('dent', p?.dents.length ?? 0), holes: cn('hole', p?.holes.length ?? 0), cracks: cn('crack', p?.cracks.length ?? 0), hp: `${num(p?.hp ?? 0, 0)}/${num(p?.maxHp ?? 0, 0)}` }),
        { through },
      )
    }),

    sc('hammer_dents_drum', ({ room, step, expect }) => {
      const id = at(room, 'steel_drum', 0, -4)
      room.setTool('hammer')
      look(room, [0, 0.6, -3.35], [0, 0.5, -4])
      let swings = 0
      for (; swings < 8 && (part(room, id, 'drum_body')?.dents.length ?? 0) === 0; swings++) {
        room.use()
        step(1)
      }
      const p = part(room, id, 'drum_body')
      expect(
        (p?.dents.length ?? 0) > 0 && p?.status !== 'broken',
        t('sc.hammer_dents_drum.check', { swings, dents: p?.dents.length ?? 0, depth: num((p?.dents[0]?.depth ?? 0) * 1000, 1), hp: `${num(p?.hp ?? 0, 0)}/${num(p?.maxHp ?? 0, 0)}` }),
        { swings },
      )
    }),

    sc('glass_shatters', ({ room, step, expect }) => {
      const id = at(room, 'glass_pane', 0, -4)
      room.setTool('pistol_9mm')
      look(room, [0, 1.3, -1.5], [0, 1.05, -4])
      let shots = 0
      for (; shots < 10 && part(room, id, 'pane')?.status !== 'broken'; shots++) {
        room.use()
        step(0.25)
      }
      step(0.5)
      const fr = room.log.entries({ type: 'fracture', objectId: id }).find((e) => e.part === 'pane')
      const n = Number(fr?.data?.fragments ?? 0)
      expect(part(room, id, 'pane')?.status === 'broken' && n >= 4, t('sc.glass_shatters.check', { shots, n }), { shots, fragments: n })
    }),

    sc('shotgun_splinters_crate', ({ room, step, expect }) => {
      const id = at(room, 'wooden_crate', 0, -4)
      room.setTool('shotgun_pump_12')
      look(room, [0, 0.6, -1.8], [0, 0.25, -3.77])
      let shots = 0
      const splinters = (): number => room.log.entries({ type: 'fracture', objectId: id }).filter((e) => e.data?.style === 'splinter').length
      for (; shots < 4 && splinters() === 0; shots++) {
        room.use()
        step(1.1)
      }
      const holes = (room.world.state(id)?.parts ?? []).reduce((n, p) => n + p.holes.length, 0)
      expect(splinters() > 0, t('sc.shotgun_splinters_crate.check', { shots, splinters: splinters(), holes }), { shots })
    }),

    sc('kick_chair_leg', ({ room, step, expect }) => {
      const id = at(room, 'chair', 0, -4)
      const before = room.renderer.pieces().length
      const leg = part(room, id, 'leg_1')
      void leg
      let kicks = 0
      for (; kicks < 6 && room.renderer.pieces().length <= before && part(room, id, 'leg_1'); kicks++) {
        room.world.hitPart(id, 'leg_1', { type: 'blunt', point: [-0.18, 0.2, -4.18], direction: [1, 0, 0], energy: 220, radius: 0.05, source: 'kick' })
        step(0.3)
      }
      step(0.5)
      const after = room.renderer.pieces().length
      const groups = room.world.state(id)?.groups.length ?? 1
      expect(
        after > before,
        t('sc.kick_chair_leg.check', { kicks, groups, before, after, leg: part(room, id, 'leg_1') ? t('leg.still') : t('leg.gone') }),
        { kicks, before, after },
      )
    }),

    sc('kick_detaches_leg_via_tool', ({ room, step, expect }) => {
      const id = at(room, 'chair', 0, -4)
      const before = room.renderer.pieces().length
      room.setTool('kick')
      let kicks = 0
      for (; kicks < 8 && room.renderer.pieces().length <= before && part(room, id, 'leg_1'); kicks++) {
        // the chair moves when it is kicked: aim at the leg where it is now, from the side
        const st = room.world.state(id)!
        const leg = toWorld(st.position, st.rotation, [-0.18, 0.2, -0.18])
        const side = rotateVec(st.rotation, [-0.8, 0, 0])
        look(room, [leg[0] + side[0], leg[1] + side[1], leg[2] + side[2]], leg)
        room.use()
        step(1.05)
      }
      step(0.5)
      const after = room.renderer.pieces().length
      expect(after > before, t('sc.kick_detaches_leg_via_tool.check', { kicks, before, after, leg: part(room, id, 'leg_1') ? t('leg.still') : t('leg.gone') }), { kicks, before, after })
    }),

    sc('screwdriver_shelf_board', ({ room, step, expect }) => {
      const id = at(room, 'shelf', 0, -4)
      room.setTool('screwdriver')
      look(room, [0, 0.8, -3.5], [0, 0.75, -3.86])
      const t0 = room.log.entries().length ? room.log.entries().slice(-1)[0].t : 0
      room.use(5)
      const done = room.log.entries({ type: 'detach', objectId: id })[0]
      const elapsed = done ? done.t - t0 : 5
      const want = JOINT_DEFAULTS.screw.seconds
      const groups = room.renderer.pieces().length
      expect(!!done && Math.abs(elapsed - want) < 0.6 && groups >= 1, t('sc.screwdriver_shelf_board.check', { secs: num(elapsed, 1), want: num(want, 1), pieces: pc(groups) }), { elapsed, want })
      step(0.2)
    }),

    sc('wrong_tool_refused', ({ room, expect }) => {
      const id = at(room, 'steel_sheet', 0, -4)
      room.setTool('screwdriver')
      look(room, [0.2, 1.05, -3.6], [0.34, 1.0, -4])
      room.use(0.5)
      const refused = count(room, 'tool_refused')
      const opened = (room.world.state(id)?.joints ?? []).filter((j) => j.open).length
      expect(refused > 0 && opened === 0, t('sc.wrong_tool_refused.check', { refused, opened }), { refused, opened })
    }),

    sc('lighter_burns_crate', ({ room, step, expect }) => {
      const id = at(room, 'wooden_crate', 0, -4)
      room.setTool('lighter')
      look(room, [0, 0.3, -3.65], [0, 0.25, -3.76])
      room.use(5)
      const lit = anyBurning(room, id)
      expect(lit, t('sc.lighter_burns_crate.lit', { lit: yn(lit) }))
      step(500)
      const parts = room.world.state(id)?.parts ?? []
      const ash = parts.filter((p) => p.status === 'ashes').length
      const charred = Math.max(...parts.map((p) => p.char))
      expect(ash === parts.length || (ash > 0 && parts.every((p) => p.status === 'ashes' || p.status === 'broken' || p.char > 0.8)), t('sc.lighter_burns_crate.ash', { ash, total: parts.length, char: num(charred * 100, 0) }), { ash, total: parts.length })
    }),

    sc('torch_melts_steel', ({ room, step, expect }) => {
      const drum = at(room, 'steel_drum', 0, -4)
      const crate = at(room, 'wooden_crate', 0.7, -4)
      igniteHit(room, crate, [0.7, 0.25, -3.8], 900, 2)
      let peak = 0
      for (let i = 0; i < 40; i++) {
        step(1)
        peak = Math.max(peak, part(room, drum, 'drum_body')?.temperature ?? 0)
      }
      const melt0 = part(room, drum, 'drum_body')?.melt ?? 0
      expect(melt0 === 0 && peak < 1450, t('sc.torch_melts_steel.wood', { peak: num(peak, 0), melt: num(melt0 * 100, 0), crate: yn(anyBurning(room, crate)) }), { peak })
      room.setTool('cutting_torch')
      look(room, [-0.15, 0.55, -3.55], [-0.15, 0.5, -3.72])
      room.use(20)
      const p = part(room, drum, 'drum_body')
      expect((p?.melt ?? 0) > 0.02 || p?.status === 'melted' || (p?.holes.length ?? 0) > 0, t('sc.torch_melts_steel.torch', { temp: num(p?.temperature ?? 0, 0), melt: num((p?.melt ?? 0) * 100, 0) }), { temperature: p?.temperature, melt: p?.melt })
    }),

    sc('bucket_melts_drips', ({ room, step, expect }) => {
      const id = at(room, 'plastic_bucket', 0, -4)
      room.setTool('flamethrower')
      look(room, [0, 0.5, -2.4], [0, 0.15, -4])
      room.use(2.5)
      step(10)
      const p = part(room, id, 'bucket_body')
      const drips = count(room, 'drip', id)
      expect((p?.melt ?? 0) > 0.05 || p?.status === 'melted', t('sc.bucket_melts_drips.check', { melt: num((p?.melt ?? 0) * 100, 0), drips, temp: num(p?.temperature ?? 0, 0) }), { melt: p?.melt, drips })
    }),

    sc('gas_bottle_explodes', ({ room, step, expect }) => {
      const bottle = at(room, 'gas_bottle', 0, -4)
      const crate = at(room, 'wooden_crate', 1.3, -4)
      const c0 = room.spawned().find((s) => s.objectId === crate)?.root.position.clone()
      let seconds = 0
      for (; seconds < 60 && count(room, 'explode', bottle) === 0; seconds++) {
        igniteHit(room, bottle, [0, 0.4, -3.9], 1000, 1)
        step(1)
      }
      step(1.5)
      const c1 = room.spawned().find((s) => s.objectId === crate)?.root.position
      const moved = c0 && c1 ? c0.distanceTo(c1) : 0
      const state = room.world.state(crate)
      const lost = (state?.parts ?? []).filter((p) => p.status === 'broken').length + (state && state.groups.length > 1 ? 1 : 0)
      expect(count(room, 'explode', bottle) > 0, t('sc.gas_bottle_explodes.explode', { seconds }), { seconds })
      expect(moved > 0.3 || lost > 0, t('sc.gas_bottle_explodes.push', { moved: num(moved, 1), lost: pc(lost) }), { moved, lost })
    }),

    sc('bottle_drop_shatters', ({ room, step, expect }) => {
      const id = at(room, 'glass_bottle', 0, -3, 1.5)
      step(2)
      const p = part(room, id, 'bottle_body')
      const stain = room.fluids.stains().find((s) => s.liquid === 'water')
      expect(p?.status === 'broken', t('sc.bottle_drop_shatters.check', { status: p?.status ?? '?', cracks: p?.cracks.length ?? 0, stain: yn(!!stain) }), { status: p?.status })
    }),

    sc('throw_chair_at_wall', ({ room, step, expect }) => {
      const id = at(room, 'chair', 0, -5.2)
      look(room, [0, 1.7, -4.2], [0, 0.35, -5.2])
      room.grab()
      look(room, [0, 1.7, -4.2], [0, 2.3, -11])
      step(0.3)
      room.throwHeld(16)
      step(2.5)
      const hits = room.log.entries({ type: 'impact' })
      const wallDamage = room.log.entries().filter((e) => e.objectId === 'target_wall' && (e.type === 'dent' || e.type === 'damage' || e.type === 'crack' || e.type === 'fracture')).length
      expect(hits.length > 0 && wallDamage > 0, t('sc.throw_chair_at_wall.check', { impacts: hits.length, wall: wallDamage, energy: num(Number(hits[0]?.data?.energyJ ?? 0), 0) }), { id })
    }),

    sc('coffee_three_sips', ({ room, step, expect }) => {
      const id = at(room, 'coffee_cup', 0, -3)
      look(room, [0, 1.0, -1.8], [0, 0.05, -3])
      const cid = `${id}_fluid`
      const before = room.fluids.container(cid)?.liters ?? 0
      room.grab()
      for (let i = 0; i < 3; i++) {
        room.useItem('sip')
        step(1.4)
      }
      const after = room.fluids.container(cid)?.liters ?? 0
      const drinks = room.log.entries().filter((e) => e.type === 'fluid.drink')
      const caffeine = drinks.some((e) => Array.isArray(e.data?.effects) && (e.data?.effects as string[]).includes('caffeine'))
      expect(drinks.length === 3 && before - after > 0.06 && caffeine, t('sc.coffee_three_sips.check', { sips: drinks.length, before: num(before, 2), after: num(after, 2), caffeine: yn(caffeine), burn: yn(drinks.some((e) => !!e.data?.burn)) }), { before, after })
    }),

    sc('tilt_cup_spills', ({ room, step, expect }) => {
      const id = at(room, 'coffee_cup', 0, -3)
      look(room, [0, 1.0, -1.8], [0, 0.05, -3])
      const cid = `${id}_fluid`
      const before = room.fluids.container(cid)?.liters ?? 0
      room.grab()
      step(0.6)
      room.tilt(2.0)
      step(2.5)
      const after = room.fluids.container(cid)?.liters ?? 0
      const stains = room.fluids.stains().filter((s) => s.liquid === 'coffee').length
      expect(before - after > 0.03 && stains > 0, t('sc.tilt_cup_spills.check', { before: num(before, 2), after: num(after, 2), stains }), { before, after })
    }),

    sc('jerrycan_leaks_fuel', ({ room, step, expect }) => {
      const id = at(room, 'jerrycan', 0, -3.5)
      room.setTool('pistol_9mm')
      look(room, [0, 0.4, -1.5], [0, 0.12, -3.43])
      room.use()
      step(1.5)
      const streams = room.fluids.streams().filter((s) => s.cause === 'leak' && s.liquid === 'fuel')
      step(5)
      const stain = room.fluids.stains().find((s) => s.liquid === 'fuel')
      const left = room.fluids.container(`${id}_fluid`)?.liters ?? 20
      const hole = room.log.entries({ type: 'hole', objectId: id })[0]
      expect(streams.length > 0 && !!stain && left < 20, t('sc.jerrycan_leaks_fuel.check', { streams: streams.length, stain: yn(!!stain), left: num(left, 2), leak: hole?.data?.leak ? yn(true) : yn(false) }), { left })
    }),

    sc('fuel_stain_burns', ({ room, step, expect }) => {
      const id = at(room, 'jerrycan', 0, -3.5)
      const crate = at(room, 'wooden_crate', 0.9, -3.2)
      room.setTool('pistol_9mm')
      look(room, [0, 0.4, -1.5], [0, 0.12, -3.43])
      room.use()
      step(6)
      const stain = room.fluids.stains().find((s) => s.liquid === 'fuel')
      expect(!!stain, t('sc.fuel_stain_burns.stain', { stain: yn(!!stain) }))
      if (!stain) return
      room.setTool('lighter')
      look(room, [stain.center[0], 0.1, stain.center[2] + 0.06], [stain.center[0], 0, stain.center[2]])
      room.use(1)
      step(4)
      const ignited = count(room, 'stain_ignite')
      const fireHits = (room.world.state(id)?.parts ?? []).some((p) => p.burning || p.temperature > 100) || anyBurning(room, crate)
      expect(ignited > 0, t('sc.fuel_stain_burns.ignite', { ignited, near: yn(fireHits) }), { ignited })
      step(30)
      expect(count(room, 'stain_burned') > 0 || room.fluids.stains().filter((s) => s.liquid === 'fuel' && s.wetness > 0.05).length === 0, t('sc.fuel_stain_burns.out', { burned: count(room, 'stain_burned') }))
    }),

    sc('one_column_roof_stands', ({ room, step, expect }) => {
      const id = at(room, 'building_frame', 0, -6)
      killColumns(room, id, ['column_0_0_0'])
      step(40)
      const roof = part(room, id, 'roof')
      const neighbour = (part(room, id, 'column_0_0_1') as unknown as { stress?: number } | null)?.stress ?? 0
      const heavy = Math.max(heavyCollapse(room), ...room.renderer.pieces().map((p) => p.mass))
      expect(!!roof && roof.status !== 'broken' && heavy < 2000, t('sc.one_column_roof_stands.check', { roof: roof ? t('roof.standing') : t('roof.fell'), heavy: num(heavy, 0), stress: num(neighbour * 100, 0) }), { heavy, neighbour })
    }),

    sc('two_columns_roof_collapses', ({ room, step, expect }) => {
      const id = at(room, 'building_frame', 0, -6)
      killColumns(room, id, ['column_0_0_0', 'column_0_1_0'])
      const stress0 = (room.world.part(id, 'column_0_0_1') as unknown as { stress?: number } | null)?.stress ?? 0
      step(40)
      const pieces = room.renderer.pieces().filter((p) => p.mass >= 2000)
      const logged = heavyCollapse(room) >= 2000
      const kg = pieces.reduce((m, p) => m + p.mass, 0)
      expect(!part(room, id, 'roof') && pieces.length > 0, t('sc.two_columns_roof_collapses.check', { stress: num(stress0 * 100, 0), pieces: pc(pieces.length), kg: num(kg, 0), logged: yn(logged) }), { kg, logged })
    }),

    sc('extinguisher_puts_out_fire', ({ room, step, expect }) => {
      const id = at(room, 'wooden_crate', 0, -4)
      igniteHit(room, id, [0, 0.25, -3.8], 900, 4)
      step(6)
      const before = anyBurning(room, id)
      expect(before, t('sc.extinguisher_puts_out_fire.burning', { burning: yn(before) }))
      room.setTool('extinguisher')
      look(room, [0, 0.9, -2.2], [0, 0.25, -4])
      room.use(2.5)
      step(1)
      const after = anyBurning(room, id)
      expect(!after, t('sc.extinguisher_puts_out_fire.out', { burning: yn(after), events: count(room, 'extinguish', id) }), { events: count(room, 'extinguish', id) })
    }),
  ]
}

const makeT =
  (locale: string): T =>
  (key, vars) => {
    let s = resolveStrings(locale).text[key] ?? key
    if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]))
    return s
  }

/** The built-in scenarios for a locale (`en` or `pt-BR`), standalone: no room needed to list them. */
export function scenariosFor(locale = 'en'): TestRoomScenario[] {
  const pt = locale.toLowerCase().startsWith('pt')
  return makeScenarios(makeT(locale), (n, d = 1) => (pt ? (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',') : (Math.round(n * 10 ** d) / 10 ** d).toFixed(d)), locale)
}

/** The built-in scenarios in English. The room offers them in its own locale. */
export const SCENARIOS: TestRoomScenario[] = scenariosFor('en')
