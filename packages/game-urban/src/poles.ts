import type { UrbanBuilder } from './scene'
import type { PartStyle } from './types'

/** The pole that carries the lamp: a tapered cylinder. */
export type MastSpec = { radiusTop: number; radiusBottom: number; height: number; color: number; segments?: number; style?: PartStyle }
/** A bar or a box of the pole, placed by its base `y`. `reach` is how far from the mast its centre sits. */
export type BarSpec = { reach: number; y: number; width: number; height: number; depth: number; color: number }
/** The box of a lamp head: its colour is the lens, lit or unlit. */
export type LampSpec = { reach: number; y: number; width: number; height: number; depth: number }
/** Colour of the lamp lens when the lamp is on (it glows) and when it is off. */
export type LensSpec = { lit: number; unlit: number }
/** The real light a lamp that is on may get from the budget. `reach` moves it along the arm. */
export type LampLightSpec = { color: number; intensity: number; distance: number; y: number; reach?: number; z?: number }

/** Double arm with two LED heads (the avenue pole of the downtown pattern). */
export type DoubleArmSpec = { mast: MastSpec; arm: BarSpec; lamp: LampSpec; lens: LensSpec; light: LampLightSpec }
/** Concrete pole with one arm and a sodium lamp, with an optional transformer drum. */
export type SingleArmSpec = {
  mast: MastSpec
  arm: BarSpec
  lamp: LampSpec
  lens: LensSpec
  light: LampLightSpec
  transformer: { offset: number; y: number; radius: number; height: number; color: number; segments: number }
}
/** Short iron post with a lantern box and a pointed cap. */
export type LanternSpec = { mast: MastSpec; lamp: LampSpec; cap: { y: number; radius: number; height: number; color: number; segments: number }; lens: LensSpec; light: LampLightSpec }
/** Wooden pole with a crossarm and a hanging lamp. */
export type CrossarmSpec = { mast: MastSpec; arm: BarSpec; lamp: LampSpec; lens: LensSpec; light: LampLightSpec }
/** Four-legged tower with a deck and a row of floodlights. */
export type FloodTowerSpec = {
  legs: { offset: number; height: number; size: number; color: number }
  deck: BarSpec
  heads: { count: number; start: number; spacing: number; y: number; z: number; width: number; height: number; depth: number }
  lens: LensSpec
  light: LampLightSpec
}

/** What a game says when it places a pole. */
export type PoleOptions = {
  x: number
  z: number
  /** Lit lamp (glowing lens and, while the budget lasts, a real light). Default true. */
  on?: boolean
  /** Turns the whole pole (the double arm only; the others are placed by their arm direction). */
  ry?: number
  /** The real light flickers (a failing lamp). */
  flicker?: boolean
  /** Which way the arm points, 1 or -1 (single arm). Default 1. */
  dir?: number
  /** Adds the transformer drum (single arm). */
  transformer?: boolean
}

export type PoleShapeBuilder = (b: UrbanBuilder, spec: any, o: PoleOptions) => void

export type PoleDef = {
  id: string
  /** Key of the shape builder that reads `spec`. */
  shape: string
  spec: object
}

const on = (o: PoleOptions): boolean => o.on ?? true

function drawMast(b: UrbanBuilder, mast: MastSpec, x: number, z: number, parent = -1): void {
  b.cylinder(x, 0, z, mast.radiusTop, mast.radiusBottom, mast.height, mast.color, parent, mast.segments, mast.style)
}

function spendLight(b: UrbanBuilder, light: LampLightSpec, x: number, z: number, o: PoleOptions): void {
  if (on(o) && b.lights.take()) b.light({ x: x + (light.reach ?? 0), y: light.y, z: z + (light.z ?? 0), color: light.color, intensity: light.intensity, distance: light.distance, flicker: o.flicker ?? false })
}

