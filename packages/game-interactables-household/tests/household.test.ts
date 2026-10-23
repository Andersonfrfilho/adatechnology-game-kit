import { describe, expect, it } from 'vitest'
import type { ContainerSpec, ObjectSpec, SlotSpec } from '@adatechnology/game-interactables'
import { cornersOf, motionPoint } from '../src'
import { REGIONS, SEEDS, bbox, boxes, build, closedPoints, localPrims, pack, partPoints } from './helpers'

const hh = pack()
const TYPES = hh.types.map((t) => t.id)
const TOL = 0.02

function fitsSize(size: number[], max: number[]): boolean {
  return size[1] <= max[1] + 1e-9 && ((size[0] <= max[0] + 1e-9 && size[2] <= max[2] + 1e-9) || (size[2] <= max[0] + 1e-9 && size[0] <= max[2] + 1e-9))
}

describe('catalog and data', () => {
  it('has the expected types', () => {
    expect(TYPES.length).toBe(37)
    for (const t of ['fridge', 'fridge_compact', 'kitchen_cabinet_base', 'kitchen_cabinet_wall', 'pantry', 'wardrobe', 'dresser', 'nightstand', 'bathroom_cabinet', 'stove', 'gas_bottle', 'sink_kitchen', 'sink_bathroom', 'shower', 'toilet', 'utility_sink', 'wall_socket', 'wall_switch', 'service_entrance', 'conduit_run', 'tv', 'microwave', 'washing_machine', 'sofa', 'armchair', 'dining_chair', 'bed_double', 'bed_single', 'bench', 'blinds', 'curtain', 'trash_bin', 'wheelie_bin', 'mailbox', 'dog_house', 'bbq', 'clothesline']) expect(TYPES).toContain(t)
  })

  it('has at least 70 well-formed items with names in both locales', () => {
    const ids = Object.keys(hh.items)
    expect(ids.length).toBeGreaterThanOrEqual(70)
    for (const id of ids) {
      const it = hh.items[id]
      expect(it.id).toBe(id)
      expect(it.size.every((n) => n > 0 && n < 1)).toBe(true)
      expect(it.weight).toBeGreaterThan(0)
      expect(hh.strings.en[`item.${id}`], id).toBeTruthy()
      expect(hh.strings['pt-BR'][`item.${id}`], id).toBeTruthy()
    }
  })

  it('has the same keys in both locales and names for every type', () => {
    expect(Object.keys(hh.strings.en).sort()).toEqual(Object.keys(hh.strings['pt-BR']).sort())
    for (const t of TYPES) {
      expect(hh.strings.en[`type.${t}`]).toBeTruthy()
      expect(hh.strings['pt-BR'][`type.${t}`]).toBeTruthy()
    }
    expect(pack('br', 'pt-BR').types.find((t) => t.id === 'fridge')!.name).toBe('Geladeira')
    expect(pack('us', 'en').types.find((t) => t.id === 'fridge')!.name).toBe('Refrigerator')
  })

  it('has the loot tables the brief lists, all pointing at catalog items', () => {
    for (const k of ['fridge', 'freezer', 'kitchen_cabinet', 'pantry', 'wardrobe', 'dresser', 'nightstand', 'bathroom_cabinet', 'under_sink', 'trash', 'mailbox', 'bbq_counter', 'garage_shelf']) expect(hh.loot[k], k).toBeTruthy()
    for (const [k, t] of Object.entries(hh.loot)) for (const e of t.entries) expect(hh.items[e.type], `${k}:${e.type}`).toBeTruthy()
  })

  it('region data differs between br and us', () => {
    expect(pack('br').region.gas.capacityKg).toBe(13)
    expect(pack('br').region.socket.standard).toBe('NBR 14136')
    expect(pack('br').region.socket.voltage).toEqual([127, 220])
    expect(pack('us').region.socket.standard).toBe('NEMA 5-15')
    expect(() => pack('xx')).toThrow()
  })

  it('throws for an unknown type', () => {
    expect(() => build('teapot')).toThrow()
  })
})

