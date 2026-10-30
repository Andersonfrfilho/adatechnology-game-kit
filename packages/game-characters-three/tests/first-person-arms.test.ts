import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ATTACK_CLIPS, FIRST_PERSON_CLIPS } from '@adatechnology/game-characters-people'
import type { HandTargets } from '@adatechnology/game-contracts'

import { createFirstPersonArms, createPlayerAvatar, toRoomAvatar } from '../src'
import { createTwoBone, solveTwoBone } from '../src/first-person/ik'

const camera = (): THREE.Object3D => {
  const object = new THREE.Object3D()
  object.updateMatrixWorld(true)
  return object
}
const step = (arms: ReturnType<typeof createFirstPersonArms>, seconds: number, state: Parameters<ReturnType<typeof createFirstPersonArms>['update']>[1]): void => {
  for (let i = 0; i < Math.round(seconds * 120); i++) arms.update(1 / 120, state)
}

describe('two-bone IK', () => {
  it('puts the end on a target within reach, to under a millimetre, with the bones at their lengths', () => {
    const out = createTwoBone(THREE)
    const root = new THREE.Vector3(0.2, -0.2, 0)
    const target = new THREE.Vector3(0.1, -0.3, -0.45)
    solveTwoBone(root, target, 0.32, 0.3, new THREE.Vector3(0.5, -1, 0.3), out)
    expect(out.clamped).toBe(false)
    expect(out.end.distanceTo(target)).toBeLessThan(0.001)
    expect(out.joint.distanceTo(root)).toBeCloseTo(0.32, 4)
    expect(out.joint.distanceTo(out.end)).toBeCloseTo(0.3, 4)
  })

  it('clamps a target out of reach to the full stretch on the same line, and a too-near one to the fold', () => {
    const out = createTwoBone(THREE)
    const root = new THREE.Vector3()
    solveTwoBone(root, new THREE.Vector3(0, 0, -2), 0.32, 0.3, new THREE.Vector3(0, -1, 0), out)
    expect(out.clamped).toBe(true)
    expect(out.end.length()).toBeCloseTo(0.62, 3)
    expect(out.end.x).toBeCloseTo(0, 6)
    solveTwoBone(root, new THREE.Vector3(0, 0, -0.001), 0.32, 0.3, new THREE.Vector3(0, -1, 0), out)
    expect(out.clamped).toBe(true)
    expect(out.end.length()).toBeGreaterThan(0.019)
  })

  it('bends the elbow toward the pole', () => {
    const out = createTwoBone(THREE)
    solveTwoBone(new THREE.Vector3(), new THREE.Vector3(0, 0, -0.45), 0.32, 0.3, new THREE.Vector3(0, -1, 0), out)
    expect(out.joint.y).toBeLessThan(-0.05)
  })
})

describe('hands hidden while idle', () => {
  const shownOf = (arms: ReturnType<typeof createFirstPersonArms>): boolean[] => {
    const flags: boolean[] = []
    arms.root.traverse((object) => {
      if (object.name.startsWith('first-person-hand-') || object.name.startsWith('first-person-elbow-')) flags.push(object.visible)
    })
    return flags
  }

  it('draws no hand while walking with nothing in them, and draws both for a held tool, fists or a shove', () => {
    const arms = createFirstPersonArms(THREE, { hideWhenIdle: true, clips: FIRST_PERSON_CLIPS })
    step(arms, 1, { camera: camera(), stance: 'relaxed', speed: 3 })
    expect(shownOf(arms).every((flag) => !flag)).toBe(true)
    step(arms, 0.6, { camera: camera(), stance: 'fists' })
    expect(shownOf(arms).every((flag) => flag)).toBe(true)
    step(arms, 0.6, { camera: camera(), stance: 'relaxed' })
    expect(shownOf(arms).every((flag) => !flag)).toBe(true)
    arms.play('shove_two_hands')
    step(arms, 0.25, { camera: camera(), stance: 'relaxed' })
    expect(shownOf(arms).every((flag) => flag)).toBe(true)
    step(arms, 1, { camera: camera(), stance: 'relaxed' })
    expect(shownOf(arms).every((flag) => !flag)).toBe(true)
  })

  it('keeps the hands drawn when the option is off (the default)', () => {
    const arms = createFirstPersonArms(THREE)
    step(arms, 1, { camera: camera(), stance: 'relaxed' })
    expect(shownOf(arms).every((flag) => flag)).toBe(true)
  })
})