const doubleArm: PoleShapeBuilder = (b, spec: DoubleArmSpec, o) => {
  const group = b.group(o.x, 0, o.z, o.ry ?? 0)
  drawMast(b, spec.mast, 0, 0, group)
  for (const side of [-1, 1]) {
    b.box(side * spec.arm.reach, spec.arm.y, 0, spec.arm.width, spec.arm.height, spec.arm.depth, spec.arm.color, { parent: group })
    b.box(side * spec.lamp.reach, spec.lamp.y, 0, spec.lamp.width, spec.lamp.height, spec.lamp.depth, on(o) ? spec.lens.lit : spec.lens.unlit, { parent: group, emissive: on(o) })
  }
  spendLight(b, spec.light, o.x, o.z, o)
}

const singleArm: PoleShapeBuilder = (b, spec: SingleArmSpec, o) => {
  const dir = o.dir ?? 1
  drawMast(b, spec.mast, o.x, o.z)
  b.box(o.x + dir * spec.arm.reach, spec.arm.y, o.z, spec.arm.width, spec.arm.height, spec.arm.depth, spec.arm.color)
  b.box(o.x + dir * spec.lamp.reach, spec.lamp.y, o.z, spec.lamp.width, spec.lamp.height, spec.lamp.depth, on(o) ? spec.lens.lit : spec.lens.unlit, { emissive: on(o) })
  if (o.transformer) b.cylinder(o.x - dir * spec.transformer.offset, spec.transformer.y, o.z, spec.transformer.radius, spec.transformer.radius, spec.transformer.height, spec.transformer.color, -1, spec.transformer.segments)
  spendLight(b, { ...spec.light, reach: dir * (spec.light.reach ?? spec.lamp.reach) }, o.x, o.z, o)
}

const lantern: PoleShapeBuilder = (b, spec: LanternSpec, o) => {
  drawMast(b, spec.mast, o.x, o.z)
  b.box(o.x + spec.lamp.reach, spec.lamp.y, o.z, spec.lamp.width, spec.lamp.height, spec.lamp.depth, on(o) ? spec.lens.lit : spec.lens.unlit, { emissive: on(o) })
  b.cone(o.x, spec.cap.y, o.z, spec.cap.radius, spec.cap.height, spec.cap.color, -1, spec.cap.segments)
  spendLight(b, spec.light, o.x, o.z, o)
}

const crossarm: PoleShapeBuilder = (b, spec: CrossarmSpec, o) => {
  drawMast(b, spec.mast, o.x, o.z)
  b.box(o.x + spec.arm.reach, spec.arm.y, o.z, spec.arm.width, spec.arm.height, spec.arm.depth, spec.arm.color)
  b.box(o.x + spec.lamp.reach, spec.lamp.y, o.z, spec.lamp.width, spec.lamp.height, spec.lamp.depth, on(o) ? spec.lens.lit : spec.lens.unlit, { emissive: on(o) })
  spendLight(b, { ...spec.light, reach: spec.light.reach ?? spec.lamp.reach }, o.x, o.z, o)
}

const floodTower: PoleShapeBuilder = (b, spec: FloodTowerSpec, o) => {
  for (const a of [-1, 1]) for (const c of [-1, 1]) b.box(o.x + a * spec.legs.offset, 0, o.z + c * spec.legs.offset, spec.legs.size, spec.legs.height, spec.legs.size, spec.legs.color)
  b.box(o.x + spec.deck.reach, spec.deck.y, o.z, spec.deck.width, spec.deck.height, spec.deck.depth, spec.deck.color)
  for (let index = 0; index < spec.heads.count; index++) {
    b.box(o.x + spec.heads.start + index * spec.heads.spacing, spec.heads.y, o.z + spec.heads.z, spec.heads.width, spec.heads.height, spec.heads.depth, on(o) ? spec.lens.lit : spec.lens.unlit, { emissive: on(o) })
  }
  spendLight(b, spec.light, o.x, o.z, o)
}

/** The shape builders the five default poles use; a game adds its own through `createUrban({ shapes })`. */
export const POLE_SHAPES: Readonly<Record<string, PoleShapeBuilder>> = { double_arm: doubleArm, single_arm: singleArm, lantern, crossarm, flood_tower: floodTower }

