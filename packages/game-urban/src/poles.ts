import { flickerPhaseOf } from './lamps'
import { DISTRIBUTION } from './pole-distribution'
import type { UrbanBuilder } from './scene'
import type { BarSpec, DistributionSpec, DoubleArmSpec, LampLightSpec, LampSpec, LensSpec, MastSpec, PoleDef, SingleArmSpec } from './pole-specs'

export type { BarSpec, DistributionPoleDef, DistributionSpec, DoubleArmSpec, LampLightSpec, LampSpec, LensSpec, MastSpec, PoleDef, PoleSlotBand, PoleSlots, SingleArmSpec } from './pole-specs'

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
  /**
   * Turns the whole pole about y (radians, as three.js turns an object): its arm, lamp and light leave the mast along the turned +x, so a pole by a street running along x reaches over
   * the road with `ry = ±π/2`. Default 0 (the arm along +x).
   */
  ry?: number
  /** The real light flickers (a failing lamp). */
  flicker?: boolean
  /** Which way the arm points along the turned x, 1 or -1 (single arm). Default 1. */
  dir?: number
  /** Adds the transformer drum (single arm). */
  transformer?: boolean
}

/** Draws a pole from its `spec`. Declared as a method so the registry can hold each builder with its own spec type (the `PoleDef` names the builder that reads its spec). */
export type PoleShapeBuilder<TSpec extends object = object> = { build(b: UrbanBuilder, spec: TSpec, o: PoleOptions): void }['build']


const on = (o: PoleOptions): boolean => o.on ?? true
/** The lens of a lamp: glowing when on, and a failing lamp's lens flickers on the phase of its light. */
const lensOf = (o: PoleOptions, parent?: number): { emissive: boolean; parent?: number; flickerPhase?: number } => ({
  emissive: on(o),
  ...(parent === undefined ? {} : { parent }),
  ...(on(o) && o.flicker ? { flickerPhase: flickerPhaseOf(o.x, o.z) } : {}),
})

/** A point `reach` metres from the mast along the pole's turned +x (`ry` about y, as three.js turns an object: +x goes to (cos ry, -sin ry)). */
const along = (o: PoleOptions, reach: number): { x: number; z: number } => ({ x: o.x + reach * Math.cos(o.ry ?? 0), z: o.z - reach * Math.sin(o.ry ?? 0) })

function drawMast(b: UrbanBuilder, mast: MastSpec, x: number, z: number, parent = -1): void {
  b.cylinder(x, 0, z, mast.radiusTop, mast.radiusBottom, mast.height, mast.color, parent, mast.segments, mast.style)
}

function spendLight(b: UrbanBuilder, light: LampLightSpec, x: number, z: number, o: PoleOptions): void {
  const ry = o.ry ?? 0
  const [reach, side] = [light.reach ?? 0, light.z ?? 0]
  if (on(o) && b.lights.take()) b.light({ x: x + reach * Math.cos(ry) + side * Math.sin(ry), y: light.y, z: z - reach * Math.sin(ry) + side * Math.cos(ry), color: light.color, intensity: light.intensity, distance: light.distance, flicker: o.flicker ?? false, ...(o.flicker ? { flickerPhase: flickerPhaseOf(o.x, o.z) } : {}) })
}

const doubleArm: PoleShapeBuilder = (b, spec: DoubleArmSpec, o) => {
  const group = b.group(o.x, 0, o.z, o.ry ?? 0)
  drawMast(b, spec.mast, 0, 0, group)
  for (const side of [-1, 1]) {
    b.box(side * spec.arm.reach, spec.arm.y, 0, spec.arm.width, spec.arm.height, spec.arm.depth, spec.arm.color, { parent: group })
    b.box(side * spec.lamp.reach, spec.lamp.y, 0, spec.lamp.width, spec.lamp.height, spec.lamp.depth, on(o) ? spec.lens.lit : spec.lens.unlit, lensOf(o, group))
  }
  spendLight(b, spec.light, o.x, o.z, { ...o, ry: 0 })
}

