import type { WorkshopEngine } from '../../workshop/engine'
import type { Vec3Tuple } from '../../workshop/types'

/** Wood chips and a puff of dust (`chips`, W849). */
export function chips(engine: WorkshopEngine, point: Vec3Tuple, direction: Vec3Tuple, count: number, spread?: number): void {
  for (let index = 0; index < engine.scaled(count); index++) {
    engine.debrisPiece({ p: point, dir: direction, cone: spread || 0.9, sp: [1, 3], size: [0.012, 0.012, 0.09], k: [0.6, 1.4], c: 0xb08a5a, life: 20 })
  }
  engine.burst('normal', count, { p: point, dir: direction, cone: 0.8, sp: [0.3, 1.2], drag: 2, life: [0.8, 1.4], size: [0.08, 0.15], grow: 3, c0: 0x7a6048, a: 0.4 })
}

/** Sparks off metal (`sparkAt`, W899). */
export function sparkAt(engine: WorkshopEngine, point: Vec3Tuple, direction: Vec3Tuple, count: number, spread?: number): void {
  engine.burst('streak', count, { p: point, dir: direction, cone: spread || 0.8, sp: [2.5, 7], life: [0.2, 0.5], len: 0.025, c0: 0xfff0c0, c1: 0xff5010, g: 9.8, gnd: 2 })
  engine.burst('add', 2, { p: point, size: [0.1, 0.18], life: 0.06, c0: 0xffd8a0, fi: 0 })
}

/** Rust flakes and a little dust (`rustAt`, W900). */
export function rustAt(engine: WorkshopEngine, point: Vec3Tuple, count: number): void {
  engine.burst('normal', count, { p: point, r: 0.1, sp: [0.1, 0.5], life: [1, 1.6], size: [0.02, 0.035], c0: 0x7a4a2a, a: 0.9, g: 6, fi: 0, gnd: 1 })
  engine.burst('normal', Math.ceil(count / 2), { p: point, r: 0.08, sp: [0.2, 0.5], drag: 2, life: [0.8, 1.3], size: [0.08, 0.14], grow: 3, c0: 0x6a4a34, a: 0.3 })
}