describe('createFirstPersonArms', () => {
  const target = (x: number, y: number, z: number): HandTargets => ({ R: { position: [x, y, z], quaternion: [0, 0, 0, 1] }, L: null, grip: 0.9, gripL: 0.5, scale: 1 })

  it('follows a hand target in the hold stance (the target in world space, the camera at the origin)', () => {
    const arms = createFirstPersonArms(THREE)
    step(arms, 1, { camera: camera(), targets: target(0.12, -0.28, -0.4), stance: 'hold' })
    const pose = arms.handPose('R')
    expect(pose.position.distanceTo(new THREE.Vector3(0.12, -0.28, -0.4))).toBeLessThan(0.001)
    expect(pose.grip).toBeCloseTo(0.9, 2)
    expect(arms.stance).toBe('hold')
  })

  it('moves with the camera: the arms stay in its view', () => {
    const arms = createFirstPersonArms(THREE)
    const eye = camera()
    eye.position.set(3, 1.7, -2)
    eye.rotation.y = 1
    eye.updateMatrixWorld(true)
    step(arms, 0.5, { camera: eye, stance: 'relaxed' })
    const world = arms.handPose('R').position.clone().applyMatrix4(arms.root.matrixWorld)
    const local = eye.worldToLocal(world.clone())
    expect(local.z).toBeLessThan(-0.2)
    expect(world.distanceTo(eye.position)).toBeLessThan(0.7)
  })

  it('changes stance: relaxed hands open, fists close, and a hold without targets falls back to relaxed', () => {
    const arms = createFirstPersonArms(THREE)
    step(arms, 0.6, { camera: camera(), stance: 'relaxed' })
    const open = arms.handPose('R').grip
    step(arms, 0.6, { camera: camera(), stance: 'fists' })
    expect(arms.stance).toBe('fists')
    expect(arms.handPose('R').grip).toBeGreaterThan(open + 0.4)
    step(arms, 0.6, { camera: camera(), stance: 'hold', targets: null })
    expect(arms.handPose('R').grip).toBeCloseTo(open, 1)
  })

  it('plays a registered clip, answers false for an unknown one, and fires the impact once, at the clip time', () => {
    const arms = createFirstPersonArms(THREE, { clips: FIRST_PERSON_CLIPS })
    expect(arms.play('no_such_clip')).toBe(false)
    const events: Array<{ clip: string; type: string; at: number }> = []
    let clock = 0
    arms.on('event', (event) => events.push({ clip: event.clip, type: event.type, at: clock }))
    expect(arms.play('punch_right')).toBe(true)
    expect(arms.playing).toBe('punch_right')
    for (; clock < 0.8; clock += 1 / 120) arms.update(1 / 120, { camera: camera(), stance: 'fists' })
    const impacts = events.filter((event) => event.type === 'impact')
    expect(impacts).toHaveLength(1)
    expect(impacts[0]!.at).toBeGreaterThanOrEqual(0.14 - 1 / 120 - 1e-6)
    expect(impacts[0]!.at).toBeLessThan(0.14 + 0.02)
    expect(arms.playing).toBeNull()
  })

  it('a punch pushes the right fist forward at the impact', () => {
    const arms = createFirstPersonArms(THREE, { clips: FIRST_PERSON_CLIPS })
    step(arms, 0.6, { camera: camera(), stance: 'fists' })
    const guard = arms.handPose('R').position.clone()
    arms.play('punch_right')
    step(arms, 0.14, { camera: camera(), stance: 'fists' })
    expect(arms.handPose('R').position.z).toBeLessThan(guard.z - 0.1)
  })

  it('a shove at its impact has both palms facing forward with the fingers up (the clip orientation reaches the hand)', () => {
    const arms = createFirstPersonArms(THREE, { clips: FIRST_PERSON_CLIPS })
    step(arms, 0.6, { camera: camera(), stance: 'relaxed' })
    arms.play('shove_two_hands')
    step(arms, 0.26, { camera: camera(), stance: 'relaxed' })
    for (const side of ['R', 'L'] as const) {
      const { quaternion } = arms.handPose(side)
      const fingers = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion)
      const back = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)
      expect(fingers.y).toBeGreaterThan(0.85)
      expect(back.z).toBeGreaterThan(0.5)
    }
  })

  it('a shove against a wall 0.4 m ahead stops the hands at the wall and bends the elbows', () => {
    const impact = (wall: number | null): { depth: number; elbow: THREE.Vector3 } => {
      const arms = createFirstPersonArms(THREE, { clips: FIRST_PERSON_CLIPS })
      const state = { camera: camera(), stance: 'relaxed', contact: (_o: number[], _d: number[], max: number): number | null => (wall !== null && wall <= max ? wall : null) }
      step(arms, 0.6, state)
      arms.play('shove_two_hands')
      step(arms, 0.26, state)
      return { depth: Math.max(-arms.handPose('R').position.z, -arms.handPose('L').position.z), elbow: arms.root.getObjectByName('first-person-elbow-R')!.position.clone() }
    }
    const free = impact(null)
    const blocked = impact(0.4)
    expect(free.depth).toBeGreaterThan(0.45)
    expect(blocked.depth).toBeLessThanOrEqual(0.4)
    expect(blocked.depth).toBeGreaterThan(0.3)
    // the forearm folds back: the elbow rides further out and up than with the arm stretched
    expect(blocked.elbow.distanceTo(free.elbow)).toBeGreaterThan(0.02)
  })

  it('a kick against a wall stops the foot in front of it', () => {
    const arms = createFirstPersonArms(THREE, { clips: FIRST_PERSON_CLIPS })
    const leg = arms.root.getObjectByName('first-person-leg')!
    const state = { camera: camera(), stance: 'relaxed', contact: (): number | null => 0.5 }
    step(arms, 0.3, state)
    arms.play('front_kick')
    step(arms, 0.32, state)
    const box = new THREE.Box3().setFromObject(leg)
    expect(leg.visible).toBe(true)
    expect(-box.min.z).toBeLessThanOrEqual(0.5)
  })

  it('a kick shows the right leg while it lasts', () => {
    const arms = createFirstPersonArms(THREE, { clips: FIRST_PERSON_CLIPS })
    const leg = arms.root.getObjectByName('first-person-leg')!
    step(arms, 0.3, { camera: camera(), stance: 'relaxed' })
    expect(leg.visible).toBe(false)
    arms.play('front_kick')
    step(arms, 0.32, { camera: camera(), stance: 'relaxed' })
    expect(leg.visible).toBe(true)
    step(arms, 0.6, { camera: camera(), stance: 'relaxed' })
    expect(leg.visible).toBe(false)
  })

  it('a kick with the left leg shows the foot on the left, mirrored, with the same impact second', () => {
    const arms = createFirstPersonArms(THREE, { clips: FIRST_PERSON_CLIPS })
    const footX = (leg: 'left' | 'right'): number => {
      arms.play('front_kick', { leg })
      step(arms, 0.32, { camera: camera(), stance: 'relaxed' })
      const shoe = arms.root.getObjectByName('first-person-leg')!.children.find((child) => child.type === 'Group')!
      const x = shoe.position.x
      step(arms, 0.7, { camera: camera(), stance: 'relaxed' })
      return x
    }
    const right = footX('right')
    const left = footX('left')
    expect(right).toBeGreaterThan(0.05)
    expect(left).toBeCloseTo(-right, 3)
  })

  it('a punch with the left hand throws the left fist, mirrored, and leaves the right one in its guard', () => {
    const punch = (hand: 'left' | 'right'): { R: THREE.Vector3; L: THREE.Vector3 } => {
      const arms = createFirstPersonArms(THREE, { clips: FIRST_PERSON_CLIPS })
      step(arms, 0.6, { camera: camera(), stance: 'fists' })
      arms.play('punch_right', { hand })
      step(arms, 0.14, { camera: camera(), stance: 'fists' })
      return { R: arms.handPose('R').position.clone(), L: arms.handPose('L').position.clone() }
    }
    const guard = (() => {
      const arms = createFirstPersonArms(THREE, { clips: FIRST_PERSON_CLIPS })
      step(arms, 0.76, { camera: camera(), stance: 'fists' })
      return { R: arms.handPose('R').position.clone(), L: arms.handPose('L').position.clone() }
    })()
    const right = punch('right')
    const left = punch('left')
    expect(left.L.z).toBeLessThan(guard.L.z - 0.1)
    expect(left.R.distanceTo(guard.R)).toBeLessThan(1e-6)
    // the mirror image of the right punch
    expect(left.L.x).toBeCloseTo(-right.R.x, 3)
    expect(left.L.z).toBeCloseTo(right.R.z, 3)
  })

  it('dispose releases the geometries and materials without throwing', () => {
    const arms = createFirstPersonArms(THREE)
    expect(() => arms.dispose()).not.toThrow()
  })
})

