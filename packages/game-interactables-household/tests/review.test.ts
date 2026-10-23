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
