import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { PieceSystem } from '../src/pieces'
import { IS_JOLT, physicsOption } from './setup-physics'

const BEAM: [number, number, number] = [6, 0.1, 0.1]
const FRAME = 1 / 60

/** A 1 t beam lying on level ground whose far end can be raised (rubble settling there). */
const beamOnGround = () => {
  const ground = { raise: 0 }
  const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: (x) => (x > 4 ? ground.raise : 0), gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
  const root = new THREE.Object3D()
  root.position.set(0, 0.1, 0)
  const piece = system.create('beam', root, BEAM, new THREE.Vector3(), 1000)
  for (let i = 0; i < 360; i++) system.update(FRAME)
  return { ground, system, root, piece }
}

// the ground that settles under a far tip of a long piece used to lift the whole piece by that rise, with no speed: a kit gift of mass x g x rise (spec 008, T3.8r)
describe.skipIf(!IS_JOLT)('ground that rises under a piece that rests on it', () => {
  it('a rise the engine clears by itself does not move the piece in the kit: its tip is pushed by the contact, not the whole piece teleported', () => {
    const b = beamOnGround()
    expect(b.piece.sleeping).toBe(true)
    const before = b.root.position.y
    b.ground.raise = 0.008
    b.system.wakeRegion(5, 0, 3)
    expect(b.root.position.y).toBe(before)
  })

  it('a rise deeper than that is still lifted onto the ground at once, as before', () => {
    const b = beamOnGround()
    const before = b.root.position.y
    b.ground.raise = 0.06
    b.system.wakeRegion(5, 0, 3)
    expect(b.root.position.y).toBeGreaterThan(before + 0.05)
  })
})