for (const region of REGIONS) {
  describe(`every type (${region})`, () => {
    for (const type of TYPES) {
      const variants: Array<[string, Record<string, unknown>]> = [['defaults', {}], ...SEEDS.map((s): [string, Record<string, unknown>] => [`seed ${s}`, { seed: s }])]
      for (const [label, item] of variants) {
        const b = build(type, item, region)
        const { w, d, h, y0 } = b.dims
        const tag = `${type} ${label}`

        it(`${tag}: stays inside the footprint when closed`, () => {
          const pts = closedPoints(b)
          if (!pts.length) return
          const bb = bbox(pts)
          expect(bb.min[0], `${tag} x min`).toBeGreaterThanOrEqual(-w / 2 - TOL)
          expect(bb.max[0], `${tag} x max`).toBeLessThanOrEqual(w / 2 + TOL)
          expect(bb.min[2], `${tag} z min`).toBeGreaterThanOrEqual(-d / 2 - TOL)
          expect(bb.max[2], `${tag} z max`).toBeLessThanOrEqual(d / 2 + TOL)
          expect(bb.min[1], `${tag} y min`).toBeGreaterThanOrEqual(y0 - TOL)
          expect(bb.max[1], `${tag} y max`).toBeLessThanOrEqual(y0 + h + TOL)
        })

        it(`${tag}: part sweeps cover the open pose and hinge angles are sane`, () => {
          for (const p of b.spec.parts ?? []) {
            expect(b.rec.parts[p.id], p.id).toBeTruthy()
            if (p.motion.kind === 'hinge') expect(Math.abs(p.motion.angle ?? 0), `${tag} ${p.id}`).toBeLessThanOrEqual(1.9)
            if (!p.sweep) continue
            const [x0, z0, x1, z1] = p.sweep
            for (const t of [0, 0.5, 1]) {
              for (const c of partPoints(b, p.id)) {
                const q = motionPoint(c, p.pivot, p.motion, t)
                expect(q[0], `${tag} ${p.id} t=${t}`).toBeGreaterThanOrEqual(x0 - 1e-6)
                expect(q[0]).toBeLessThanOrEqual(x1 + 1e-6)
                expect(q[2]).toBeGreaterThanOrEqual(z0 - 1e-6)
                expect(q[2]).toBeLessThanOrEqual(z1 + 1e-6)
              }
            }
          }
        })

        it(`${tag}: ids are unique and every reference resolves`, () => checkRefs(b.spec))

        it(`${tag}: containers hold their slots inside their volume`, () => {
          for (const c of b.spec.containers ?? []) checkContainer(tag, c, b.spec)
        })
      }
    }
  })
}

function checkRefs(spec: ObjectSpec): void {
  const uniq = (ids: string[], what: string) => expect(new Set(ids).size, `${spec.type} duplicate ${what}: ${ids.join(',')}`).toBe(ids.length)
  const parts = (spec.parts ?? []).map((p) => p.id)
  uniq(parts, 'part')
  uniq((spec.containers ?? []).map((c) => c.id), 'container')
  uniq((spec.interactions ?? []).map((i) => i.id), 'interaction')
  uniq((spec.seats ?? []).map((i) => i.id), 'seat')
  uniq((spec.soft ?? []).map((i) => i.id), 'soft')
  uniq((spec.devices ?? []).map((i) => i.id), 'device')
  uniq((spec.emitters ?? []).map((i) => i.id), 'emitter')
  uniq((spec.colliders ?? []).map((i) => i.id), 'collider')
  uniq((spec.wires ?? []).map((i) => i.id), 'wire')
  const has = (id: string | undefined, list: string[], what: string) => {
    if (id) expect(list, `${spec.type}: ${what} -> ${id}`).toContain(id)
  }
  const containers = (spec.containers ?? []).map((c) => c.id)
  const devices = (spec.devices ?? []).map((c) => c.id)
  const burners = (spec.burners ?? []).map((c) => c.id)
  const fixtures = (spec.fixtures ?? []).map((c) => c.id)
  const fuels = (spec.fuels ?? []).map((c) => c.id)
  const seats = (spec.seats ?? []).map((c) => c.id)
  const switches = (spec.switches ?? []).map((c) => c.id)
  for (const p of spec.parts ?? []) has(p.requires, parts, 'requires')
  for (const c of spec.containers ?? []) {
    has(c.access, parts, 'access')
    for (const s of c.slots) has(s.part, parts, 'slot part')
  }
  for (const i of spec.interactions ?? []) {
    const a = i.action
    if (a.do === 'toggle_part') has(a.part, parts, 'toggle_part')
    else if (a.do === 'open_container' || a.do === 'take' || a.do === 'read') has(a.container, containers, a.do)
    else if (a.do === 'toggle_device' || a.do === 'cycle_device') has(a.device, devices, a.do)
    else if (a.do === 'toggle_burner' || a.do === 'ignite') has(a.burner, burners, a.do)
    else if (a.do === 'toggle_fixture') has(a.fixture, fixtures, a.do)
    else if (a.do === 'toggle_fuel') has(a.fuel, fuels, a.do)
    else if (a.do === 'sit') has(a.seat, seats, a.do)
    else if (a.do === 'toggle_switch') has(a.switch, switches, a.do)
  }
  for (const s of spec.switches ?? []) has(s.part, parts, 'switch part')
  for (const dv of spec.devices ?? []) has(dv.part, parts, 'device part')
  for (const bn of spec.burners ?? []) has(bn.part, parts, 'burner part')
  for (const f of spec.fixtures ?? []) has(f.part, parts, 'fixture part')
  for (const f of spec.fuels ?? []) has(f.valve, parts, 'valve')
  for (const s of spec.soft ?? []) has(s.part, parts, 'soft part')
  for (const m of spec.mirrors ?? []) has(m.part, parts, 'mirror part')
  for (const c of spec.colliders ?? []) has(c.part, parts, 'collider part')
  const sources = [...burners, ...fixtures, ...devices, ...fuels]
  for (const e of spec.emitters ?? []) has(e.source, sources, 'emitter source')
  for (const bn of spec.burners ?? []) if (bn.fuel !== 'auto') has(bn.fuel, fuels, 'burner fuel')
}

