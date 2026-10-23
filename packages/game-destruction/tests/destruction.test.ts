import { describe, expect, it } from 'vitest'
import {
  JOINT_BY_MATERIALS, JOINT_DEFAULTS, MATERIALS, createDestruction, guessMaterial, inferJoints, partMass, partVolume, quatFromEuler, resolveStrings, rotateVec, toLocal,
  toWorld,
} from '../src'
import type { DestructionEvent } from '../src'
import { chair, plate } from './helpers'

const types = (events: DestructionEvent[]) => events.map((e) => e.type)
const bullet = { type: 'ballistic' as const, point: [0, 0, 0.03] as [number, number, number], direction: [0, 0, -1] as [number, number, number], energy: 500, caliber: 9 }

describe('materials', () => {
  it('has unique ids and every field the model needs', () => {
    const ids = MATERIALS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ['steel', 'cast_iron', 'aluminium', 'copper', 'wood_soft', 'wood_hard', 'plywood', 'mdf', 'glass', 'tempered_glass', 'ceramic', 'concrete', 'brick', 'plaster', 'stone', 'plastic', 'rubber', 'fabric', 'foam', 'leather', 'paper', 'foliage', 'green_wood', 'flesh_fruit', 'cactus', 'wax']) {
      expect(ids).toContain(id)
    }
    for (const m of MATERIALS) {
      expect(m.id).toMatch(/^[a-z_]+$/)
      expect(m.density).toBeGreaterThan(0)
      expect(m.hpPerKg).toBeGreaterThan(0)
      expect(m.penetration).toBeGreaterThan(0)
      expect(m.ductility).toBeGreaterThanOrEqual(0)
      expect(m.ductility).toBeLessThanOrEqual(1)
      expect(['shatter', 'crumble', 'splinter', 'tear', 'snap', 'none']).toContain(m.fracture)
      expect(m.hitDebris).toBeTruthy()
      expect(m.breakDebris).toBeTruthy()
      expect(m.thermal.conductivity).toBeGreaterThanOrEqual(0)
    }
  })

  it('melting points and flammability match the real thing', () => {
    const by = (id: string) => MATERIALS.find((m) => m.id === id)!
    expect(by('aluminium').thermal.meltC).toBe(660)
    expect(by('steel').thermal.meltC).toBe(1450)
    expect(by('copper').thermal.meltC).toBe(1085)
    expect(by('cast_iron').thermal.meltC).toBe(1200)
    expect(by('concrete').thermal.ignitionC).toBeUndefined()
    expect(by('wood_soft').thermal.ignitionC).toBeLessThan(400)
    expect(by('plastic').thermal.smoke).toBe('black')
    expect(by('cactus').thermal.ignitionC).toBeGreaterThanOrEqual(450)
  })

  it('guesses materials from names (longest keyword wins)', () => {
    expect(guessMaterial('Chrome_Bumper')).toBe('steel')
    expect(guessMaterial('window_pane')).toBe('glass')
    expect(guessMaterial('cast iron pot')).toBe('cast_iron')
    expect(guessMaterial('cardboard_box')).toBe('paper')
    expect(guessMaterial('Sofa_cushion')).toBe('fabric')
    expect(guessMaterial('tree_trunk')).toBe('green_wood')
    expect(guessMaterial('tyre')).toBe('rubber')
    expect(guessMaterial('qqq')).toBeUndefined()
  })

  it('picks joints by material and infers them from touching parts', () => {
    const by = (id: string) => MATERIALS.find((m) => m.id === id)!
    expect(JOINT_BY_MATERIALS(by('steel'), by('steel'))).toBe('weld')
    expect(JOINT_BY_MATERIALS(by('wood_soft'), by('wood_soft'))).toBe('screw')
    expect(JOINT_BY_MATERIALS(by('glass'), by('steel'))).toBe('glue')
    expect(JOINT_BY_MATERIALS(by('brick'), by('brick'))).toBe('mortar')
    expect(JOINT_BY_MATERIALS(by('fabric'), by('wood_soft'))).toBe('tie')
    expect(JOINT_BY_MATERIALS(by('foliage'), by('green_wood'))).toBe('stem')
    expect(JOINT_BY_MATERIALS(by('plastic'), by('steel'))).toBe('clip')
    expect(JOINT_DEFAULTS.screw).toEqual({ strength: 80, tools: ['screwdriver'], seconds: 2.5 })
    const joints = inferJoints(chair().parts)
    expect(joints.length).toBe(5)
    expect(joints.every((j) => j.kind === 'screw')).toBe(true)
  })

  it('computes volume and mass', () => {
    expect(partVolume({ kind: 'box', size: [1, 2, 3] })).toBe(6)
    const steel = MATERIALS.find((m) => m.id === 'steel')!
    expect(partMass({ id: 'a', material: 'steel', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0, 0], fill: 0.1 }, steel)).toBeCloseTo(785)
  })

  it('has en and pt-BR strings with a fallback', () => {
    expect(resolveStrings('pt-BR').materialNames.glass).toBe('vidro')
    expect(resolveStrings('pt-BR').materialNames.cactus).toBe('cacto')
    expect(resolveStrings('xx').materialNames.glass).toBe('glass')
    for (const m of MATERIALS) {
      expect(resolveStrings('en').materialNames[m.id]).toBeTruthy()
      expect(resolveStrings('pt-BR').materialNames[m.id]).toBeTruthy()
    }
    expect(Object.keys(resolveStrings('pt-BR').eventLabels).sort()).toEqual(Object.keys(resolveStrings('en').eventLabels).sort())
  })
})

