/** murmur3 fmix32: a full avalanche of the 32 bits. */
export const mix32 = (value: number): number => {
  let hash = value >>> 0
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}

/**
 * 0..1 from an identity, a step and a salt: the counter-based draw every physics feature uses (never the shared `random` stream, whose order is the game's).
 * The salt goes in before the step so two different `(step, salt)` pairs never share an input.
 */
export const unit = (identity: number, step: number, salt: number): number => (mix32((mix32(identity ^ salt) + Math.imul(step + 1, 0x9e3779b9)) >>> 0) >>> 0) / 4294967296

/** The identity of the `serial`-th agent born into a crowd seeded with `seed`. */
export const identityOf = (seed: number, serial: number): number => mix32(seed ^ mix32(serial))

/** One salt per use, so draws of the same agent at the same step stay independent. */
export const SALT = {
  FALL: 0x0f411,
  TRIP: 0x07219,
  LIMB: 0x1b100,
  REGION: 0x2e610,
  JAW: 0x3a7b0,
  CORPSE: 0x4c0de,
  SPIN: 0x5917a,
  SPEED: 0x6511d,
  REACTION: 0x7201c,
  STABILITY: 0x8b21e,
  TRIP_FACTOR: 0x93b5d,
  DRIVE: 0xa00d3,
  CADENCE: 0xb1c4e,
  AGGRESSION: 0xc2a97,
  IDLE: 0xd3e08,
  GAIT: 0xe4f19,
} as const
