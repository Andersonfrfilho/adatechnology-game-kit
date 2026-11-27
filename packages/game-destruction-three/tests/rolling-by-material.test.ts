import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { TERRAIN_MATERIALS } from '@adatechnology/game-terrain'
import type { Vec3 } from '@adatechnology/game-destruction'

import { createDestructionRenderer } from '../src/renderer'
import type { PieceBody } from '../src/internal'
import { FakeWorld, mat, partState } from './fake-world'
import { IS_JOLT, physicsOption } from './setup-physics'

const FRAME = 1 / 60

/** What rolls: a bottle, a can and a log, each of its SDK material (`surfaceOf` by id), lying across +x. */
const ROLLERS = {
  glass: { radius: 0.035, length: 0.25, mass: 0.45, density: 2500, tags: ['glass'] },
  steel: { radius: 0.033, length: 0.12, mass: 0.35, density: 7850, tags: ['metal'] },
  wood: { radius: 0.08, length: 0.5, mass: 6, density: 600, tags: ['wood'] },
} as const
type RollerId = keyof typeof ROLLERS

const ground = (id: string): { readonly rolling?: number; readonly rollingDamping?: number } => {
  const material = TERRAIN_MATERIALS.find((m) => m.id === id)
  if (!material) throw new Error(`no terrain material ${id}`)
  return material
}

const scene = (groundId: string) => {
  const surface = ground(groundId)
  const world = new FakeWorld()
  for (const [id, r] of Object.entries(ROLLERS)) world.materials.set(id, mat(id, { density: r.density, tags: [...r.tags], fracture: 'none' }))
  const scene3 = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, {
    physics: physicsOption(),
    scene: scene3,
    world: world.asWorld(),
    terrainRollingAt: () => surface.rolling,
    terrainRollingDampingAt: () => surface.rollingDamping,
  })
  return { world, scene: scene3, renderer }
}

type Scene = ReturnType<typeof scene>

const addRoller = (s: Scene, id: RollerId, at: Vec3, velocity: Vec3, tilt = 0): { root: THREE.Group; piece: PieceBody } => {
  const r = ROLLERS[id]
  s.world.addObject(id, [partState('body', id, { mass: r.mass })])
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r.radius, r.radius, r.length, 24))
  mesh.rotation.x = Math.PI / 2
  const root = new THREE.Group()
  root.add(mesh)
  root.rotation.z = -tilt
  root.position.set(...at)
  s.scene.add(root)
  root.updateMatrixWorld(true)
  s.renderer.bind(id, root, { parts: { body: mesh } })
  const piece = s.renderer.makePiece(id, { velocity, inertia: 0.5 }) as PieceBody
  return { root, piece }
}

/** A roller set rolling at `speed` on flat ground: when it is almost still (s) and how far it went (m). */
const rollOut = (id: RollerId, groundId: string, speed = 1.5): { seconds: number; distance: number } => {
  const s = scene(groundId)
  const r = ROLLERS[id]
  const { root, piece } = addRoller(s, id, [0, r.radius + 0.001, 0], [speed, 0, 0])
  piece.angularVelocity = [0, 0, -speed / r.radius]
  for (let t = 0; t < 60; t += FRAME) {
    s.renderer.update(FRAME)
    if (t > 0.2 && Math.hypot(piece.velocity[0], piece.velocity[2]) < 0.02) return { seconds: t, distance: root.position.x }
  }
  return { seconds: 60, distance: root.position.x }
}

