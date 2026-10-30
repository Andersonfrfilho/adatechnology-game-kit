import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ATTACK_CLIPS } from '@adatechnology/game-characters-people'
import { mirrorPoseClip } from '@adatechnology/game-characters'

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
      // the right leg (legs[0], at -x, beside the weapon arm): the one the first-person kick shows
      const kneeRight = avatar.rig.legs[0]!.kn
      const restKnee = kneeRight.rotation.x
      avatar.play(clip)
      let armMoved = 0
      let kneeMoved = 0
      for (let step = 0; step < Math.ceil(clip.duration * 60); step++) {
        avatar.update(1 / 60, { speed: 0 })
        armMoved = Math.max(armMoved, Math.abs(armWeapon.g.rotation.x - restArm))
        kneeMoved = Math.max(kneeMoved, Math.abs(kneeRight.rotation.x - restKnee))
        for (const value of [armWeapon.g.rotation.x, avatar.rig.upper.rotation.x, avatar.rig.legs[0]!.g.rotation.x]) expect(Number.isFinite(value)).toBe(true)
      }
      expect(armMoved, clip.id).toBeGreaterThan(0.2)
      if (clip.channels === 'upper') expect(kneeMoved, clip.id).toBeLessThan(1e-6)
      else expect(kneeMoved, clip.id).toBeGreaterThan(0.5)
    }
  })

  it('throw the punch with the right arm and kick with the right leg, as the first-person view does; the mirror uses the left ones', () => {
    const reach = (clipId: string, mirror: boolean): { right: number; left: number; legRight: number; legLeft: number } => {
      const avatar = createPlayerAvatar(THREE, { cascade: false })
      avatar.update(1 / 60, { speed: 0 })
      const clip = ATTACK_CLIPS.find((c) => c.id === clipId)!
      const [legRight, legLeft] = avatar.rig.legs as [typeof avatar.rig.legs[0], typeof avatar.rig.legs[0]]
      const rest = { right: avatar.rig.arms[1]!.g.rotation.x, left: avatar.rig.arms[0]!.g.rotation.x, legRight: legRight.g.rotation.x, legLeft: legLeft.g.rotation.x }
      avatar.play(mirror ? mirrorPoseClip(clip, `${clip.id}_left`) : clip)
      const most = { right: 0, left: 0, legRight: 0, legLeft: 0 }
      for (let step = 0; step < Math.ceil(clip.duration * 60); step++) {
        avatar.update(1 / 60, { speed: 0 })
        most.right = Math.max(most.right, rest.right - avatar.rig.arms[1]!.g.rotation.x)
        most.left = Math.max(most.left, rest.left - avatar.rig.arms[0]!.g.rotation.x)
        most.legRight = Math.max(most.legRight, rest.legRight - legRight.g.rotation.x)
        most.legLeft = Math.max(most.legLeft, rest.legLeft - legLeft.g.rotation.x)
      }
      return most
    }
    const punch = reach('punch_right', false)
    // the punching arm comes up to the shoulder (about -1.5 rad); the guard rises less
    expect(punch.right).toBeGreaterThan(1.3)
    expect(punch.left).toBeLessThan(punch.right - 0.3)
    const left = reach('punch_right', true)
    expect(left.left).toBeGreaterThan(1.3)
    expect(left.right).toBeLessThan(left.left - 0.3)
    const kick = reach('front_kick', false)
    expect(kick.legRight).toBeGreaterThan(1)
    expect(kick.legLeft).toBeLessThan(0.3)
  })

  it('reach the pose of the strike by its impact with the cascade on (the joints hurry while a clip that does not loop plays)', () => {
    const avatar = createPlayerAvatar(THREE)
    for (let i = 0; i < 30; i++) avatar.update(1 / 60, { speed: 0 })
    const arm = avatar.rig.arms[1]!.g
    avatar.play(ATTACK_CLIPS.find((c) => c.id === 'punch_right')!)
    for (let i = 0; i < Math.round(0.16 * 60); i++) avatar.update(1 / 60, { speed: 0 })
    expect(arm.rotation.x).toBeLessThan(-1.2)
    const slow = createPlayerAvatar(THREE, { clipCascade: 1 })
    for (let i = 0; i < 30; i++) slow.update(1 / 60, { speed: 0 })
    slow.play(ATTACK_CLIPS.find((c) => c.id === 'punch_right')!)
    for (let i = 0; i < Math.round(0.16 * 60); i++) slow.update(1 / 60, { speed: 0 })
    expect(slow.rig.arms[1]!.g.rotation.x).toBeGreaterThan(arm.rotation.x + 0.3)
  })
})
