import type { HostEvent } from '@adatechnology/game-contracts'
import type { WeaponEvent, WeaponPhase } from '@adatechnology/game-weapons'

const NO_RECOIL: [number, number] = [0, 0]

export interface HostEventOptions {
  recoil?: [number, number]
  /** What the weapon is busy with when the event is drained: the start of a phase takes its duration from it. */
  phase?: WeaponPhase | null
}

const durationOf = (phase: WeaponPhase | null | undefined, id: WeaponPhase['id']): { duration?: number } => (phase?.id === id ? { duration: phase.end - phase.start } : {})

/** What the host tells a module about a weapon event: the whole cycle, with the seconds the rule gave each phase. */
export const toHostEvent = (weapon: string, event: WeaponEvent, options: HostEventOptions = {}): HostEvent | null => {
  const { recoil = NO_RECOIL, phase } = options
  switch (event.type) {
    case 'draw':
      return event.phase === 'start' ? { type: 'tool', weapon, ...durationOf(phase, 'draw') } : null
    case 'shot':
      return { type: 'shot', weapon, shots: event.shots, recoil, rounds: event.rounds, mode: event.mode }
    case 'misfire':
      return { type: 'shot', weapon, shots: 0, recoil: NO_RECOIL, rounds: 1 }
    case 'reload':
      return { type: 'reload', weapon, phase: event.phase, ...(event.phase === 'start' ? { kind: event.kind, ...durationOf(phase, 'reload') } : {}) }
    case 'reload_stage':
      return { type: 'stage', weapon, stage: event.stage }
    case 'feed':
      return { type: 'feed', weapon }
    case 'cycle':
      return { type: 'cycle', weapon, phase: event.phase, ...(event.phase === 'start' ? durationOf(phase, 'cycle') : {}) }
    case 'empty':
      return { type: 'empty', weapon }
    case 'mode':
      return { type: 'mode', weapon, mode: event.mode }
    case 'fault':
      return { type: 'fault', weapon, fault: event.fault }
    case 'clear':
      return { type: 'clear', weapon, fault: event.fault, phase: event.phase, ...(event.phase === 'start' ? durationOf(phase, 'clear') : {}) }
    case 'safety':
      return { type: 'safety', weapon, on: event.on }
    default:
      return null
  }
}
