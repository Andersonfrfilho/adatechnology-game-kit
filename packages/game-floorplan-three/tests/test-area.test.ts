import { checkBench, checkSpec } from '@adatechnology/game-contracts'
import type { DestructibleSpec } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { floorplanAreaParams } from '../src/testing'
import { fakeRoom } from './helpers/area-room'
import { THREE } from './helpers/houses'

describe('the module declares itself', () => {
  it('has a valid bench, items that match its area, and both locales', () => {
    for (const locale of ['en', 'pt-BR']) {
      const { module } = fakeRoom({ locale })
      const declared = { controls: module.controls!(locale), layers: module.layers!(locale), metrics: module.metrics!(locale) }
      expect(checkBench(declared).problems).toEqual([])
      const items = module.items(locale)
      expect(items.map((i) => i.id)).toEqual(['house_casa_portico', 'house_casa_inteira', 'house_casa_wood_frame', 'house_casa_tronco', 'house_barraca', 'furniture_dining_table', 'furniture_coffee_table', 'furniture_desk'])
      expect(module.area!(locale).placements).toEqual([])
      expect(module.scenarios!(locale).map((s) => s.id)).toEqual(['house_one_pillar', 'house_two_pillars', 'house_partition', 'house_window_glass', 'house_tank_leak', 'house_gas_explodes', 'floorplan_typologies'])
    }
    expect(fakeRoom({ locale: 'pt-BR' }).module.name).toBe('Área de casas e prédios')
  })

  it('gives the room specs that pass its checks, one box per part named by the part, with the water tank and the gas bottle', () => {
    const { module, world } = fakeRoom()
    for (const item of module.items('en')) {
      const root = item.build(THREE) as THREE.Object3D
      const spec = (item.spec as (root: unknown) => DestructibleSpec)(root)
      const report = checkSpec(spec, { materials: world.materials.keys() })
      expect(report.problems, item.id).toEqual([])
      const names = new Set<string>()
      root.traverse((o) => (o as THREE.Mesh).isMesh && names.add(o.name))
      expect(names.size, item.id).toBeGreaterThan(5)
      for (const name of names) expect(spec.parts.some((p) => p.id === name), `${item.id} ${name}`).toBe(true)
    }
    const whole = (module.items('en').find((i) => i.id === 'house_casa_inteira')!.spec as (root: unknown) => DestructibleSpec)((module.items('en').find((i) => i.id === 'house_casa_inteira')!.build(THREE)))
    expect(whole.parts.some((p) => p.contains?.fluid === 'water')).toBe(true)
    expect(whole.parts.some((p) => p.explodes)).toBe(true)
  })

  it('lists only the templates the engine has, by package', () => {
    const { module } = fakeRoom({ groups: [{ id: 'residential', templates: ['townhouse', 'no_such_template'] }, { id: 'commercial', templates: ['market'] }, { id: 'ghost', templates: ['zzz'] }] })
    const groups = module.groups()
    expect(groups.slice(0, 2).map((g) => [g.id, g.templates])).toEqual([['residential', ['townhouse']], ['commercial', ['market']]])
    const control = module.controls!('en').find((c) => c.id === 'package') as unknown as { options: { id: string }[] }
    expect(control.options.map((o) => o.id)).toEqual(['residential', 'commercial', 'other'])
  })

  it('puts every template the engine has and no group lists in an "other" group, so no registered plan is missing from the bench', () => {
    const { module } = fakeRoom({ groups: [{ id: 'residential', templates: ['townhouse'] }] })
    const listed = module.groups().flatMap((g) => g.templates)
    const other = module.groups().find((g) => g.id === 'other')!
    expect(other.templates).toContain('mansion')
    expect(other.templates).toContain('triage_tent')
    expect(other.templates).not.toContain('townhouse')
    expect(new Set(listed).size).toBe(listed.length)
  })

  it('opens on the template, seed and state of the address', () => {
    expect(floorplanAreaParams('?area=floorplan_area&template=mansion&seed=4&state=abandoned')).toEqual({ template: 'mansion', seed: 4, state: 'abandoned' })
    expect(floorplanAreaParams('?template=../x&seed=0&state=')).toEqual({})
    const { module } = fakeRoom({ ...floorplanAreaParams('?template=mansion&seed=4&state=abandoned') })
    const values = Object.fromEntries(module.controls!('en').map((c) => [c.id, (c as { default?: unknown }).default]))
    expect([values.template, values.seed, values.state]).toEqual(['mansion', 4, 'abandoned'])
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
    expect(r.world.has(house.destruction.id!)).toBe(true)
    expect(r.scene.children).toContain(house.group)
    expect(r.looks).toHaveLength(1)
    r.act('clear')
    expect(r.module.houses).toHaveLength(0)
    expect(r.world.has(house.destruction.id!)).toBe(false)
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
    const world = (u: number, v: number) => group.localToWorld(new (r.camera.position.constructor as typeof THREE.Vector3)(u, 0.5, v))
    const wall = plan.walls.find((w) => w.floor === 0 && w.exterior)
    expect(wall).toBeTruthy()
    const blockedAt = (p: THREE.Vector3) => [...r.blockers].some((fn) => fn(p.x, p.z, 0.3))
    const outside = world(-4, -4)
    expect(blockedAt(outside)).toBe(false)
    const room = plan.rooms.find((x) => x.floor === 0)!
    const inside = world((room.u0 + room.u1) / 2, (room.v0 + room.v1) / 2)
    expect(blockedAt(inside)).toBe(false)
    // a point on the front wall away from the door is blocked
    const door = plan.doors.find((d) => d.exterior && d.floor === 0)!
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
    expect(house.doors.some((d) => d.open)).toBe(true)
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
    const p = house.group.localToWorld(new (r.camera.position.constructor as typeof THREE.Vector3)(5, 1.4, 0.1))
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

  it('steps through construction levels 0..8 from blueprint and foundation to complete house', () => {
    const r = fakeRoom()
    r.set('template', 'single_storey_a')
    r.act('build')
    const { house } = r.module.houses[0]!
    const stageMetric = () => r.module.metrics!('en').find((m) => m.id === 'construction_stage')!.read() as string

    r.set('construction_level', 0)
    expect(stageMetric()).toContain('0 ·')
    expect(house.groups['stage:0:blueprint']?.visible).toBe(true)
    expect(house.groups['stage:1:foundation']?.visible).toBe(false)
    expect(house.groups['f0']?.visible).toBe(false)

    r.set('construction_level', 1)
    expect(stageMetric()).toContain('1 ·')
    expect(house.groups['stage:0:blueprint']?.visible).toBe(true)
    expect(house.groups['stage:1:foundation']?.visible).toBe(true)
    expect(house.groups['stage:2:frame']?.visible).toBe(false)
    const foundationGroup = house.groups['stage:1:foundation']!
    const dirtBed = foundationGroup.children.find((c) => c.userData.structurePartId === 'foundation_dirt_bed')
    expect(dirtBed).toBeDefined()

    r.set('construction_level', 2)
    expect(stageMetric()).toContain('2 ·')
    expect(house.groups['stage:0:blueprint']?.visible).toBe(false)
    expect(house.groups['stage:1:foundation']?.visible).toBe(true)
    expect(house.groups['stage:2:frame']?.visible).toBe(true)
    expect(house.groups['stage:3:masonry']?.visible).toBe(false)
    const frameGroup = house.groups['stage:2:frame']!
    const intCols = frameGroup.children.filter((c) => String(c.userData.structurePartId || '').startsWith('interior_column_'))
    expect(intCols.length).toBeGreaterThan(0)

    r.set('construction_level', 3)
    expect(stageMetric()).toContain('3 ·')
    expect(house.groups['stage:2:frame']?.visible).toBe(true)
    expect(house.groups['stage:3:masonry']?.visible).toBe(true)

    r.set('construction_level', 4)
    expect(stageMetric()).toContain('4 ·')
    expect(house.groups['stage:4:installations']?.visible).toBe(true)
    expect(house.groups['f0']?.visible).toBe(true)

    r.set('construction_level', 5)
    expect(stageMetric()).toContain('5 ·')
    expect(house.groups['stage:2:frame']?.visible).toBe(false)
    expect(house.groups['stage:3:masonry']?.visible).toBe(false)
    expect(house.groups['stage:4:installations']?.visible).toBe(false)

    r.layer('water', true)
    expect(house.groups['stage:4:installations']?.visible).toBe(true)
    r.layer('water', false)

    // the timber frame goes up at 7, before the tiles; the tiles come at 8 and the frame stays under them
    r.set('construction_level', 7)
    expect(stageMetric()).toContain('7 ·')
    expect(house.groups['stage:7:roof_framing']?.visible).toBe(true)
    expect(house.groups['roof']?.visible).toBe(false)

    r.set('construction_level', 8)
    expect(stageMetric()).toContain('8 ·')
    expect(house.groups['stage:7:roof_framing']?.visible).toBe(true)
    expect(house.groups['roof']?.visible).toBe(true)
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

describe('the scenarios stop listening when they end (CLAUDE.md, "Memória")', () => {
  it('leaves no listener of theirs on the room world', async () => {
    const { module, room, step } = fakeRoom({ locale: 'en' })
    const on = room.world.on.bind(room.world)
    let open = 0
    room.world.on = ((type: Parameters<typeof on>[0], fn: Parameters<typeof on>[1]) => {
      open++
      const off = on(type, fn)
      return () => {
        open--
        off()
      }
    }) as typeof room.world.on
    const scenario = module.scenarios!('en').find((s) => s.id === 'house_gas_explodes')!
    await scenario.run({ room, step, expect: () => undefined })
    expect(open).toBe(0)
  })
})