describe('round pieces stop by the rolling resistance and damping of their material and of the ground (SDK materials)', () => {
  // limits a few times what the materials give, so a change that sends them rolling for ever fails, and a smaller one does not
  const LIMITS: Record<string, Record<RollerId, { readonly metres: number; readonly seconds: number }>> = {
    // measured with the SDK's values: glass and steel 12.5 m in 18.7 s on glazed tile, 5.7 m in 8.9 s on concrete, 0.8 m in 1.1 s on grass; wood 5.3 m, 3.7 m, 0.7 m
    ceramic: { glass: { metres: 16, seconds: 25 }, steel: { metres: 16, seconds: 25 }, wood: { metres: 7, seconds: 12 } },
    concrete: { glass: { metres: 7.5, seconds: 12 }, steel: { metres: 7.5, seconds: 12 }, wood: { metres: 5, seconds: 8.5 } },
    turf: { glass: { metres: 1.2, seconds: 2 }, steel: { metres: 1.2, seconds: 2 }, wood: { metres: 1.1, seconds: 2 } },
  }

  it.each(Object.entries(LIMITS).flatMap(([g, byRoller]) => Object.entries(byRoller).map(([id, limit]) => [g, id as RollerId, limit] as const)))(
    'on %s, a %s roller at 1.5 m/s stops within its limit',
    (groundId, id, limit) => {
      const out = rollOut(id, groundId)
      expect(out.seconds).toBeLessThan(limit.seconds)
      expect(out.distance).toBeLessThan(limit.metres)
      expect(out.distance).toBeGreaterThan(0.1)
    },
  )

  it('the pair decides: glass on glazed tile rolls farthest, wood on grass stops soonest, and wood stops before glass on every ground', () => {
    const glassTile = rollOut('glass', 'ceramic')
    const woodGrass = rollOut('wood', 'turf')
    expect(glassTile.distance).toBeGreaterThan(rollOut('glass', 'concrete').distance)
    expect(woodGrass.distance).toBeLessThan(rollOut('wood', 'concrete').distance / 4)
    for (const g of ['ceramic', 'concrete', 'turf']) expect(rollOut('wood', g).distance).toBeLessThan(rollOut('glass', g).distance)
    expect(woodGrass.seconds).toBeLessThan(glassTile.seconds / 4)
  })
})

describe('a rolling piece goes on down a slope and rolls again when kicked', () => {
  /** A wooden board 4 m long tilted by `degrees`, asleep: a ramp. */
  const addRamp = (s: Scene, degrees: number): number => {
    const angle = (degrees * Math.PI) / 180
    s.world.materials.set('board', mat('board', { density: 600, tags: ['wood'] }))
    s.world.addObject('ramp', [partState('body', 'board', { mass: 200 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, 1))
    const root = new THREE.Group()
    root.add(mesh)
    root.rotation.z = -angle
    root.position.set(0, Math.sin(angle) * 2 + 0.03, 0)
    s.scene.add(root)
    root.updateMatrixWorld(true)
    s.renderer.bind('ramp', root, { parts: { body: mesh } })
    // under Jolt a drawn fixed thing is a static body already; a sleeping piece is a dynamic board that the roller wakes and drops flat
    if (!IS_JOLT) s.renderer.makePiece('ramp').sleeping = true
    return root.position.y
  }

  it.each(Object.keys(ROLLERS) as RollerId[])('a %s roller let go on a 10 degree wooden ramp speeds up all the way down', (id) => {
    const s = scene('concrete')
    const top = addRamp(s, 10)
    const angle = (10 * Math.PI) / 180
    const lift = 0.025 + ROLLERS[id].radius + 0.001
    const { piece } = addRoller(s, id, [-1.2 * Math.cos(angle) + Math.sin(angle) * lift, top + 1.2 * Math.sin(angle) + Math.cos(angle) * lift, 0], [0, 0, 0], angle)
    const along = (): number => piece.velocity[0] * Math.cos(angle) - piece.velocity[1] * Math.sin(angle)
    for (let t = 0; t < 0.5; t += FRAME) s.renderer.update(FRAME)
    const early = along()
    for (let t = 0; t < 0.6; t += FRAME) s.renderer.update(FRAME)
    expect(early).toBeGreaterThan(0.3)
    expect(along()).toBeGreaterThan(early + 0.3)
  })

  it.each([['concrete'], ['turf']] as const)('on %s, a can that stopped and fell asleep rolls again when kicked (impulse at its side)', (groundId) => {
    const s = scene(groundId)
    const { root, piece } = addRoller(s, 'steel', [0, ROLLERS.steel.radius + 0.001, 0], [0.5, 0, 0])
    for (let t = 0; t < 12; t += FRAME) s.renderer.update(FRAME)
    expect(piece.sleeping).toBe(true)
    const rest = root.position.x
    s.renderer.impulse('steel', [ROLLERS.steel.mass * 1.5, 0, 0], [root.position.x, root.position.y, root.position.z])
    s.renderer.update(FRAME)
    expect(piece.sleeping).toBe(false)
    expect(piece.velocity[0]).toBeGreaterThan(0.5)
    for (let t = 0; t < 0.5; t += FRAME) s.renderer.update(FRAME)
    expect(root.position.x - rest).toBeGreaterThan(0.1)
  })
})
