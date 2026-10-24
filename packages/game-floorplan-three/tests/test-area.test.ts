import { checkBench, checkSpec } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { fakeRoom } from './helpers/area-room'
import { THREE } from './helpers/houses'

describe('the module declares itself', () => {
  it('has a valid bench, items that match its area, and both locales', () => {
    for (const locale of ['en', 'pt-BR']) {
      const { module } = fakeRoom({ locale })
      const declared = { controls: module.controls!(locale), layers: module.layers!(locale), metrics: module.metrics!(locale) }
      expect(checkBench(declared).problems).toEqual([])
      const items = module.items(locale)
      expect(items.map((i) => i.id)).toEqual(['house_casa_portico', 'house_casa_inteira', 'house_casa_wood_frame', 'house_casa_tronco', 'house_barraca'])
      expect(module.area!(locale).placements).toEqual([])
      expect(module.scenarios!(locale).map((s) => s.id)).toEqual(['house_one_pillar', 'house_two_pillars', 'house_partition', 'house_window_glass', 'house_tank_leak', 'house_gas_explodes', 'floorplan_typologies'])
    }
    expect(fakeRoom({ locale: 'pt-BR' }).module.name).toBe('Área de casas e prédios')
  })

  it('gives the room specs that pass its checks, one box per part named by the part, with the water tank and the gas bottle', () => {
    const { module, world } = fakeRoom()
    for (const item of module.items('en')) {
      const root = item.build(THREE) as any
      const spec = (item.spec as any)(root)
      const report = checkSpec(spec, { materials: world.materials.keys() })
      expect(report.problems, item.id).toEqual([])
      const names = new Set<string>()
      root.traverse((o: any) => o.isMesh && names.add(o.name))
      expect(names.size, item.id).toBeGreaterThan(5)
      for (const name of names) expect(spec.parts.some((p: any) => p.id === name), `${item.id} ${name}`).toBe(true)
    }
    const whole = (module.items('en').find((i) => i.id === 'house_casa_inteira')!.spec as any)((module.items('en').find((i) => i.id === 'house_casa_inteira')!.build(THREE)))
    expect(whole.parts.some((p: any) => p.contains?.fluid === 'water')).toBe(true)
    expect(whole.parts.some((p: any) => p.explodes)).toBe(true)
  })

  it('lists only the templates the engine has, by package', () => {
    const { module } = fakeRoom({ groups: [{ id: 'residential', templates: ['townhouse', 'no_such_template'] }, { id: 'commercial', templates: ['market'] }, { id: 'ghost', templates: ['zzz'] }] })
    expect(module.groups().map((g) => [g.id, g.templates])).toEqual([['residential', ['townhouse']], ['commercial', ['market']]])
    const control = module.controls!('en').find((c) => c.id === 'package') as any
    expect(control.options.map((o: any) => o.id)).toEqual(['residential', 'commercial'])
  })
})

