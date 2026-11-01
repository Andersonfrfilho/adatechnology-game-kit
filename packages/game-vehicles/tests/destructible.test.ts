import { describe, expect, it } from 'vitest'
import { checkAnimation, checkDestructible } from '@adatechnology/game-contracts'
import type { DestructionEvent, Hit } from '@adatechnology/game-contracts'
import { buildVehicleItem, createVehicleDestructible, type VehicleDestructible } from '../src'
import { makeKit } from './helpers/kit'
import { SAMPLE_KEYS } from './helpers/sample-fleet'

const MATERIALS = ['steel', 'aluminium', 'glass', 'plastic', 'rubber']

function make(key: string, locale = 'en') {
  const kit = makeKit({ locale })
  const item = buildVehicleItem(kit, key)
  const d = createVehicleDestructible(kit, item.vehicle, { id: `${key}_1`, frame: item.root })
  return { kit, item, d }
}
const types = (evs: DestructionEvent[]) => evs.map((e) => e.type)
const find = (evs: DestructionEvent[], type: string) => evs.filter((e) => e.type === type)

describe('light mode item', () => {
  it('builds an item in the light mode of the kit with the same parts and a valid contract', () => {
    const kit = makeKit()
    const full = createVehicleDestructible(kit, buildVehicleItem(kit, 'proto').vehicle)
    const light = createVehicleDestructible(kit, buildVehicleItem(kit, 'proto', { lod: true }).vehicle)
    expect(checkDestructible(light, { materials: MATERIALS, cost: true }).problems).toEqual([])
    expect(light.describe().parts.map((p) => p.id)).toEqual(full.describe().parts.map((p) => p.id))
  })
})

describe('contract', () => {
  for (const key of SAMPLE_KEYS) {
    it(`${key}: checkDestructible and checkAnimation pass`, () => {
      const { d } = make(key)
      const spec = d.describe()
      const r = checkDestructible(d, { materials: MATERIALS, cost: true })
      expect(r.problems).toEqual([])
      expect(r.ok).toBe(true)
      for (const clip of d.animations()) expect(checkAnimation(clip, spec.parts.map((p) => p.id)).problems).toEqual([])
    })
  }

  it('lists every zone as a part with a material from the table', () => {
    const { kit, d } = make('proto')
    const ids = d.describe().parts.map((p) => p.id)
    for (const z of kit.zonesOf(d.vehicle)) expect(ids, z.id).toContain(z.id)
    const mat = (id: string) => d.describe().parts.find((p) => p.id === id)!.material
    expect(mat('hood')).toBe('steel')
    expect(mat('door_front_left')).toBe('steel')
    expect(mat('windshield')).toBe('glass')
    expect(mat('headlight_left')).toBe('glass')
    expect(mat('bumper_front')).toBe('plastic')
    expect(mat('mirror_left')).toBe('plastic')
    expect(mat('tyre_front_left')).toBe('rubber')
  })

  it('uses aluminium for aircraft', () => {
    const { d } = make('plane')
    expect(d.describe().parts.some((p) => p.material === 'aluminium')).toBe(true)
    expect(d.describe().parts.find((p) => p.id === 'nose')?.material).toBe('aluminium')
  })

  it('lists the joints: hinge, bolt and weld', () => {
    const { d } = make('proto')
    const j = (id: string) => d.describe().joints!.find((x) => x.id === id)
    expect(j('door_front_left~underbody')?.kind).toBe('hinge')
    expect(j('hood~underbody')?.kind).toBe('hinge')
    expect(j('lid~underbody')?.kind).toBe('hinge')
    for (const id of ['wheel_front_left', 'bumper_front', 'mirror_left', 'battery', 'headlight_left', 'taillight_left']) {
      const x = d.describe().joints!.find((q) => q.a === id)
      expect(x?.kind, id).toBe(id === 'mirror_left' ? 'bolt' : 'bolt')
    }
    expect(d.describe().joints!.some((x) => x.kind === 'weld' && x.a === 'pillar_a_left')).toBe(true)
    expect(d.describe().joints!.some((x) => x.kind === 'weld' && x.a === 'roof')).toBe(true)
  })

  it('has the new mechanical parts with names in both languages', () => {
    const en = make('proto', 'en').d
    const pt = make('proto', 'pt-BR').d
    for (const [id, enName, ptName] of [
      ['battery', 'Battery', 'Bateria'],
      ['alternator', 'Alternator', 'Alternador'],
      ['gearbox', 'Gearbox', 'Caixa de câmbio'],
      ['brakes', 'Brakes', 'Freios'],
      ['steering', 'Steering', 'Direção'],
      ['shock_absorbers', 'Shock absorbers', 'Amortecedores'],
      ['mirror_left', 'Left mirror', 'Retrovisor esquerdo'],
    ] as const) {
      expect(en.describe().parts.map((p) => p.id)).toContain(id)
      expect(en.partName(id)).toBe(enName)
      expect(pt.partName(id)).toBe(ptName)
    }
  })

  it('fits the tow hitch by option, spec flag or seed', () => {
    const kit = makeKit()
    const a = createVehicleDestructible(kit, buildVehicleItem(kit, 'proto').vehicle, { hitch: true })
    const b = createVehicleDestructible(kit, buildVehicleItem(kit, 'proto').vehicle, { hitch: false })
    expect(a.describe().parts.some((p) => p.id === 'tow_hitch')).toBe(true)
    expect(b.describe().parts.some((p) => p.id === 'tow_hitch')).toBe(false)
    const again = createVehicleDestructible(kit, buildVehicleItem(kit, 'truck').vehicle)
    const same = createVehicleDestructible(kit, buildVehicleItem(kit, 'truck').vehicle)
    expect(again.describe().parts.some((p) => p.id === 'tow_hitch')).toBe(same.describe().parts.some((p) => p.id === 'tow_hitch'))
  })

  it('has open and close clips for the doors, hood and trunk', () => {
    const { d } = make('proto')
    expect(d.animations().map((c) => c.id)).toEqual(['open_doors', 'close_doors', 'open_hood', 'close_hood', 'open_trunk', 'close_trunk'])
  })
})

