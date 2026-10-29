import type { ModuleScenario } from '@adatechnology/game-contracts'
import { fill } from './text.js'
import type { AreaText } from './text.js'

/** What the room hands a scenario (`ScenarioContext` of game-test-room), narrowed to what these use. */
export interface AreaContext {
  room: any
  step(seconds: number): void
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
}

export type Vec3 = readonly [number, number, number]

/** Where the team's page lays its specimens (the arena has 14 m of half width). */
export const SPECIMEN_AT: Vec3 = [-5, 0, -11]

/**
 * The six structural scenarios of the team's house area (sala-de-testes/area-casas, L3833-3868), same ids and same checks, on the specimens the area builds: destroy a pillar, two pillars, a partition,
 * shoot a window, puncture the water tank, set the gas bottle on fire. The hits are the team's (3 MJ blunt on a pillar, 600 J 9 mm on the glass and the tank, 900 C fire on the bottle). A scenario
 * passes when every check holds; the names of the checks are in `text.steps`.
 */
export function createHouseScenarios(text: AreaText, at: Vec3 = SPECIMEN_AT): Array<ModuleScenario<AreaContext>> {
  const T = text.steps
  const spawn = (room: any, item: string): { oid: string; parts: any[]; centre: (part: string) => [number, number, number] } => {
    const so = room.spawn(item, [at[0], at[1], at[2]], 0)
    const parts: any[] = so.root.userData.floorplanSpec.parts
    const centre = (id: string): [number, number, number] => {
      const p = parts.find((x) => x.id === id)
      return [p.position[0] + at[0], p.position[1] + at[1], p.position[2] + at[2]]
    }
    return { oid: so.objectId, parts, centre }
  }
  const role = (p: any): string | undefined => p.structure && p.structure.role
  const events = (room: any): any[] => {
    const list: any[] = []
    room.world.on('*', (e: any) => list.push(e))
    return list
  }
  const collapsed = (list: any[]): string[] => list.filter((e) => e.type === 'collapse').flatMap((e) => e.parts.map((p: any) => p.id || p))
  /** Standing: not broken, and not stripped to its rebar cage (reinforced concrete that fractured stays as a cage, stage 3). */
  const whole = (room: any, oid: string, pid: string): boolean => {
    const p = room.world.part(oid, pid)
    return !!p && p.status !== 'broken' && !p.stripped
  }
  const groundColumns = (parts: any[]): any[] => parts.filter((p) => role(p) === 'column' && p.position[1] < 2 && !/tank/.test(p.id))
  const slabs = (parts: any[]): string[] => parts.filter((p) => role(p) === 'slab').map((p) => p.id)
  const blunt = (room: any, oid: string, pid: string, point: [number, number, number], energy: number): void => {
    room.world.hitPart(oid, pid, { type: 'blunt', point, energy, radius: 0.05, source: 'teste' })
  }
  const bullet = (room: any, oid: string, pid: string, point: [number, number, number], energy: number): void => {
    room.world.hitPart(oid, pid, { type: 'ballistic', point, direction: [0, 0, -1], energy, caliber: 9 })
  }

  return [
    {
      id: 'house_one_pillar',
      name: text.scenarios.house_one_pillar as string,
      run({ room, step, expect }) {
        const { oid, parts, centre } = spawn(room, 'house_casa_portico')
        const list = events(room)
        const columns = groundColumns(parts)
        const laj = slabs(parts)
        blunt(room, oid, columns[0].id, centre(columns[0].id), 3e6)
        step(20)
        expect(!whole(room, oid, columns[0].id), fill(T.one_pillar_broke as string, { id: columns[0].id }))
        expect(laj.length > 0 && laj.every((id) => whole(room, oid, id)), T.slabs_whole as string)
        expect(!collapsed(list).some((id) => laj.includes(id)), T.no_slab_fell as string)
      },
    },
    {
      id: 'house_two_pillars',
      name: text.scenarios.house_two_pillars as string,
      run({ room, step, expect }) {
        const { oid, parts, centre } = spawn(room, 'house_casa_portico')
        const list = events(room)
        const columns = groundColumns(parts)
        const laj = slabs(parts)
        // the two pillars at the ends of one side of the frame: the beams of the frame carry the loss of one pillar (house_one_pillar), and a side that loses both ends is
        // left to the one pillar between them, so the slab and the roof come down on that side
        const first = columns[0]
        const mate = columns.slice(1).filter((p) => Math.abs(p.position[0] - first.position[0]) < 0.5).sort((a, b) => Math.abs(b.position[2] - first.position[2]) - Math.abs(a.position[2] - first.position[2]))[0] ?? columns[1]
        blunt(room, oid, first.id, centre(first.id), 3e6)
        blunt(room, oid, mate.id, centre(mate.id), 3e6)
        step(90)
        const fell = collapsed(list)
        expect(laj.some((id) => fell.includes(id)), fill(T.two_slab_fell as string, { n: fell.length }))
        expect(parts.filter((p) => role(p) === 'roof').some((p) => fell.includes(p.id)), T.two_roof_fell as string)
      },
    },
    {
      id: 'house_partition',
      name: text.scenarios.house_partition as string,
      run({ room, step, expect }) {
        const { oid, parts, centre } = spawn(room, 'house_casa_inteira')
        const list = events(room)
        const partition = parts.find((p) => role(p) === 'partition')
        const laj = slabs(parts)
        blunt(room, oid, partition.id, centre(partition.id), 3e6)
        step(20)
        expect(!whole(room, oid, partition.id), fill(T.partition_broke as string, { id: partition.id }))
        expect(laj.every((id) => whole(room, oid, id)) && !collapsed(list).some((id) => laj.includes(id)), T.slab_stayed as string)
      },
    },
    {
      id: 'house_window_glass',
      name: text.scenarios.house_window_glass as string,
      run({ room, step, expect }) {
        const { oid, parts, centre } = spawn(room, 'house_casa_inteira')
        const window = parts.find((p) => /glass/.test(p.material) && /^window:/.test(p.id))
        let shots = 0
        for (; shots < 12 && whole(room, oid, window.id); shots++) {
          bullet(room, oid, window.id, centre(window.id), 600)
          step(0.3)
        }
        const state = room.world.part(oid, window.id)
        expect((state ? state.holes.length : 0) > 0, T.glass_hole as string)
        expect(!whole(room, oid, window.id), fill(T.glass_broke as string, { id: window.id, n: shots }))
        expect(parts.filter((p) => role(p) === 'wall').every((p) => whole(room, oid, p.id)), T.walls_whole as string)
      },
    },
    {
      id: 'house_tank_leak',
      name: text.scenarios.house_tank_leak as string,
      run({ room, step, expect }) {
        const { oid, parts, centre } = spawn(room, 'house_casa_inteira')
        const tank = parts.find((p) => p.contains && p.contains.fluid === 'water')
        const before = (room.world.part(oid, tank.id) || {}).liters ?? 0
        bullet(room, oid, tank.id, centre(tank.id), 600)
        step(40)
        const state = room.world.part(oid, tank.id)
        expect((state ? state.holes.length : 0) > 0, T.tank_hole as string)
        expect(before > 0 && (state.liters ?? 0) < before, fill(T.tank_leaked as string, { before: Math.round(before), after: Math.round(state.liters ?? 0) }))
      },
    },
    {
      id: 'house_gas_explodes',
      name: text.scenarios.house_gas_explodes as string,
      run({ room, step, expect }) {
        const { oid, parts, centre } = spawn(room, 'house_casa_inteira')
        const list = events(room)
        const bottle = parts.find((p) => p.explodes)
        room.world.hitPart(oid, bottle.id, { type: 'fire', point: centre(bottle.id), temperature: 900, radius: 0.6, duration: 8 })
        step(12)
        expect(list.filter((e) => e.type === 'explode').length > 0, T.gas_exploded as string)
        const damage = list.filter((e) => e.type === 'damage' && e.part !== bottle.id && e.damageType === 'explosive')
        expect(damage.length > 0, fill(T.gas_damaged as string, { n: new Set(damage.map((e) => e.part)).size }))
      },
    },
  ]
}
