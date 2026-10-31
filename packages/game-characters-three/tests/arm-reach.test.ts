import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { HandPose, HandTargets } from '@adatechnology/game-contracts'

import { ATTACK_CLIPS } from '@adatechnology/game-characters-people'

import { createPlayerAvatar, type ReachView } from '../src'

// Hand targets the weapons module of game-weapons-three gives the room (world space), taken with the eye at 1.70 m over the feet at the origin, looking down -z.
const EYE = new THREE.Vector3(0, 1.7, 0)
const HOLDS: Record<string, HandTargets> = {
  glock_17: {
    R: { position: [0.1255, 1.5236, -0.4301], quaternion: [0.4024, 0.4024, -0.5814, 0.5814] },
    L: { position: [0.0745, 1.4843, -0.4153], quaternion: [-0.5814, 0.5814, 0.4024, 0.4024] },
  },
  shotgun_pump_12: {
    R: { position: [0.214, 1.4634, -0.4806], quaternion: [0.4197, 0.4197, -0.5691, 0.5691] },
    L: { position: [0.2, 1.47, -0.666], quaternion: [1, 0, 0, 0] },
  },
  axe: { R: { position: [0.2, 1.5015, -0.2362], quaternion: [0.7071, 0.7071, 0, 0] }, L: null },
}

/** The same hold with the look turned up (positive) or down about the eye, as the weapon follows the camera. */
const pitched = (targets: HandTargets, pitch: number): HandTargets => {
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch)
  const pose = (hand: HandPose | null | undefined): HandPose | null => {
    if (!hand) return null
    const position = new THREE.Vector3(...hand.position).sub(EYE).applyQuaternion(turn).add(EYE)
    const quaternion = new THREE.Quaternion(...hand.quaternion).premultiply(turn)
    return { position: [position.x, position.y, position.z], quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] }
  }
  return { R: pose(targets.R), L: pose(targets.L) }
}

const standing = (): ReturnType<typeof createPlayerAvatar> => {
  const avatar = createPlayerAvatar(THREE, { cascade: false })
  avatar.root.rotation.set(0, Math.PI, 0) // as the room turns it: the body's front is +z, the look -z
  return avatar
}
const handGroup = (avatar: ReturnType<typeof createPlayerAvatar>, side: 'R' | 'L'): THREE.Object3D =>
  ((side === 'R' ? avatar.rig.arms[1]! : avatar.rig.arms[0]!).el as unknown as THREE.Object3D).getObjectByName(`hand_group_${side}`)!
const elbowBend = (avatar: ReturnType<typeof createPlayerAvatar>, side: 'R' | 'L'): number => -(side === 'R' ? avatar.rig.arms[1]! : avatar.rig.arms[0]!).el.rotation.x
const palmMiss = (avatar: ReturnType<typeof createPlayerAvatar>, side: 'R' | 'L', pose: HandPose): number =>
  handGroup(avatar, side).localToWorld(new THREE.Vector3(0, -0.042, 0)).distanceTo(new THREE.Vector3(...pose.position))

describe('third-person reach: shoulder, elbow and wrist to the tool in the hands', () => {
  for (const [weapon, hold] of Object.entries(HOLDS)) {
    for (const pitch of [-0.3, 0, 0.3]) {
      it(`${weapon} at pitch ${pitch}: each palm on its grip, the elbow bent`, () => {
        const avatar = standing()
        const targets = pitched(hold, pitch)
        avatar.update(1 / 60, { armed: weapon !== 'axe', pitch: -pitch })
        avatar.reach(targets)
        avatar.root.updateMatrixWorld(true)
        for (const side of ['R', 'L'] as const) {
          const pose = targets[side]
          if (!pose) continue
          expect(palmMiss(avatar, side, pose)).toBeLessThan(0.025) // within half a palm
          expect(elbowBend(avatar, side)).toBeGreaterThan(0.3)
          expect(elbowBend(avatar, side)).toBeLessThan(2.51)
        }
      })
    }
  }

  it('a hold out of the arm\'s range (the look far up or down) stops each joint at its limit, never a locked elbow', () => {
    for (const [weapon, hold] of Object.entries(HOLDS)) {
      for (const pitch of [-0.6, 0.6]) {
        const avatar = standing()
        avatar.update(1 / 60, { armed: weapon !== 'axe', pitch: -pitch })
        avatar.reach(pitched(hold, pitch))
        for (const side of ['R', 'L'] as const) {
          if (!hold[side]) continue
          expect(elbowBend(avatar, side)).toBeGreaterThanOrEqual(0.12 - 1e-9)
          expect(elbowBend(avatar, side)).toBeLessThanOrEqual(2.5 + 1e-9)
        }
      }
    }
  })

  it('the support arm of a shotgun no longer locks straight, the chest turns it forward', () => {
    const avatar = standing()
    avatar.update(1 / 60, { armed: true, pitch: 0 })
    const straight = elbowBend(avatar, 'L')
    avatar.reach(HOLDS.shotgun_pump_12!)
    expect(straight).toBeLessThan(0.15)
    expect(elbowBend(avatar, 'L')).toBeGreaterThan(0.4)
    expect(avatar.rig.upper.rotation.y).toBeLessThan(-0.1)
  })

  it('the next update gets back the pose it gave, and null, a strike or a fall leave the arms alone', () => {
    const avatar = standing()
    avatar.update(1 / 60, { armed: true, pitch: 0 })
    const posed = avatar.rig.arms.map((arm) => arm.el.rotation.x)
    const chest = avatar.rig.upper.rotation.y
    avatar.reach(HOLDS.shotgun_pump_12!)
    avatar.update(0, { armed: true, pitch: 0 })
    expect(avatar.rig.arms.map((arm) => arm.el.rotation.x)).toEqual(posed)
    expect(avatar.rig.upper.rotation.y).toBe(chest)
    avatar.reach(null)
    expect(avatar.rig.arms.map((arm) => arm.el.rotation.x)).toEqual(posed)
    avatar.play(ATTACK_CLIPS.find((clip) => clip.id === 'punch_right')!)
    avatar.update(1 / 60, { armed: true, pitch: 0 })
    const striking = avatar.rig.arms.map((arm) => arm.el.rotation.x)
    avatar.reach(HOLDS.shotgun_pump_12!)
    expect(avatar.rig.arms.map((arm) => arm.el.rotation.x)).toEqual(striking)
  })
})