const singleArm: PoleShapeBuilder = (b, spec: SingleArmSpec, o) => {
  const dir = o.dir ?? 1
  const ry = o.ry ?? 0
  const arm = along(o, dir * spec.arm.reach)
  const lamp = along(o, dir * spec.lamp.reach)
  const drum = along(o, -dir * spec.transformer.offset)
  drawMast(b, spec.mast, o.x, o.z)
  b.box(arm.x, spec.arm.y, arm.z, spec.arm.width, spec.arm.height, spec.arm.depth, spec.arm.color, { ry })
  b.box(lamp.x, spec.lamp.y, lamp.z, spec.lamp.width, spec.lamp.height, spec.lamp.depth, on(o) ? spec.lens.lit : spec.lens.unlit, { ...lensOf(o), ry })
  if (o.transformer) b.cylinder(drum.x, spec.transformer.y, drum.z, spec.transformer.radius, spec.transformer.radius, spec.transformer.height, spec.transformer.color, -1, spec.transformer.segments)
  spendLight(b, { ...spec.light, reach: dir * (spec.light.reach ?? spec.lamp.reach) }, o.x, o.z, o)
}

const lantern: PoleShapeBuilder = (b, spec: LanternSpec, o) => {
  const lamp = along(o, spec.lamp.reach)
  drawMast(b, spec.mast, o.x, o.z)
  b.box(lamp.x, spec.lamp.y, lamp.z, spec.lamp.width, spec.lamp.height, spec.lamp.depth, on(o) ? spec.lens.lit : spec.lens.unlit, { ...lensOf(o), ry: o.ry ?? 0 })
  b.cone(o.x, spec.cap.y, o.z, spec.cap.radius, spec.cap.height, spec.cap.color, -1, spec.cap.segments)
  spendLight(b, spec.light, o.x, o.z, o)
}

const crossarm: PoleShapeBuilder = (b, spec: CrossarmSpec, o) => {
  const ry = o.ry ?? 0
  const arm = along(o, spec.arm.reach)
  const lamp = along(o, spec.lamp.reach)
  drawMast(b, spec.mast, o.x, o.z)
  b.box(arm.x, spec.arm.y, arm.z, spec.arm.width, spec.arm.height, spec.arm.depth, spec.arm.color, { ry })
  b.box(lamp.x, spec.lamp.y, lamp.z, spec.lamp.width, spec.lamp.height, spec.lamp.depth, on(o) ? spec.lens.lit : spec.lens.unlit, { ...lensOf(o), ry })
  spendLight(b, { ...spec.light, reach: spec.light.reach ?? spec.lamp.reach }, o.x, o.z, o)
}

const floodTower: PoleShapeBuilder = (b, spec: FloodTowerSpec, o) => {
  for (const a of [-1, 1]) for (const c of [-1, 1]) b.box(o.x + a * spec.legs.offset, 0, o.z + c * spec.legs.offset, spec.legs.size, spec.legs.height, spec.legs.size, spec.legs.color)
  b.box(o.x + spec.deck.reach, spec.deck.y, o.z, spec.deck.width, spec.deck.height, spec.deck.depth, spec.deck.color)
  for (let index = 0; index < spec.heads.count; index++) {
    b.box(o.x + spec.heads.start + index * spec.heads.spacing, spec.heads.y, o.z + spec.heads.z, spec.heads.width, spec.heads.height, spec.heads.depth, on(o) ? spec.lens.lit : spec.lens.unlit, lensOf(o))
  }
  spendLight(b, spec.light, o.x, o.z, o)
}

/** The distribution pole draws as its single arm (mast, arm, lamp, drum) until its crossarm, insulators and clamps get their drawing (spec 011, T2.8d). */
const distribution: PoleShapeBuilder = (b, spec: DistributionSpec, o) => singleArm(b, spec, o)

/** The shape builders the default poles use; a game adds its own through `createUrban({ shapes })`. */
export const POLE_SHAPES: Readonly<Record<string, PoleShapeBuilder>> = { double_arm: doubleArm, single_arm: singleArm, lantern, crossarm, flood_tower: floodTower, distribution }

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
 * strength and reach of the real light), and the distribution pole the utility networks stand on. A game patches a number by id or adds a pole with its own shape.
 */
export const DEFAULT_POLES: readonly PoleDef[] = [
  { id: 'led_double', shape: 'double_arm', spec: LED },
  { id: 'concrete_arm', shape: 'single_arm', spec: CONCRETE },
  { id: 'cast_iron', shape: 'lantern', spec: IRON },
  { id: 'wood_crossarm', shape: 'crossarm', spec: WOOD },
  { id: 'flood_tower', shape: 'flood_tower', spec: FLOOD },
  { id: 'concrete_distribution', shape: 'distribution', spec: DISTRIBUTION },
]
