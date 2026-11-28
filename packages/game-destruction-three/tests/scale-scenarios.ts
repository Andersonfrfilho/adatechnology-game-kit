import * as THREE from 'three'
import type { Fragment } from '@adatechnology/game-destruction'

import { FragmentSystem } from '../src/fragments'
import { PieceSystem } from '../src/pieces'
import { physicsOption } from './setup-physics'

/**
 * The three motions the kit's two integrators of loose debris are held to, each at any size: a body let fall, a box sliding to a stop, a rod tipping over from a lean.
 * Each runs in the light physics of the splinters (`FragmentSystem`, no rigid bodies lent) and on the rigid bodies (`PieceSystem` on the engine), and reports what it
 * did as numbers a closed-form answer (`fragment-analytic`) or the same motion at another size (`scale-sweep`) is compared with. Nothing is judged here.
 */

export const GRAVITY = 9.81
/** One step of both: the engine's own fixed step (`KIT_WORLD.fixedStep`), so each update of the rigid bodies is one engine step and both read the same instants. */
export const STEP = 1 / 120
/** Sizes the motions are run at, as multiples of the 1x scene. */
export const SCALES = [0.1, 1, 3, 10] as const

export type Integrator = 'light' | 'rigid'
export const INTEGRATORS: readonly Integrator[] = ['light', 'rigid']

/** The 1x scenes (m, m/s, degrees): a 20 cm cube dropped 1 m; a 40 x 10 x 40 cm box sent along the floor at 2 m/s; a rod 1 m long and 5 cm thick let go 15 degrees off upright. */
export const FALL_HEIGHT = 1
export const CUBE_SIDE = 0.2
export const SLIDE_SPEED = 2
export const SLIDE_SIZE: readonly [number, number, number] = [0.4, 0.1, 0.4]
export const ROD_LENGTH = 1
export const ROD_THICKNESS = 0.05
export const ROD_LEAN_DEGREES = 15

/** Dynamic friction of the floor each integrator slides on: `DEBRIS_FRICTION` (fragments.ts) and the engine's default of a piece and of the ground (`MU_DYNAMIC`, engine-pieces.ts). */
export const FRICTION: Readonly<Record<Integrator, number>> = { light: 0.5, rigid: 0.6 }

/** Where a body is after each step: its centre and turn. */
type Pose = { readonly position: THREE.Vector3; readonly quaternion: THREE.Quaternion }
type Body = { readonly pose: () => Pose; readonly update: () => void }

/** A box of `size` (m) let go at `center` with `rotation`, `velocity` and no turn, alone over a flat floor at y = 0. */
type Launch = { readonly size: readonly [number, number, number]; readonly center: readonly [number, number, number]; readonly rotation: THREE.Quaternion; readonly velocity: readonly [number, number, number] }

/** A density of wood (kg/m³): the mass enters none of the motions, only the engine's need of one. */
const DENSITY = 600

function lightBody(launch: Launch): Body {
  const scene = new THREE.Scene()
  const system = new FragmentSystem(THREE, { scene, groundAt: () => 0, gravity: GRAVITY, max: 8, life: 0 })
  const [x, y, z] = launch.size
  const fragment: Fragment = {
    id: 'body', part: 'part', material: 'wood_hard', shape: 'chunk', center: [...launch.center], size: [x, y, z],
    rotation: [launch.rotation.x, launch.rotation.y, launch.rotation.z, launch.rotation.w], velocity: [...launch.velocity], angularVelocity: [0, 0, 0], mass: DENSITY * x * y * z,
  }
  const mesh = system.spawn(fragment, system.materialFor('wood_hard', 0x996633, false), 'thing', 8)
  if (!mesh) throw new Error('the fragment system made no fragment')
  return { pose: () => mesh, update: () => system.update(STEP) }
}

function rigidBody(launch: Launch): Body {
  const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: GRAVITY, onHardLanding: () => undefined, scene: new THREE.Scene() })
  const root = new THREE.Object3D()
  root.position.set(...launch.center)
  root.quaternion.copy(launch.rotation)
  root.updateMatrixWorld(true)
  const [x, y, z] = launch.size
  system.create('body', root, [x / 2, y / 2, z / 2], new THREE.Vector3(), DENSITY * x * y * z, [...launch.velocity])
  return { pose: () => root, update: () => system.update(STEP) }
}

const bodyOf = (integrator: Integrator, launch: Launch): Body => (integrator === 'light' ? lightBody(launch) : rigidBody(launch))

/** A trace of a motion: the centre and turn at the start and after each step. */
type Trace = { readonly positions: readonly THREE.Vector3[]; readonly turns: readonly THREE.Quaternion[] }

function trace(body: Body, seconds: number): Trace {
  const positions = [body.pose().position.clone()]
  const turns = [body.pose().quaternion.clone()]
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    body.update()
    positions.push(body.pose().position.clone())
    turns.push(body.pose().quaternion.clone())
  }
  return { positions, turns }
}