describe('math', () => {
  it('round-trips local and world', () => {
    const q = quatFromEuler(0.3, 1.1, -0.4)
    const p = toWorld([1, 2, 3], q, [0.5, -1, 2])
    const l = toLocal([1, 2, 3], q, p)
    expect(l[0]).toBeCloseTo(0.5)
    expect(l[1]).toBeCloseTo(-1)
    expect(l[2]).toBeCloseTo(2)
    const r = rotateVec(quatFromEuler(0, Math.PI / 2, 0), [1, 0, 0])
    expect(r[2]).toBeCloseTo(-1)
  })
})

describe('raycast', () => {
  it('returns entry points and normals for box, cylinder and sphere, honouring rotation', () => {
    const w = createDestruction()
    w.add({ parts: [{ id: 'b', material: 'steel', shape: { kind: 'box', size: [1, 1, 1] }, position: [0, 0, 0] }] }, { id: 'box' })
    w.add({ parts: [{ id: 'c', material: 'steel', shape: { kind: 'cylinder', radius: 0.5, height: 2 }, position: [0, 0, 0] }] }, { id: 'cyl', position: [10, 0, 0] })
    w.add({ parts: [{ id: 's', material: 'steel', shape: { kind: 'sphere', radius: 1 }, position: [0, 0, 0] }] }, { id: 'sph', position: [20, 0, 0] })
    const a = w.raycast([0, 0, 5], [0, 0, -1])!
    expect(a.object).toBe('box')
    expect(a.distance).toBeCloseTo(4.5)
    expect(a.normal).toEqual([0, 0, 1])
    const b = w.raycast([10, 5, 0], [0, -1, 0])!
    expect(b.object).toBe('cyl')
    expect(b.point[1]).toBeCloseTo(1)
    expect(b.normal).toEqual([0, 1, 0])
    const c = w.raycast([15, 0, 0], [-1, 0, 0])!
    expect(c.normal[0]).toBeCloseTo(1)
    const d = w.raycast([20, 0, 5], [0, 0, -1])!
    expect(d.object).toBe('sph')
    expect(d.point[2]).toBeCloseTo(1)
    expect(d.normal[2]).toBeCloseTo(1)
    expect(w.raycast([0, 5, 5], [0, 0, -1])).toBeNull()
    w.setTransform('box', [0, 0, 0], quatFromEuler(0, Math.PI / 4, 0))
    const e = w.raycast([0, 0, 5], [0, 0, -1])!
    expect(e.distance).toBeCloseTo(5 - Math.SQRT1_2, 3)
    expect(e.normal[2]).toBeCloseTo(Math.SQRT1_2, 3)
  })
})