describe('toRoomAvatar with the first-person arms', () => {
  it('gives the arms by default and none with firstPerson: false', () => {
    const withArms = toRoomAvatar(createPlayerAvatar(THREE))
    expect(withArms.arms).not.toBeNull()
    expect(withArms.firstPerson?.root).toBe(withArms.arms!.root)
    const without = toRoomAvatar(createPlayerAvatar(THREE), { firstPerson: false })
    expect(without.arms).toBeNull()
    expect(without.firstPerson).toBeUndefined()
    expect(without.strike('punch_right')).not.toBeNull()
  })

  it('dresses the arms in the colours of the body', () => {
    const avatar = createPlayerAvatar(THREE)
    const room = toRoomAvatar(avatar)
    const colors = new Set<number>()
    room.arms!.root.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined
      if (material?.color) colors.add(material.color.getHex())
    })
    expect(colors.has(avatar.colors.skin)).toBe(true)
    expect(colors.has(avatar.colors.shirt) || colors.has(avatar.colors.skin)).toBe(true)
  })

  it.each([
    ['punch_right', 0.14],
    ['shove_two_hands', 0.26],
    ['front_kick', 0.32],
  ])('strike(%s) plays on the body and the arms and answers the attack clip impact second (%f)', (id, seconds) => {
    const room = toRoomAvatar(createPlayerAvatar(THREE))
    const clip = ATTACK_CLIPS.find((candidate) => candidate.id === id)!
    expect(clip.events!.find((event) => event.type === 'impact')!.t).toBe(seconds)
    expect(room.strike(id)).toBe(seconds)
    expect(room.arms!.playing).toBe(id)
    expect(room.avatar.playing).not.toBeNull()
    expect(room.strike('unknown')).toBeNull()
  })

  it('a kick with the left leg plays the mirrored body clip, with the same impact second as the right', () => {
    const room = toRoomAvatar(createPlayerAvatar(THREE))
    const right = room.strike('front_kick', { leg: 'right' })
    const rightClip = room.avatar.playing
    const left = room.strike('front_kick', { leg: 'left' })
    expect(left).toBe(right)
    expect(room.avatar.playing).not.toBe(rightClip)
    expect(room.avatar.playing).toBe('front_kick_left')
  })

  it('a punch with the left hand plays the mirrored body clip and the left fist on the arms, with the same impact second', () => {
    const room = toRoomAvatar(createPlayerAvatar(THREE))
    const right = room.strike('punch_right', { hand: 'right' })
    expect(room.avatar.playing).toBe('punch_right')
    const left = room.strike('punch_right', { hand: 'left' })
    expect(left).toBe(right)
    expect(room.avatar.playing).toBe('punch_right_left')
    expect(room.arms!.playing).toBe('punch_right')
  })

  const standing = { speed: 0, running: false, crouch: false, down: false, armed: false, pitch: 0 }
  const run = (room: ReturnType<typeof toRoomAvatar>, seconds: number, state = standing): void => {
    for (let t = 0; t < seconds; t += 1 / 60) room.update(1 / 60, state)
  }

  it('holds the guard after a punch while the body stands, then drops it', () => {
    const room = toRoomAvatar(createPlayerAvatar(THREE), { firstPerson: false })
    run(room, 0.2)
    room.strike('jab', { hand: 'left' })
    run(room, 0.5)
    expect(room.avatar.playing).toBe('fight_guard')
    // the next punch leaves from the guard
    room.strike('punch_right', { hand: 'right' })
    expect(room.avatar.playing).toBe('punch_right')
    run(room, 0.5)
    expect(room.avatar.playing).toBe('fight_guard')
    run(room, 1.5)
    expect(room.avatar.playing).toBe(null)
  })

  it('gives the legs back to the walk: no guard while it moves, and none after a kick', () => {
    const walking = toRoomAvatar(createPlayerAvatar(THREE), { firstPerson: false })
    walking.strike('punch_right')
    run(walking, 0.6, { ...standing, speed: 1.4 })
    expect(walking.avatar.playing).not.toBe('fight_guard')
    const kick = toRoomAvatar(createPlayerAvatar(THREE), { firstPerson: false })
    kick.strike('front_kick')
    run(kick, 0.9)
    expect(kick.avatar.playing).not.toBe('fight_guard')
    const none = toRoomAvatar(createPlayerAvatar(THREE), { firstPerson: false, guardClip: false })
    none.strike('punch_right')
    run(none, 0.5)
    expect(none.avatar.playing).not.toBe('fight_guard')
  })
})

