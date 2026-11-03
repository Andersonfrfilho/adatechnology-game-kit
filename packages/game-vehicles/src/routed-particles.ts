/** Smoke, fire and dust puffs handed to the host's effects world instead of the kit's own sprites. */

/** What `EffectSink.play` of `game-contracts` takes, as a structural type: this package does not depend on the contracts layer. */
export interface ParticleEffectRequest {
  readonly effect: string
  readonly point: [number, number, number]
  readonly values: Readonly<Record<string, number>>
}

/** The host's effects world as far as the puffs need it (`EffectSink` of `game-contracts` fits). */
export interface ParticleEffects {
  play(request: ParticleEffectRequest): unknown
}

export const ROUTED_PARTICLE_TYPES: Readonly<Record<string, string>> = { smoke: 'particle_puff', dust: 'particle_puff', fire: 'particle_glow' }

const PUFF_LOOKS: Readonly<Record<string, readonly [number, number]>> = {
  smokewhite: [0x9aa1a7, 0.42],
  smokeblack: [0x1b1b1c, 0.62],
  smokegray: [0x55595c, 0.5],
  smokesteam: [0xb6bcc1, 0.3],
  dust: [0x6e6658, 0.34],
  fire: [0xffffff, 0.9],
}
const LIFE: Readonly<Record<string, number>> = { dust: 1.6, smoke: 2.8, fire: 0.7 }
const FIRE_COLOR = 0xffa530
const SMOKE_START_SCALE = 0.18

export interface RoutedParticleInput {
  readonly type: string
  readonly variant?: string
  readonly color?: number
  readonly alpha?: number
  readonly size?: number
  readonly life?: number
  readonly grow?: number
  readonly position: [number, number, number]
  readonly velocity: readonly [number, number, number]
}

/** The numbers of one puff as the local system gives it: same colour, opacity, life and size, with the growth of the local law as a ratio. */
export function routedParticleRequest(input: RoutedParticleInput): ParticleEffectRequest {
  const { type } = input
  const look = PUFF_LOOKS[type + (input.variant ?? '')] ?? PUFF_LOOKS[type] ?? PUFF_LOOKS.smokewhite!
  const life = input.life ?? LIFE[type] ?? 99
  const size = (input.size ?? 1) * (input.grow ?? 1)
  const isFire = type === 'fire'
  const growth = isFire ? 1 : (SMOKE_START_SCALE + 1.5 * (1 - Math.exp(-life * 1.1)) + life * 0.12) / SMOKE_START_SCALE
  return {
    effect: ROUTED_PARTICLE_TYPES[type]!,
    point: input.position,
    values: {
      vx: input.velocity[0],
      vy: input.velocity[1],
      vz: input.velocity[2],
      life,
      size: isFire ? size * 0.85 : size * SMOKE_START_SCALE,
      grow: growth,
      color: input.color ?? (isFire ? FIRE_COLOR : look[0]),
      alpha: input.alpha ?? look[1],
      gravity: isFire ? 0 : type === 'dust' ? 0 : -0.08,
      drag: type === 'dust' ? 2.5 : isFire ? 1.5 : 0.9,
    },
  }
}
