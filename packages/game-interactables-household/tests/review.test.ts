import { describe, expect, it } from 'vitest'
import { createWorld } from '@adatechnology/game-interactables'
import { build, pack } from './helpers'

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