describe('ballistic', () => {
  it('9mm goes through 1 mm steel and not through 5 cm concrete', () => {
    const w = createDestruction()
    const steel = w.add(plate('steel', 1, 1, 0.001))
    const concrete = w.add(plate('concrete', 1, 1, 0.05), { position: [5, 0, 0] })
    const r1 = w.hit(steel, bullet)
    expect(r1.penetrated).toBe(true)
    expect(r1.exitEnergy).toBeGreaterThan(300)
    expect(types(r1.events)).toContain('hole')
    expect(w.part(steel, 'plate')!.holes[0].through).toBe(true)
    const r2 = w.hit(concrete, { ...bullet, point: [5, 0, 0.03] })
    expect(r2.penetrated).toBe(false)
    expect(r2.exitEnergy).toBe(0)
    expect(w.part(concrete, 'plate')!.holes.every((h) => !h.through)).toBe(true)
    expect(w.part(concrete, 'plate')!.cracks.length).toBe(1)
  })

  it('dents steel from a hammer and never breaks it', () => {
    const w = createDestruction()
    const id = w.add(plate('steel', 1, 1, 0.003))
    for (let i = 0; i < 50; i++) w.hit(id, { type: 'blunt', point: [0, 0, 0.03], direction: [0, 0, -1], energy: 80, radius: 0.03 })
    const p = w.part(id, 'plate')!
    expect(p.dents.length).toBeGreaterThan(0)
    expect(p.status).toBe('damaged')
    expect(p.hp).toBeGreaterThanOrEqual(1)
    for (let i = 0; i < 100; i++) w.hit(id, bullet)
    expect(w.part(id, 'plate')!.status).not.toBe('broken')
    expect(w.part(id, 'plate')!.holes.length).toBeGreaterThan(5)
  })

  it('glass pane shatters within a few shots into shards', () => {
    const w = createDestruction()
    const id = w.add(plate('glass', 0.6, 0.6, 0.004))
    const events: DestructionEvent[] = []
    let shots = 0
    while (w.part(id, 'plate')!.status !== 'broken' && shots < 20) {
      events.push(...w.hit(id, bullet).events)
      shots++
    }
    expect(shots).toBeGreaterThanOrEqual(3)
    expect(shots).toBeLessThanOrEqual(6)
    const fr = events.find((e) => e.type === 'fracture')!
    expect(fr.type === 'fracture' && fr.style).toBe('shatter')
    if (fr.type === 'fracture') {
      expect(fr.fragments.length).toBeGreaterThan(5)
      expect(fr.fragments.every((f) => f.shape === 'shard')).toBe(true)
      expect(fr.fragments.every((f) => Math.abs(f.size[2] - 0.004) < 1e-9)).toBe(true)
      const total = fr.fragments.reduce((s, f) => s + f.mass, 0)
      expect(total).toBeCloseTo(0.6 * 0.6 * 0.004 * 2500, 3)
    }
    expect(types(events)).toContain('crack')
    expect(types(events)).toContain('destroyed')
    expect(w.state(id)!.destroyed).toBe(true)
  })

  it('ricochets off a grazing steel hit', () => {
    const w = createDestruction()
    const id = w.add(plate('steel', 1, 1, 0.01))
    const r = w.hit(id, { type: 'ballistic', point: [0, 0, 0.005], direction: [0, -0.1, -1], energy: 300, caliber: 9 })
    // direction mostly along the surface normal: not a ricochet
    expect(types(r.events)).not.toContain('ricochet')
    const g = w.hit(id, { type: 'ballistic', point: [0, 0.2, 0.005], direction: [0, -1, -0.1], energy: 100, caliber: 9 })
    expect(types(g.events)).toContain('ricochet')
  })

  it('shoot goes through several parts and keeps the exit energy', () => {
    const w = createDestruction()
    w.add(plate('wood_soft', 1, 1, 0.01), { id: 'a' })
    w.add(plate('wood_soft', 1, 1, 0.01), { id: 'b', position: [0, 0, -1] })
    const res = w.shoot([0, 0, 5], [0, 0, -1], 500, 9)
    expect(res.length).toBe(2)
    expect(res[0].penetrated).toBe(true)
    expect(res[1].exitEnergy).toBeLessThan(res[0].exitEnergy)
  })

  it('leaks from a punctured tank and the level drops in update', () => {
    const w = createDestruction()
    const id = w.add({
      parts: [{ id: 'tank', material: 'steel', shape: { kind: 'box', size: [0.5, 0.5, 0.5] }, position: [0, 0, 0], thickness: 0.001, contains: { fluid: 'fuel', liters: 20 } }],
    })
    const r = w.hit(id, bullet)
    const leak = r.events.find((e) => e.type === 'leak')!
    expect(leak.type === 'leak' && leak.rate).toBeGreaterThan(0)
    if (leak.type === 'leak') expect(leak.direction[2]).toBeCloseTo(1)
    w.update(1)
    expect(w.part(id, 'tank')!.liters!).toBeLessThan(20)
    w.setLiters(id, 'tank', 999)
    expect(w.part(id, 'tank')!.liters).toBe(20)
    w.setLiters(id, 'tank', -5)
    expect(w.part(id, 'tank')!.liters).toBe(0)
  })
})

