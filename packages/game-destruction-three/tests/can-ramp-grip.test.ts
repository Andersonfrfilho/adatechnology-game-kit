import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { PieceBody } from '../src/internal'
import { FakeWorld, mat, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const CAN_RADIUS = 0.033
const CAN_LENGTH = 0.115
const CAN_FULL = 0.41
const RAMP_HALF_THICKNESS = 0.025

const scene = () => {
  const three = new THREE.Scene()
  const world = new FakeWorld()
  world.materials.set('steel', mat('steel', { density: 7850, tags: ['metal'], fracture: 'none' }))
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene: three, world: world.asWorld() })
  return { three, world, renderer }
}

/** A 350 ml can standing on a wooden ramp of `degrees`, set down touching it; returns how far it moved along the world x axis in `seconds`. */
const slideOnRamp = (degrees: number, seconds: number): { slide: number; rampDrop: number; piece: PieceBody } => {
  const s = scene()
  const angle = (degrees * Math.PI) / 180
  s.world.addObject('ramp', [partState('body', 'wood', { mass: 200 })])
  const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1))
  const ramp = new THREE.Group()
  ramp.add(rampMesh)
  ramp.rotation.z = -angle
  ramp.position.set(0, Math.sin(angle) * 1.5 + 0.03, 0)
  s.three.add(ramp)
  ramp.updateMatrixWorld(true)
  s.renderer.bind('ramp', ramp, { parts: { body: rampMesh } })
  // under Jolt a drawn fixed thing is a static body already; a sleeping piece is a dynamic board that the can wakes and drops flat

  s.world.addObject('can', [partState('body', 'steel', { mass: CAN_FULL })])
  const canMesh = new THREE.Mesh(new THREE.CylinderGeometry(CAN_RADIUS, CAN_RADIUS, CAN_LENGTH, 24))
  canMesh.userData.hollow = true
  canMesh.userData.destructionThickness = 0.00025
  canMesh.userData.destructionContains = { fluid: 'soda', liters: 0.35 }
  const can = new THREE.Group()
  can.add(canMesh)
  can.rotation.z = -angle
  const lift = RAMP_HALF_THICKNESS + CAN_LENGTH / 2 + 0.001
  can.position.set(Math.sin(angle) * lift, ramp.position.y + Math.cos(angle) * lift, 0)
  s.three.add(can)
  can.updateMatrixWorld(true)
  s.renderer.bind('can', can, { parts: { body: canMesh } })
  const piece = s.renderer.makePiece('can') as PieceBody

  const startX = can.position.x
  const rampStartY = ramp.position.y
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) s.renderer.update(1 / 60)
  return { slide: Math.abs(can.position.x - startX), rampDrop: rampStartY - ramp.position.y, piece }
}

describe('a standing can on a ramp holds by its grip (steel on wood holds to 26 degrees)', () => {
  it.each([5, 10, 20])('on %i degrees it moves at most 2 cm in 2 s, and the board under it stays put', (degrees) => {
    const { slide, rampDrop } = slideOnRamp(degrees, 2)
    expect(slide).toBeLessThan(0.02)
    expect(Math.abs(rampDrop)).toBeLessThan(0.001)
  })

  it('its linear speed is not damped: set down, it falls freely at g', () => {
    const s = scene()
    s.world.addObject('can', [partState('body', 'steel', { mass: CAN_FULL })])
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(CAN_RADIUS, CAN_RADIUS, CAN_LENGTH, 24))
    mesh.userData.hollow = true
    mesh.userData.destructionThickness = 0.00025
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(0, 50, 0)
    s.three.add(root)
    root.updateMatrixWorld(true)
    s.renderer.bind('can', root, { parts: { body: mesh } })
    const piece = s.renderer.makePiece('can') as PieceBody
    for (let t = 0; t < 1 - 1e-9; t += 1 / 60) s.renderer.update(1 / 60)
    expect(piece.velocity[1]).toBeLessThan(-9.81 * 0.99)
    expect(piece.velocity[1]).toBeGreaterThan(-9.81 * 1.01)
  })
})
