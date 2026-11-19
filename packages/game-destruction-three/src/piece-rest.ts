import type * as THREE_NS from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'

import type { PieceBody } from './internal'

// when a loose piece has come to rest: one rule for the kit's own solver (`PieceSystem`) and for the engine's (`EnginePieces`), so both put the same pieces to sleep

/** A piece on the ground slower than this (m/s) and turning slower than this (rad/s) is still: it sleeps after `SLEEP_AFTER`, or at once over `maxAwake`. */
export const STILL_SPEED = 0.12
export const STILL_SPIN = 0.45
export const SLEEP_AFTER = 0.5
/**
 * A piece on the ground that neither moves farther than `CALM_DRIFT` (m) nor turns more than `CALM_TURN` (rad) in `CALM_SLEEP_AFTER` seconds sleeps, however
 * its speed flickers: a book propped on another, or trembling where its corners rest on two pieces, stays in place; a fall or a slide leaves the window sooner.
 */
export const CALM_DRIFT = 0.01
export const CALM_TURN = 0.05
export const CALM_SLEEP_AFTER = 1.5
/**
 * A piece held up at an angle (on its edge, leant on something) that turns less than `STEADY_TURN` (rad) in `STEADY_SECONDS` keeps its tilt: the balancing push stops and it
 * may sleep. One going over turns past it sooner: the topple alone (`TOPPLE`) turns even a low piece 0.17 rad in that time.
 */
export const STEADY_TURN = 0.1
export const STEADY_SECONDS = 1.5

/** The angle (rad) between the rotation `a` and `q`. */
export const turnBetween = (a: readonly [number, number, number, number], q: THREE_NS.Quaternion): number =>
  2 * Math.acos(Math.min(1, Math.abs(a[0] * q.x + a[1] * q.y + a[2] * q.z + a[3] * q.w)))

/** Slower than `STILL_SPEED` and `STILL_SPIN`. */
export const isSlow = (b: PieceBody): boolean =>
  Math.hypot(b.velocity[0], b.velocity[1], b.velocity[2]) < STILL_SPEED && Math.hypot(b.angularVelocity[0], b.angularVelocity[1], b.angularVelocity[2]) < STILL_SPIN

export interface StaysInPlaceParams {
  readonly body: PieceBody
  /** It touches what holds it up (the ground, a fixed thing, another piece) and is not going over. */
  readonly held: boolean
  readonly center: Vec3
  readonly quaternion: THREE_NS.Quaternion
  readonly dt: number
}

/** Whether the piece has kept to the same spot on the ground for `CALM_SLEEP_AFTER` (see `CALM_DRIFT`). */
export const staysInPlace = ({ body: b, held, center, quaternion: q, dt }: StaysInPlaceParams): boolean => {
  const at = b.calmAt
  const turned = at ? turnBetween(at.quaternion, q) : Infinity
  if (!held || !at || Math.hypot(center[0] - at.center[0], center[1] - at.center[1], center[2] - at.center[2]) > CALM_DRIFT || turned > CALM_TURN) {
    b.calmAt = held ? { center: [center[0], center[1], center[2]], quaternion: [q.x, q.y, q.z, q.w] } : null
    b.calm = 0
    return false
  }
  b.calm += dt
  return b.calm >= CALM_SLEEP_AFTER
}

/** The piece sleeps where it lies: its speeds are dropped and what it kept while awake (rest points, tilt, calm window) goes. */
export const putToSleep = (b: PieceBody): void => {
  b.restPoints = undefined
  b.sleeping = true
  b.calmAt = null
  b.steady = null
  b.velocity[0] = b.velocity[1] = b.velocity[2] = 0
  b.angularVelocity[0] = b.angularVelocity[1] = b.angularVelocity[2] = 0
}
