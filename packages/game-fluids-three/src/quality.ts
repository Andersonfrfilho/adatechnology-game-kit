import type { FluidQuality } from './types'

export interface QualityProfile {
  /** Radial segments of the container liquid volume. */
  bodySegments: number
  /** Samples along a stream and sides of its tube. */
  streamSamples: number
  streamSides: number
  /** Drops of a thin stream. */
  thinDrops: number
  /** Subdivisions per front sample of a stain outline (16 samples). */
  stainSubdiv: number
  maxStains: number
  maxStreams: number
  maxParticles: number
  /** Steam puffs per second of a steaming container. */
  steamRate: number
  /** Droplets of a full-intensity splash. */
  splashDroplets: number
}

export const PROFILES: Record<FluidQuality, QualityProfile> = {
  low: { bodySegments: 10, streamSamples: 8, streamSides: 4, thinDrops: 4, stainSubdiv: 1, maxStains: 24, maxStreams: 12, maxParticles: 96, steamRate: 4, splashDroplets: 5 },
  medium: { bodySegments: 14, streamSamples: 12, streamSides: 5, thinDrops: 6, stainSubdiv: 2, maxStains: 48, maxStreams: 24, maxParticles: 256, steamRate: 8, splashDroplets: 9 },
  high: { bodySegments: 20, streamSamples: 20, streamSides: 8, thinDrops: 8, stainSubdiv: 4, maxStains: 96, maxStreams: 48, maxParticles: 512, steamRate: 14, splashDroplets: 14 },
}

export const profileOf = (q: FluidQuality | undefined): QualityProfile => PROFILES[q ?? 'medium'] ?? PROFILES.medium