describe('the index finger on the trigger', () => {
  it('is straight along the frame at rest and curls at least 60 degrees at its first joint when pulled, the other fingers staying where the grip puts them', async () => {
    const { createHandMesh } = await import('../src/first-person/hand')
    const hand = createHandMesh(THREE, new THREE.MeshBasicMaterial())
    const joints = (): number[][] => hand.root.children.filter((child) => child.type === 'Group' && child.children.length > 0 && child.position.z !== 0 && child !== undefined).map((finger) => {
      const out: number[] = []
      let part: THREE.Object3D | undefined = finger
      while (part) {
        out.push(part.rotation.z)
        part = part.children.find((child) => child.type === 'Group')
      }
      return out
    })
    hand.setGrip(0.9)
    const grip = joints()
    hand.setIndex(0)
    const extended = joints()
    expect(extended[0]!.every((angle) => Math.abs(angle) < 1e-9)).toBe(true)
    hand.setIndex(1)
    const pulled = joints()
    expect((Math.abs(pulled[0]![0]!) * 180) / Math.PI).toBeGreaterThanOrEqual(60)
    for (const finger of [1, 2, 3]) expect(pulled[finger]).toEqual(grip[finger])
    hand.setIndex(undefined)
    expect(joints()[0]).toEqual(grip[0])
  })
})