describe('the six structural scenarios of the team (same ids, same checks)', () => {
  it('pass on the specimens, in both languages', async () => {
    for (const locale of ['en', 'pt-BR']) {
      const ids = fakeRoom({ locale }).module.scenarios!(locale).filter((s) => s.id.startsWith('house_')).map((s) => s.id)
      for (const id of ids) {
        // the room clears between scenarios: a fresh world for each
        const { module, room, step } = fakeRoom({ locale })
        const scenario = module.scenarios!(locale).find((s) => s.id === id)!
        const checks: Array<[boolean, string]> = []
        await scenario.run({ room, step, expect: (ok, label) => checks.push([ok, label]) })
        expect(checks.filter(([ok]) => !ok), scenario.id).toEqual([])
        expect(checks.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('houses in the room', () => {
  it('builds a house in the room destruction world, laid facing the player, and takes it away', () => {
    const r = fakeRoom()
    r.act('build')
    expect(r.module.houses).toHaveLength(1)
    const { house } = r.module.houses[0]!
    expect(house.destruction.active).toBe(true)
    expect(r.world.has(house.destruction.id)).toBe(true)
    expect(r.scene.children).toContain(house.group)
    expect(r.looks).toHaveLength(1)
    r.act('clear')
    expect(r.module.houses).toHaveLength(0)
    expect(r.world.has(house.destruction.id)).toBe(false)
  })

  it('the room clearing its area takes the houses away; the detach takes everything', () => {
    const r = fakeRoom()
    r.act('build')
    r.clears.forEach((fn) => fn())
    expect(r.module.houses).toHaveLength(0)
    r.act('build')
    expect(r.blockers.size).toBe(1)
    r.detach()
    expect(r.blockers.size).toBe(0)
    expect(r.clears.size).toBe(0)
    expect(r.module.houses).toHaveLength(0)
  })

  it('rebuilds when the typology, seed or state changes, and builds a row', () => {
    const r = fakeRoom()
    r.act('build')
    const first = r.module.houses[0]!.house
    r.set('seed', 7)
    r.frame(1)
    expect(r.module.houses[0]!.house).not.toBe(first)
    expect(r.module.houses[0]!.seed).toBe(7)
    r.set('houses', 3)
    r.frame(1)
    expect(r.module.houses.map((h) => h.seed)).toEqual([7, 8, 9])
    const xs = r.module.houses.map((h) => h.house.group.position.x)
    expect(xs[0]).toBeGreaterThan(xs[1]!)
    expect(xs[1]).toBeGreaterThan(xs[2]!)
  })

  it('the walls stop the walking player and the closed door does too, until it is opened', () => {
    const r = fakeRoom()
    r.set('template', 'single_storey_a')
    r.act('build')
    r.frame(0.1)
    const { house, plan } = r.module.houses[0]!
    const group = house.group
    const world = (u: number, v: number) => group.localToWorld(new (r.camera.position.constructor as any)(u, 0.5, v))
    const wall = plan.walls.find((w: any) => w.floor === 0 && w.exterior)
    expect(wall).toBeTruthy()
    const blockedAt = (p: any) => [...r.blockers].some((fn) => fn(p.x, p.z, 0.3))
    const outside = world(-4, -4)
    expect(blockedAt(outside)).toBe(false)
    const room = plan.rooms.find((x: any) => x.floor === 0)
    const inside = world((room.u0 + room.u1) / 2, (room.v0 + room.v1) / 2)
    expect(blockedAt(inside)).toBe(false)
    // a point on the front wall away from the door is blocked
    const door = plan.doors.find((d: any) => d.exterior && d.floor === 0)
    const sill = world(door.u + 2, 0.02)
    expect(blockedAt(sill)).toBe(true)
    const through = world(door.u, door.v)
    expect(blockedAt(through)).toBe(true)
    // open the door: stand in front of it, looking at it, press E
    r.act('enter')
    expect(r.looks.length).toBeGreaterThan(1)
    const doorWorld = world(door.u, door.v)
    const centre = world((room.u0 + room.u1) / 2, (room.v0 + room.v1) / 2)
    const away = Math.hypot(centre.x - doorWorld.x, centre.z - doorWorld.z)
    // one metre inside the door, looking at it
    const eye = [doorWorld.x + ((centre.x - doorWorld.x) / away), 1.7, doorWorld.z + ((centre.z - doorWorld.z) / away)]
    r.host.bench.look(eye, [doorWorld.x, 1.6, doorWorld.z])
    r.frame(0.5)
    r.act('door')
    r.frame(1)
    expect(house.doors.some((d: any) => d.open)).toBe(true)
    expect(blockedAt(through)).toBe(false)
  })

  it('goes up and down the floors of a townhouse', () => {
    const r = fakeRoom()
    r.set('template', 'townhouse')
    r.act('build')
    const before = r.looks.length
    r.act('up')
    expect(r.looks).toHaveLength(before + 1)
    const eye = r.looks[r.looks.length - 1]!.eye
    expect(eye[1]).toBeGreaterThan(2.8 + 1.5)
    r.act('up')
    expect(r.looks).toHaveLength(before + 1)
    r.act('down')
    expect(r.looks[r.looks.length - 1]!.eye[1]).toBeLessThan(2.5)
  })

  it('hits the aimed wall with the bench hit: a blast brings parts down, reset puts them back', () => {
    const r = fakeRoom()
    r.set('template', 'single_storey_a')
    r.act('build')
    r.frame(0.2)
    const { house } = r.module.houses[0]!
    const metric = (id: string) => (r.module.metrics!('en').find((m) => m.id === id)!.read() as number)
    expect(metric('parts')).toBeGreaterThan(100)
    expect(metric('broken')).toBe(0)
    // aim at the front wall from the street side
    const p = house.group.localToWorld(new (r.camera.position.constructor as any)(5, 1.4, 0.1))
    r.host.bench.look([p.x, 1.6, p.z + 6], [p.x, 1.4, p.z])
    r.set('hit', 'c4')
    r.act('strike')
    r.frame(8)
    expect(metric('broken')).toBeGreaterThan(0)
    r.act('reset')
    r.frame(0.2)
    expect(metric('broken')).toBe(0)
    r.set('hit', 'burst_9mm')
    let damage = 0
    r.world.on('damage', () => damage++)
    r.act('strike')
    r.frame(1)
    expect(damage).toBeGreaterThan(0)
  })

  it('shows the level of detail: manual, and shared among a row by the budget', () => {
    const r = fakeRoom()
    r.act('build')
    r.set('lod', '1')
    expect(r.module.houses[0]!.house.lod).toBe(1)
    r.set('lod', '2')
    expect(r.module.houses[0]!.house.lod).toBe(2)
    r.set('lod', '0')
    r.set('houses', 4)
    r.frame(1)
    r.set('lod', 'auto')
    r.set('budget', 300)
    r.frame(1)
    const levels = r.module.houses.map((h) => h.house.lod)
    expect(Math.max(...levels)).toBeGreaterThan(0)
    expect(levels.includes(0)).toBe(true)
    expect(r.module.metrics!('en').find((m) => m.id === 'planned')!.read()).toBeGreaterThan(0)
  })

  it('every typology of the engine builds', async () => {
    const r = fakeRoom()
    const scenario = r.module.scenarios!('en').find((s) => s.id === 'floorplan_typologies')!
    const checks: Array<[boolean, string]> = []
    await scenario.run({ room: r.room, step: r.step, expect: (ok, label) => checks.push([ok, label]) })
    expect(checks.length).toBeGreaterThanOrEqual(10)
    expect(checks.filter(([ok]) => !ok)).toEqual([])
  })
})