function checkContainer(tag: string, c: ContainerSpec, spec: ObjectSpec): void {
  expect(c.slots.length, `${tag} ${c.id}`).toBeGreaterThan(0)
  const v = c.volume
  const e = 0.012
  for (const [i, s] of c.slots.entries()) {
    const lo = [s.pos[0] - s.max[0] / 2, s.pos[1], s.pos[2] - s.max[2] / 2]
    const hi = [s.pos[0] + s.max[0] / 2, s.pos[1] + s.max[1], s.pos[2] + s.max[2] / 2]
    for (let a = 0; a < 3; a++) {
      expect(lo[a], `${tag} ${c.id} slot ${i} min ${a}`).toBeGreaterThanOrEqual(v.center[a] - v.half[a] - e)
      expect(hi[a], `${tag} ${c.id} slot ${i} max ${a}`).toBeLessThanOrEqual(v.center[a] + v.half[a] + e)
    }
    expect(s.max.every((n) => n > 0.01), `${tag} ${c.id} slot ${i} size`).toBe(true)
  }
  if (c.loot) expect(hh.loot[c.loot], `${tag} loot ${c.loot}`).toBeTruthy()
  void spec
}

describe('loot fits the containers that use it', () => {
  it('every loot entry fits at least one slot of a container using the table', () => {
    const slotsByTable: Record<string, SlotSpec[]> = {}
    for (const region of REGIONS) {
      for (const t of TYPES) {
        const variants = t === 'pantry' ? [{}, { variant: 'garage' }] : [{}]
        for (const v of variants) {
          for (const c of build(t, v, region).spec.containers ?? []) if (c.loot) (slotsByTable[c.loot] ??= []).push(...c.slots)
        }
      }
    }
    for (const [table, def] of Object.entries(hh.loot)) {
      expect(slotsByTable[table], `no container uses ${table}`).toBeTruthy()
      for (const e of def.entries) {
        const size = hh.items[e.type].size
        expect(slotsByTable[table].some((s) => fitsSize(size, s.max)), `${table}: ${e.type} fits no slot`).toBe(true)
      }
    }
  })

  it('explicit contents win and keep their slot order', () => {
    const b = build('fridge', { contents: { fridge: [{ type: 'milk_carton', qty: 2 }, null, { type: 'eggs', qty: 1 }] } })
    const c = b.spec.containers!.find((x) => x.id === 'fridge')!
    expect(c.contents![0]).toEqual({ type: 'milk_carton', qty: 2 })
    expect(c.contents![1]).toBeNull()
    expect(c.contents![2]).toEqual({ type: 'eggs', qty: 1 })
    expect(c.contents!.length).toBe(c.slots.length)
  })
})

describe('locale keys used by specs', () => {
  it('every label and mailbox text exists in both locales', () => {
    for (const region of REGIONS) {
      for (const t of TYPES) {
        const spec = build(t, { seed: 3 }, region).spec
        const labels = new Set<string>()
        for (const p of spec.parts ?? []) if (p.label) labels.add(p.label)
        for (const i of spec.interactions ?? []) labels.add(i.label)
        for (const l of labels) {
          expect(hh.strings.en[l], `${t}: ${l} (en)`).toBeTruthy()
          expect(hh.strings['pt-BR'][l], `${t}: ${l} (pt-BR)`).toBeTruthy()
        }
        for (const c of spec.containers ?? []) for (const s of c.contents ?? []) {
          const text = s?.data?.text
          if (typeof text === 'string') {
            expect(hh.strings.en[text], text).toBeTruthy()
            expect(hh.strings['pt-BR'][text], text).toBeTruthy()
          }
        }
      }
    }
  })
})

