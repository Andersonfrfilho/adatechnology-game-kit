import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { TERRAIN_MATERIALS } from '@adatechnology/game-terrain'

import { createDestructionRenderer } from '../src/renderer'
import type { PieceBody } from '../src/internal'
import { FakeWorld, mat, partState } from './fake-world'
import { IS_JOLT, physicsOption } from './setup-physics'

const G = 9.81
/** Solid aluminium rods lying across their way: they roll with k = 1/2 (I = m r^2 / 2), and their own rolling resistance (metal, 0.002) is under every ground's. */
const K = 0.5
const FRAME = 1 / 60

const rollingOf = (id: string): number => {
  const rolling = TERRAIN_MATERIALS.find((m) => m.id === id)?.rolling
  if (rolling === undefined) throw new Error(`no rolling resistance for ${id}`)
  return rolling
}

/** A rod `radius` across and 1 m long thrown along +x at `speed` m/s on flat ground of one material: where it starts rolling without slipping, and where it stops. */
const throwRod = (o: { ground: string; radius: number; speed: number; seconds: number }) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  world.materials.set('aluminium', mat('aluminium', { density: 2700, tags: ['metal'], fracture: 'none' }))
  const rolling = rollingOf(o.ground)
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), terrainRollingAt: () => rolling })
  world.addObject('rod', [partState('body', 'aluminium', { mass: Math.PI * o.radius * o.radius * 2700 })])
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.radius, o.radius, 1, 24))
  mesh.rotation.x = Math.PI / 2
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(0, o.radius + 0.001, 0)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('rod', root, { parts: { body: mesh } })
  const piece = renderer.makePiece('rod', { velocity: [o.speed, 0, 0], inertia: K }) as PieceBody
  let rollFrom: { x: number; speed: number } | null = null
  let stopAt: number | null = null
  let speed = o.speed
  for (let t = 0; t < o.seconds - 1e-9; t += FRAME) {
    renderer.update(FRAME)
    speed = Math.hypot(piece.velocity[0], piece.velocity[2])
    const spin = Math.abs(piece.angularVelocity[2]) * o.radius
    if (!rollFrom && speed > 0.5 && Math.abs(speed - spin) < 0.02 * speed) rollFrom = { x: root.position.x, speed }
    if (rollFrom && stopAt === null && speed < 0.02) stopAt = root.position.x
  }
  return { rollFrom, stopAt, x: root.position.x, speed }
}

/** How far a solid rod rolling at `speed` goes on a surface of rolling resistance `c`: it slows at C_rr g / (1 + k), so v^2 (1 + k) / (2 C_rr g). */
const rollOut = (speed: number, c: number): number => (speed * speed * (1 + K)) / (2 * c * G)

describe('a round piece rolls by the ground it is on (TerrainMaterial.rolling)', () => {
  // a 10 cm pipe thrown at 3 m/s slides until its spin catches up (2 m/s, 3 / (1 + k)), then rolls out slowing at C_rr g / (1 + k): 0.52 m/s2 on soil (3.8 m), 0.10 on
  // asphalt (20 m). Under Jolt it slows by about 0.11 m/s2 more on both grounds alike (measured: 0.64 and 0.20), a loss of the engine's contact, not of the ground.
  it("a pipe rolling at 2 m/s slows on soil and on asphalt by each one's rolling resistance; the difference is the grounds' alone", () => {
    const slowing = (ground: string): number => {
      const rod = throwRod({ ground, radius: 0.05, speed: 3, seconds: 30 })
      expect(rod.rollFrom).not.toBeNull()
      expect(rod.stopAt).not.toBeNull()
      return (rod.rollFrom!.speed * rod.rollFrom!.speed) / (2 * (rod.stopAt! - rod.rollFrom!.x))
    }
    const expected = (ground: string): number => (rollingOf(ground) * G) / (1 + K)
    const soil = slowing('soil')
    const asphalt = slowing('asphalt')
    expect(rollingOf('asphalt')).toBe(0.015)
    expect(soil).toBeGreaterThan(expected('soil') * 0.85)
    expect(soil).toBeLessThan(expected('soil') * (IS_JOLT ? 1.3 : 1.15))
    expect(soil - asphalt).toBeGreaterThan((expected('soil') - expected('asphalt')) * 0.9)
    expect(soil - asphalt).toBeLessThan((expected('soil') - expected('asphalt')) * 1.1)
  })

  // the case from the room: a thin rod thrown at 15 m/s. It slides and hops for 18 m, rolls from about 7 m/s and rolls out over 7^2 x 1.5 / (2 x 0.08 x 9.81) = 47 m on
  // soil: it stops 63 m from the throw (measured), 24 m in sand, and 309 m on asphalt (the old 0.015, which every ground had). Kit solver only: Jolt caps a body's spin at
  // 47 rad/s (its default `mMaxAngularVelocity`, 0.25 pi per step at 60 Hz), so a 1.5 cm rod cannot roll faster than 0.7 m/s there and slides instead (the case above stays under it).
  it.skipIf(IS_JOLT)('a 3 cm rod thrown at 15 m/s rolls out on soil within 10 % of its rolling resistance, in sand in a quarter of that, and on asphalt is still rolling', () => {
    const soil = throwRod({ ground: 'soil', radius: 0.015, speed: 15, seconds: 25 })
    expect(soil.stopAt).not.toBeNull()
    const run = soil.stopAt! - soil.rollFrom!.x
    const expected = rollOut(soil.rollFrom!.speed, rollingOf('soil'))
    expect(run).toBeGreaterThan(expected * 0.9)
    expect(run).toBeLessThan(expected * 1.1)
    const sand = throwRod({ ground: 'sand', radius: 0.015, speed: 15, seconds: 10 })
    expect(sand.stopAt).not.toBeNull()
    expect(sand.stopAt! - sand.rollFrom!.x).toBeLessThan(rollOut(sand.rollFrom!.speed, rollingOf('sand')) * 1.1)
    const asphalt = throwRod({ ground: 'asphalt', radius: 0.015, speed: 15, seconds: 25 })
    expect(asphalt.stopAt).toBeNull()
    expect(asphalt.x).toBeGreaterThan(soil.stopAt! * 1.5)
  })
})