describe('chair and joints', () => {
  it('a strong blow on a leg detaches it', () => {
    const w = createDestruction()
    const id = w.add(chair())
    expect(w.state(id)!.groups.length).toBe(1)
    const r = w.hit(id, { type: 'blunt', point: [0.2, 0.2, 0.18], direction: [-1, 0, 0], energy: 300, radius: 0.05 })
    expect(r.part).toBe('leg_fl')
    expect(types(r.events)).toContain('detach')
    const st = w.state(id)!
    expect(st.groups.length).toBeGreaterThanOrEqual(2)
    expect(st.groups[0]).toContain('seat')
    expect(st.groups.flat()).toContain('leg_fl')
    expect(st.groups.find((g) => g.includes('leg_fl'))!).not.toContain('seat')
  })

  it('splits the loose group into its own object', () => {
    const w = createDestruction()
    const id = w.add(chair())
    w.hit(id, { type: 'blunt', point: [0.2, 0.2, 0.18], direction: [-1, 0, 0], energy: 300, radius: 0.05 })
    const g = w.state(id)!.groups.findIndex((x) => x.includes('leg_fl'))
    const nid = w.splitGroup(id, g)
    expect(nid).not.toBe(id)
    expect(w.state(nid)!.parts.map((p) => p.id)).toEqual(['leg_fl'])
    expect(w.state(id)!.parts.length).toBe(5)
    expect(w.state(id)!.groups.length).toBe(1)
    expect(w.part(nid, 'leg_fl')!.status).toBe('damaged')
  })

  it('screwdriver undoes a screw in the expected seconds, other tools do not', () => {
    const w = createDestruction()
    const id = w.add(chair())
    const joint = w.state(id)!.joints.find((j) => j.kind === 'screw')!
    expect(w.disassemble(id, joint.id, 'hammer', 0.1)).toBe(-1)
    expect(w.disassemble(id, joint.id, 'hand', 0.1)).toBe(-1)
    expect(w.workableJoints(id, 'screwdriver').length).toBe(5)
    expect(w.workableJoints(id, 'wrench').length).toBe(0)
    const seen: number[] = []
    w.on('disassemble_progress', (e) => e.type === 'disassemble_progress' && seen.push(e.progress))
    let t = 0
    let p = 0
    while (p < 1 && t < 10) {
      p = w.disassemble(id, joint.id, 'screwdriver', 0.1)
      t += 0.1
    }
    expect(t).toBeCloseTo(2.5, 1)
    expect(p).toBe(1)
    expect(w.state(id)!.joints.find((j) => j.id === joint.id)!.open).toBe(true)
    expect(w.state(id)!.joints.find((j) => j.id === joint.id)!.openedBy).toBe('tool')
    expect(w.state(id)!.groups.length).toBe(2)
    expect(seen.length).toBeGreaterThanOrEqual(9)
    expect(w.workableJoints(id, 'screwdriver').length).toBe(4)
  })

  it('finds the nearest joint to a point', () => {
    const w = createDestruction()
    const id = w.add(chair())
    const j = w.nearestJoint(id, [0.18, 0.4, 0.18])!
    expect(j.a === 'seat' || j.b === 'seat').toBe(true)
    expect(j.a === 'leg_fl' || j.b === 'leg_fl').toBe(true)
    expect(w.nearestJoint(id, [5, 5, 5])).toBeNull()
  })

  it('a destroyed part opens its joints with part_lost', () => {
    const w = createDestruction()
    const id = w.add(chair())
    const events: DestructionEvent[] = []
    for (let i = 0; i < 6 && w.part(id, 'leg_fl')!.status !== 'broken'; i++) {
      events.push(...w.hit(id, { type: 'ballistic', point: [0.2, 0.2, 0.18], direction: [-1, 0, 0], energy: 500, caliber: 9 }).events)
    }
    expect(w.part(id, 'leg_fl')!.status).toBe('broken')
    const fr = events.find((e) => e.type === 'fracture')!
    expect(fr.type === 'fracture' && fr.style).toBe('splinter')
    expect(events.some((e) => e.type === 'detach' && e.by === 'part_lost')).toBe(true)
    expect(w.state(id)!.groups.flat()).not.toContain('leg_fl')
  })
})