describe('the support arm under a rifle', () => {
  // the hand of an M4 held at rest, in the camera's space: 0.65 m ahead, a little to the right and low, palm up and the fingers rising to the right
  const cup = (): HandTargets => {
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(Math.cos(0.5), Math.sin(0.5), 0), new THREE.Vector3(Math.sin(0.5), -Math.cos(0.5), 0), new THREE.Vector3(0, 0, -1)))
    const grip: HandTargets['R'] = { position: [0.2, -0.3, -0.36], quaternion: [0, 0, 0, 1] }
    return { R: grip, L: { position: [0.156, -0.255, -0.647], quaternion: [q.x, q.y, q.z, q.w] }, grip: 0.9, gripL: 0.6, scale: 1 }
  }
  it('comes from below: the elbow hangs under the wrist and the forearm does not sweep in from the side', () => {
    const arms = createFirstPersonArms(THREE)
    step(arms, 1, { camera: camera(), targets: cup(), stance: 'hold' })
    const { elbow, wrist, shoulder } = arms.joints('L')
    const fore = wrist.clone().sub(elbow)
    expect(wrist.y - elbow.y, 'the elbow is under the wrist').toBeGreaterThan(0.1)
    expect((Math.atan2(fore.x, -fore.z) * 180) / Math.PI, 'few degrees off the forward').toBeLessThan(25)
    expect(Math.atan2(fore.y, Math.hypot(fore.x, fore.z)) * (180 / Math.PI), 'rising to the hand').toBeGreaterThan(20)
    // the left shoulder sits nearer the middle than the right one (the arm does not pass beside the gun)
    expect(Math.abs(shoulder.x)).toBeLessThan(0.1)
  })
})
