import { createCharacters, createRng } from '@adatechnology/game-characters'
import type { DestructionEvent } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { PENDULUM, createBestBuilder, createEye, createFluidsBridge, createPendulum, createRigAnimator, createWounds, findEyes, stepPendulum, woundBodyOf } from '../src'
import type { BloodSink, RichRig } from '../src'

const best = createBestBuilder(THREE, { types: [{ name: 'Lento', eye: 0xff2020 }], random: () => 0.5 })

const setup = () => {
  const scene = new THREE.Scene()
  const root = best.build({ type: 'Lento', decay: 1, seed: 4, phase: 0 }) as THREE.Object3D
  scene.add(root)
  scene.updateMatrixWorld(true)
  const splashes: { liquid: string; point: number[]; liters: number }[] = []
  const sink: BloodSink = { splash: (liquid, point, liters) => void splashes.push({ liquid, point, liters }) }
  const wounds = createWounds(THREE, { random: createRng(9), scene, bridge: createFluidsBridge({ sink }) })
  const body = wounds.track(woundBodyOf(root)!)
  return { scene, root, wounds, body, splashes, rig: root.userData.rig as RichRig }
}

const bodyEvent = (change: 'wound' | 'broken' | 'severed' | 'destroyed' | 'split' | 'limp' | 'crawl' | 'stunned' | 'killed', part?: string, extra: object = {}): DestructionEvent =>
  ({ type: 'body', object: 'z1', time: 0, change, ...(part ? { part } : {}), ...extra }) as DestructionEvent

describe('pendulum (Elenco 593)', () => {
  it('follows the spring -26 (a + base) - 1.8 v and starts with a kick of 6', () => {
    const node = { rotation: { x: 0.2, z: 0 } }
    const pendulum = createPendulum(node, 'elbow', 1)
    expect(pendulum).toMatchObject({ a: 0.2, v: PENDULUM.kick })
    stepPendulum(pendulum, 0.1, 0.01)
    const acceleration = -26 * (0.2 + 0.1) - 1.8 * 6
    expect(pendulum.v).toBeCloseTo(6 + acceleration * 0.01, 12)
    expect(pendulum.a).toBeCloseTo(0.2 + pendulum.v * 0.01, 12)
    expect(node.rotation.x).toBe(pendulum.a)
  })

  it('settles near the negative of the base when nothing moves it', () => {
    const node = { rotation: { x: 0, z: 0 } }
    const pendulum = createPendulum(node, 'elbow', 1)
    for (let step = 0; step < 2000; step++) stepPendulum(pendulum, 0.3, 0.005)
    expect(pendulum.a).toBeCloseTo(-0.3, 3)
  })

  it('a broken shoulder hangs its forearm and sways while walking', () => {
    const node = { rotation: { x: 0, z: 0 } }
    const forearm = { rotation: { x: 1 } }
    const pendulum = createPendulum(node, 'shoulder', -1, forearm)
    stepPendulum(pendulum, 0, 0.01, 1)
    expect(forearm.rotation.x).toBe(PENDULUM.forearmHang)
    expect(node.rotation.z).toBeCloseTo(-0.12 + Math.sin(pendulum.a * 3) * 0.12, 12)
  })
})