describe('fire and heat', () => {
  it('ignites wood and burns it to ashes', () => {
    const w = createDestruction()
    const id = w.add({ parts: [{ id: 'plank', material: 'wood_soft', shape: { kind: 'box', size: [0.3, 0.02, 0.05] }, position: [0, 0, 0] }] })
    const r = w.hit(id, { type: 'fire', point: [0, 0, 0], temperature: 1000, radius: 0.5, duration: 1 })
    expect(types(r.events)).toContain('ignite')
    expect(w.part(id, 'plank')!.burning).toBe(true)
    const events: DestructionEvent[] = []
    for (let i = 0; i < 600 && w.part(id, 'plank')!.status !== 'ashes'; i++) events.push(...w.update(1))
    const p = w.part(id, 'plank')!
    expect(p.status).toBe('ashes')
    expect(p.burning).toBe(false)
    expect(p.char).toBe(1)
    expect(types(events)).toContain('burnout')
    expect(types(events)).toContain('destroyed')
    expect(p.mass).toBeLessThan(0.05)
  })

  it('does not burn concrete', () => {
    const w = createDestruction()
    const id = w.add(plate('concrete', 1, 1, 0.1))
    w.hit(id, { type: 'fire', point: [0, 0, 0], temperature: 1000, radius: 1, duration: 5 })
    expect(w.part(id, 'plate')!.burning).toBe(false)
  })

  it('a wood fire does not melt steel but melts aluminium and plastic', () => {
    const w = createDestruction({ fireSpread: 0.5 })
    const wood = w.add({ parts: [{ id: 'log', material: 'wood_soft', shape: { kind: 'box', size: [0.4, 0.2, 0.2] }, position: [0, 0, 0] }] })
    const mk = (material: string, x: number) => w.add({ parts: [{ id: 'p', material, shape: { kind: 'box', size: [0.1, 0.1, 0.1] }, position: [0, 0, 0] }] }, { position: [x, 0, 0] })
    const steel = mk('steel', 0.3)
    const alu = mk('aluminium', -0.3)
    const plastic = mk('plastic', 0)
    w.setTransform(plastic, [0, 0.25, 0], [0, 0, 0, 1])
    w.hit(wood, { type: 'fire', point: [0, 0, 0], temperature: 1000, radius: 0.5, duration: 2 })
    expect(w.part(wood, 'log')!.burning).toBe(true)
    const events: DestructionEvent[] = []
    for (let i = 0; i < 240; i++) events.push(...w.update(0.25))
    expect(w.part(steel, 'p')!.melt).toBe(0)
    expect(w.part(steel, 'p')!.temperature).toBeLessThan(800)
    expect(w.part(steel, 'p')!.temperature).toBeGreaterThan(100)
    expect(w.part(alu, 'p')!.melt).toBeGreaterThan(0)
    expect(w.part(plastic, 'p')!.melt).toBeGreaterThan(0)
    expect(types(events)).toContain('melt')
    expect(types(events)).toContain('drip')
  })

  it('a 3000 C cutting torch melts steel', () => {
    const w = createDestruction()
    const id = w.add(plate('steel', 0.2, 0.2, 0.005))
    const events: DestructionEvent[] = []
    for (let i = 0; i < 400 && w.part(id, 'plate')!.status !== 'melted'; i++) {
      w.hit(id, { type: 'heat', point: [0, 0, 0.1], temperature: 3000, radius: 0.3, duration: 0.1 })
      events.push(...w.update(0.1))
    }
    expect(w.part(id, 'plate')!.status).toBe('melted')
    expect(types(events)).toContain('melt')
    expect(types(events)).toContain('drip')
    expect(types(events)).toContain('destroyed')
  })

  it('plastic melts and drips under heat', () => {
    const w = createDestruction()
    const id = w.add(plate('plastic', 0.2, 0.2, 0.01))
    w.hit(id, { type: 'heat', point: [0, 0, 0], temperature: 400, radius: 1, duration: 10 })
    const ev = w.update(1)
    expect(w.part(id, 'plate')!.melt).toBeGreaterThan(0)
        expect(types(ev)).toContain('drip')
  })

  it('extinguish puts fire out and cools', () => {
    const w = createDestruction()
    const id = w.add(plate('wood_soft', 0.3, 0.3, 0.02))
    w.hit(id, { type: 'fire', point: [0, 0, 0], temperature: 1000, radius: 1, duration: 3 })
    expect(w.part(id, 'plate')!.burning).toBe(true)
    w.extinguish(id)
    expect(w.part(id, 'plate')!.burning).toBe(false)
    expect(w.part(id, 'plate')!.temperature).toBeLessThan(700)
  })

  it('glass cracks from thermal shock', () => {
    const w = createDestruction()
    const id = w.add(plate('glass', 0.5, 0.5, 0.004))
    w.hit(id, { type: 'heat', point: [0, 0, 0], temperature: 900, radius: 1, duration: 3 })
    const ev = w.update(0.1)
    expect(types(ev)).toContain('crack')
  })

  it('a gas bottle in a fire explodes and blasts a nearby object', () => {
    const w = createDestruction()
    const bottle = w.add({
      parts: [{ id: 'bottle', material: 'steel', shape: { kind: 'cylinder', radius: 0.1, height: 0.5 }, position: [0, 0, 0], thickness: 0.003, explodes: { energy: 200000, radius: 6, atC: 300 }, contains: { fluid: 'gas', liters: 20, pressurized: true } }],
    })
    const board = w.add(plate('plywood', 0.5, 0.5, 0.01), { position: [1.5, 0, 0] })
    const wall = w.add(plate('concrete', 1, 1, 0.2), { position: [-3, 0, 0] })
    w.hit(bottle, { type: 'fire', point: [0, 0, 0], temperature: 1000, radius: 1, duration: 2 })
    expect(w.part(bottle, 'bottle')!.temperature).toBeGreaterThan(300)
    const events = w.update(0.1)
    expect(types(events)).toContain('explode')
    expect(w.part(bottle, 'bottle')!.status).toBe('broken')
    expect(w.part(board, 'plate')!.status).toBe('broken')
    expect(w.part(wall, 'plate')!.hp).toBeLessThan(w.part(wall, 'plate')!.maxHp)
    const fr = events.find((e) => e.type === 'fracture' && e.object === bottle)
    expect(fr).toBeTruthy()
    if (fr?.type === 'fracture') for (const f of fr.fragments) expect(Math.hypot(...f.velocity)).toBeLessThanOrEqual(41)
  })

  it('an explosion hurts chairs, dents steel and ignites cloth', () => {
    const w = createDestruction()
    const c = w.add(chair(), { position: [2, 0, 0] })
    const door = w.add(plate('steel', 1, 1, 0.002), { position: [0, 0, 2] })
    const cloth = w.add(plate('fabric', 1, 1, 0.002, 'plate', { hp: 1000 }), { position: [0, 2, 0] })
    const res = w.explode([0, 0, 0], 100000, 5)
    expect(res.length).toBe(3)
    expect(w.part(door, 'plate')!.dents.length).toBeGreaterThan(0)
    expect(w.part(door, 'plate')!.status).not.toBe('broken')
    expect(w.part(cloth, 'plate')!.burning).toBe(true)
    expect(w.state(c)!.parts.some((p) => p.status === 'broken')).toBe(true)
  })
})

