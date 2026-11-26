import type JoltNS from 'jolt-physics/wasm-compat'

import { LAYERS } from '@adatechnology/game-physics'
import type { Layer } from '@adatechnology/game-physics'

export type Jolt = typeof JoltNS

/** Object layers: the contract's layers, plus one the queries run as (meets everything but sensors). */
export const LAYER_INDEX = new Map<Layer, number>(LAYERS.map((layer, i) => [layer, i]))
export const QUERY_LAYER = LAYERS.length
/** The layer a vehicle's wheel probes run as: it meets what a wheel can stand on and not people, dead bodies or sensors. */
export const WHEEL_PROBE_LAYER = LAYERS.length + 1
export const WHEEL_BLIND_LAYERS: readonly string[] = ['agent', 'corpse', 'sensor']
export const NUM_OBJECT_LAYERS = LAYERS.length + 2
/** Broadphase layers: what does not move, what moves, and the crowd agents (many, kinematic, moved every frame). */
export const BP_STATIC = 0
export const BP_MOVING = 1
export const BP_AGENT = 2
export const BP_SENSOR = 3
export const NUM_BP = 4

export const ROW_CAPACITY = 4096
/** Height field blocks (samples a side) and Jolt's value for a sample with no ground (`HeightFieldShapeConstants::cNoCollisionValue`, FLT_MAX). */
export const HEIGHT_BLOCK = 4
export const NO_COLLISION = 3.4028234663852886e38
/** How much larger the inertia a dynamic body is made with is than its own (see `settingsFor`). */
export const INERTIA_SCALE = 1e6
export const POINTS_PER_BODY = 16
/** A sub-shape's user data when it has no tag: all 32 bits set, read back signed as -1. */
export const NO_TAG = 0xffffffff

export const layerOf = (layer: Layer): number => LAYER_INDEX.get(layer) ?? 0
