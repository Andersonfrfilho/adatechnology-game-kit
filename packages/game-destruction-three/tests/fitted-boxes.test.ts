import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { pushFittedBoxes } from '../src/fitted-boxes'
import { FragmentSystem } from '../src/fragments'

const boardMatrix = (turn: number): THREE.Matrix4 => new THREE.Matrix4().compose(new THREE.Vector3(1, 0.02, 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn), new THREE.Vector3(1.2, 0.04, 0.16))
const UNIT = { min: { x: -0.5, y: -0.5, z: -0.5 }, max: { x: 0.5, y: 0.5, z: 0.5 } }

const fragments = (life = 12) => {
  const scene = new THREE.Scene()
  const system = new FragmentSystem(THREE, { scene, groundAt: () => 0, gravity: 9.81, max: 160, life })
  const spawn = (id: string, size: [number, number, number], mass: number) =>
    system.spawn({ id, part: 'p', material: 'wood_hard', shape: 'chunk', center: [0, 0.1, 0], size, rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], mass }, new THREE.MeshBasicMaterial(), 'table', 160)
  const near = () => {
    const found: Array<{ mass: number; push: (x: number, z: number) => void }> = []
    system.solidsNear(0, 0, 1, (_home, _min, _max, body) => found.push(body))
    return found
  }
  return { system, spawn, near }
}

describe('pushFittedBoxes', () => {
  it('a board lying square has one box, the size of the mesh', () => {
    const out: number[] = []
    pushFittedBoxes(UNIT, boardMatrix(0), out)
    expect(out).toHaveLength(6)
    expect(out[3]! - out[0]!).toBeCloseTo(1.2)
    expect(out[5]! - out[2]!).toBeCloseTo(0.16)
  })

  it('a board lying askew has boxes that follow it: what they cover stays close to the area of the board', () => {
    const out: number[] = []
    pushFittedBoxes(UNIT, boardMatrix(Math.PI / 4), out)
    const whole = (1.2 + 0.16) * Math.SQRT1_2
    let covered = 0
    for (let i = 0; i < out.length; i += 6) covered += (out[i + 3]! - out[i]!) * (out[i + 5]! - out[i + 2]!)
    expect(out.length / 6).toBe(10)
    // the board has 0.192 m2; the one axis box would be 0.92 m2 of mostly air
    expect(covered).toBeLessThan(0.45)
    expect(covered).toBeLessThan(whole * whole * 0.5)
    // and its middle line stays inside them
    for (const along of [-0.55, -0.2, 0.3, 0.55]) {
      const x = 1 + along * Math.SQRT1_2
      const z = 2 - along * Math.SQRT1_2
      let inside = false
      for (let i = 0; i < out.length; i += 6) inside ||= x >= out[i]! && x <= out[i + 3]! && z >= out[i + 2]! && z <= out[i + 5]!
      expect(inside).toBe(true)
    }
  })
})

describe('big fragments', () => {
  it('half a board is a solid that stays; a splinter is neither', () => {
    const { system, spawn, near } = fragments(2)
    spawn('stub', [0.7, 0.04, 0.16], 3.5)
    spawn('splinter', [0.15, 0.01, 0.01], 0.01)
    expect([...new Set(near())].map((b) => b.mass)).toEqual([3.5])
    for (let t = 0; t < 6; t += 1 / 60) system.update(1 / 60)
    expect(system.count).toBe(1)
    expect(new Set(near()).size).toBe(1)
  })

  it('a board that lands on its end falls flat', () => {
    const { system, spawn } = fragments()
    const mesh = spawn('stub', [0.04, 0.8, 0.16], 3.5)!
    for (let t = 0; t < 4; t += 1 / 60) system.update(1 / 60)
    expect(new THREE.Box3().setFromObject(mesh).max.y).toBeLessThan(0.2)
  })

  it('is kicked along the floor', () => {
    const { system, spawn, near } = fragments()
    const mesh = spawn('stub', [0.7, 0.04, 0.16], 3.5)!
    for (let t = 0; t < 2; t += 1 / 60) system.update(1 / 60)
    near()[0]!.push(2, 0)
    for (let t = 0; t < 1; t += 1 / 60) system.update(1 / 60)
    expect(mesh.position.x).toBeGreaterThan(0.1)
  })

  it('over the limit the splinters go first', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, groundAt: () => 0, gravity: 9.81, max: 2, life: 12 })
    const spawn = (id: string, size: [number, number, number]) => system.spawn({ id, part: 'p', material: 'wood_hard', shape: 'chunk', center: [0, 0.1, 0], size, rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], mass: 1 }, new THREE.MeshBasicMaterial(), 'table', 2)
    spawn('stub', [0.7, 0.04, 0.16])
    spawn('splinter_a', [0.1, 0.01, 0.01])
    system.update(1 / 60)
    spawn('splinter_b', [0.1, 0.01, 0.01])
    const found: number[] = []
    system.solidsNear(0, 0, 1, (_h, _a, _b, body) => found.push(body.mass))
    expect(found).toEqual([1])
  })
})
