import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createPlayerAvatar } from '../src'
import type { PoseClip } from '@adatechnology/game-characters'

const legs = (avatar: ReturnType<typeof createPlayerAvatar>): number[] => avatar.rig.legs.flatMap((leg) => [leg.g.rotation.x, leg.kn.rotation.x])
const arms = (avatar: ReturnType<typeof createPlayerAvatar>): number[] => avatar.rig.arms.flatMap((arm) => [arm.g.rotation.x, arm.el.rotation.x])
const run = (avatar: ReturnType<typeof createPlayerAvatar>, seconds: number, state = {}): void => {
  for (let i = 0; i < seconds * 60; i++) avatar.update(1 / 60, state)
}

describe('createPlayerAvatar', () => {
  it('builds the team game player (human Lento, shirt 0x3d5a73)', () => {
    const avatar = createPlayerAvatar(THREE)
    expect(avatar.root).toBeInstanceOf(THREE.Object3D)
    expect(avatar.rig.type).toBe('Lento')
    expect(avatar.playing).toBeNull()
    let blue = false
    avatar.root.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined
      if (material?.color?.getHex?.() === 0x3d5a73) blue = true
    })
    expect(blue).toBe(true)
  })

  it('walks: the legs swing with the ground speed and stand still at zero speed', () => {
    const avatar = createPlayerAvatar(THREE)
    run(avatar, 1, { speed: 0 })
    const still = legs(avatar)
    run(avatar, 0.37, { speed: 3 })
    const walking = legs(avatar)
    expect(walking.some((value, index) => Math.abs(value - still[index]!) > 0.05)).toBe(true)
  })

  it('crouch bends the knees as the shader does (1.9) and lowers the hip by 0.35', () => {
    const avatar = createPlayerAvatar(THREE, { cascade: false })
    avatar.update(1 / 60, { speed: 0, crouch: true })
    expect(avatar.rig.legs[0]!.kn.rotation.x).toBeCloseTo(1.9, 5)
    expect(avatar.rig.legs[0]!.g.rotation.x).toBeCloseTo(-0.95, 5)
    expect(avatar.rig.upper.rotation.x).toBeCloseTo(0.25, 5)
    expect(avatar.rig.fig.position.y - avatar.rig.dropBase).toBeCloseTo(-0.35, 5)
  })

  it('down turns the body about the hip and lays it on the ground', () => {
    const avatar = createPlayerAvatar(THREE, { cascade: false })
    avatar.update(1 / 60, { down: true })
    run(avatar, 0.5, { down: true })
    expect(Math.abs(avatar.root.children[0]!.rotation.x)).toBeCloseTo(1.5, 5)
    avatar.update(1 / 60, { down: false })
    run(avatar, 0.5, { down: false })
    expect(avatar.root.children[0]!.rotation.x).toBeCloseTo(0, 5)
  })

  it('armed: both arms follow the aim', () => {
    const avatar = createPlayerAvatar(THREE, { cascade: false })
    avatar.update(1 / 60, { armed: true, pitch: -1 })
    const low = avatar.rig.arms[1]!.g.rotation.x
    avatar.update(1 / 60, { armed: true, pitch: 1.5 })
    expect(avatar.rig.arms[1]!.g.rotation.x).toBeGreaterThan(low)
    expect(avatar.rig.arms[1]!.g.rotation.z).toBeCloseTo(0.36, 5)
  })

  describe('play', () => {
    const clip: PoseClip = {
      id: 'raise',
      duration: 1,
      channels: 'upper',
      keys: [
        { t: 0, pose: { armR: -2, armL: -2, elbR: -1, legL: 1.2, kneeL: 1.2 } },
        { t: 1, pose: { armR: -2, armL: -2, elbR: -1, legL: 1.2, kneeL: 1.2 } },
      ],
      events: [{ t: 0.5, type: 'impact' }],
    }

    it('an upper clip changes the arms and leaves the legs to the gait', () => {
      const plain = createPlayerAvatar(THREE, { cascade: false })
      const clipped = createPlayerAvatar(THREE, { cascade: false })
      clipped.play(clip)
      run(plain, 0.6, { speed: 3 })
      run(clipped, 0.6, { speed: 3 })
      expect(clipped.playing).toBe('raise')
      expect(clipped.rig.arms[0]!.g.rotation.x).toBeCloseTo(-2, 5)
      expect(Math.abs(arms(clipped)[0]! - arms(plain)[0]!)).toBeGreaterThan(0.5)
      expect(legs(clipped)).toEqual(legs(plain))
    })

    it('a full clip drives the legs too', () => {
      const avatar = createPlayerAvatar(THREE, { cascade: false })
      avatar.play({ ...clip, channels: 'full' })
      run(avatar, 0.6, { speed: 3 })
      expect(avatar.rig.legs[0]!.g.rotation.x).toBeCloseTo(1.2, 5)
    })

    it('fires each event once, to onEvent and to on(event), and ends by itself', () => {
      const avatar = createPlayerAvatar(THREE)
      const seen: string[] = []
      const emitted: string[] = []
      avatar.on('event', (event) => emitted.push(`${event.clip}:${event.type}`))
      avatar.play(clip, { onEvent: (event) => seen.push(event.type) })
      run(avatar, 1.5)
      expect(seen).toEqual(['impact'])
      expect(emitted).toEqual(['raise:impact'])
      expect(avatar.playing).toBeNull()
    })

    it('plays a registered clip by id and stop() blends it out', () => {
      const avatar = createPlayerAvatar(THREE)
      avatar.play('grabbed_bitten_human')
      expect(avatar.playing).toBe('grabbed_bitten_human')
      run(avatar, 0.5)
      avatar.stop()
      run(avatar, 0.2)
      expect(avatar.playing).toBeNull()
      expect(() => avatar.play('nope')).toThrow()
    })
  })

  it('has a hand socket under the weapon arm (-x) and one under the other, with articulated fingers in third person', () => {
    const avatar = createPlayerAvatar(THREE, { cascade: false })
    const right = avatar.hand('R')
    expect(right.parent).toBe(avatar.rig.arms[1]!.el)
    expect(avatar.hand('L').parent).toBe(avatar.rig.arms[0]!.el)
    expect(right.position.y).toBeCloseTo(-0.33, 5)
    const handGroupR = (avatar.rig.arms[1]!.el as unknown as THREE.Object3D).getObjectByName('hand_group_R')
    const handGroupL = (avatar.rig.arms[0]!.el as unknown as THREE.Object3D).getObjectByName('hand_group_L')
    expect(handGroupR).toBeDefined()
    expect(handGroupL).toBeDefined()
    expect(handGroupR!.children.length).toBeGreaterThanOrEqual(6) // palm + 4 fingers + thumb

    // holding raises the right arm and curls the fingers; drinking brings the right hand toward the mouth and tilts the head back
    avatar.update(1 / 60, { speed: 0 })
    const idleArmL = avatar.rig.arms[1]!.g.rotation.x
    const idleElbL = avatar.rig.arms[1]!.el.rotation.x
    avatar.update(1 / 60, { speed: 0, holding: true })
    const holdArmL = avatar.rig.arms[1]!.g.rotation.x
    const holdElbL = avatar.rig.arms[1]!.el.rotation.x
    expect(holdArmL).toBeLessThan(idleArmL - 0.3)
    expect(holdElbL).toBeLessThan(idleElbL - 0.5)

    avatar.update(1 / 60, {
      speed: 0,
      holding: true,
      itemUse: { id: 'drink', position: [0, 0.02, -0.2], rotation: [-1.22, 0, 0] },
    })
    expect(avatar.rig.arms[1]!.g.rotation.x).toBeLessThan(holdArmL - 0.8)
    expect(avatar.rig.arms[1]!.g.rotation.z).toBeGreaterThan(0.5)
    expect(avatar.rig.headG.rotation.x).toBeLessThan(-0.15)
  })

  it('human arms rest down at the sides, below the waist, and swing below waist level when walking', () => {
    const avatar = createPlayerAvatar(THREE, { cascade: false })
    avatar.update(1 / 60, { speed: 0 })
    // arms hang down at rest (close to 0 rad)
    expect(Math.abs(avatar.rig.arms[0]!.g.rotation.x)).toBeLessThan(0.1)
    expect(Math.abs(avatar.rig.arms[1]!.g.rotation.x)).toBeLessThan(0.1)
    // walking arms swing gently beside the hips, staying within [-0.38, 0.38] rad
    for (let i = 0; i < 60; i++) {
      avatar.update(1 / 60, { speed: 3 })
      expect(Math.abs(avatar.rig.arms[0]!.g.rotation.x)).toBeLessThan(0.38)
      expect(Math.abs(avatar.rig.arms[1]!.g.rotation.x)).toBeLessThan(0.38)
    }
  })

  it('running animation: running leans the torso forward, bends elbows and pumps arms dynamically', () => {
    const avatar = createPlayerAvatar(THREE, { cascade: false })
    run(avatar, 0.5, { speed: 5, running: true })
    expect(avatar.rig.upper.rotation.x).toBeGreaterThan(0.1) // forward torso lean
    expect(avatar.rig.arms[0]!.el.rotation.x).toBeLessThan(-0.8) // bent elbow
    expect(avatar.rig.arms[1]!.el.rotation.x).toBeLessThan(-0.8) // bent elbow
  })

  it('takes a spec override', () => {
    const avatar = createPlayerAvatar(THREE, { spec: { seed: 1, fem: true, skin: 'ffcc99' }, shirtColor: 0xff0000 })
    expect(avatar.rig).toBeDefined()
  })
})
