import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

const run = (renderer: { update(dt: number): void }, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
}

/**
 * A long board tilted by `degrees` about z (its +x end down), lying asleep on the floor, and a 2 kg thing of `material` set down on the middle of it: a 20 x 10 x 20 cm box,
 * or (`can`) a can of 7 cm across lying with its axis across the slope. Wood on wood holds a box up to atan(0.4) = 22 degrees; steel on wood up to atan(0.49) = 26.
 */
const slope = (degrees: number, material = 'wood', can = false) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
  const angle = (degrees * Math.PI) / 180
  world.addObject('board', [partState('body', 'wood', { mass: 200 })])
  const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1))
  const board = new THREE.Group()
  board.add(boardMesh)
  board.rotation.z = -angle
  // the low end touches the floor
  board.position.set(0, Math.sin(angle) * 1.5 + 0.03, 0)
  scene.add(board)
  board.updateMatrixWorld(true)
  renderer.bind('board', board, { parts: { body: boardMesh } })
  const boardPiece = renderer.makePiece('board')
  boardPiece.sleeping = true
  world.addObject('box', [partState('body', material, { mass: can ? 0.45 : 2 })])
  const boxMesh = can ? new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.11, 24)) : new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2))
  // the can lies on its side, its axis along z: across the slope, so it can roll down it
  if (can) boxMesh.rotation.x = Math.PI / 2
  const box = new THREE.Group()
  box.add(boxMesh)
  box.rotation.z = -angle
  // on the surface, over the middle of the board
  const lift = 0.025 + (can ? 0.035 : 0.05) + 0.002
  box.position.set(Math.sin(angle) * lift, board.position.y + Math.cos(angle) * lift, 0)
  scene.add(box)
  box.updateMatrixWorld(true)
  renderer.bind('box', box, { parts: { body: boxMesh } })
  const piece = renderer.makePiece('box')
  return { renderer, box, boardPiece, piece }
}

describe('a thing on a tilted top', () => {
  it('stays put on a slope gentler than the friction angle', () => {
    const { renderer, box } = slope(15)
    const x0 = box.position.x
    run(renderer, 2)
    expect(Math.abs(box.position.x - x0)).toBeLessThan(0.03)
  })

  it('slides down a slope steeper than the friction angle, toward the low side', () => {
    const { renderer, box } = slope(45)
    const x0 = box.position.x
    run(renderer, 0.6)
    expect(box.position.x - x0).toBeGreaterThan(0.2)
  })

  it('the friction is the two materials: at 25 degrees a wooden box slides on the wooden top, a steel one holds', () => {
    const wood = slope(25, 'wood')
    const steel = slope(25, 'steel')
    const woodX = wood.box.position.x
    const steelX = steel.box.position.x
    run(wood.renderer, 1)
    run(steel.renderer, 1)
    expect(wood.box.position.x - woodX).toBeGreaterThan(0.1)
    expect(Math.abs(steel.box.position.x - steelX)).toBeLessThan(0.03)
  })

  it('a can lying across a gentle slope rolls down it, turning as it goes, where a box stays', () => {
    const can = slope(8, 'steel', true)
    const box = slope(8, 'steel')
    expect(can.piece.sleeping).toBe(false)
    const canX = can.box.position.x
    const boxX = box.box.position.x
    run(can.renderer, 1)
    run(box.renderer, 1)
    expect(can.box.position.x - canX).toBeGreaterThan(0.2)
    // rolling, not sliding: it turned about its axis by about the distance over its radius
    expect(Math.abs(can.piece.angularVelocity[2])).toBeGreaterThan(1)
    expect(Math.abs(box.box.position.x - boxX)).toBeLessThan(0.03)
  })
})

describe('a round thing on the floor', () => {
  it('a can given a push rolls on and slows to a stop by its rolling resistance', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    world.addObject('can', [partState('body', 'steel', { mass: 0.45 })])
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.11, 24))
    mesh.rotation.x = Math.PI / 2
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(0, 0.036, 0)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('can', root, { parts: { body: mesh } })
    const can = renderer.makePiece('can', { velocity: [1, 0, 0] })
    run(renderer, 0.5)
    // it skids a moment, then rolls at about two thirds of the push (v = w r)
    expect(root.position.x).toBeGreaterThan(0.25)
    expect(Math.abs(can.angularVelocity[2]) * 0.035).toBeCloseTo(Math.hypot(can.velocity[0], can.velocity[2]), 1)
    run(renderer, 12)
    // it went on well past where a sliding box would stop (v^2 / 2 mu g: 13 cm), then stopped
    expect(root.position.x).toBeGreaterThan(0.6)
    expect(Math.hypot(...can.velocity)).toBeLessThan(0.05)
  })
})
