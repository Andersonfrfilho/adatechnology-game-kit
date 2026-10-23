import { describe, expect, it } from 'vitest'
import { createWorld } from '@adatechnology/game-interactables'
import { cornersOf } from '../src'
import { SEEDS, boxes, build, localPrims, pack } from './helpers'

const NEW_TYPES = ['bunk_bed', 'wood_stove', 'fireplace', 'outhouse', 'well', 'cooler', 'campfire', 'camp_stove', 'gas_canister', 'lantern_lamp', 'camp_chair', 'camp_table']

function world(region = 'br', locale = 'pt-BR') {
  const hh = pack(region, locale)
  const w = createWorld({ locale: locale as 'en' | 'pt-BR', strings: hh.strings, items: hh.items, loot: hh.loot, seed: 'rural' })
  return { hh, w }
}

const at = (x = 0, z = 0) => ({ x, y: 0, z, ry: 0 })

describe('rural and camping types', () => {
  it('exist, are grouped and named in both locales', () => {
    const hh = pack()
    for (const t of NEW_TYPES) {
      const def = hh.types.find((x) => x.id === t)!
      expect(def, t).toBeTruthy()
      expect(['seating', 'rural', 'camp']).toContain(def.group)
      expect(hh.strings.en[`type.${t}`], t).toBeTruthy()
      expect(hh.strings['pt-BR'][`type.${t}`], t).toBeTruthy()
    }
    expect(pack('br', 'pt-BR').types.find((t) => t.id === 'outhouse')!.name).toBe('Privada de fora')
  })

  it('every type tags the body and every part with destruction data', () => {
    for (const t of NEW_TYPES) {
      const s = build(t, {}).spec
      expect(s.destruction, t).toBeTruthy()
      for (const p of s.parts ?? []) expect(p.destruction, `${t}.${p.id}`).toBeTruthy()
    }
  })

  it('bunk bed: two lie seats at different heights, a ladder and guard rails', () => {
    const b = build('bunk_bed')
    const seats = b.spec.seats!
    expect(seats.map((s) => s.id)).toEqual(['lie_lower', 'lie_upper'])
    expect(seats.every((s) => s.pose === 'lie')).toBe(true)
    expect(seats[1].pos[1] - seats[0].pos[1]).toBeGreaterThan(0.6)
    const rungs = boxes(b.rec.primitives).filter((p) => p.w >= 0.35 && p.w <= 0.45 && p.h <= 0.05 && p.d <= 0.06)
    expect(rungs.length).toBeGreaterThanOrEqual(4)
    const { w } = world()
    w.add('bunk', b.spec, at())
    expect(w.sit('bunk', 'lie_upper', 'a')?.pose).toBe('lie')
    expect(w.sit('bunk', 'lie_lower', 'b')?.pose).toBe('lie')
  })

  it('wood stove: cast iron, door part, pot spot, flue to flueHeight, lights and smokes at the flue top', () => {
    for (const seed of SEEDS) {
      const b = build('wood_stove', { seed, h: 2.1, flueHeight: 2.0 })
      const s = b.spec
      expect(s.destruction).toMatchObject({ material: 'cast_iron' })
      expect(s.parts!.map((p) => p.id)).toEqual(['firebox_door'])
      expect(s.burners![0]).toMatchObject({ needsIgnition: true, fuel: 'wood' })
      expect(s.fuels![0].kind).toBe('wood')
      const smoke = s.emitters!.find((e) => e.kind === 'smoke')!
      expect(smoke.pos[1]).toBeCloseTo(2.02, 2)
      const pipe = b.rec.primitives.filter((p) => p.kind === 'cylinder' && p.r > 0.06 && p.r < 0.08 && p.h > 1)
      expect(pipe.length).toBe(1)
      expect(pipe[0].y + (pipe[0] as { h: number }).h).toBeCloseTo(2.0, 2)
      expect(s.containers!.find((c) => c.id === 'pot_spot')!.slots.length).toBe(1)
      // the firebox is hollow: a back liner and two side liners behind the door opening
      const liners = boxes(b.rec.primitives).filter((p) => p.material === 'plain' && p.d >= 0.25 && p.w <= 0.02)
      expect(liners.length).toBeGreaterThanOrEqual(2)
    }
    const { w } = world()
    w.add('stove', build('wood_stove').spec, at())
    w.update(0.1)
    expect(w.isLit('stove', 'fire')).toBe(false)
    w.act('stove:ignite_fire')
    w.update(0.1)
    expect(w.isLit('stove', 'fire')).toBe(true)
    const kinds = w.emitters().map((e) => e.kind)
    expect(kinds).toContain('fire')
    expect(kinds).toContain('smoke')
    expect(w.fuelLevel('stove', 'wood')).toBeLessThan(8)
    w.act('stove:toggle_fire')
    expect(w.isLit('stove', 'fire')).toBe(false)
  })

  it('fireplace: real firebox depth, hearth, mantel, brick or stone, smoke at chimneyHeight', () => {
    for (const variant of ['brick', 'stone'] as const) {
      const b = build('fireplace', { variant, chimneyHeight: 2.4 })
      const prims = boxes(b.rec.primitives)
      // two inner side faces at least 40 cm deep define the firebox
      expect(prims.filter((p) => p.w <= 0.05 && p.d >= 0.4 && p.h >= 0.5 && p.y < 0.2).length, variant).toBeGreaterThanOrEqual(2)
      expect(prims.some((p) => p.y === 0 && p.h <= 0.12 && p.w >= 1.4 && p.d >= 0.8), 'hearth').toBe(true)
      expect(prims.some((p) => p.material === 'wood' && p.w >= 1.4 && p.h <= 0.1 && p.y > 0.9), 'mantel').toBe(true)
      expect(b.spec.destruction).toMatchObject(variant === 'stone' ? { material: 'stone', joint: 'mortar' } : { material: 'brick', joint: 'mortar' })
      expect(b.spec.burners![0]).toMatchObject({ needsIgnition: true, fuel: 'wood' })
      expect(b.spec.emitters!.find((e) => e.kind === 'smoke')!.pos[1]).toBeCloseTo(2.42, 2)
    }
    const { w } = world()
    w.add('fp', build('fireplace').spec, at())
    w.act('fp:ignite_fire')
    w.update(0.1)
    const e = w.emitters()
    expect(e.map((x) => x.kind).sort()).toEqual(['fire', 'smoke'])
    expect(e.find((x) => x.kind === 'smoke')!.pos[1]).toBeGreaterThan(2.5)
  })

  it('outhouse: hollow booth, door with a crescent cut, seat with a lid, no water', () => {
    for (const seed of SEEDS) {
      const b = build('outhouse', { seed })
      const s = b.spec
      expect(s.parts!.map((p) => p.id).sort()).toEqual(['door', 'seat_lid'])
      expect(s.fixtures).toBeUndefined()
      expect(s.tanks).toBeUndefined()
      expect(s.seats![0]).toMatchObject({ pose: 'sit' })
      const door = localPrims(b, 'door')
      const covered = (x: number, y: number) => boxes(door).some((p) => x >= p.x - p.w / 2 && x <= p.x + p.w / 2 && y >= p.y && y <= p.y + p.h)
      expect(covered(0.3, 1.5), 'plank away from the cut').toBe(true)
      expect(covered(-0.07, 1.5), 'crescent gap').toBe(false)
      expect(covered(-0.07, 1.46), 'crescent gap, lower').toBe(false)
      expect(covered(0.06, 1.53), 'solid inside the moon').toBe(true)
      expect(covered(0.03, 0.5)).toBe(true)
      // hollow: the back wall and both side walls exist and the interior is not filled
      expect(boxes(b.rec.primitives).some((p) => p.y < 0.1 && p.w > 0.9 && p.h <= 0.06), 'floor').toBe(true)
      expect(s.colliders!.map((c) => c.id)).toEqual(expect.arrayContaining(['wall_back', 'wall_left', 'wall_right', 'door']))
    }
    const { w } = world()
    w.add('wc', build('outhouse').spec, at())
    expect(w.colliders().some((c) => c.id === 'wc:door')).toBe(true)
    w.setPart('wc', 'door', 1, true)
    expect(w.colliders().some((c) => c.id === 'wc:door')).toBe(false)
    expect(w.sit('wc', 'seat', 'p')?.pose).toBe('sit')
    for (const l of w.interactables().map((i) => i.label)) expect(l).not.toMatch(/^prompt\./)
  })

  it('well: stone ring with an opening, crank + bucket + rope move together and the bucket yields water from a large tank', () => {
    const b = build('well')
    const s = b.spec
    expect(s.parts!.map((p) => p.id).sort()).toEqual(['bucket', 'crank', 'rope'])
    expect(s.parts!.every((p) => p.group === 'draw')).toBe(true)
    expect(s.parts!.find((p) => p.id === 'bucket')!.motion.kind).toBe('slide')
    expect(s.parts!.find((p) => p.id === 'crank')!.motion.kind).toBe('knob')
    expect(s.tanks![0].capacity).toBeGreaterThanOrEqual(5000)
    expect(s.fixtures![0]).toMatchObject({ kind: 'hose', part: 'bucket', tank: 'well_water' })
    // the ring is open in the middle: no box covers the center above the water
    const prims = boxes(b.rec.primitives)
    expect(prims.filter((p) => p.y >= 0.1 && p.y <= 0.9 && Math.abs(p.x) < 0.3 && Math.abs(p.z) < 0.3 && p.w > 0.1)).toEqual([])
    expect(prims.filter((p) => p.y < 0.5 && p.h > 0.4 && Math.hypot(p.x, p.z) > 0.4).length).toBeGreaterThanOrEqual(12)
    const { w } = world()
    w.add('well', s, at())
    const full = w.water.level('well:well_water')
    expect(full).toBeGreaterThanOrEqual(5000)
    expect(w.water.isFlowing('well', 'water')).toBe(false)
    expect(w.emitters().filter((e) => e.kind === 'water')).toEqual([])
    w.act('well:use_water')
    w.update(1)
    expect(w.partT('well', 'bucket')).toBe(1)
    expect(w.partT('well', 'crank')).toBeGreaterThan(0.9)
    expect(w.partT('well', 'rope')).toBeGreaterThan(0.9)
    expect(w.water.isFlowing('well', 'water')).toBe(true)
    expect(w.emitters().some((e) => e.kind === 'water')).toBe(true)
    expect(w.water.level('well:well_water')).toBeLessThan(full)
    w.act('well:use_water')
    w.update(1)
    expect(w.water.isFlowing('well', 'water')).toBe(false)
    expect(w.partT('well', 'bucket')).toBe(0)
  })

  it('cooler: hollow insulated box, lid hinge at the back, loot from the cooler table', () => {
    for (const seed of SEEDS) {
      const { w, hh } = world()
      const b = build('cooler', { seed })
      expect(b.spec.parts![0]).toMatchObject({ id: 'lid', motion: { kind: 'hinge', axis: [1, 0, 0] } })
      expect(b.spec.parts![0].pivot[2]).toBeCloseTo(-b.dims.d / 2, 2)
      expect(b.spec.containers![0]).toMatchObject({ id: 'cooler', access: 'lid', loot: 'cooler' })
      w.add('c', b.spec, at())
      expect(w.accessible('c', 'cooler')).toBe(false)
      w.setPart('c', 'lid', 1, true)
      const list = w.contents('c', 'cooler')
      const slot = list.findIndex(Boolean)
      expect(slot, `seed ${seed}`).toBeGreaterThanOrEqual(0)
      const names = Object.keys(hh.loot.cooler.entries.map((e) => e.type).reduce<Record<string, 1>>((a, t) => ({ ...a, [t]: 1 }), {}))
      expect(names).toContain(list[slot]!.type)
      expect(w.take('c', 'cooler', slot)).toBeTruthy()
    }
    expect(Object.keys(pack().loot.cooler.entries.map((e) => e.type).reduce<Record<string, 1>>((a, t) => ({ ...a, [t]: 1 }), {}))).toEqual(expect.arrayContaining(['soda_can', 'ice_pack', 'sandwich']))
  })

  it('campfire: lights, burns, smokes; log seats only when the footprint has room', () => {
    const plain = build('campfire')
    expect(plain.spec.seats).toBeUndefined()
    const big = build('campfire', { w: 2.4, d: 2.4 })
    expect(big.spec.seats!.length).toBe(2)
    expect(big.spec.seats![0].ry).not.toBe(big.spec.seats![1].ry)
    const { w } = world()
    w.add('fire', big.spec, at())
    expect(w.sit('fire', 'seat_1', 'p')?.pose).toBe('sit')
    expect(w.isLit('fire', 'fire')).toBe(false)
    w.act('fire:ignite_fire')
    w.update(0.1)
    expect(w.isLit('fire', 'fire')).toBe(true)
    expect(w.emitters().map((e) => e.kind).sort()).toEqual(['fire', 'smoke'])
    const logs = plain.rec.primitives.filter((p) => p.kind === 'cylinder' && p.material === 'wood')
    expect(logs.length).toBeGreaterThanOrEqual(6)
  })

  it('camp stove lights from a small canister; the canister explodes small and has a valve', () => {
    for (const region of ['br', 'us']) {
      const can = build('gas_canister', {}, region).spec
      expect(can.parts!.map((p) => p.id)).toEqual(['valve'])
      expect(can.fuels![0].kind).toBe('gas')
      expect(can.fuels![0].capacity).toBeLessThan(0.5)
      expect(can.destruction!.explodes!.energy).toBeGreaterThan(1000)
      expect(can.destruction!.explodes!.energy).toBeLessThan(50000)
      expect(can.destruction!.explodes!.radius).toBeLessThanOrEqual(4)
      expect(can.destruction!.contains).toMatchObject({ fluid: 'gas', pressurized: true })
      const big = build('gas_bottle', {}, region).spec.destruction!
      expect(can.destruction!.explodes!.energy).toBeLessThan(big.explodes!.energy / 10)
    }
    const { w } = world()
    w.add('stove', build('camp_stove').spec, at())
    w.add('can', build('gas_canister').spec, at(0.4, 0))
    const knob = 'stove:use_burner'
    expect(w.interactables().some((i) => i.id === knob)).toBe(true)
    w.act(knob)
    w.update(0.3)
    expect(w.isLit('stove', 'burner')).toBe(false) // the valve of the canister is closed
    w.act(knob)
    w.act('can:use_gas')
    w.update(0.3)
    w.act(knob)
    w.update(0.3)
    expect(w.isLit('stove', 'burner')).toBe(true)
    expect(w.emitters().some((e) => e.kind === 'flame')).toBe(true)
    expect(w.fuelLevel('can', 'gas')).toBeLessThan(0.23)
  })

  it('lantern: an electric:false lamp, toggled by its wick, with a flame emitter; hanging has no collider', () => {
    const s = build('lantern_lamp').spec
    expect(s.devices![0]).toMatchObject({ kind: 'lamp', electric: false, part: 'wick' })
    expect(s.emitters![0]).toMatchObject({ kind: 'flame', source: 'lamp' })
    const { w } = world()
    w.add('l', s, at())
    expect(w.emitters()).toEqual([])
    w.act('l:toggle_lamp')
    w.update(0.1)
    expect(w.emitters().map((e) => e.kind)).toEqual(['flame'])
    expect(w.power.isPowered('l', 'lamp')).toBe(true) // no grid needed
    w.act('l:toggle_lamp')
    expect(w.emitters()).toEqual([])
    const hung = build('lantern_lamp', { variant: 'hanging', on: true }).spec
    expect(hung.colliders).toBeUndefined()
    expect(hung.devices![0].on).toBe(true)
    expect(build('lantern_lamp').rec.primitives.some((p) => p.kind !== 'leaf' && p.kind !== 'light' && p.material === 'glass')).toBe(true)
  })

  it('camp chair seats one person; camp table is a surface without containers', () => {
    const chair = build('camp_chair')
    expect(chair.spec.seats).toHaveLength(1)
    expect(chair.rec.primitives.filter((p) => p.kind === 'cylinder' && (p.rx !== 0 || p.rz !== 0)).length).toBeGreaterThanOrEqual(4)
    const table = build('camp_table')
    expect(table.spec.containers).toBeUndefined()
    expect(boxes(table.rec.primitives).some((p) => p.w >= 1.1 && p.d >= 0.55 && p.y + p.h > 0.7)).toBe(true)
    const { w } = world()
    w.add('chair', chair.spec, at())
    expect(w.sit('chair', 'seat', 'p')?.pose).toBe('sit')
  })

  it('prompts of the new types are localized in both languages', () => {
    for (const locale of ['en', 'pt-BR']) {
      const { w } = world('br', locale)
      let x = 0
      for (const t of NEW_TYPES) {
        w.add(t, build(t).spec, at((x += 4)))
        w.setPart(t, 'door', 0)
      }
      for (const i of w.interactables()) {
        expect(i.label, `${locale} ${i.id}`).toBeTruthy()
        expect(i.label, `${locale} ${i.id}`).not.toMatch(/^prompt\./)
      }
    }
  })
})

describe('mounting height and variants', () => {
  it('camp stove, canister and lantern follow item.y (they stand on tables)', () => {
    for (const t of ['camp_stove', 'gas_canister', 'lantern_lamp']) {
      const b = build(t, { y: 0.7 })
      let min = Infinity
      for (const p of b.rec.primitives) for (const c of cornersOf(p)) min = Math.min(min, c[1])
      expect(min, t).toBeGreaterThanOrEqual(0.7 - 0.02)
      const maxY = Math.max(...b.rec.primitives.flatMap((p) => cornersOf(p).map((c) => c[1])))
      expect(maxY, t).toBeLessThanOrEqual(0.7 + b.dims.h + 0.02)
    }
  })

  it('service entrance "gato" variant has no meter box, no riser and keeps the drop wire', () => {
    const s = build('service_entrance', { variant: 'gato', house: [0, 3, 8] }).spec
    expect(s.parts).toBeUndefined()
    expect(s.wires!.map((w) => w.id)).toEqual(['drop', 'hook'])
    expect(build('service_entrance', { house: [0, 3, 8] }).spec.parts!.map((p) => p.id)).toEqual(['meter_door'])
  })
})