describe('wounds on the rich body', () => {
  it('maps the arms, legs and head onto the engine segments, the left side on +x', () => {
    const { body } = setup()
    expect(Object.keys(body.nodes).sort()).toEqual(['forearmL', 'forearmR', 'head', 'shinL', 'shinR', 'thighL', 'thighR', 'upperArmL', 'upperArmR'])
    expect(body.nodes.upperArmL!.node.position.x).toBeGreaterThan(0)
    expect(body.nodes.thighR!.node.position.x).toBeLessThan(0)
  })

  it('a severed arm hides, leaves a stump, flies as a copy with a cut face and spills blood through the bridge', () => {
    const { wounds, body, scene, splashes } = setup()
    const before = scene.children.length
    wounds.handle(body, bodyEvent('severed', 'upperArmL'))
    expect(body.nodes.upperArmL!.node.visible).toBe(false)
    expect(body.nodes.upperArmL!.node.parent!.children.some((child) => child.userData.stump)).toBe(true)
    expect(scene.children.length).toBe(before + 1)
    expect(wounds.flying.pieces).toHaveLength(1)
    expect(wounds.goneOf(body).has('forearmL')).toBe(true)
    expect(wounds.goneOf(body).has('handL')).toBe(true)
    expect(splashes).toHaveLength(1)
    expect(splashes[0]).toMatchObject({ liquid: 'blood' })
  })

  it('the flying piece falls, bounces and comes to rest on the ground', () => {
    const { wounds, body } = setup()
    wounds.handle(body, bodyEvent('severed', 'thighL'))
    const piece = wounds.flying.pieces[0]!
    for (let step = 0; step < 600 && !piece.rest; step++) wounds.update(1 / 60)
    expect(piece.rest).toBe(true)
    expect(piece.object.position.y).toBeCloseTo(0.08, 6)
  })

  it('a broken shoulder gets a ring wound and a swinging arm; a broken leg limps', () => {
    const { wounds, body, rig } = setup()
    wounds.handle(body, bodyEvent('broken', 'upperArmR'))
    expect(body.nodes.upperArmR!.node.children.some((child) => child.userData.stump)).toBe(true)
    wounds.update(0.02)
    expect(rig.arms[1]!.g.rotation.x).not.toBe(rig.arms[1]!.base)
    wounds.handle(body, bodyEvent('limp', 'shinL'))
    const hurt = rig.legs[body.nodes.shinL!.leg!]!
    const kneeBefore = hurt.kn.rotation.x
    wounds.applyLimp(body)
    expect(hurt.kn.rotation.x).toBe(0.05)
    expect(kneeBefore).not.toBe(0.05)
  })

  it('a destroyed part bursts into 14 chunks; a split throws the upper body; a severed head kills', () => {
    const { wounds, body } = setup()
    wounds.handle(body, bodyEvent('destroyed', 'forearmR', { exit: [0, 0.3, 1] }))
    expect(wounds.flying.pieces).toHaveLength(14)
    wounds.handle(body, bodyEvent('split', 'torso'))
    expect((body.rig.upper as unknown as THREE.Object3D).visible).toBe(false)
    const other = setup()
    other.wounds.handle(other.body, bodyEvent('severed', 'head'))
    expect(other.wounds.goneOf(other.body).has('jaw')).toBe(true)
  })

  it('a hole event lays an entry decal, and an exit star when the bullet went through', () => {
    const { wounds, body, scene } = setup()
    scene.updateMatrixWorld(true)
    const node = body.nodes.thighL!.node
    const centre = node.getWorldPosition(new THREE.Vector3())
    const event = { type: 'hole', object: 'z1', time: 0, part: 'thighL', hole: {}, worldPoint: [centre.x + 0.1, centre.y - 0.2, centre.z + 0.1], exitPoint: [centre.x - 0.1, centre.y - 0.2, centre.z - 0.1] } as unknown as DestructionEvent
    wounds.handle(body, event)
    expect(node.children.filter((child) => child.userData.wound).length).toBeGreaterThanOrEqual(1)
  })

  it('leak events of the engine become blood through the bridge', () => {
    const { wounds, body, splashes } = setup()
    wounds.handle(body, { type: 'leak', object: 'z1', time: 0, part: 'neck', fluid: 'blood', point: [0, 1.5, 0], direction: [0, -1, 0], rate: 0.02, pressurized: true } as unknown as DestructionEvent)
    expect(splashes).toEqual([{ liquid: 'blood', point: [0, 1.5, 0], liters: 0.02 }])
  })

  it('follows a real character: a machete cut the engine decides becomes a stump on the drawn body', () => {
    const kit = createCharacters()
    const character = kit.create({ seed: 3, kind: 'person' })
    const { wounds, body } = setup()
    const events = character.hit({ type: 'slash', point: [0.2, 1.4, 0], direction: [-1, 0, 0], part: 'upperArmL', points: 100, cut: 1 })
    for (const event of events) wounds.handle(body, event)
    expect(events.some((event) => event.type === 'body' && event.change === 'severed')).toBe(true)
    expect(body.nodes.upperArmL!.node.visible).toBe(false)
  })
})

describe('eyes', () => {
  it('finds the balls and glows of a built zombie, dims them together and turns them off', () => {
    const { root } = setup()
    const eyes = findEyes(THREE, root)
    expect(eyes.markable.length).toBe(2)
    expect(eyes.glows.length).toBe(2)
    const ball = eyes.markable[0]!.material as THREE.MeshBasicMaterial
    const base = ball.color.getHex()
    eyes.dim()
    expect(ball.color.r).toBeCloseTo(new THREE.Color(base).r * 0.25, 6)
    eyes.off()
    expect(ball.color.getHex()).toBe(0)
    expect(eyes.glows[0]!.material.opacity).toBe(0)
    eyes.on()
    expect(ball.color.getHex()).toBe(base)
  })

  it('isolates the eyes for the test layer and brings the body back', () => {
    const { root } = setup()
    const eyes = findEyes(THREE, root)
    eyes.isolate(true)
    let hiddenMeshes = 0
    root.traverse((object) => {
      if ((object as THREE.Mesh).isMesh && !object.userData.eye && !object.visible) hiddenMeshes++
    })
    expect(hiddenMeshes).toBeGreaterThan(10)
    expect(eyes.markable.every((mesh) => mesh.visible)).toBe(true)
    eyes.isolate(false)
    expect(root.children.every((child) => child.visible)).toBe(true)
  })

  it('builds a standalone eye: an unlit ball and an additive sprite', () => {
    const eye = createEye(THREE, { color: 0xb0122a, radius: 0.02 })
    expect(eye.children).toHaveLength(2)
    expect((eye.children[1] as THREE.Sprite).material.blending).toBe(THREE.AdditiveBlending)
    expect(createRigAnimator).toBeTypeOf('function')
  })
})