/** The time (s) a sequence first reaches `level` from below, between the two steps around it; Infinity when it never does. */
function crossing(values: readonly number[], level: number): number {
  for (let i = 1; i < values.length; i++) {
    const before = values[i - 1] as number
    const after = values[i] as number
    if (before < level && after >= level) return (i - 1 + (level - before) / (after - before)) * STEP
  }
  return Infinity
}

/** Share of its size a body at rest may still move in a step (1.2 % of it a second): the engine's contact leaves a resting body creeping by less. */
export const STILL_SHARE = 1e-4

/** The last time (s) the body moved more than `STILL_SHARE` of `size` in a step: when it came to rest. */
function stillFrom(positions: readonly THREE.Vector3[], size: number): number {
  let moved = 0
  for (let i = 1; i < positions.length; i++) if ((positions[i] as THREE.Vector3).distanceTo(positions[i - 1] as THREE.Vector3) > STILL_SHARE * size) moved = i * STEP
  return moved
}

/** Share of the drop a fall is read at: before the floor, so what the floor does to it is not in the reading. */
export const FALL_READ = 0.9

/**
 * The fall: the centre's height drop after each step (m, from the start), when it had fallen `FALL_READ` of the drop (s) and how fast (m/s, that step's drop over the step), and
 * when it came to rest on the floor after its bounces (s).
 */
export type Fall = { readonly drops: readonly number[]; readonly read: number; readonly speed: number; readonly settled: number }

export function fall(integrator: Integrator, scale: number): Fall {
  const side = CUBE_SIDE * scale
  const height = FALL_HEIGHT * scale
  const { positions } = trace(bodyOf(integrator, { size: [side, side, side], center: [0, height + side / 2, 0], rotation: new THREE.Quaternion(), velocity: [0, 0, 0] }), 4 * Math.sqrt(scale) + 1)
  const drops = positions.map((p) => height + side / 2 - p.y)
  const read = crossing(drops, FALL_READ * height)
  const at = Math.ceil(read / STEP)
  const speed = ((drops[at] as number) - (drops[at - 1] as number)) / STEP
  return { drops, read, speed, settled: stillFrom(positions, side) }
}

/** The slide: how far the box went along the floor (m) and when it stopped (s). */
export type Slide = { readonly distance: number; readonly stopped: number }

export function slide(integrator: Integrator, scale: number): Slide {
  const [x, y, z] = SLIDE_SIZE
  const speed = SLIDE_SPEED * Math.sqrt(scale)
  const { positions } = trace(bodyOf(integrator, { size: [x * scale, y * scale, z * scale], center: [0, (y * scale) / 2, 0], rotation: new THREE.Quaternion(), velocity: [speed, 0, 0] }), (3 * speed) / (FRICTION[integrator] * GRAVITY) + 0.5)
  return { distance: (positions.at(-1) as THREE.Vector3).x - (positions[0] as THREE.Vector3).x, stopped: stillFrom(positions, x * scale) }
}

/** The tilt (rad from upright) a tip is read at: short of lying, so what the floor does to the falling end is not in the reading. */
export const TIP_READ = (85 * Math.PI) / 180

/** The tip: the rod's tilt from upright after each step (rad), when it reached `TIP_READ` (s), and how fast it was tilting over then (rad/s, that step's tilt over the step). */
export type Tip = { readonly tilts: readonly number[]; readonly read: number; readonly spin: number }

/** A rod `length` long and `thickness` thick leaning `lean` (rad) over +x from upright, its lowest bottom corner on the floor at the origin: where its centre is. */
export const rodCenter = (params: { readonly length: number; readonly thickness: number; readonly lean: number }): [number, number, number] => [
  (params.length / 2) * Math.sin(params.lean) - (params.thickness / 2) * Math.cos(params.lean),
  (params.length / 2) * Math.cos(params.lean) + (params.thickness / 2) * Math.sin(params.lean),
  0,
]

export function tip(integrator: Integrator, scale: number): Tip {
  const length = ROD_LENGTH * scale
  const thickness = ROD_THICKNESS * scale
  const lean = (ROD_LEAN_DEGREES * Math.PI) / 180
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -lean)
  const { turns } = trace(bodyOf(integrator, { size: [thickness, length, thickness], center: rodCenter({ length, thickness, lean }), rotation, velocity: [0, 0, 0] }), 3 * Math.sqrt(scale) + 0.5)
  const along = new THREE.Vector3()
  const tilts = turns.map((turn) => Math.acos(Math.min(1, along.set(0, 1, 0).applyQuaternion(turn).y)))
  const read = crossing(tilts, TIP_READ)
  const at = Math.ceil(read / STEP)
  const spin = Number.isFinite(read) ? ((tilts[at] as number) - (tilts[at - 1] as number)) / STEP : 0
  return { tilts, read, spin }
}