const bullet = (d: VehicleDestructible, part: string, from: [number, number, number], energy = 500, caliber = 9): Hit => {
  const target = d.partWorldCenter(part)
  const dir: [number, number, number] = [target[0] - from[0], target[1] - from[1], target[2] - from[2]]
  const n = Math.hypot(...dir)
  const unit = dir.map((v) => v / n) as [number, number, number]
  // land on the near face of the part
  const spec = d.describe().parts.find((p) => p.id === part)!
  const half = spec.shape.kind === 'box' ? spec.shape.size : [0, 0, 0]
  const point: [number, number, number] = [target[0] - unit[0] * half[0] * 0.5, target[1] - unit[1] * half[1] * 0.5, target[2] - unit[2] * half[2] * 0.5]
  return { type: 'ballistic', point, direction: unit, energy, caliber }
}

describe('hits', () => {
  it('a 9 mm bullet through the windshield makes a hole and cracks it', () => {
    const { d } = make('proto')
    const evs = d.hit(bullet(d, 'windshield', [0, 3, 6]))
    expect(find(evs, 'hole')).toHaveLength(1)
    expect(find(evs, 'crack').length).toBeGreaterThan(0)
    const s = d.state().parts.find((p) => p.id === 'windshield')!
    expect(s.holes).toHaveLength(1)
    expect(s.status).toBe('damaged')
    expect(find(evs, 'hole')[0]).toMatchObject({ part: 'windshield', hole: { through: true } })
  })

  it('a bullet through a tempered window shatters it', () => {
    const { d } = make('proto')
    const evs = d.hit(bullet(d, 'window_front_left', [-4, 1.2, 0]))
    expect(types(evs)).toContain('hole')
    expect(types(evs)).toContain('fracture')
    expect(d.state().parts.find((p) => p.id === 'window_front_left')!.status).toBe('broken')
  })

  it('a bullet on a panel makes a hole, or a dent when the panel holds', () => {
    const { d } = make('proto')
    const evs = d.hit(bullet(d, 'door_front_left', [-6, 0.7, 0], 900, 9))
    expect(find(evs, 'hole').length + find(evs, 'dent').length).toBeGreaterThan(0)
    const weak = d.hit(bullet(d, 'door_rear_left', [-6, 0.7, 0], 120, 9))
    expect(find(weak, 'dent')).toHaveLength(1)
    expect(find(weak, 'dent')[0]).toMatchObject({ part: 'door_rear_left' })
  })

  it('a wrench on the wheel bolts takes the wheel off and the event names the joint', () => {
    const { d } = make('proto')
    const joint = 'wheel_front_left~underbody'
    expect(d.disassemble!(joint, 'screwdriver', 1)).toBe(-1)
    let p = 0
    let evs: DestructionEvent[] = []
    for (let i = 0; i < 80 && p < 1; i++) {
      p = d.disassemble!(joint, 'wrench', 0.1)
      evs = evs.concat(d.update!(0.1))
    }
    expect(p).toBe(1)
    const detach = find(evs, 'detach')
    expect(detach).toHaveLength(1)
    expect(detach[0]).toMatchObject({ joint, by: 'tool', parts: ['wheel_front_left', 'underbody'] })
    const st = d.state()
    expect(st.joints.find((j) => j.id === joint)).toMatchObject({ open: true, openedBy: 'tool' })
    expect(st.groups.length).toBeGreaterThan(1)
    expect(d.detachedParts()).toContain('wheel_front_left')
    expect(d.detachedParts()).toContain('tyre_front_left')
  })

  it('an explosion near the tank explodes it, kills the glass and wears the joints', () => {
    const { d } = make('proto')
    const tank = d.partWorldCenter('fuel_tank')
    const evs = d.hit({ type: 'explosive', point: [tank[0], tank[1] - 0.2, tank[2]], energy: 60000, radius: 4 })
    const boom = find(evs, 'explode')
    expect(boom).toHaveLength(1)
    expect(boom[0]).toMatchObject({ part: 'fuel_tank' })
    expect(d.state().parts.find((p) => p.id === 'fuel_tank')!.status).toBe('broken')
    expect(d.status().exploded).toBe(true)
    const more = d.hit({ type: 'explosive', point: [tank[0], tank[1], tank[2]], energy: 60000, radius: 4 })
    expect(find(more, 'explode')).toHaveLength(0)
  })

  it('a bullet in the fuel tank leaks, fire lights it and it explodes', () => {
    const { d } = make('proto')
    const t = d.partWorldCenter('fuel_tank')
    const spec = d.describe().parts.find((p) => p.id === 'fuel_tank')!
    const low = t[1] - (spec.shape.kind === 'box' ? spec.shape.size[1] / 2 - 0.02 : 0)
    const leak = d.hit({ type: 'ballistic', point: [t[0], low, t[2]], direction: [0, 0, -1], energy: 600, caliber: 9 })
    expect(find(leak, 'leak')).toHaveLength(1)
    expect(find(leak, 'leak')[0]).toMatchObject({ part: 'fuel_tank', fluid: 'fuel' })
    d.update!(1)
    expect(d.state().parts.find((p) => p.id === 'fuel_tank')!.liters).toBeLessThan(55)
    let all: DestructionEvent[] = []
    for (let i = 0; i < 400 && !types(all).includes('explode'); i++) {
      all = all.concat(d.hit({ type: 'fire', point: t, temperature: 900, radius: 0.5, duration: 0.05 }))
      all = all.concat(d.update!(0.05))
    }
    expect(types(all)).toContain('ignite')
    expect(types(all)).toContain('explode')
  })

  it('same input gives the same events', () => {
    const run = () => {
      const { d } = make('proto')
      let evs: DestructionEvent[] = []
      evs = evs.concat(d.hit(bullet(d, 'windshield', [0, 3, 6])))
      evs = evs.concat(d.hit(bullet(d, 'door_front_left', [-6, 0.7, 0], 900)))
      evs = evs.concat(d.hit({ type: 'blunt', point: d.partWorldCenter('bumper_front'), direction: [-1, 0, 0], energy: 30000, radius: 0.5 }))
      for (let i = 0; i < 30; i++) evs = evs.concat(d.update!(0.1))
      return JSON.stringify([evs, d.state()])
    }
    expect(run()).toBe(run())
  })
})

