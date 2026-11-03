import { BODY_FOLEY_BANK } from '@adatechnology/game-audio'
import type { AudioEngine } from '@adatechnology/game-audio'
import { SWING_LEAD_SECONDS, hitSoundId, landSoundId, swingSoundId } from '@adatechnology/game-contracts'
import type { BlowId, BlowTarget, GaitId, SurfaceId, Vec3 } from '@adatechnology/game-contracts'

/** How each melee tool of the arsenal strikes, by tool id; a tool not here goes by its category (`melee_blade` cuts, `melee_blunt` and `hand` knock). */
export const DEFAULT_TOOL_BLOWS: Readonly<Record<string, BlowId>> = {
  hand: 'punch',
  fists: 'punch',
  kick: 'kick',
  shove: 'shove',
  knife: 'blade',
  machete: 'blade',
  utility_knife: 'blade',
  axe: 'chop',
  hammer: 'blunt',
  claw_hammer: 'blunt',
  sledgehammer: 'blunt',
  baseball_bat: 'blunt',
  crowbar: 'blunt',
  wrench: 'blunt',
}

/** The blow a tool strikes with, or null when it is not a melee tool. */
export function blowOfTool(id: string, category: string, table: Readonly<Record<string, BlowId>> = DEFAULT_TOOL_BLOWS): BlowId | null {
  const listed = table[id]
  if (listed) return listed
  if (category === 'melee_blade') return 'blade'
  if (category === 'melee_blunt' || category === 'hand') return id === 'kick' ? 'kick' : 'blunt'
  return null
}

/** Joules of a blow to its level: a jab (about 40 J) is 0.6, a full swing of a sledgehammer (400 J and up) is 1. */
const levelOf = (energyJ: number): number => Math.max(0.5, Math.min(1, 0.5 + energyJ / 800))

/** Metres of ground per footfall when no body says where its feet are: a walking stride, a running one. */
export const STRIDE_METRES: Readonly<Record<GaitId, number>> = { walk: 0.72, run: 1.05 }

export type BodySounds = {
  /** The swing of a blow through the air, `delay` seconds from now (its loudest part `SWING_LEAD_SECONDS` later); nothing for a blow without one. */
  swing(blow: BlowId, position: Vec3, delay?: number): void
  /** The body's side of a blow that landed (knuckles, sole, blade, club) on a body, a head or an object; the material's own impact plays beside it. */
  hit(blow: BlowId, target: Exclude<BlowTarget, 'air'>, position: Vec3, energyJ: number): void
  jump(position: Vec3): void
  /** The feet meet the floor after a fall of `speed` m/s on `surface`. */
  land(surface: SurfaceId, speed: number, position: Vec3): void
  /** A thrown body hits a wall or the floor at `speed` m/s: the fall of the body, and the hurt cry when it was hard (`SLAM_HURT_SPEED`). */
  slam(speed: number, position: Vec3): void
  /** Ids played, oldest first, for the room's checks (the last 64). */
  readonly played: readonly string[]
}

/** From this speed (m/s) a body thrown into a wall or onto the floor is hurt: it cries out. */
export const SLAM_HURT_SPEED = 3.5

/** The test room's body sounds on its engine (the bank is registered in it); with no engine every call does nothing. */
export function createBodySounds(audio: AudioEngine | null): BodySounds {
  audio?.register(BODY_FOLEY_BANK)
  const played: string[] = []
  const play = (id: string, position: Vec3, volume: number, delay = 0): void => {
    played.push(id)
    if (played.length > 64) played.shift()
    audio?.play(id, { position, volume, urgent: true, ...(delay > 0 ? { delay } : {}) })
  }
  return {
    swing(blow, position, delay = 0) {
      const id = swingSoundId(blow)
      if (id) play(id, position, 0.8, delay)
    },
    hit(blow, target, position, energyJ) {
      play(hitSoundId(blow, target), position, levelOf(energyJ))
    },
    jump: (position) => play('jump', position, 0.6),
    land: (surface, speed, position) => play(landSoundId(surface, speed), position, Math.min(1, 0.45 + speed / 8)),
    slam(speed, position) {
      play('body_fall', position, Math.min(1, 0.4 + speed / 8))
      if (speed >= SLAM_HURT_SPEED) play('player_hurt', position, Math.min(1, 0.5 + speed / 12))
    },
    played,
  }
}

/** Seconds before the contact the swing of `blow` starts, so its loudest part meets the hit. */
export const swingLead = (blow: BlowId): number => SWING_LEAD_SECONDS[blow]

/** Counts strides along the ground the player walked, for a room with no body to put the feet down: one footfall per stride, the feet alternating. */
export function createStrideCounter(stride: Readonly<Record<GaitId, number>> = STRIDE_METRES): { advance(metres: number, gait: GaitId): 'left' | 'right' | null; reset(): void } {
  // the first footfall comes after half a stride: starting to walk is a step
  let left = stride.walk / 2
  let next: 'left' | 'right' = 'right'
  return {
    advance(metres, gait) {
      left -= metres
      if (left > 0) return null
      left += stride[gait]
      const foot = next
      next = next === 'right' ? 'left' : 'right'
      return foot
    },
    reset() {
      left = stride.walk / 2
      next = 'right'
    },
  }
}
