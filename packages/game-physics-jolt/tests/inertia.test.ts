import { describe, expect, it } from 'vitest'

import type { Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine, loadJolt } from '../src/index'
import type { JoltWorld } from '../src/index'

/** A 9 mm casing as a solid cylinder: radius 5 mm, half height 9.5 mm, 4 g. Its moments: m (3 r^2 + h^2) / 12 across, m r^2 / 2 along its axis (y). */
const R = 0.005
const HALF = 0.0095
const M = 0.004
const ACROSS = (M * (3 * R * R + (2 * HALF) ** 2)) / 12
const ALONG = (M * R * R) / 2

const close = (got: Vec3, want: Vec3, share = 0.02): void => {
  for (let i = 0; i < 3; i++) expect(Math.abs(got[i]! - want[i]!) / want[i]!).toBeLessThan(share)
}

describe('small inertia (spec 008 condition 7)', () => {
  it('pure Jolt, no adapter: a body whose principal moments are under 1e-6 kg m^2 gets a 1 m sphere (0.4 m) instead: the upstream behaviour the adapter works round', async () => {
    const J = await loadJolt()
    const settings = new J.JoltSettings()
    const layers = new J.ObjectLayerPairFilterTable(1)
    layers.EnableCollision(0, 0)
    const bp = new J.BroadPhaseLayerInterfaceTable(1, 1)
    const layer = new J.BroadPhaseLayer(0)
    bp.MapObjectToBroadPhaseLayer(0, layer)
    settings.mObjectLayerPairFilter = layers
    settings.mBroadPhaseLayerInterface = bp
    settings.mObjectVsBroadPhaseLayerFilter = new J.ObjectVsBroadPhaseLayerFilterTable(bp, 1, layers, 1)
    const iface = new J.JoltInterface(settings)
    J.destroy(settings)
    J.destroy(layer)
    const shapeSettings = new J.CylinderShapeSettings(HALF, R, 0.001)
    const shape = shapeSettings.Create().Get()
    const position = new J.RVec3(0, 1, 0)
    const rotation = new J.Quat(0, 0, 0, 1)
    const body = new J.BodyCreationSettings(shape, position, rotation, J.EMotionType_Dynamic, 0)
    body.mOverrideMassProperties = J.EOverrideMassProperties_CalculateInertia
    body.mMassPropertiesOverride.mMass = M
    const bi = iface.GetPhysicsSystem().GetBodyInterface()
    const made = bi.CreateBody(body)
    const d = made.GetMotionProperties().GetInverseInertiaDiagonal()
    const got: Vec3 = [d.GetX(), d.GetY(), d.GetZ()]
    // 1 / (0.4 * 0.004) on every axis, where 1 / 1.45e-7 and 1 / 5e-8 belong (MotionProperties.cpp: !diagonal.IsNearZero(), 1e-12 on the squared length)
    close(got, [625, 625, 625], 1e-4)
    bi.DestroyBody(made.GetID())
    for (const o of [body, position, rotation, shapeSettings]) J.destroy(o)
    J.destroy(iface)
  })

  it('the adapter: the casing has its own inertia after it is made, and keeps it and its mass when its shape changes, or when its mass does', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld() as JoltWorld
    const casing = world.createBody({ shape: { kind: 'cylinder', halfHeight: HALF, radius: R }, motion: 'dynamic', mass: M, position: [0, 1, 0], user: 0 })
    const made = world.massProperties(casing)
    expect(made.mass).toBeCloseTo(M, 9)
    close(made.inertia, [ACROSS, ALONG, ACROSS])
    // broken shorter: the same 4 g in a 6 mm long cylinder, its inertia from the new shape
    world.setShape(casing, { kind: 'cylinder', halfHeight: 0.003, radius: R }, { mass: M })
    const shorter = world.massProperties(casing)
    expect(shorter.mass).toBeCloseTo(M, 9)
    close(shorter.inertia, [(M * (3 * R * R + 0.006 ** 2)) / 12, ALONG, (M * (3 * R * R + 0.006 ** 2)) / 12])
    // a 2 kg piece that loses a third of itself: its new box, the kit's new mass
    const piece = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', mass: 2, position: [1, 1, 0], user: 1 })
    world.setShape(piece, { kind: 'box', half: [0.1, 0.1, 0.0667] }, { mass: 1.33 })
    const smaller = world.massProperties(piece)
    expect(smaller.mass).toBeCloseTo(1.33, 6)
    close(smaller.inertia, [(1.33 * (0.2 ** 2 + 0.1334 ** 2)) / 12, (1.33 * (0.2 ** 2 + 0.1334 ** 2)) / 12, (1.33 * (0.2 ** 2 + 0.2 ** 2)) / 12])
    // its moments given (a can whose contents roll with it), kept through a new shape
    world.setShape(piece, { kind: 'box', half: [0.1, 0.1, 0.1] }, { mass: 2, inertia: [0.01, 0.02, 0.03] })
    close(world.massProperties(piece).inertia, [0.01, 0.02, 0.03], 1e-4)
    world.dispose()
  })
})
