import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createPlayerAvatar } from '@adatechnology/game-characters-three'
import { coincidentFacesOf, describeCoincidentFaces } from '@adatechnology/game-shapes-three'
import { createArsenal } from '@adatechnology/game-weapons'

import { createHolsteredWeapons } from '../src'

const poseOf = (socket: THREE.Object3D) => {
  socket.updateWorldMatrix(true, false)
  const position = socket.getWorldPosition(new THREE.Vector3())
  const quaternion = socket.getWorldQuaternion(new THREE.Quaternion())
  return { position: [position.x, position.y, position.z] as [number, number, number], quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] as [number, number, number, number] }
}

/** The weapons put away on the player's body: a pistol on the hip, a rifle and a shotgun across the back and hanging on the sling. */
const CASES = [
  ['beretta_92fs', 'hip'],
  ['glock_17', 'hip'],
  ['ak_12', 'back'],
  ['remington_870', 'back'],
  ['ak_12', 'sling'],
  ['remington_870', 'sling'],
] as const

describe('weapons put away on the body', () => {
  const arsenal = createArsenal()

  for (const [weapon, slot] of CASES) {
    it(`${weapon} on the ${slot}: drawn at the place of the body, outside it, no face on a plane of the body's`, () => {
      const avatar = createPlayerAvatar(THREE as never)
      avatar.update(1 / 60, {})
      const scene = new THREE.Scene()
      scene.add(avatar.root)
      scene.updateMatrixWorld(true)
      const before = coincidentFacesOf(avatar.root, { maxHits: Number.POSITIVE_INFINITY }).length
      const holstered = createHolsteredWeapons({ THREE, scene, arsenal, bodySlot: (name) => (name === 'hip' || name === 'back' || name === 'sling' ? poseOf(avatar.slot(name)) : null) })
      holstered.handle({ weapon, slot, on: true })
      holstered.update()
      expect(holstered.drawn).toEqual([weapon])
      const holder = scene.getObjectByName(`holstered_${weapon}`)!
      expect(holder.visible).toBe(true)
      const both = new THREE.Group()
      both.add(avatar.root.clone(), holder.clone())
      both.updateMatrixWorld(true)
      const hits = coincidentFacesOf(both, { maxHits: Number.POSITIVE_INFINITY })
      expect(hits.length - before, describeCoincidentFaces(hits, 4)).toBe(0)
      // on the weapon side of the body for a holster, behind it for a sling, and off the cloth
      const box = new THREE.Box3().setFromObject(holder)
      if (slot === 'hip') expect(box.max.x).toBeLessThan(-0.15)
      else if (slot === 'sling') expect(box.min.z).toBeGreaterThan(0.05)
      else expect(box.max.z).toBeLessThan(-0.1)
      holstered.handle({ weapon, slot, on: false })
      expect(holstered.drawn).toEqual([])
      expect(holder.visible).toBe(false)
      holstered.dispose()
    })
  }
})