describe('reach seen from the body\'s own eyes (view)', () => {
  const eyes = (): THREE.PerspectiveCamera => {
    const camera = new THREE.PerspectiveCamera()
    camera.position.copy(EYE)
    camera.updateMatrixWorld(true)
    return camera
  }
  const far = (x: number, z: number): HandTargets => ({
    R: { position: [-x, 1.45, z], quaternion: [0.4024, 0.4024, -0.5814, 0.5814] },
    L: { position: [x, 1.45, z], quaternion: [-0.5814, 0.5814, 0.4024, 0.4024] },
  })
  const reached = (targets: HandTargets, view?: ReachView | null): ReturnType<typeof createPlayerAvatar> => {
    const avatar = standing()
    avatar.update(1 / 60, { armed: true, pitch: 0 })
    avatar.reach(targets, view)
    avatar.root.updateMatrixWorld(true)
    return avatar
  }
  const handDepth = (avatar: ReturnType<typeof createPlayerAvatar>, side: 'R' | 'L'): number =>
    -handGroup(avatar, side).localToWorld(new THREE.Vector3(0, -0.042, 0)).z

  it('a hand far out in front keeps the elbow bent past the reach bend instead of straightening', () => {
    const targets = far(0.15, -1.1)
    const free = reached(targets)
    const viewed = reached(targets, { camera: eyes() })
    for (const [side, bend] of [['R', 1.35], ['L', 0.95]] as const) {
      expect(elbowBend(free, side)).toBeLessThan(bend - 0.1)
      expect(elbowBend(viewed, side)).toBeGreaterThanOrEqual(bend - 0.02)
    }
    expect(handDepth(viewed, 'R')).toBeLessThan(handDepth(free, 'R') + 1e-9) // the hand stops short of the target
  })

  it('the bend is configurable', () => {
    const avatar = reached(far(0.15, -1.1), { camera: eyes(), reachBend: [0.6, 0.6] })
    expect(elbowBend(avatar, 'R')).toBeGreaterThanOrEqual(0.58)
    expect(elbowBend(avatar, 'R')).toBeLessThan(1.2)
  })

  it('a hand behind a wall stays its reach and a margin in front of it', () => {
    const wall = 0.3
    const contact = (_o: number[], _d: number[], max: number): number | null => (wall <= max ? wall : null)
    const targets = far(0.15, -0.8)
    const free = reached(targets, { camera: eyes() })
    const kept = reached(targets, { camera: eyes(), keepOutside: { contact: contact as never } })
    expect(handDepth(free, 'R')).toBeGreaterThan(wall + 0.05)
    expect(handDepth(kept, 'R')).toBeLessThan(wall - 0.005 + 0.01)
    expect(handDepth(kept, 'R')).toBeGreaterThan(0.2)
    const wider = reached(targets, { camera: eyes(), keepOutside: { contact: contact as never, margin: 0.05 } })
    expect(handDepth(wider, 'R')).toBeLessThan(handDepth(kept, 'R') - 0.03)
  })

  it('a hand pulled back by a wall at 0.1 m stops at 0.12 m from the eye, never nearer', () => {
    const targets: HandTargets = { R: { position: [-0.15, 1.45, -0.6], quaternion: [0.4024, 0.4024, -0.5814, 0.5814] }, L: null }
    const contact = (): number | null => 0.1
    const loose = reached(targets, { camera: eyes() })
    const kept = reached(targets, { camera: eyes(), keepOutside: { contact: contact as never } })
    expect(handDepth(loose, 'R')).toBeGreaterThan(0.4)
    expect(handDepth(kept, 'R')).toBeGreaterThan(0.1)
    expect(handDepth(kept, 'R')).toBeLessThan(0.16)
    const nearest = reached(targets, { camera: eyes(), keepOutside: { contact: contact as never, nearest: 0.3 } })
    expect(handDepth(nearest, 'R')).toBeGreaterThan(0.27)
  })

  it('without a view nothing changes', () => {
    const targets = far(0.15, -1.1)
    const plain = reached(targets)
    for (const view of [undefined, null]) {
      const same = reached(targets, view)
      expect(same.rig.arms.map((arm) => [(arm.g as unknown as THREE.Object3D).quaternion.toArray(), arm.el.rotation.x])).toEqual(plain.rig.arms.map((arm) => [(arm.g as unknown as THREE.Object3D).quaternion.toArray(), arm.el.rotation.x]))
      expect(same.rig.upper.rotation.y).toBe(plain.rig.upper.rotation.y)
    }
  })
})
