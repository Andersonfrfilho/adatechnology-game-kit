import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createPlayerAvatar, toRoomAvatar } from '../src'

type Body = ReturnType<typeof toRoomAvatar>

/** Walks the body `seconds` at `speed` and answers each footfall with the frame it came on and the forward reach of each foot then. */
const walk = (body: Body, seconds: number, speed: number, running = false) => {
  const falls: { frame: number; foot: 'left' | 'right'; ahead: { left: number; right: number } }[] = []
  const footZ = (index: 0 | 1): number => {
    const knee = body.avatar.rig.legs[index]!.kn as unknown as THREE.Object3D
    return body.root.worldToLocal(knee.getWorldPosition(new THREE.Vector3())).z
  }
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
    body.update(1 / 60, { speed, running, crouch: false, down: false, armed: false, pitch: 0 })
    body.root.updateMatrixWorld(true)
    const foot = body.footfall()
    if (foot) falls.push({ frame, foot, ahead: { left: footZ(0), right: footZ(1) } })
  }
  return falls
}

describe('footfalls of the player body', () => {
  it('puts the feet down in turn while walking, about two steps a second', () => {
    const body = toRoomAvatar(createPlayerAvatar(THREE))
    const falls = walk(body, 4, 1.4)
    const perSecond = falls.length / 4
    expect(perSecond).toBeGreaterThan(1.4)
    expect(perSecond).toBeLessThan(3)
    for (let i = 1; i < falls.length; i++) expect(falls[i]!.foot).not.toBe(falls[i - 1]!.foot)
  })

  it('the foot it names is the one in front at that frame (the heel strikes, it does not lift)', () => {
    const body = toRoomAvatar(createPlayerAvatar(THREE))
    const falls = walk(body, 3, 1.4).slice(1)
    expect(falls.length).toBeGreaterThan(2)
    for (const fall of falls) {
      const front = fall.ahead.left > fall.ahead.right ? 'left' : 'right'
      expect(fall.foot).toBe(front)
    }
  })

  it('steps faster running than walking, and not at all standing', () => {
    const run = walk(toRoomAvatar(createPlayerAvatar(THREE)), 3, 4.5, true).length
    const stroll = walk(toRoomAvatar(createPlayerAvatar(THREE)), 3, 1.4).length
    expect(run).toBeGreaterThan(stroll)
    expect(walk(toRoomAvatar(createPlayerAvatar(THREE)), 2, 0)).toHaveLength(0)
  })
})