describe('a weapon seen going to the body and back (owner, 2026-11-25)', () => {
  const arsenal = createArsenal()
  const setup = () => {
    const avatar = createPlayerAvatar(THREE as never)
    avatar.update(1 / 60, {})
    const scene = new THREE.Scene()
    scene.add(avatar.root)
    scene.updateMatrixWorld(true)
    const slot = (name: string) => (name === 'hip' || name === 'back' || name === 'sling' ? poseOf(avatar.slot(name)) : null)
    // the hand holds the gun ahead of the chest, as the weapon in the hands does
    const hold = { position: [-0.15, 1.35, 0.35] as [number, number, number], quaternion: [0, 0, 0, 1] as [number, number, number, number] }
    const holstered = createHolsteredWeapons({ THREE, scene, arsenal, bodySlot: slot, holdFrame: () => hold })
    return { avatar, scene, holstered, hold }
  }
  const from = { position: [-0.18, 1.2, 0.45] as [number, number, number], quaternion: [0, 0, 0, 1] as [number, number, number, number] }
  const distance = (a: readonly number[], b: readonly number[]): number => Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0))

  it('a rifle swings onto its sling with the hand on its grip all the way, and hangs on the front of the body', () => {
    const { avatar, scene, holstered } = setup()
    holstered.handle({ weapon: 'ak_12', slot: 'sling', on: true, from, seconds: 0.45 })
    const first = holstered.handTargets()?.R
    expect(first).toBeTruthy()
    expect(distance(first!.position, from.position)).toBeLessThan(1e-6)
    let travelled = 0
    let last = first!.position
    for (let i = 0; i < 30; i++) {
      holstered.update(1 / 60)
      const now = holstered.handTargets()?.R
      if (now) {
        travelled += distance(now.position, last)
        last = now.position
      }
    }
    expect(travelled).toBeGreaterThan(0.2)
    expect(holstered.handTargets()).toBeNull()
    const holder = scene.getObjectByName('holstered_ak_12')!
    expect(holder.visible).toBe(true)
    const box = new THREE.Box3().setFromObject(holder)
    const front = avatar.root.worldToLocal(avatar.slot('sling').getWorldPosition(new THREE.Vector3())).z
    // in front of the chest, hanging down from it, with a strap up to the shoulder
    expect(box.min.z).toBeGreaterThan(front - 0.06)
    expect(box.min.y).toBeLessThan(1.0)
    expect(holder.getObjectsByProperty('name', 'cord').length).toBe(2)
  })

  it('the slung rifle swings forward when the body stops short, and never into the body', () => {
    const { avatar, scene, holstered } = setup()
    holstered.handle({ weapon: 'ak_12', slot: 'sling', on: true })
    const swing = scene.getObjectByName('holstered_ak_12')!.children[0]!
    // the body walks forward (+z, the body's front) and stops dead
    for (let i = 0; i < 30; i++) {
      avatar.root.position.z += 0.05
      scene.updateMatrixWorld(true)
      holstered.update(1 / 60)
      expect(-swing.rotation.x).toBeGreaterThanOrEqual(0)
    }
    holstered.update(1 / 60)
    for (let i = 0; i < 6; i++) {
      scene.updateMatrixWorld(true)
      holstered.update(1 / 60)
    }
    expect(-swing.rotation.x).toBeGreaterThan(0.05)
  })

  it('drawn back, it goes from the sling to where it was taken from and the hand stays on it until it is in hand', () => {
    const { scene, holstered } = setup()
    holstered.handle({ weapon: 'ak_12', slot: 'sling', on: true, from, seconds: 0.3 })
    for (let i = 0; i < 30; i++) holstered.update(1 / 60)
    holstered.handle({ weapon: 'ak_12', slot: 'sling', on: false, seconds: 0.3 })
    for (let i = 0; i < 30; i++) holstered.update(1 / 60)
    const hand = holstered.handTargets()?.R
    expect(hand).toBeTruthy()
    expect(distance(hand!.position, from.position)).toBeLessThan(1e-4)
    holstered.inHand('ak_12')
    expect(holstered.handTargets()).toBeNull()
    expect(scene.getObjectByName('holstered_ak_12')!.visible).toBe(false)
    expect(holstered.drawn).toEqual([])
  })

  it('tossed, the weapon falls ahead and down, the hand lets go on the way, and it is gone for the world item', () => {
    const { holstered } = setup()
    holstered.handle({ weapon: 'glock_17', slot: 'ground', on: true, from, seconds: 0.4 })
    expect(holstered.handTargets()).not.toBeNull()
    for (let i = 0; i < 12; i++) holstered.update(1 / 60)
    expect(holstered.handTargets()).toBeNull()
    for (let i = 0; i < 20; i++) holstered.update(1 / 60)
    expect(holstered.drawn).toEqual([])
  })
})

describe('the strap of a slung gun', () => {
  it('goes over the shoulder only once the gun hangs on the body', () => {
    const avatar = createPlayerAvatar(THREE as never)
    avatar.update(1 / 60, {})
    const scene = new THREE.Scene()
    scene.add(avatar.root)
    scene.updateMatrixWorld(true)
    const holstered = createHolsteredWeapons({ THREE, scene, arsenal: createArsenal(), bodySlot: (name) => (name === 'sling' ? poseOf(avatar.slot('sling')) : null), holdFrame: () => ({ position: [0, 1.4, 0.3], quaternion: [0, 0, 0, 1] }) })
    holstered.handle({ weapon: 'ak_12', slot: 'sling', on: true, from: { position: [-0.2, 1.2, 0.45], quaternion: [0, 0, 0, 1] }, seconds: 0.3 })
    const holder = scene.getObjectByName('holstered_ak_12')!
    const cords = holder.getObjectsByProperty('name', 'cord')
    const overShoulder = cords.find((cord) => cord.parent === holder)
    const onGun = cords.find((cord) => cord.parent !== holder)
    holstered.update(0.1)
    expect(overShoulder!.visible).toBe(false)
    expect(onGun!.visible).toBe(true)
    holstered.update(0.3)
    expect(overShoulder!.visible).toBe(true)
  })
})

describe('a gun on its sling hangs by its weight', () => {
  it('stays hanging down when the chest leans forward, and turns with the body about the vertical', () => {
    const arsenal = createArsenal()
    const scene = new THREE.Scene()
    let pitch = 0
    let yaw = 0
    const socket = () => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'))
      return { position: [0, 1.2, 0.1] as [number, number, number], quaternion: [q.x, q.y, q.z, q.w] as [number, number, number, number] }
    }
    const holstered = createHolsteredWeapons({ THREE, scene, arsenal, bodySlot: (name) => (name === 'sling' ? socket() : null) })
    holstered.handle({ weapon: 'ak_12', slot: 'sling', on: true })
    const holder = scene.getObjectByName('holstered_ak_12')!
    const lowest = (): number => new THREE.Box3().setFromObject(holder).min.y
    const upright = lowest()
    // the chest leans forward 40 degrees (looking down): the gun still hangs, its bottom as low as before
    pitch = 0.7
    holstered.update(1 / 60)
    expect(Math.abs(lowest() - upright)).toBeLessThan(0.02)
    yaw = Math.PI / 2
    holstered.update(1 / 60)
    const turn = holder.getWorldQuaternion(new THREE.Quaternion())
    expect(turn.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2))).toBeLessThan(1e-6)
  })
})