const unbolt = (d: VehicleDestructible, joint: string): DestructionEvent[] => {
  let evs: DestructionEvent[] = []
  for (let i = 0; i < 200 && d.disassemble!(joint, 'wrench', 0.2) < 1; i++) evs = evs.concat(d.update!(0.2))
  return evs.concat(d.update!(0.1))
}

describe('detaching and mechanics', () => {
  it('a bumper, a mirror, a light and the hitch come off as objects that fall', () => {
    const kit = makeKit()
    const item = buildVehicleItem(kit, 'proto')
    const d = createVehicleDestructible(kit, item.vehicle, { frame: item.root, hitch: true })
    const c = d.vehicle
    for (const id of ['bumper_front', 'mirror_left', 'headlight_left', 'tow_hitch', 'battery']) {
      const evs = unbolt(d, `${id}~${id.startsWith('mirror') ? 'door_front_left' : 'underbody'}`)
      expect(find(evs, 'detach'), id).toHaveLength(1)
    }
    expect((c as any).flying.length).toBeGreaterThanOrEqual(5)
    for (let i = 0; i < 90; i++) kit.tick(c, 1 / 30)
    for (const piece of (c as any).flying) expect(piece.o.position.y).toBeLessThan(0.5)
    expect(d.detachedParts().sort()).toEqual(['battery', 'bumper_front', 'headlight_left', 'mirror_left', 'tow_hitch'])
  })

  it('a fender and the front bumper tear off under a hard blow', () => {
    const { d } = make('proto')
    const evs = d.hit({ type: 'blunt', point: d.partWorldCenter('bumper_front'), direction: [-1, 0, 0], energy: 30000, radius: 0.6 })
    expect(find(evs, 'dent').length).toBeGreaterThan(0)
    expect(find(evs, 'detach').some((e) => (e as { parts: string[] }).parts[0] === 'bumper_front')).toBe(true)
  })

  it('breaking the mirror drops it', () => {
    const { d } = make('proto')
    const evs = d.hit({ type: 'blunt', point: d.partWorldCenter('mirror_left'), direction: [0, 0, 1], energy: 2500, radius: 0.1 })
    expect(d.state().parts.find((p) => p.id === 'mirror_left')!.status).toBe('broken')
    expect(find(evs, 'detach').length).toBeGreaterThan(0)
  })

  it('a dead battery or a missing alternator stops the start and puts the lights out', () => {
    for (const part of ['battery', 'alternator']) {
      const { d } = make('proto')
      expect(d.status()).toMatchObject({ canStart: true, lightsOn: true, canDrive: true })
      unbolt(d, `${part}~${part === 'battery' ? 'underbody' : 'engine'}`)
      expect(d.status(), part).toMatchObject({ canStart: false, lightsOn: false, canDrive: false })
    }
  })

  it('no brakes stop longer, no steering pulls, no gearbox does not drive', () => {
    const { d } = make('proto')
    unbolt(d, 'brakes~underbody')
    expect(d.status().brakeFactor).toBeGreaterThan(3)
    unbolt(d, 'steering~underbody')
    expect(Math.abs(d.status().steerPull)).toBeGreaterThan(0.3)
    expect(d.status().canDrive).toBe(true)
    unbolt(d, 'gearbox~engine')
    expect(d.status()).toMatchObject({ canStart: true, canDrive: false })
  })

  it('shooting the battery kills it, and a bullet in a tyre makes it flat', () => {
    const { d } = make('proto')
    d.hit({ type: 'ballistic', point: d.partWorldCenter('battery'), direction: [0, -1, 0], energy: 500, caliber: 9 })
    expect(d.status().lightsOn).toBe(false)
    const t = d.partWorldCenter('tyre_rear_left')
    d.hit({ type: 'ballistic', point: [t[0], t[1] + 0.27, t[2]], direction: [0, -1, 0], energy: 500, caliber: 9 })
    expect(d.status().flatTyres).toContain('tyre_rear_left')
  })

  it('fire on the engine ignites it and long fire melts the tyres', () => {
    const { d } = make('proto')
    let evs: DestructionEvent[] = []
    const e = d.partWorldCenter('engine')
    for (let i = 0; i < 100; i++) {
      evs = evs.concat(d.hit({ type: 'fire', point: e, temperature: 900, radius: 0.5, duration: 0.1 }), d.update!(0.1))
    }
    expect(find(evs, 'ignite').some((x) => (x as { part: string }).part === 'engine')).toBe(true)
    for (let i = 0; i < 600; i++) evs = evs.concat(d.update!(0.1))
    const tyres = d.state().parts.filter((p) => p.id.startsWith('tyre_'))
    expect(find(evs, 'melt').length).toBeGreaterThan(0)
    expect(tyres.some((p) => p.status === 'melted' || p.melt > 0.5)).toBe(true)
  })

  it('rollover hurts the roof and the glass', () => {
    const { d } = make('proto')
    d.rollover()
    let evs: DestructionEvent[] = []
    for (let i = 0; i < 300; i++) evs = evs.concat(d.update!(1 / 30))
    expect(d.state().parts.find((p) => p.id === 'roof')!.hp).toBeLessThan(d.describe().parts.find((p) => p.id === 'roof')!.hp!)
    expect(find(evs, 'dent').some((x) => (x as { part: string }).part === 'roof')).toBe(true)
  })

  it('reset gives back a whole vehicle and works without a scene', () => {
    const { d } = make('proto')
    d.hit({ type: 'blunt', point: d.partWorldCenter('hood'), direction: [0, -1, 0], energy: 40000, radius: 0.5 })
    unbolt(d, 'brakes~underbody')
    d.reset!()
    expect(d.state().parts.every((p) => p.status === 'intact')).toBe(true)
    expect(d.state().groups).toHaveLength(1)
    const kit = makeKit()
    const h = createVehicleDestructible(kit, kit.build('proto'), { headless: true })
    expect(h.hit({ type: 'ballistic', point: h.partWorldCenter('windshield'), direction: [0, 0, -1], energy: 500, caliber: 9 }).length).toBeGreaterThan(0)
  })
})

describe('door and lid plates', () => {
  it('a closed door is the body itself, and the first swing hangs the skin and window of the door itself on the hinge in place of the flat plate', () => {
    const { item, d } = make('proto')
    const piv = item.root.getObjectByName('door_front_left') ?? item.root.getObjectByName(d.describe().parts.find((p) => /door/.test(p.id))!.id)
    expect(piv).toBeTruthy()
    const panel = piv!.children[0]!
    expect(panel.visible).toBe(false)
    expect(piv!.children.length).toBe(1)
    piv!.rotation.set(0, 0.6, 0)
    // the skin cut from the body, its trim and the side window now turn with the hinge
    expect(piv!.children.length).toBeGreaterThan(1)
    expect(panel.visible).toBe(false)
    const pieces = piv!.children.length
    piv!.rotation.set(0, 0, 0)
    // closed again, the pieces stay on the hinge (no second cut)
    expect(piv!.children.length).toBe(pieces)
    expect(panel.visible).toBe(false)
    piv!.quaternion.set(0, Math.sin(0.3), 0, Math.cos(0.3))
    expect(panel.visible).toBe(false)
  })
})
