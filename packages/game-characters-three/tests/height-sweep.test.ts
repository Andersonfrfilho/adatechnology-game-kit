import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createPlayerAvatar, toRoomAvatar } from '../src'

const HEIGHTS = [1.4, 1.55, 1.7, 1.8, 1.95, 2.1] as const

describe('Spec 012 R3 (T2.3) — avatar scales eye, hip, shoulder, door reach and footfalls from 1.40 to 2.10 m', () => {
  it('scales standing eye, crouched eye and shoulder height monotonically and proportionally with heightMetres', () => {
    const eyes: number[] = []
    const crouchedEyes: number[] = []
    const shoulders: number[] = []

    for (const h of HEIGHTS) {
      const avatar = createPlayerAvatar(THREE, { heightMetres: h, cascade: false })
      expect(avatar.heightMetres).toBe(h)
      avatar.update(1 / 60, {})
      const eyeY = avatar.eye().y
      const shoulderY = avatar.shoulder('R').getWorldPosition(new THREE.Vector3()).y
      eyes.push(eyeY)
      shoulders.push(shoulderY)

      // Eye sits proportionally (~86% of stature on normalised body)
      expect(eyeY / h).toBeGreaterThan(0.84)
      expect(eyeY / h).toBeLessThan(0.9)

      avatar.update(1 / 60, { crouch: true })
      crouchedEyes.push(avatar.eye().y)
    }

    for (let i = 1; i < HEIGHTS.length; i++) {
      expect(eyes[i]!).toBeGreaterThan(eyes[i - 1]!)
      expect(crouchedEyes[i]!).toBeGreaterThan(crouchedEyes[i - 1]!)
      expect(shoulders[i]!).toBeGreaterThan(shoulders[i - 1]!)
    }
  })

  it('adapts door reach arm angle to the person height (shorter person raises arm higher for a 1.1 m handle)', () => {
    const short = createPlayerAvatar(THREE, { heightMetres: 1.4, cascade: false })
    const tall = createPlayerAvatar(THREE, { heightMetres: 2.1, cascade: false })
    const door = { phase: 'swing' as const, progress: 0.5, height: 1.1, pull: true }
    short.update(1 / 60, { door })
    tall.update(1 / 60, { door })
    // Negative armR raises the arm forward/up; the 1.40 m person raises further than the 2.10 m person for a 1.1 m handle.
    expect(short.rig.arms[0]!.g.rotation.x).toBeLessThan(tall.rig.arms[0]!.g.rotation.x)
  })

  it('keeps alternating heel-strike footfalls matching the ground at every height from 1.40 to 2.10 m', () => {
    for (const h of HEIGHTS) {
      const body = toRoomAvatar(createPlayerAvatar(THREE, { heightMetres: h }))
      const falls: { foot: 'left' | 'right'; ahead: { left: number; right: number } }[] = []
      const footZ = (index: 0 | 1): number => {
        const knee = body.avatar.rig.legs[index]!.kn as unknown as THREE.Object3D
        return body.root.worldToLocal(knee.getWorldPosition(new THREE.Vector3())).z
      }
      for (let frame = 0; frame < 180; frame++) {
        body.update(1 / 60, { speed: 1.4, running: false, crouch: false, down: false, armed: false, pitch: 0 })
        body.root.updateMatrixWorld(true)
        const foot = body.footfall()
        if (foot) falls.push({ foot, ahead: { left: footZ(0), right: footZ(1) } })
      }
      expect(falls.length, `height ${h} m`).toBeGreaterThan(3)
      for (let i = 1; i < falls.length; i++) {
        expect(falls[i]!.foot).not.toBe(falls[i - 1]!.foot)
        const front = falls[i]!.ahead.left > falls[i]!.ahead.right ? 'left' : 'right'
        expect(falls[i]!.foot, `height ${h} m step ${i}`).toBe(front)
      }
    }
  })
})
