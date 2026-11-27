import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { PieceSystem } from '../src/pieces'
import { physicsOption } from './setup-physics'

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
describe('ground that rises under a piece that rests on it', () => {
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

  it('the beam asleep on the rising tip is pushed out of the ground, not left in it (measured at the tip, not at the position the kit kept)', () => {
    const b = beamOnGround()
    b.ground.raise = 0.008
    b.system.wakeRegion(5, 0, 3)
    for (let i = 0; i < 240; i++) b.system.update(FRAME)
    // the lowest point of the far end (x from 4 m up, over the risen ground) from the piece's own pose
    const q = b.root.quaternion
    const low = (sx: number): number => {
      let lowest = Infinity
      for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const corner = new THREE.Vector3(sx * BEAM[0], sy * BEAM[1], sz * BEAM[2]).applyQuaternion(q).add(b.root.position)
        if (corner.x > 4) lowest = Math.min(lowest, corner.y)
      }
      return lowest
    }
    const tipBottom = low(1)
    expect(Number.isFinite(tipBottom)).toBe(true)
    const penetration = Math.max(0, b.ground.raise - tipBottom)
    // measured, not assumed (audit of #309): the beam is woken with the ground and the engine clears the rise; before, it stayed 8 mm in the ground for good
    expect(penetration).toBeLessThanOrEqual(0.002)
  })
})

// the net under the ground (`readBack`): a piece the engine leaves wholly under the ground is put back on it, its body as well as its mesh. With a `sweep` the sweep's answer
// (it met nothing) overwrote the lift, so only the mesh rose: the body stayed under the ground and was caught again every update (CLAUDE.md §12).
describe('a piece the engine left under the ground, with a sweep', () => {
  it('is lifted body and all: caught once, then it stands where it was put, not under the ground again each update', () => {
    const ground = { level: 0 }
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => ground.level, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), sweep: () => null })
    const root = new THREE.Object3D()
    root.position.set(0, 0.5, 0)
    system.create('box', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
    for (let i = 0; i < 6; i++) system.update(FRAME)
    const engine = (system as unknown as { engine: { fellThrough: number } }).engine
    expect(engine.fellThrough).toBe(0)
    // the ground the host answers jumps 2 m over the box; the engine's tiles are not told (no `wakeRegion`), so its body is left under it
    ground.level = 2
    for (let i = 0; i < 4; i++) system.update(FRAME)
    expect(root.position.y).toBeGreaterThan(1.9)
    expect(engine.fellThrough).toBe(1)
  })

  it('a sweep that turns it back (a face over it, facing down) is judged before the lift: the piece still ends on the ground, not back under it', () => {
    const ground = { level: 0 }
    const over = { object: 'slab', part: 'body', distance: 0, point: [0, 0, 0] as [number, number, number], normal: [0, -1, 0] as [number, number, number] }
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => ground.level, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), sweep: () => over })
    const root = new THREE.Object3D()
    root.position.set(0, 0.5, 0)
    // going up when the ground jumps 2 m over it: lifted first, a face over its way would turn it back to where it was, under the ground
    system.create('box', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2, [0, 3, 0])
    ground.level = 2
    system.update(FRAME)
    expect(root.position.y).toBeGreaterThan(1.9)
  })
})

