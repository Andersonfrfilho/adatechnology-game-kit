import { describe, expect, it } from 'vitest'

import { bodyMass, knockOf, KNOCK_DOWN_SPEED, stepKnock } from '../src/test-area/knock'

const BLAST = { point: [0, 0, 0] as [number, number, number], energy: 200_000, radius: 14 }
const flat = (): number => 0
const run = (feet: [number, number, number], alive = true, seconds = 6) => {
  const knock = knockOf(BLAST, feet, bodyMass(1.75))
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

describe('a blast shoves a body', () => {
  it('slides it away from the centre, less the farther it stands, and nothing outside the radius', () => {
    const near = run([3, 0, 0])
    const mid = run([6, 0, 0])
    const far = run([10, 0, 0])
    expect(near && mid && far).toBeTruthy()
    expect(near!.position.x - 3).toBeGreaterThan(mid!.position.x - 6)
    expect(mid!.position.x - 6).toBeGreaterThan(far!.position.x - 10)
    expect(near!.position.x - 3).toBeGreaterThan(1)
    expect(near!.position.y).toBe(0)
    expect(run([15, 0, 0])).toBeUndefined()
  })

  it('knocks a body off its feet when the shove is strong, and it gets up again; a dead body stays down', () => {
    expect(knockOf(BLAST, [3, 0, 0], bodyMass(1.75))!.down).toBe(true)
    const alive = run([3, 0, 0], true, 8)!
    expect(alive.lyingMax).toBe(1)
    expect(alive.knock.lying).toBe(0)
    expect(alive.done).toBe(true)
    const dead = run([3, 0, 0], false, 8)!
    expect(dead.knock.lying).toBe(1)
    expect(dead.done).toBe(false)
  })

  it('only pushes (no fall) a body the blast barely reaches', () => {
    const knock = knockOf(BLAST, [11, 0, 0], bodyMass(1.75))!
    expect(Math.hypot(...knock.velocity)).toBeLessThan(KNOCK_DOWN_SPEED)
    expect(knock.down).toBe(false)
  })

  it('takes the numbers from the host', () => {
    expect(knockOf(BLAST, [3, 0, 0], bodyMass(1.75), { maxSpeed: 0.1 })).toBeUndefined()
  })
})