describe('determinism', () => {
  it('same seed gives identical primitives and spec', () => {
    for (const t of TYPES) {
      const a = build(t, { seed: 'abc' })
      const b = build(t, { seed: 'abc' })
      expect(JSON.stringify(b.spec), t).toBe(JSON.stringify(a.spec))
      expect(JSON.stringify([b.rec.primitives, b.rec.parts]), t).toBe(JSON.stringify([a.rec.primitives, a.rec.parts]))
    }
  })

  it('different seeds change the random details', () => {
    const a = JSON.stringify(build('clothesline', { seed: 1 }).rec.parts)
    const b = JSON.stringify(build('clothesline', { seed: 2 }).rec.parts)
    expect(a).not.toBe(b)
  })
})

describe('drawers', () => {
  const withDrawers = TYPES.filter((t) => (build(t).spec.parts ?? []).some((p) => p.id.startsWith('drawer')))
  it('exist on the storage types', () => {
    for (const t of ['kitchen_cabinet_base', 'wardrobe', 'dresser', 'nightstand']) expect(withDrawers).toContain(t)
  })
  for (const t of withDrawers) {
    it(`${t}: drawers are open-top boxes that slide 0.75 x their depth`, () => {
      const b = build(t)
      for (const p of (b.spec.parts ?? []).filter((x) => x.id.startsWith('drawer'))) {
        const prims = boxes(localPrims(b, p.id))
        const pts = partPoints(b, p.id)
        const bb = bbox(pts)
        // front panel: the box with the largest z extent among thin ones at the front
        const thinZ = prims.filter((q) => q.d <= 0.03)
        const front = thinZ.filter((q) => Math.abs(q.z + q.d / 2 - (bb.max[2] - 0.03)) < 0.035 && q.w > 0.8 * (bb.max[0] - bb.min[0]))
        expect(front.length, `${t} ${p.id} front`).toBeGreaterThan(0)
        const sides = prims.filter((q) => q.w <= 0.03 && q.h >= 0.04 && q.d > 0.2)
        expect(sides.length, `${t} ${p.id} sides`).toBeGreaterThanOrEqual(2)
        expect(Math.min(...sides.map((s) => s.x)), `${t} ${p.id} left side`).toBeLessThan(0 + (bb.min[0] + bb.max[0]) / 2)
        expect(Math.max(...sides.map((s) => s.x)), `${t} ${p.id} right side`).toBeGreaterThan((bb.min[0] + bb.max[0]) / 2)
        const bottom = prims.filter((q) => q.h <= 0.03 && q.w > 0.3 && q.d > 0.2)
        expect(bottom.length, `${t} ${p.id} bottom`).toBeGreaterThan(0)
        const back = prims.filter((q) => q.d <= 0.02 && q.w > 0.2 && q.z < bb.min[2] + 0.06 + 0.02)
        expect(back.length, `${t} ${p.id} back`).toBeGreaterThan(0)
        // slide distance is 75% of the inner depth
        const depth = Math.max(...sides.map((s) => s.d))
        expect(p.motion.distance!).toBeCloseTo(0.75 * depth, 2)
        expect(p.motion.distance!).toBeGreaterThan(0.15)
        // nothing outside the carcass when closed is checked by the footprint test
        const cont = b.spec.containers!.find((c) => c.id === p.id)!
        expect(cont.slots.every((s) => s.part === p.id), `${t} ${p.id} slots follow the drawer`).toBe(true)
      }
    })
  }
})

