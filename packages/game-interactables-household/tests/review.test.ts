import { describe, expect, it } from 'vitest'
import { createWorld } from '@adatechnology/game-interactables'
import { motionPoint } from '../src'
import { build, pack, partPoints } from './helpers'

function world() {
  const hh = pack('br', 'en')
  return createWorld({ locale: 'en', strings: hh.strings, items: hh.items, loot: hh.loot, seed: 'review' })
}

describe('seat orientation against the engine', () => {
  const SEATED = ['sofa', 'armchair', 'dining_chair', 'bench', 'bed_double', 'bed_single']
  for (const type of SEATED) {
    for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      it(`${type} (ry ${ry.toFixed(2)}): the view faces the front, away from the backrest`, () => {
        const w = world()
        const spec = build(type).spec
        w.add('o', spec, { x: 2, y: 0, z: -3, ry })
        for (const seat of spec.seats!) {
          if (seat.pose === 'lie' && type === 'sofa') continue
          const r = w.sit('o', seat.id, 'p')!
          w.stand('p')
          // view yaw 0 looks toward -z, so the forward vector is (-sin yaw, -cos yaw)
          const fwd = [-Math.sin(r.yaw), -Math.cos(r.yaw)]
          // object front (+z) in world space
          const front = [Math.sin(ry), Math.cos(ry)]
          expect(fwd[0] * front[0] + fwd[1] * front[1], `${type} ${seat.id}`).toBeGreaterThan(0.99)
        }
      })
    }
  }

  it('the exit point is in front of every sit seat', () => {
    for (const type of SEATED) {
      for (const s of build(type).spec.seats!) expect(s.exit[2], `${type} ${s.id}`).toBeGreaterThan(s.pos[2])
    }
  })
})

describe('parts never swing into the back wall', () => {
  // a wall flush with the back of the object: no part may pass behind z = -d/2 (clothes on a line are in the open yard)
  const hh = pack()
  for (const t of hh.types.filter((x) => x.id !== 'clothesline')) {
    it(`${t.id}: every part stays in front of the back plane for t in 0..1`, () => {
      const b = build(t.id)
      for (const p of b.spec.parts ?? []) {
        for (let k = 0; k <= 20; k++) {
          for (const pt of partPoints(b, p.id)) {
            const q = motionPoint(pt, p.pivot, p.motion, k / 20)
            expect(q[2], `${t.id}.${p.id} t=${k / 20}`).toBeGreaterThanOrEqual(-b.dims.d / 2 - 0.006)
          }
        }
      }
    })
  }
})

