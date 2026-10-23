import { describe, expect, it } from 'vitest'
import { buildFrame, createDestruction, partCapacity, MATERIALS, resolveStrings } from '../src'
import type { DestructibleSpec, DestructionEvent, DestructionWorld, JointSpec, PartSpec } from '../src'
import { chair } from './helpers'

const types = (e: DestructionEvent[]) => e.map((x) => x.type)

/** Four concrete columns under a slab. `weak` columns get 5 hp so one blow removes them. */
const slabSpec = (weak: number[] = [], extra: { wall?: boolean; partition?: boolean } = {}): DestructibleSpec => {
  const pos: Array<[number, number]> = [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]
  const parts: PartSpec[] = []
  const joints: JointSpec[] = []
  pos.forEach(([x, z], i) => {
    parts.push({ id: `f${i}`, material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [x, -0.15, z], structure: { role: 'foundation' } })
    parts.push({
      id: `c${i}`, material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [x, 1.5, z], structure: { role: 'column', capacity: 4000 },
      ...(weak.includes(i) ? { hp: 5 } : {}),
    })
    joints.push({ a: `c${i}`, b: `f${i}`, kind: 'rebar', bears: 'a_on_b' })
    joints.push({ a: 'slab', b: `c${i}`, kind: 'rebar', bears: 'a_on_b' })
  })
  parts.push({ id: 'slab', material: 'concrete', shape: { kind: 'box', size: [4.2, 0.2, 4.2] }, position: [0, 3.1, 0], structure: { role: 'slab' } })
  if (extra.wall) {
    parts.push({ id: 'wall', material: 'brick', shape: { kind: 'box', size: [1, 2, 0.2] }, position: [0, 4.2, 0], structure: { role: 'wall' } })
    joints.push({ a: 'wall', b: 'slab', kind: 'mortar', bears: 'a_on_b' })
  }
  if (extra.partition) {
    parts.push({ id: 'fp', material: 'concrete', shape: { kind: 'box', size: [0.6, 0.3, 3] }, position: [2.4, -0.15, 0], structure: { role: 'foundation' } })
    parts.push({ id: 'part', material: 'plaster', shape: { kind: 'box', size: [0.1, 3, 3] }, position: [2.4, 1.5, 0], structure: { role: 'partition' } })
    joints.push({ a: 'part', b: 'fp', kind: 'glue', bears: 'a_on_b' })
    joints.push({ a: 'part', b: 'slab', kind: 'glue', bears: false })
  }
  return { parts, joints }
}

const strike = (w: DestructionWorld, id: string, part: string) => {
  const p = w.state(id)!.parts.find((x) => x.id === part)!
  void p
  const spec = w.serialize().objects.find((o) => o.id === id)!.spec.parts.find((x) => x.id === part)!
  const [x, y, z] = spec.position
  const half = spec.shape.kind === 'box' ? spec.shape.size[0] / 2 : 0.15
  return w.hit(id, { type: 'blunt', point: [x + half, y, z], direction: [-1, 0, 0], energy: 5000, radius: 0.05 })
}

const run = (w: DestructionWorld, seconds: number, dt = 0.25) => {
  const ev: DestructionEvent[] = []
  for (let t = 0; t < seconds; t += dt) ev.push(...w.update(dt))
  return ev
}

