import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { HandPose, HandTargets, Vec3 } from '@adatechnology/game-contracts'

import { ATTACK_CLIPS } from '@adatechnology/game-characters-people'

import { createPlayerAvatar } from '../src'
import holds from './fixtures/shovel-dig-holds.json'

/**
 * A shovelful in the hands, frame by frame: the targets the shovel gave the room in the test room (the tool on the body, its dig motion playing), in the avatar root's
 * space, at the share of the dig they came at. The body plays `shovel_dig` (trunk and legs) and the arms reach the tool: each palm stays on the shaft.
 */
type HoldFrame = { readonly at: number; readonly R: HandPose; readonly L: HandPose; readonly slideL: { readonly from: Vec3; readonly to: Vec3 } }

const FRAMES = holds as unknown as readonly HoldFrame[]
const DIG = ATTACK_CLIPS.find((clip) => clip.id === 'shovel_dig')!
/** The most a palm may be off the shaft, metres (the hand around a 3.5 cm handle). */
const ON_SHAFT = 0.03
/** One frame of the room in the slow motion the dig was recorded in. */
const FRAME = 1 / 240

const toWorld = (matrix: THREE.Matrix4, turn: THREE.Quaternion, pose: HandPose): HandPose => {
  const position = new THREE.Vector3(...pose.position).applyMatrix4(matrix)
  const quaternion = new THREE.Quaternion(...pose.quaternion).premultiply(turn)
  return { position: [position.x, position.y, position.z], quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] }
}
const point = (matrix: THREE.Matrix4, at: Vec3): Vec3 => {
  const p = new THREE.Vector3(...at).applyMatrix4(matrix)
  return [p.x, p.y, p.z]
}
const palmOf = (avatar: ReturnType<typeof createPlayerAvatar>, side: 'R' | 'L'): THREE.Vector3 =>
  ((side === 'R' ? avatar.rig.arms[1]! : avatar.rig.arms[0]!).el as unknown as THREE.Object3D).getObjectByName(`hand_group_${side}`)!.localToWorld(new THREE.Vector3(0, -0.042, 0))
/** The distance from a point to the line through two points. */
const offLine = (p: THREE.Vector3, a: Vec3, b: Vec3): number => {
  const from = new THREE.Vector3(...a)
  const axis = new THREE.Vector3(...b).sub(from).normalize()
  const rel = p.clone().sub(from)
  return rel.sub(axis.multiplyScalar(rel.dot(axis))).length()
}

describe('two hands on one tool: the left hand stays on the shaft through a shovelful', () => {
  it('the recorded dig has frames from the start of the clip to its end', () => {
    expect(DIG.channels).toBe('body')
    expect(FRAMES.length).toBeGreaterThan(30)
    expect(FRAMES[0]!.at).toBe(0)
    expect(FRAMES[FRAMES.length - 1]!.at).toBe(1)
  })

  it('in every frame each palm is within 3 cm of the shaft, the elbows inside their range', () => {
    // as in the room: the joints follow the clip smoothly, frames of 1/60 s in the slow motion the dig was recorded in (a quarter of the speed)
    const avatar = createPlayerAvatar(THREE)
    avatar.root.rotation.set(0, Math.PI, 0)
    avatar.play(DIG)
    // the room passes its eye in both views, looking down at the ground being dug 0.9 m ahead, with the ground as the surface the hands keep out of
    const camera = new THREE.PerspectiveCamera()
    const ground = (origin: [number, number, number], direction: [number, number, number], maxDistance: number): number | null => {
      if (direction[1] >= 0) return null
      const distance = -origin[1] / direction[1]
      return distance <= maxDistance ? distance : null
    }
    const view = { camera, keepOutside: { contact: ground } }
    let time = 0
    const misses: string[] = []
    for (const frame of FRAMES) {
      const until = frame.at * DIG.duration
      while (time < until - 1e-9) {
        const step = Math.min(FRAME, until - time)
        avatar.update(step, { armed: true, pitch: -0.6 })
        time += step
      }
      avatar.root.updateMatrixWorld(true)
      camera.position.copy(avatar.eye())
      camera.lookAt(0, 0, -0.9)
      camera.updateMatrixWorld(true)
      const matrix = avatar.root.matrixWorld
      const turn = avatar.root.getWorldQuaternion(new THREE.Quaternion())
      const R = toWorld(matrix, turn, frame.R)
      const L = toWorld(matrix, turn, frame.L)
      const shaft = { from: point(matrix, frame.slideL.from), to: point(matrix, frame.slideL.to) }
      const targets: HandTargets = { R, L, slideL: shaft }
      avatar.reach(targets, view)
      avatar.root.updateMatrixWorld(true)
      const right = palmOf(avatar, 'R').distanceTo(new THREE.Vector3(...R.position))
      const left = offLine(palmOf(avatar, 'L'), shaft.from, shaft.to)
      if (right > ON_SHAFT || left > ON_SHAFT) misses.push(`at ${frame.at}: right ${right.toFixed(3)} left ${left.toFixed(3)}`)
      for (const arm of avatar.rig.arms) {
        expect(-arm.el.rotation.x).toBeGreaterThanOrEqual(0.12 - 1e-9)
        expect(-arm.el.rotation.x).toBeLessThanOrEqual(2.5 + 1e-9)
      }
    }
    expect(misses).toEqual([])
  })

  it('a left grip in reach is kept where the tool puts it: the hand slides only when it has to', () => {
    const avatar = createPlayerAvatar(THREE, { cascade: false })
    avatar.root.rotation.set(0, Math.PI, 0)
    avatar.update(1 / 60, { armed: true, pitch: 0 })
    avatar.root.updateMatrixWorld(true)
    const shoulder = avatar.shoulder('L').getWorldPosition(new THREE.Vector3())
    const R: HandPose = { position: [shoulder.x - 0.35, shoulder.y - 0.3, shoulder.z + 0.2], quaternion: [0.7071, 0.7071, 0, 0] }
    const L: HandPose = { position: [shoulder.x - 0.05, shoulder.y - 0.3, shoulder.z + 0.3], quaternion: [0.7071, 0.7071, 0, 0] }
    avatar.reach({ R, L, slideL: { from: [R.position[0] + 0.1, R.position[1], R.position[2]], to: [L.position[0] + 0.3, L.position[1], L.position[2]] } })
    avatar.root.updateMatrixWorld(true)
    expect(palmOf(avatar, 'L').distanceTo(new THREE.Vector3(...L.position))).toBeLessThan(0.025)
  })
})

describe('a strike in slow motion keeps the world\'s clock', () => {
  it('clipRate plays the clip at the world\'s pace while the body is updated in real time', () => {
    const avatar = createPlayerAvatar(THREE)
    avatar.play(DIG)
    for (let k = 0; k < 90; k++) avatar.update(1 / 60, { clipRate: 0.25 }) // 1.5 s of real time, a quarter of the dig
    expect(avatar.playing).toBe('shovel_dig')
    for (let k = 0; k < 300; k++) avatar.update(1 / 60, { clipRate: 0.25 })
    expect(avatar.playing).toBeNull()
  })
})
