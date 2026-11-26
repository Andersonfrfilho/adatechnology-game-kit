// Page side of the `vehicle` phase of leak.mjs (CLAUDE.md, "Memória"): bundled by leak.mjs and run in the page, against the room's own Jolt world.
// One cycle = a car is born (kit, hulls, crash parts, chassis body), drives into a wall, takes damage and loses parts, and is removed whole.
import * as THREE from 'three'
import { createVehicleDestructible, createVehicleKit, buildVehicleItem } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'
import { createCrashParts, createVehicleColliders } from '@adatechnology/game-vehicles-three'

const MODEL = 'family_hatch'
const MAX_HULLS = 256
const STEP = 1 / 120
const CRASH_STEPS = 900
// far from everything the room puts down, so the car meets only its own ground and wall
/** @type {[number, number, number]} */
const ORIGIN = [4000, 0, 4000]
/** @param {number} x @param {number} y @param {number} z @returns {[number, number, number]} */
const at = (x, y, z) => [ORIGIN[0] + x, ORIGIN[1] + y, ORIGIN[2] + z]

const kit = createVehicleKit({ THREE, document, locale: 'en' })
installFleet(kit)

/** Runs one cycle on `world` and says how many parts came off. */
window.__vehicleLeakCycle = () => {
  const world = window.__joltWorld
  if (!world) throw new Error('leak-vehicle: the page made no Jolt world')
  const ground = world.createBody({ shape: { kind: 'box', half: [50, 0.5, 50] }, motion: 'static', position: at(0, -0.5, 0), user: -1 })
  const wall = world.createBody({ shape: { kind: 'box', half: [6, 2, 0.5] }, motion: 'static', position: at(0, 2, 4), user: -1 })
  const item = buildVehicleItem(kit, MODEL)
  const vehicle = createVehicleDestructible(kit, item.vehicle, { id: 'leak-probe', frame: item.root })
  item.root.updateMatrixWorld(true)
  const colliders = createVehicleColliders(THREE, vehicle, item.root, { hulls: true, maxHulls: MAX_HULLS })
  colliders.pieces()
  colliders.hulls()
  const total = vehicle.model.parts.reduce((sum, part) => sum + part.mass, 0)
  /** @type {[number, number, number]} */
  const inertia = [total * 0.4, total * 0.8, total * 0.9]
  const parts = createCrashParts({ THREE, world, vehicle, frame: item.root, colliders, mass: { mass: total, centre: [0, 0.5, 0], inertia } })
  const chassis = world.createBody({ shape: parts.shape(), motion: 'dynamic', mass: total, inertia, position: at(0, 0.02, -8), layer: 'vehicle', user: 1 })
  parts.bind(chassis)
  world.setVelocity(chassis, [0, 0, 15], [0, 0, 0])
  const pose = new Float64Array(7)
  for (let i = 0; i < CRASH_STEPS; i++) {
    world.step(STEP)
    world.readPose(chassis, pose, 0)
    item.root.position.set(pose[0], pose[1], pose[2])
    item.root.quaternion.set(pose[3], pose[4], pose[5], pose[6])
    item.root.updateMatrixWorld(true)
    parts.step()
  }
  // what the crash did not shake off is unbolted, so the cycle always ends with a car that lost parts
  for (const joint of vehicle.model.joints) {
    const tool = joint.tools[0]
    if (tool) vehicle.disassemble(joint.id, tool, joint.seconds)
  }
  for (let i = 0; i < 60; i++) {
    world.step(STEP)
    parts.step()
  }
  const released = parts.stats().released
  // the part bodies go with `dispose`, the chassis with `removeBody`; two steps let the broadphase let go of what the removals left
  world.removeBody(chassis)
  parts.dispose()
  world.removeBody(wall)
  world.removeBody(ground)
  world.step(STEP)
  world.step(STEP)
  kit.dispose(item.vehicle)
  return released
}