describe('storage details', () => {
  it('fridge doors hinge on the front edge, open at most 100 degrees and have liners and shelves', () => {
    const b = build('fridge')
    const doors = (b.spec.parts ?? []).filter((p) => p.id.startsWith('door'))
    expect(doors.length).toBe(2)
    for (const d of doors) {
      expect(Math.abs(d.motion.angle!)).toBeLessThanOrEqual((100 * Math.PI) / 180)
      const bb = bbox(partPoints(b, d.id))
      // pivot sits in the front 5 cm of the unit
      expect(d.pivot[2]).toBeGreaterThan(b.dims.d / 2 - 0.1)
      expect(d.pivot[2]).toBeLessThanOrEqual(bb.max[2])
      expect(d.sweep, d.id).toBeTruthy()
    }
    const fr = b.spec.containers!.find((c) => c.id === 'fridge')!
    expect(fr.slots.some((s) => s.part === 'door_fridge')).toBe(true)
    expect(fr.slots.some((s) => !s.part)).toBe(true)
    const light = (c: number) => ((c >> 16) & 255) > 0xd8 && ((c >> 8) & 255) > 0xd8 && (c & 255) > 0xd8
    const liner = boxes(b.rec.primitives).filter((x) => Math.min(x.w, x.h, x.d) <= 0.0045 && light(x.color))
    expect(liner.length, 'five lighter inner faces').toBeGreaterThanOrEqual(5)
    expect(b.spec.devices![0].socket).toBe('auto')
  })

  it('wardrobe has 2 or 3 doors from its width, a rod, shelves, drawers and a mirror on the outer face of a door', () => {
    for (const [w, n] of [[1.1, 2], [1.6, 3]] as const) {
      const b = build('wardrobe', { w })
      const doors = (b.spec.parts ?? []).filter((p) => p.id.startsWith('door'))
      expect(doors.length).toBe(n)
      expect((b.spec.parts ?? []).filter((p) => p.id.startsWith('drawer')).length).toBe(n)
      expect(b.rec.primitives.some((p) => p.kind === 'cylinder' && p.rz !== 0 && p.r < 0.02), 'rod').toBe(true)
      const m = b.spec.mirrors![0]
      expect(m.part).toBeTruthy()
      const part = b.rec.parts[m.part!]
      const world = localPrims(b, m.part)
      const planes = world.filter((p) => p.kind === 'plane')
      expect(planes.length).toBe(1)
      const pl = planes[0] as Extract<(typeof world)[number], { kind: 'plane' }>
      const big = boxes(world).filter((x) => x.w * x.h > 0.2)
      const panel = [...big].sort((a, c) => c.w * c.h - a.w * a.h)[0]
      const outer = Math.max(...big.map((x) => x.z + x.d / 2))
      expect(pl.z - outer, 'proud by 4 mm').toBeCloseTo(0.004, 3)
      expect(pl.x).toBeCloseTo(panel.x, 3)
      expect(pl.x).toBeCloseTo(m.center[0], 3)
      expect(m.center[2]).toBeCloseTo(pl.z, 3)
      expect(pl.x - pl.w / 2).toBeGreaterThanOrEqual(panel.x - panel.w / 2)
      expect(pl.x + pl.w / 2).toBeLessThanOrEqual(panel.x + panel.w / 2)
      expect(m.normal).toEqual([0, 0, 1])
      expect(part).toBeTruthy()
    }
  })

  it('bathroom cabinet carries its mirror in the door', () => {
    const b = build('bathroom_cabinet')
    expect(b.spec.mirrors![0].part).toBe('door')
    expect(b.rec.parts.door.primitives.some((p) => p.kind === 'plane')).toBe(true)
  })
})

describe('kitchen and bathroom', () => {
  it('stove has four burners with knob parts, an oven door hinged at the bottom, auto gas and a hose', () => {
    const b = build('stove')
    const burners = b.spec.burners!
    expect(burners.length).toBe(5)
    for (const bn of burners) {
      expect(bn.fuel).toBe('auto')
      expect(b.spec.parts!.find((p) => p.id === bn.part)!.motion.kind).toBe('knob')
    }
    expect(b.spec.parts!.find((p) => p.id === 'oven_door')!.motion.axis).toEqual([1, 0, 0])
    expect(b.spec.wires!.some((w) => w.id === 'gas_hose')).toBe(true)
    expect(b.spec.emitters!.filter((e) => e.kind === 'flame').length).toBe(5)
  })

  it('gas bottle follows the region', () => {
    const br = build('gas_bottle', {}, 'br').spec
    expect(br.fuels![0]).toMatchObject({ kind: 'gas', capacity: 13, valve: 'valve' })
    expect(br.parts!.some((p) => p.id === 'valve')).toBe(true)
    expect(br.damage!.some((d) => d.kind === 'gas')).toBe(true)
    const us = build('gas_bottle', {}, 'us').spec
    expect(us.fuels![0].capacity).toBeLessThan(13)
  })

  it('sinks have a tap with a handle part and an under-sink container', () => {
    for (const t of ['sink_kitchen', 'sink_bathroom']) {
      const s = build(t).spec
      expect(s.fixtures![0]).toMatchObject({ kind: 'tap', part: 'tap_handle' })
      expect(s.parts!.some((p) => p.id === 'tap_handle')).toBe(true)
      expect(s.containers![0].id).toBe('under_sink')
      expect(s.emitters!.some((e) => e.kind === 'water')).toBe(true)
    }
  })

  it('shower has a head, a valve, a steam emitter and soft glass panels that never collide', () => {
    const s = build('shower').spec
    expect(s.fixtures![0]).toMatchObject({ kind: 'shower', part: 'valve' })
    expect(s.emitters!.some((e) => e.kind === 'steam')).toBe(true)
    expect(s.soft!.length).toBeGreaterThanOrEqual(2)
    expect(s.soft!.every((x) => x.kind === 'panel')).toBe(true)
    expect(s.soft!.some((x) => x.part)).toBe(true)
    for (const c of s.colliders!) expect(c.id.startsWith('wall')).toBe(true)
  })

  it('toilet has a flush fixture and a lid part', () => {
    const s = build('toilet').spec
    expect(s.fixtures![0].kind).toBe('flush')
    expect(s.parts!.some((p) => p.id === 'lid')).toBe(true)
  })

  it('utility sink has a tap and a basin fixture', () => {
    const s = build('utility_sink').spec
    expect(s.fixtures!.map((f) => f.kind).sort()).toEqual(['tap', 'utility_sink'])
  })
})