describe('blinds really close', () => {
  const slatIds = (spec: ReturnType<typeof build>['spec']) => spec.parts!.filter((p) => p.id.startsWith('slat_')).map((p) => p.id)

  it('slats share one group, hinge around x by about 80 degrees and are not nested in the raise part', () => {
    const b = build('blinds')
    const slats = b.spec.parts!.filter((p) => p.id.startsWith('slat_'))
    expect(slats.length).toBeGreaterThan(20)
    for (const p of slats) {
      expect(p.group).toBe('tilt')
      expect(p.motion.kind).toBe('hinge')
      expect(p.motion.axis).toEqual([1, 0, 0])
      expect(Math.abs(p.motion.angle!)).toBeGreaterThan(1.3)
      expect(Math.abs(p.motion.angle!)).toBeLessThan(1.45)
    }
    expect(b.spec.parts!.find((p) => p.id === 'raise')).toMatchObject({ motion: { kind: 'scale' } })
    expect(b.spec.parts!.find((p) => p.id === 'raise')!.group).toBeUndefined()
  })

  it('closed (t = 0): neighbouring slats overlap vertically; open (t = 1): slats are flat with gaps between them', () => {
    const b = build('blinds')
    const ys = (t: number) =>
      slatIds(b.spec).map((id) => {
        const p = b.spec.parts!.find((x) => x.id === id)!
        const v = partPoints(b, id).map((c) => motionPoint(c, p.pivot, p.motion, t)[1])
        return [Math.min(...v), Math.max(...v)] as const
      })
    const closed = ys(0)
    for (let i = 1; i < closed.length; i++) expect(closed[i - 1][0], `closed overlap ${i}`).toBeLessThan(closed[i][1])
    const open = ys(1)
    for (const [lo, hi] of open) expect(hi - lo).toBeLessThan(0.012)
    for (let i = 1; i < open.length; i++) expect(open[i - 1][0] - open[i][1]).toBeGreaterThan(0.02)
  })

  it('stays inside the footprint in every pose', () => {
    const b = build('blinds')
    const { w, d, h, y0 } = b.dims
    for (const p of b.spec.parts!) {
      for (const t of [0, 0.5, 1]) {
        for (const c of partPoints(b, p.id)) {
          const q = motionPoint(c, p.pivot, p.motion, t)
          expect(Math.abs(q[0])).toBeLessThanOrEqual(w / 2 + 0.02)
          expect(Math.abs(q[2])).toBeLessThanOrEqual(d / 2 + 0.02)
          expect(q[1]).toBeGreaterThanOrEqual(y0 - 0.02)
          expect(q[1]).toBeLessThanOrEqual(y0 + h + 0.02)
        }
      }
    }
  })

  for (const locale of ['en', 'pt-BR'] as const) {
    it(`one interaction closes and opens every slat; raising is a separate one (${locale})`, () => {
      const hh = pack('br', locale)
      const w = createWorld({ locale, strings: hh.strings, items: hh.items, loot: hh.loot, seed: 'b' })
      const spec = build('blinds').spec
      w.add('b', spec, { x: 0, y: 0, z: 0, ry: 0 })
      const labels = () => w.interactables().map((i) => i.label)
      const tilt = w.interactables().find((i) => i.id === 'b:toggle_slat_1')!
      const raise = w.interactables().find((i) => i.id === 'b:toggle_raise')!
      expect(tilt.label).toBe(locale === 'en' ? 'Close the blinds' : 'Fechar a persiana')
      expect(raise.label).toBe(locale === 'en' ? 'Raise the blinds' : 'Subir a persiana')
      expect(slatIds(spec).every((id) => w.partT('b', id) === 1)).toBe(true)
      expect(tilt.act()).toBe(true)
      for (let i = 0; i < 60; i++) w.update(1 / 30)
      expect(slatIds(spec).every((id) => w.partT('b', id) === 0)).toBe(true)
      expect(w.partT('b', 'raise')).toBeCloseTo(0.15, 2)
      expect(w.interactables().find((i) => i.id === 'b:toggle_slat_1')!.label).toBe(locale === 'en' ? 'Open the blinds' : 'Abrir a persiana')
      expect(w.act('b:toggle_raise')).toBe(true)
      for (let i = 0; i < 60; i++) w.update(1 / 30)
      expect(w.partT('b', 'raise')).toBe(1)
      expect(slatIds(spec).every((id) => w.partT('b', id) === 0)).toBe(true)
      expect(labels().length).toBe(2)
    })
  }

  it('variant closed starts closed', () => {
    const spec = build('blinds', { variant: 'closed' }).spec
    expect(slatIds(spec).every((id) => (spec.parts!.find((p) => p.id === id)!.t0 ?? 0) === 0)).toBe(true)
  })
})

describe('curtain panels move together', () => {
  it('a single interaction opens and closes both panels', () => {
    const w = world()
    const spec = build('curtain').spec
    expect(spec.parts!.map((p) => p.group)).toEqual(['panels', 'panels'])
    expect(spec.interactions!.length).toBe(1)
    w.add('c', spec, { x: 0, y: 0, z: 0, ry: 0 })
    expect(w.partT('c', 'panel_l')).toBe(1)
    expect(w.act('c:toggle_panel_l')).toBe(true)
    for (let i = 0; i < 60; i++) w.update(1 / 30)
    expect(w.partT('c', 'panel_l')).toBe(0)
    expect(w.partT('c', 'panel_r')).toBe(0)
    w.setPart('c', 'panel_r', 1)
    for (let i = 0; i < 60; i++) w.update(1 / 30)
    expect(w.partT('c', 'panel_l')).toBe(1)
    expect(spec.soft!.map((s) => s.part)).toEqual(['panel_l', 'panel_r'])
  })
})
