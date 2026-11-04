import { describe, expect, it } from 'vitest'

import { bodyMass, knockOf, KNOCK_DOWN_SPEED, stepKnock } from '../src/test-area/knock'

type V = [number, number, number]
/** An M67: 0.24 kg of TNT, lethal to 5 m, hurts to 15 m. */
const GRENADE = { point: [0, 0, 0] as V, energy: 200_000, radius: 15, tnt: 0.24, lethalRadius: 5 }
/** A block of C4 (0.76 kg of TNT). */
const C4 = { point: [0, 0, 0] as V, energy: 345_600, radius: 18, tnt: 0.76, lethalRadius: 6 }
const flat = (): number => 0
const run = (blast: typeof GRENADE, feet: V, alive = true, seconds = 6) => {
  const knock = knockOf(blast, feet, bodyMass(1.75))
  if (!knock) return undefined
  const position = { x: feet[0], y: feet[1], z: feet[2] }
  let lyingMax = 0
  let done = false
  for (let i = 0; i < seconds * 60 && !done; i++) {
    done = stepKnock(knock, position, 1 / 60, flat, alive)
    lyingMax = Math.max(lyingMax, knock.lying)
  }
  return { position, lyingMax, done, knock }
}

describe('a blast on a body', () => {
  it('a grenade 3 m away fells a body where it stands (its wounds), it does not throw it', () => {
    const near = run(GRENADE, [3, 0, 0])!
    expect(near.knock.wounded).toBe(true)
    expect(near.lyingMax).toBe(1)
    expect(Math.abs(near.position.x - 3)).toBeLessThan(0.2)
  })

  it('a big charge close throws a body away from the centre, less the farther it stands, and nothing outside the radius', () => {
    const near = run(C4, [1, 0, 0])!
    const mid = run(C4, [3, 0, 0])!
    expect(near.position.x - 1).toBeGreaterThan(mid.position.x - 3)
    expect(near.position.x - 1).toBeGreaterThan(0.5)
    expect(near.position.y).toBe(0)
    expect(run(C4, [19, 0, 0])).toBeUndefined()
  })

  it('a felled body gets up again; a dead body stays down', () => {
    const alive = run(GRENADE, [3, 0, 0], true, 10)!
    expect(alive.knock.lying).toBe(0)
    expect(alive.done).toBe(true)
    const dead = run(GRENADE, [3, 0, 0], false, 10)!
    expect(dead.knock.lying).toBe(1)
    expect(dead.done).toBe(false)
  })

  it('out of the lethal zone a grenade only stuns: no fall', () => {
    const knock = knockOf(GRENADE, [9, 0, 0], bodyMass(1.75))!
    expect(Math.hypot(...knock.velocity)).toBeLessThan(KNOCK_DOWN_SPEED)
    expect(knock.down).toBe(false)
    expect(knock.stunSeconds).toBeGreaterThan(0)
  })

  it('takes the body numbers from the host', () => {
    const light = knockOf(C4, [2, 0, 0], bodyMass(1.75), undefined, { bodyArea: 0.1 })!
    const full = knockOf(C4, [2, 0, 0], bodyMass(1.75))!
    expect(Math.hypot(...light.velocity)).toBeLessThan(Math.hypot(...full.velocity))
  })
})