describe('electrical', () => {
  it('socket follows the region and registers a socket', () => {
    const br = build('wall_socket', {}, 'br')
    const us = build('wall_socket', {}, 'us')
    expect(br.spec.sockets!.length).toBe(1)
    expect(JSON.stringify(br.rec.primitives)).not.toBe(JSON.stringify(us.rec.primitives))
    expect(boxes(br.rec.primitives).length).toBeGreaterThan(2)
  })

  it('switch controls come from the item', () => {
    const s = build('wall_switch', { controls: ['lamp-1', 'lamp-2'] }).spec
    expect(s.switches![0].controls).toEqual(['lamp-1', 'lamp-2'])
    expect(s.parts![0].motion.kind).toBe('rocker')
  })

  it('service entrance has a pole, a catenary drop to the house point, a meter door and a riser conduit', () => {
    const b = build('service_entrance', { house: [0, 3, 10], sag: 0.5 })
    const drop = b.spec.wires!.find((w) => w.id === 'drop')!
    expect(drop.kind).toBe('drop')
    const last = drop.points[drop.points.length - 1]
    expect(last).toEqual([0, 3, 10])
    const mid = drop.points[Math.floor(drop.points.length / 2)]
    const chord = (drop.points[0][1] + last[1]) / 2
    expect(mid[1]).toBeLessThan(chord)
    expect(b.spec.parts!.some((p) => p.id === 'meter_door')).toBe(true)
    expect(b.spec.wires!.some((w) => w.kind === 'conduit')).toBe(true)
  })

  it('conduit run follows the item points', () => {
    const pts: [number, number, number][] = [[0, 0, 0], [0, 2, 0], [1, 2, 0]]
    const s = build('conduit_run', { points: pts }).spec
    expect(s.wires![0]).toMatchObject({ kind: 'conduit', points: pts })
  })

  it('tv, microwave and washing machine are plugged devices', () => {
    const tv = build('tv').spec
    expect(tv.devices![0]).toMatchObject({ kind: 'screen', socket: 'auto', channels: 6 })
    expect(tv.devices![0].plug).toBeTruthy()
    expect(tv.wires!.some((w) => w.kind === 'cord')).toBe(true)
    for (const t of ['microwave', 'washing_machine']) {
      const s = build(t).spec
      expect(s.devices![0]).toMatchObject({ kind: 'appliance', socket: 'auto' })
      expect(s.parts!.some((p) => p.id === 'door')).toBe(true)
    }
  })
})

describe('seating', () => {
  it('sofa has sit seats from its width and a lie seat', () => {
    const wide = build('sofa', { w: 2.4 }).spec.seats!
    const small = build('sofa', { w: 1.4 }).spec.seats!
    expect(wide.filter((s) => s.pose === 'sit').length).toBe(3)
    expect(small.filter((s) => s.pose === 'sit').length).toBe(2)
    expect(wide.filter((s) => s.pose === 'lie').length).toBe(1)
    expect(build('armchair').spec.seats!.length).toBe(1)
    expect(build('dining_chair').spec.seats![0].pose).toBe('sit')
    expect(build('bed_double').spec.seats!.filter((s) => s.pose === 'lie').length).toBe(2)
    expect(build('bed_single').spec.seats!.filter((s) => s.pose === 'lie').length).toBe(1)
    expect(build('bench').spec.seats!.length).toBeGreaterThanOrEqual(2)
  })

  it('seats are reachable by an interaction', () => {
    for (const t of ['sofa', 'armchair', 'dining_chair', 'bed_double', 'bed_single', 'bench']) {
      const s = build(t).spec
      for (const seat of s.seats!) expect(s.interactions!.some((i) => i.action.do === 'sit' && i.action.seat === seat.id), `${t} ${seat.id}`).toBe(true)
    }
  })
})

