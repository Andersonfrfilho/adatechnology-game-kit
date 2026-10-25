import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ATTACK_CLIPS } from '@adatechnology/game-characters-people'

import { createPlayerAvatar } from '../src'

/** The joint names `setPose` of the rich body knows. */
const BODY_JOINTS = ['lean', 'twist', 'side', 'drop', 'headX', 'headY', 'headZ', 'armR', 'armL', 'elbR', 'elbL', 'armRz', 'armLz', 'legL', 'legR', 'kneeL', 'kneeR']

describe('attack clips on the player body', () => {
  it('only name joints the body has', () => {
    for (const clip of ATTACK_CLIPS) for (const key of clip.keys) for (const joint of Object.keys(key.pose)) expect(BODY_JOINTS, `${clip.id}.${joint}`).toContain(joint)
  })

  it('move the joints they name, without NaN, and leave the legs to the gait when upper', () => {
    for (const clip of ATTACK_CLIPS) {
      const avatar = createPlayerAvatar(THREE, { cascade: false })
      avatar.update(1 / 60, { speed: 0 })
      const armWeapon = avatar.rig.arms[1]!
      const restArm = armWeapon.g.rotation.x
      const restKnee = avatar.rig.legs[1]!.kn.rotation.x
      avatar.play(clip)
      let armMoved = 0
      let kneeMoved = 0
      for (let step = 0; step < Math.ceil(clip.duration * 60); step++) {
        avatar.update(1 / 60, { speed: 0 })
        armMoved = Math.max(armMoved, Math.abs(armWeapon.g.rotation.x - restArm))
        kneeMoved = Math.max(kneeMoved, Math.abs(avatar.rig.legs[1]!.kn.rotation.x - restKnee))
        for (const value of [armWeapon.g.rotation.x, avatar.rig.upper.rotation.x, avatar.rig.legs[1]!.g.rotation.x]) expect(Number.isFinite(value)).toBe(true)
      }
      expect(armMoved, clip.id).toBeGreaterThan(0.2)
      if (clip.channels === 'upper') expect(kneeMoved, clip.id).toBeLessThan(1e-6)
      else expect(kneeMoved, clip.id).toBeGreaterThan(0.5)
    }
  })
})