describe('structure', () => {
  it('computes capacities from material and section', () => {
    const conc = MATERIALS.find((m) => m.id === 'concrete')!
    const brick = MATERIALS.find((m) => m.id === 'brick')!
    const wood = MATERIALS.find((m) => m.id === 'wood_soft')!
    const col: PartSpec = { id: 'c', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [0, 0, 0], structure: { role: 'column' } }
    expect(partCapacity(col, conc)).toBeCloseTo(40000, -2)
    const wall: PartSpec = { id: 'w', material: 'brick', shape: { kind: 'box', size: [1, 2.8, 0.2] }, position: [0, 0, 0], structure: { role: 'wall' } }
    expect(partCapacity(wall, brick)).toBeCloseTo(8000, -1)
    const beam: PartSpec = { id: 'b', material: 'wood_soft', shape: { kind: 'box', size: [0.1, 0.2, 3] }, position: [0, 0, 0], structure: { role: 'beam' } }
    expect(partCapacity(beam, wood)).toBeCloseTo(2000, -1)
    expect(partCapacity({ ...col, structure: { role: 'column', capacity: 123 } }, conc)).toBe(123)
  })

  it('a slab on four columns stands with stress below 1 and loads add up', () => {
    const w = createDestruction()
    const id = w.add(slabSpec())
    const st = w.state(id)!
    const c0 = st.parts.find((p) => p.id === 'c0')!
    expect(c0.stress!).toBeGreaterThan(0.5)
    expect(c0.stress!).toBeLessThan(1)
    const slab = st.parts.find((p) => p.id === 'slab')!
    expect(slab.stress!).toBeLessThan(0.1)
    const foundations = st.parts.filter((p) => p.id.startsWith('f')).reduce((s, p) => s + p.load!, 0)
    const total = st.parts.reduce((s, p) => s + p.mass, 0)
    expect(foundations).toBeGreaterThan(total * 0.99)
    expect(types(run(w, 20))).not.toContain('stress')
    expect(st.groups.length).toBe(1)
  })

  it('losing one column raises stress on the others but the slab stands', () => {
    const w = createDestruction()
    const id = w.add(slabSpec([0]))
    const before = w.part(id, 'c1')!.stress!
    strike(w, id, 'c0')
    expect(w.part(id, 'c0')!.status).toBe('broken')
    const after = w.part(id, 'c1')!.stress!
    expect(after).toBeGreaterThan(before * 1.15)
    expect(after).toBeLessThan(1)
    const ev = run(w, 60)
    expect(types(ev)).not.toContain('collapse')
    expect(w.part(id, 'c1')!.status).not.toBe('broken')
  })

  it('losing two adjacent columns overloads the rest and the slab collapses', () => {
    const w = createDestruction()
    const id = w.add(slabSpec([0, 1]))
    strike(w, id, 'c0')
    strike(w, id, 'c1')
    expect(w.part(id, 'c2')!.stress!).toBeGreaterThan(1)
    const ev = run(w, 120)
    expect(types(ev)).toContain('stress')
    expect(types(ev).filter((t) => t === 'collapse').length).toBe(1)
    const col = ev.find((e) => e.type === 'collapse')!
    expect(col.type === 'collapse' && col.parts).toContain('slab')
    const st = w.state(id)!
    const gi = st.parts.find((p) => p.id === 'slab')!.group
    expect(gi).toBeGreaterThanOrEqual(1)
    expect(st.groups[0].every((p) => p.startsWith('f'))).toBe(true)
  })

  it('a broken column is never reported as a collapse, even when its joints open a moment before it fractures', () => {
    const w = createDestruction()
    const id = w.add(slabSpec([0]))
    const hit = strike(w, id, 'c0')
    expect(w.part(id, 'c0')!.status).toBe('broken')
    const ev = [...hit.events, ...run(w, 10)]
    expect(types(ev)).not.toContain('collapse')
    // nor in a frame hit with a huge blow, where the foundation joint opens first
    const f = createDestruction()
    const fid = f.add(buildFrame({ spanX: 4, spanZ: 4, columnsX: 2, columnsZ: 2, height: 2.8, floors: 1, walls: false, roof: true, columnCapacity: 4400 }), { position: [0, 0, -6] })
    const r = f.hitPart(fid, 'column_0_0_0', { type: 'blunt', point: [-2, 1.4, -8], energy: 3e6, radius: 0.05 })
    expect(f.part(fid, 'column_0_0_0')!.status).toBe('broken')
    for (const e of [...r.events, ...run(f, 10)]) if (e.type === 'collapse') expect(e.parts).not.toContain('column_0_0_0')
  })

  it('when the columns and the roof supports fail on the same tick, the roof group still gets its collapse event, computed after all losses', () => {
    const w = createDestruction()
    const id = w.add(slabSpec([0, 1, 2, 3], { wall: true }))
    const ev = w.explode([0, 1.5, 0], 20000, 8).flatMap((r) => r.events)
    for (const c of ['c0', 'c1', 'c2', 'c3']) expect(w.part(id, c)!.status).toBe('broken')
    const collapses = ev.filter((e) => e.type === 'collapse')
    expect(collapses.length).toBeGreaterThan(0)
    const parts = collapses.flatMap((e) => (e.type === 'collapse' ? e.parts : []))
    expect(parts).toEqual(expect.arrayContaining(['slab', 'wall']))
    expect(parts.some((p) => /^c\d$/.test(p))).toBe(false)
    // reported once
    expect(types(run(w, 10))).not.toContain('collapse')
  })

  it('the roof of a frame gets its own collapse event after columns went one by one and the stress broke the rest', () => {
    const w = createDestruction()
    const id = w.add(buildFrame({ spanX: 4, spanZ: 4, columnsX: 2, columnsZ: 2, height: 2.8, floors: 1, walls: false, roof: true, columnCapacity: 4400 }), { position: [0, 0, -6] })
    const ev: DestructionEvent[] = []
    for (const [c, p] of [['column_0_0_0', [-2, 1.4, -8]], ['column_0_1_0', [2, 1.4, -8]]] as const) ev.push(...w.hitPart(id, c, { type: 'blunt', point: [...p], energy: 3e6, radius: 0.05 }).events)
    ev.push(...run(w, 60))
    const collapsed = ev.flatMap((e) => (e.type === 'collapse' ? e.parts : []))
    expect(collapsed).toContain('roof')
    expect(collapsed).not.toContain('column_0_0_0')
    expect(collapsed).not.toContain('column_0_1_0')
    expect(w.part(id, 'roof')!.group).toBeGreaterThanOrEqual(1)
  })

  it('a wall resting on the slab falls with it', () => {
    const w = createDestruction()
    const id = w.add(slabSpec([0, 1], { wall: true }))
    strike(w, id, 'c0')
    strike(w, id, 'c1')
    const ev = run(w, 120)
    const col = ev.find((e) => e.type === 'collapse')!
    expect(col.type === 'collapse' && col.parts.sort()).toEqual(expect.arrayContaining(['slab', 'wall']))
    const st = w.state(id)!
    expect(st.parts.find((p) => p.id === 'wall')!.group).toBe(st.parts.find((p) => p.id === 'slab')!.group)
    expect(w.splitGroup(id, st.parts.find((p) => p.id === 'slab')!.group)).not.toBe(id)
  })

  it('a slab resting only on columns falls even when joined sideways to a standing partition; breaking the partition drops nothing', () => {
    const w = createDestruction()
    const id = w.add(slabSpec([0, 1, 2, 3], { partition: true }))
    const w2 = createDestruction()
    const id2 = w2.add(slabSpec([], { partition: true }))
    strike(w2, id2, 'part')
    const solo = w2.part(id2, 'part')!
    // a struck partition either breaks or loses its joint to the foundation and falls alone (reported as collapsed)
    expect(['broken', 'damaged', 'collapsed']).toContain(solo.status)
    expect(types(run(w2, 5))).not.toContain('collapse')
    for (let i = 0; i < 4; i++) strike(w, id, `c${i}`)
    const st = w.state(id)!
    const slabGroup = st.parts.find((p) => p.id === 'slab')!.group
    expect(slabGroup).toBeGreaterThanOrEqual(1)
    expect(st.parts.find((p) => p.id === 'part')!.group).toBe(0)
    expect(st.groups[0]).toEqual(expect.arrayContaining(['part', 'fp']))
  })

  it('objects without structure are unchanged', () => {
    const w = createDestruction()
    const id = w.add(chair())
    const st = w.state(id)!
    expect(st.parts.every((p) => p.load === undefined && p.stress === undefined)).toBe(true)
    const ev = [...w.hit(id, { type: 'blunt', point: [0.2, 0.2, 0.18], direction: [-1, 0, 0], energy: 300, radius: 0.05 }).events, ...run(w, 5)]
    expect(types(ev)).not.toContain('collapse')
    expect(types(ev)).not.toContain('stress')
  })

  it('a two-floor frame only cascades when overloaded', () => {
    const base = buildFrame({ columnsX: 2, columnsZ: 2, spanX: 4, spanZ: 4, floors: 2 })
    const probe = createDestruction()
    const pid = probe.add(base)
    const load0 = probe.part(pid, 'column_0_0_0')!.load!
    expect(probe.part(pid, 'column_0_0_0')!.stress!).toBeLessThan(0.5)
    const cascade = (capacity: number) => {
      const w = createDestruction()
      const id = w.add(buildFrame({ columnsX: 2, columnsZ: 2, spanX: 4, spanZ: 4, floors: 2, columnCapacity: capacity }))
      w.hit(id, { type: 'blunt', point: [-1.85, 1.5, -2], direction: [-1, 0, 0], energy: 3e6, radius: 0.05 })
      const ev = run(w, 300)
      const broken = w.state(id)!.parts.filter((p) => p.id.startsWith('column_0') && p.status === 'broken').length
      return { broken, ev, w, id }
    }
    const strong = cascade(load0 * 2)
    expect(strong.broken).toBe(1)
    expect(types(strong.ev)).not.toContain('collapse')
    const weak = cascade(load0 * 1.25)
    expect(weak.broken).toBeGreaterThanOrEqual(2)
    expect(types(weak.ev)).toContain('stress')
    expect(types(weak.ev)).toContain('collapse')
  })

  it('buildFrame makes a house with walls, a door opening and a resting roof', () => {
    const spec = buildFrame({ walls: true, floors: 2 })
    const ids = spec.parts.map((p) => p.id)
    expect(ids).toContain('roof')
    expect(ids).toContain('door')
    expect(ids).toContain('wall_door_lintel')
    expect(spec.joints!.find((j) => j.b === 'beam_x_1_0_0' && j.a === 'roof')!.kind).toBe('resting')
    expect(spec.joints!.some((j) => j.kind === 'mortar')).toBe(true)
    const w = createDestruction()
    const id = w.add(spec)
    const st = w.state(id)!
    expect(st.groups.length).toBe(1)
    expect(Math.max(...st.parts.map((p) => p.stress ?? 0))).toBeLessThan(1)
    expect(w.part(id, 'door')!.stress).toBeUndefined()
  })

  it('solves a 6x6 columns x 3 floors frame quickly', () => {
    const w = createDestruction()
    const spec = buildFrame({ columnsX: 6, columnsZ: 6, floors: 3, spanX: 15, spanZ: 15 })
    const id = w.add(spec)
    expect(spec.parts.length).toBeGreaterThan(300)
    const strikeCol = (c: string) => {
      const p = spec.parts.find((x) => x.id === c)!
      return w.hit(id, { type: 'blunt', point: [p.position[0] + 0.15, p.position[1], p.position[2]], direction: [-1, 0, 0], energy: 3e6, radius: 0.05 })
    }
    strikeCol('column_0_0_0')
    // best of three breaks (each one runs the load solver over ~330 parts) to ignore GC noise. The bound is a regression guard with headroom
    // for shared CI runners (where all packages test in parallel), not a micro-benchmark: locally a break takes 6-10 ms.
    const times: number[] = []
    for (const c of ['column_0_1_0', 'column_0_2_0', 'column_0_3_0']) {
      const t0 = performance.now()
      strikeCol(c)
      times.push(performance.now() - t0)
      expect(w.part(id, c)!.status).toBe('broken')
    }
    expect(Math.min(...times)).toBeLessThan(60)
    const t1 = performance.now()
    for (let i = 0; i < 60; i++) w.update(1 / 60)
    expect(performance.now() - t1).toBeLessThan(1000)
  })

  it('has structure labels in both locales', () => {
    expect(resolveStrings('pt-BR').structureRoles.column).toBe('pilar')
    expect(resolveStrings('pt-BR').eventLabels.collapse).toBe('desabou')
    expect(resolveStrings('pt-BR').eventLabels.stress).toBe('sobrecarga')
    expect(resolveStrings('pt-BR').jointKinds.rebar).toBe('vergalhão')
    expect(resolveStrings('en').jointKinds.resting).toBe('resting')
  })

  it('parts that fall in a collapse get status collapsed; broken parts stay broken; serialize, load and reset keep or clear it', () => {
    const w = createDestruction()
    const id = w.add(slabSpec([0, 1], { wall: true }))
    expect(w.part(id, 'slab')!.status).toBe('intact')
    strike(w, id, 'c0')
    strike(w, id, 'c1')
    const ev = run(w, 120)
    const col = ev.find((e) => e.type === 'collapse')!
    expect(col.type === 'collapse' && col.parts).toEqual(expect.arrayContaining(['slab', 'wall']))
    expect(w.part(id, 'slab')!.status).toBe('collapsed')
    expect(w.part(id, 'wall')!.status).toBe('collapsed')
    expect(w.part(id, 'c0')!.status).toBe('broken')
    expect(w.part(id, 'f0')!.status).not.toBe('collapsed')
    // a collapsed part that is damaged further stays collapsed until it is lost
    expect(resolveStrings('pt-BR').partStatus.collapsed).toBe('desabado')
    expect(resolveStrings('en').partStatus.collapsed).toBe('collapsed')
    const snap = JSON.parse(JSON.stringify(w.serialize()))
    const w2 = createDestruction()
    w2.load(snap)
    expect(w2.part(id, 'slab')!.status).toBe('collapsed')
    expect(types(run(w2, 5))).not.toContain('collapse')
    expect(w2.part(id, 'wall')!.status).toBe('collapsed')
    w.reset(id)
    expect(w.state(id)!.parts.every((p) => p.status === 'intact')).toBe(true)
  })
})