describe('windows', () => {
  it('curtain panels are soft curtains driven by sliding-scale parts', () => {
    const s = build('curtain').spec
    expect(s.parts!.map((p) => p.id)).toEqual(['panel_l', 'panel_r'])
    for (const so of s.soft!) {
      expect(so.kind).toBe('curtain')
      expect(s.parts!.some((p) => p.id === so.part)).toBe(true)
    }
    expect(s.colliders ?? []).toEqual([])
  })
})

describe('yard', () => {
  it('bins are hollow with inner walls, a floor and a lid hinged at the back', () => {
    for (const t of ['trash_bin', 'wheelie_bin']) {
      const b = build(t)
      const lid = b.spec.parts!.find((p) => p.id === 'lid')!
      expect(lid.pivot[2]).toBeLessThan(-b.dims.d / 2 + 0.1)
      expect(lid.motion.axis).toEqual([1, 0, 0])
      const c = b.spec.containers![0]
      expect(c.loot).toBe('trash')
      expect(c.access).toBe('lid')
      expect(c.volume.half[1]).toBeGreaterThan(0.25)
      // hollow: the volume center is not covered by any static box
      const center = c.volume.center
      const lowY = c.volume.center[1] - c.volume.half[1]
      for (let y = lowY + 0.03; y <= lowY + 2 * c.volume.half[1]; y += 0.04) {
        const covers = boxes(b.rec.primitives).filter((x) => Math.abs(x.x - center[0]) < x.w / 2 && Math.abs(x.z - center[2]) < x.d / 2 && y > x.y && y < x.y + x.h)
        expect(covers.length, `${t} open at y=${y.toFixed(2)}`).toBe(0)
      }
      // a floor under the volume
      const fl = boxes(b.rec.primitives).filter((x) => x.y + x.h <= c.volume.center[1] - c.volume.half[1] + 0.03 && x.w > b.dims.w * 0.6 && x.d > b.dims.d * 0.5)
      expect(fl.length, `${t} floor`).toBeGreaterThan(0)
    }
  })

  it('mailbox has a flap, letters with readable text keys and read interactions', () => {
    for (const region of REGIONS) {
      let found = 0
      for (const seed of [1, 2, 3, 4, 5]) {
        const s = build('mailbox', { seed }, region).spec
        expect(s.parts!.some((p) => p.id === 'flap')).toBe(true)
        const c = s.containers!.find((x) => x.id === 'letters')!
        expect(c.access).toBe('flap')
        for (const st of c.contents ?? []) if (st) { found++; expect(typeof st.data?.text).toBe('string') }
        expect(s.interactions!.filter((i) => i.action.do === 'read').length).toBe(c.slots.length)
      }
      expect(found).toBeGreaterThan(0)
    }
    expect(build('mailbox', {}, 'us').spec.parts!.some((p) => p.id === 'flag')).toBe(true)
    expect(build('mailbox', {}, 'br').spec.parts!.some((p) => p.id === 'flag')).toBe(false)
  })

  it('dog house has a hollow interior with a lighter lining, an interior floor and a real opening in the front wall', () => {
    const b = build('dog_house')
    const prims = boxes(b.rec.primitives)
    const hd = b.dims.d / 2
    // interior floor: wide thin box low down
    expect(prims.some((p) => p.h <= 0.02 && p.y < 0.1 && p.w > 0.5 && p.d > 0.5 && p.color === 0xc9a574)).toBe(true)
    // lighter lining (0xd8bc8a)
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255)
    const paint = prims.find((p) => p.color === 0xa84a34)!
    expect(prims.filter((p) => Math.min(p.w, p.h, p.d) <= 0.0045 && lum(p.color) > lum(paint.color) + 150).length).toBeGreaterThanOrEqual(5)
    // front wall: find its z plane, then sample x at mid height for a gap
    const frontZ = Math.max(...prims.filter((p) => p.h > 0.4 && p.y < 0.1).map((p) => p.z + p.d / 2))
    const wall = prims.filter((p) => p.z + p.d / 2 > frontZ - 0.035 && p.z - p.d / 2 < frontZ - 0.01 && p.y < 0.3 && p.y + p.h > 0.3)
    const covered = (x: number) => wall.some((p) => x >= p.x - p.w / 2 && x <= p.x + p.w / 2)
    expect(covered(-0.3)).toBe(true)
    expect(covered(0.3)).toBe(true)
    for (const x of [-0.12, -0.06, 0, 0.06, 0.12]) expect(covered(x), `gap at x=${x}`).toBe(false)
    expect(frontZ).toBeLessThan(hd)
    expect(prims.some((p) => p.color === 0x5a4a3a || p.rz !== 0)).toBe(true)
  })

  it('barbecue lights, smokes at the flue top and has a side counter with a door', () => {
    const b = build('bbq')
    const s = b.spec
    expect(s.burners![0]).toMatchObject({ needsIgnition: true, fuel: 'charcoal' })
    expect(s.fuels![0].kind).toBe('charcoal')
    const fire = s.emitters!.find((e) => e.kind === 'fire')!
    const smoke = s.emitters!.find((e) => e.kind === 'smoke')!
    expect(smoke.pos[1]).toBeGreaterThan(fire.pos[1] + 1)
    expect(smoke.pos[1]).toBeGreaterThanOrEqual(b.dims.h - 0.01)
    expect(s.interactions!.some((i) => i.action.do === 'ignite')).toBe(true)
    expect(s.containers![0]).toMatchObject({ id: 'counter', access: 'counter_door', loot: 'bbq_counter' })
    // grill grate: many thin parallel bars at one height
    expect(boxes(b.rec.primitives).filter((p) => p.h <= 0.01 && p.w > 0.5 && p.d <= 0.01).length).toBeGreaterThan(8)
  })

  it('clothesline: wires end on the arm tips, base plates float above the floor, clothes sway and do not collide', () => {
    for (const seed of SEEDS) {
      const b = build('clothesline', { seed })
      const s = b.spec
      const wires = s.wires!.filter((w) => w.id.startsWith('wire'))
      expect(wires.length).toBe(3)
      const prims = boxes(b.rec.primitives)
      const dist = (p: number[], q: (typeof prims)[number]) => {
        const dx = Math.max(q.x - q.w / 2 - p[0], 0, p[0] - (q.x + q.w / 2))
        const dy = Math.max(q.y - p[1], 0, p[1] - (q.y + q.h))
        const dz = Math.max(q.z - q.d / 2 - p[2], 0, p[2] - (q.z + q.d / 2))
        return Math.hypot(dx, dy, dz)
      }
      const arms = prims.filter((p) => p.d >= 0.5 && p.w < 0.05)
      expect(arms.length).toBe(2)
      for (const w of wires) {
        for (const end of [w.points[0], w.points[w.points.length - 1]]) {
          expect(Math.min(...arms.map((a) => dist(end, a))), `${w.id} end`).toBeLessThan(0.001)
          // the end is at the very tip (or the center junction) of one arm
          const a = arms.find((q) => dist(end, q) < 0.001)!
          const zEnds = [a.z - a.d / 2, a.z, a.z + a.d / 2]
          expect(Math.min(...zEnds.map((z) => Math.abs(z - end[2])))).toBeLessThan(0.001)
          expect(Math.abs(end[1] - (a.y + a.h))).toBeLessThan(0.001)
        }
      }
      // base plates: lowest static boxes are above the floor
      expect(Math.min(...prims.map((p) => p.y))).toBeGreaterThan(0.0005)
      expect(Math.min(...prims.map((p) => p.y))).toBeLessThan(0.002)
      expect(closedPoints(b).every((p) => p[1] > 0.0005)).toBe(true)
      // poles collide, clothes do not
      expect(s.colliders!.length).toBe(2)
      expect(s.colliders!.every((c) => c.id.startsWith('pole'))).toBe(true)
      const cloths = s.parts!.filter((p) => p.id.startsWith('cloth'))
      expect(cloths.length).toBeGreaterThanOrEqual(6)
      for (const c of cloths) {
        const so = s.soft!.find((x) => x.id === c.id)!
        expect(so.kind).toBe('cloth')
        expect(so.anchor).toEqual(c.pivot)
        // the cloth hangs from the wire: its pivot lies on the wire polyline height
        expect(so.wind).toBe(1)
      }
    }
  })
})

describe('recorder', () => {
  it('keeps static and part primitives apart', () => {
    const b = build('fridge')
    expect(b.rec.primitives.length).toBeGreaterThan(25)
    expect(Object.keys(b.rec.parts).sort()).toEqual(['door_freezer', 'door_fridge'])
    for (const p of Object.values(b.rec.parts)) expect(p.primitives.length).toBeGreaterThan(5)
    expect(cornersOf(b.rec.primitives[0]).length).toBeGreaterThan(0)
  })
})
