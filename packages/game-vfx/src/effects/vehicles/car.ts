import { localToWorld } from '../props'
import type { Vec3Tuple } from '../../workshop/types'
import { normalized } from '../vector-math'

/** The car of the Workshop's set as the page leaves it between effects (`CAR0`, W104): at (5.6, 0, 0.8), turned -0.4 rad. */
export const CAR_ORIGIN: Vec3Tuple = [5.6, 0, 0.8]
export const CAR_ROTATION: Vec3Tuple = [0, -0.4, 0]
/** A point of the car's own space in the world (`carW`). */
export const carPoint = (x: number, y: number, z: number): Vec3Tuple => localToWorld(CAR_ORIGIN, CAR_ROTATION, [x, y, z])
export const carDirection = (from: Vec3Tuple, to: Vec3Tuple): Vec3Tuple => normalized([to[0] - from[0], to[1] - from[1], to[2] - from[2]])
