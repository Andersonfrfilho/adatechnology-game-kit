import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

const run = (renderer: { update(dt: number): void }, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
}

/**
 * A long board tilted by `degrees` about z (its +x end down), lying asleep on the floor, and a 2 kg box set down on the middle of it. The friction of the two (0.7 static,
 * 0.6 dynamic: wood on wood) holds the box up to atan(0.7) = 35 degrees; steeper, it slides toward the low end.
 */
const slope = (degrees: number) => {
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
  world.addObject('box', [partState('body', 'wood', { mass: 2 })])
  const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2))
  const box = new THREE.Group()
  box.add(boxMesh)
  box.rotation.z = -angle
  // on the surface, over the middle of the board
  const lift = 0.025 + 0.05 + 0.002
  box.position.set(Math.sin(angle) * lift, board.position.y + Math.cos(angle) * lift, 0)
  scene.add(box)
  box.updateMatrixWorld(true)
  renderer.bind('box', box, { parts: { body: boxMesh } })
  renderer.makePiece('box')
  return { renderer, box, boardPiece }
}

describe('a thing on a tilted top', () => {
  it('stays put on a slope gentler than the friction angle', () => {
    const { renderer, box } = slope(20)
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
})