describe('determinism', () => {
  const script = (w: ReturnType<typeof createDestruction>, ids: string[]) => {
    const ev: DestructionEvent[] = []
    for (let i = 0; i < 40; i++) {
      ev.push(...w.hit(ids[0], { type: 'ballistic', point: [0.2, 0.2, 0.18], direction: [-1, 0, 0], energy: 200, caliber: 9 }).events)
      ev.push(...w.hit(ids[1], { type: 'fire', point: [0, 0, 0], temperature: 900, radius: 1, duration: 0.2 }).events)
      ev.push(...w.update(0.5))
    }
    return ev
  }
  const setup = () => {
    const w = createDestruction({ seed: 7 })
    const a = w.add(chair())
    const b = w.add(plate('wood_soft', 0.4, 0.05, 0.05), { position: [1, 0, 0] })
    return { w, ids: [a, b] }
  }

  it('same seed gives the same events', () => {
    const x = setup()
    const y = setup()
    expect(JSON.stringify(script(x.w, x.ids))).toBe(JSON.stringify(script(y.w, y.ids)))
  })

  it('serialize and load continue exactly like the original', () => {
    const a = setup()
    for (let i = 0; i < 5; i++) a.w.update(0.5)
    a.w.hit(a.ids[1], { type: 'fire', point: [0, 0, 0], temperature: 900, radius: 1, duration: 3 })
    a.w.hit(a.ids[0], { type: 'blunt', point: [0.2, 0.2, 0.18], direction: [-1, 0, 0], energy: 300, radius: 0.05 })
    const snap = JSON.parse(JSON.stringify(a.w.serialize()))
    const b = createDestruction({ seed: 99 })
    b.load(snap)
    expect(JSON.stringify(b.serialize())).toBe(JSON.stringify(snap))
    expect(b.time).toBe(a.w.time)
    const ea = script(a.w, a.ids)
    const eb = script(b, a.ids)
    expect(eb.length).toBeGreaterThan(0)
    expect(JSON.stringify(eb)).toBe(JSON.stringify(ea))
    expect(JSON.stringify(b.serialize())).toBe(JSON.stringify(a.w.serialize()))
  })

  it('on() listeners and onEvent see events in order, and can be removed', () => {
    const seen: string[] = []
    const typed: string[] = []
    const w = createDestruction({ onEvent: (e) => seen.push(e.type) })
    const off = w.on('dent', (e) => typed.push(e.type))
    const star: string[] = []
    w.on('*', (e) => star.push(e.type))
    const id = w.add(plate('steel', 1, 1, 0.01))
    w.hit(id, { type: 'blunt', point: [0, 0, 0.03], direction: [0, 0, -1], energy: 100 })
    expect(typed).toEqual(['dent'])
    expect(star).toEqual(seen)
    off()
    w.hit(id, { type: 'blunt', point: [0.3, 0, 0.03], direction: [0, 0, -1], energy: 100 })
    expect(typed.length).toBe(1)
  })

  it('reset restores the spec', () => {
    const w = createDestruction()
    const id = w.add(chair())
    w.hit(id, { type: 'blunt', point: [0.2, 0.2, 0.18], direction: [-1, 0, 0], energy: 300, radius: 0.05 })
    expect(w.state(id)!.groups.length).toBeGreaterThan(1)
    w.reset(id)
    expect(w.state(id)!.groups.length).toBe(1)
    expect(w.part(id, 'leg_fl')!.status).toBe('intact')
  })
})

describe('performance', () => {
  it('200 objects x 10 parts: 60 updates are cheap, with a few fires', () => {
    const w = createDestruction()
    const ids: string[] = []
    for (let i = 0; i < 200; i++) {
      ids.push(
        w.add(
          {
            parts: Array.from({ length: 10 }, (_, k) => ({
              id: `p${k}`, material: k % 2 ? 'wood_soft' : 'steel', shape: { kind: 'box' as const, size: [0.1, 0.1, 0.1] as [number, number, number] }, position: [k * 0.1, 0, 0] as [number, number, number],
            })),
          },
          { position: [(i % 20) * 2, 0, Math.floor(i / 20) * 2] },
        ),
      )
    }
    for (let i = 0; i < 5; i++) w.hit(ids[i * 40], { type: 'fire', point: [0, 0, 4 * i], temperature: 1000, radius: 0.5, duration: 3 })
    const t0 = performance.now()
    for (let i = 0; i < 60; i++) w.update(1 / 60)
    const idle = performance.now() - t0
    expect(idle).toBeLessThan(200)
    const burning = ids.filter((id) => w.state(id)!.parts.some((p) => p.burning)).length
    expect(burning).toBeGreaterThanOrEqual(5)
  })
})
