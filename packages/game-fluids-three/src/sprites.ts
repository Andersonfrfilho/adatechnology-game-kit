import type { VfxWorld } from '@adatechnology/game-vfx'
import { Rng, clamp, hashPoint } from './util'

/**
 * Splash droplets and steam, made of the shared sprite kinds of the effects world (`drips` and `steam`) instead of a pool of their own. The droplets are
 * ballistic and stop at the height they were thrown from; the steam rises slowly.
 */
export class FluidSprites {
  private readonly rng = new Rng(1234567)
  private thrown = 0

  constructor(
    private readonly vfx: VfxWorld,
    private readonly owner: string,
  ) {}

  /** Droplets thrown up by an impact; they stop at `point[1]`. */
  splash(point: [number, number, number], intensity: number, hex: number, opacity: number, count: number): void {
    const rng = new Rng(hashPoint(point[0], point[1], point[2]) ^ this.thrown)
    const n = Math.max(2, Math.round(count * (0.35 + 0.65 * clamp(intensity, 0, 1))))
    this.thrown += n
    for (let k = 0; k < n; k++) {
      const a = rng.next() * Math.PI * 2
      const h = (0.25 + rng.next() * 0.9) * (0.4 + intensity)
      const up = (0.7 + rng.next() * 1.5) * (0.5 + intensity)
      const life = 0.45 + rng.next() * 0.45
      const size = 0.012 + rng.next() * 0.014
      this.vfx.spawn('drips', [point[0], point[1] + 0.01, point[2]], [Math.cos(a) * h, up, Math.sin(a) * h], {
        color: hex,
        life: life / DRIP_LIFE,
        size: size / DRIP_SIZE,
        alpha: clamp(opacity + 0.2, 0.35, 1),
        floor: point[1],
      })
    }
  }

  /** One puff of steam rising from `point`. */
  steam(point: [number, number, number]): void {
    const r = this.rng
    this.vfx.spawn('steam', [point[0] + (r.next() - 0.5) * 0.04, point[1], point[2] + (r.next() - 0.5) * 0.04], [(r.next() - 0.5) * 0.06, 0.22 + r.next() * 0.12, (r.next() - 0.5) * 0.06], {
      color: STEAM_COLOR,
      life: (1.2 + r.next() * 0.6) / STEAM_LIFE,
      size: STEAM_SIZE_FACTOR,
      alpha: STEAM_ALPHA,
      rise: STEAM_RISE,
    })
  }

  /** The sprites alive in the world (a shared world counts everyone's). */
  get count(): number {
    return this.vfx.sprites().live
  }
}

// The `drips` kind lives 2 to 3 s at 0.025 to 0.035 m, the `steam` kind 1 to 2 s at 0.12 to 0.2 m with 0.35 alpha and a rise of 0.9 m/s²: the
// fluids pool's old droplets (0.45 to 0.9 s, 0.012 to 0.026 m) and steam (1.2 to 1.8 s, 0.03 m growing to 0.1 m, 0.24 alpha) are those scaled.
const DRIP_LIFE = 2.5
const DRIP_SIZE = 0.03
const STEAM_LIFE = 1.5
const STEAM_COLOR = 0xf4f8ff
const STEAM_SIZE_FACTOR = 0.2
const STEAM_ALPHA = 0.24 / 0.35
const STEAM_RISE = 0.3