const LED: DoubleArmSpec = {
  mast: { radiusTop: 0.1, radiusBottom: 0.14, height: 9, color: 0x55595e, style: { metalness: 0.6, roughness: 0.5 } },
  arm: { reach: 0.8, y: 8.8, width: 1.6, height: 0.1, depth: 0.12, color: 0x55595e },
  lamp: { reach: 1.5, y: 8.6, width: 0.6, height: 0.12, depth: 0.3 },
  lens: { lit: 0xeef4ff, unlit: 0x3a3a3a },
  light: { color: 0xdfe8ff, intensity: 1.3, distance: 24, y: 8 },
}

const CONCRETE: SingleArmSpec = {
  mast: { radiusTop: 0.12, radiusBottom: 0.2, height: 8, color: 0x8a8a84, segments: 4 },
  arm: { reach: 0.7, y: 7.6, width: 1.4, height: 0.1, depth: 0.1, color: 0x6a6a66 },
  lamp: { reach: 1.35, y: 7.45, width: 0.5, height: 0.16, depth: 0.3 },
  lens: { lit: 0xffa040, unlit: 0x3a3a3a },
  light: { color: 0xff9a40, intensity: 1.3, distance: 20, y: 7.2 },
  transformer: { offset: 0.35, y: 6.2, radius: 0.28, height: 0.7, color: 0x5a5e62, segments: 8 },
}

const IRON: LanternSpec = {
  mast: { radiusTop: 0.06, radiusBottom: 0.12, height: 4, color: 0x1e2022, segments: 8 },
  lamp: { reach: 0, y: 4, width: 0.42, height: 0.5, depth: 0.42 },
  cap: { y: 4.5, radius: 0.36, height: 0.3, color: 0x1e2022, segments: 4 },
  lens: { lit: 0xffd090, unlit: 0x2a2a2a },
  light: { color: 0xffc880, intensity: 1, distance: 14, y: 3.9 },
}

const WOOD: CrossarmSpec = {
  mast: { radiusTop: 0.11, radiusBottom: 0.14, height: 7, color: 0x5a4630, segments: 6 },
  arm: { reach: 0, y: 6.6, width: 1.2, height: 0.08, depth: 0.08, color: 0x4a3a28 },
  lamp: { reach: 0.5, y: 6.35, width: 0.16, height: 0.22, depth: 0.16 },
  lens: { lit: 0xffe08a, unlit: 0x3a3a3a },
  light: { color: 0xffd27a, intensity: 0.9, distance: 16, y: 6.2 },
}

const FLOOD: FloodTowerSpec = {
  legs: { offset: 0.4, height: 12, size: 0.12, color: 0x6a6c6e },
  deck: { reach: 0, y: 12, width: 2, height: 0.15, depth: 1.2, color: 0x6a6c6e },
  heads: { count: 3, start: -0.6, spacing: 0.6, y: 12.2, z: 0.4, width: 0.45, height: 0.35, depth: 0.2 },
  lens: { lit: 0xfff2d8, unlit: 0x3a3a3a },
  light: { color: 0xfff0d0, intensity: 1.6, distance: 34, y: 11.5, z: 2 },
}

/**
 * The five poles of the neighbourhood patterns, with the numbers of the Galeria (heights, arms, lens colours, the colour,
 * strength and reach of the real light). A game patches a number by id or adds a pole with its own shape.
 */
export const DEFAULT_POLES: readonly PoleDef[] = [
  { id: 'led_double', shape: 'double_arm', spec: LED },
  { id: 'concrete_arm', shape: 'single_arm', spec: CONCRETE },
  { id: 'cast_iron', shape: 'lantern', spec: IRON },
  { id: 'wood_crossarm', shape: 'crossarm', spec: WOOD },
  { id: 'flood_tower', shape: 'flood_tower', spec: FLOOD },
]
