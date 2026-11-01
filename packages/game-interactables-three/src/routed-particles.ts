/** The kinds of particle pool of the effects, as `effects.ts` draws them. */
export type PoolKind = 'smoke' | 'steam' | 'fire' | 'spark' | 'water'

/** What `EffectSink.play` of `game-contracts` takes, as a structural type. */
export interface ParticleEffectRequest {
  readonly effect: string
  readonly point: [number, number, number]
  readonly values: Readonly<Record<string, number>>
}

/** The host's effects world as far as the particles need it (`EffectSink` of `game-contracts` fits). */
export interface ParticleEffects {
  play(request: ParticleEffectRequest): unknown
}

export interface RoutedParticle {
  readonly kind: PoolKind
  readonly flag: number
  readonly position: [number, number, number]
  readonly velocity: [number, number, number]
  readonly life: number
  readonly startSize: number
  readonly endSize: number
  readonly tint: number
}

const channel = (value: number): number => Math.round(Math.min(1, Math.max(0, value)) * 255)
const rgb = (red: number, green: number, blue: number): number => (channel(red) << 16) | (channel(green) << 8) | channel(blue)

const EFFECT_OF: Readonly<Partial<Record<PoolKind, string>>> = { smoke: 'particle_puff', steam: 'particle_puff', fire: 'particle_glow', spark: 'particle_streak' }

/** True for the kinds the effects world draws; water stays local because it ends at a height of its own. */
export const isRoutedKind = (kind: PoolKind): boolean => EFFECT_OF[kind] !== undefined

/** The numbers of the local particle at birth: the colour and peak opacity the local shader gives it, its life, its two sizes (as a ratio). */
export function routedParticleRequest(particle: RoutedParticle): ParticleEffectRequest {
  const { kind, flag, tint } = particle
  const look = lookOf(kind, flag, tint)
  return {
    effect: EFFECT_OF[kind]!,
    point: particle.position,
    values: {
      vx: particle.velocity[0],
      vy: particle.velocity[1],
      vz: particle.velocity[2],
      life: particle.life,
      size: particle.startSize,
      grow: particle.endSize / particle.startSize,
      color: look.color,
      alpha: look.alpha,
      gravity: 0,
      drag: 0,
    },
  }
}

function lookOf(kind: PoolKind, flag: number, tint: number): { color: number; alpha: number } {
  if (kind === 'smoke') return { color: rgb(tint, tint, tint), alpha: 0.55 }
  if (kind === 'steam') return { color: rgb(tint, tint, tint), alpha: 0.4 }
  if (kind === 'spark') return { color: rgb(1, 0.75, 0.3), alpha: 1 }
  if (flag) return { color: rgb(0.25 + 0.15 * tint, 0.5 + 0.2 * tint, 1), alpha: 0.95 }
  return { color: rgb(1, Math.max(0.15, 0.85 - tint * 0.1), 0.25), alpha: 0.8 }
}
