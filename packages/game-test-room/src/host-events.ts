import type { HostEvent } from '@adatechnology/game-contracts'
import type { WeaponEvent } from '@adatechnology/game-weapons'

const NO_RECOIL: [number, number] = [0, 0]

/** What the host tells a module about a weapon event; the finer steps (cycle, reload stages, feed) stay inside the weapon until the animation contract (T1.2). */
export const toHostEvent = (weapon: string, event: WeaponEvent, recoil: [number, number] = NO_RECOIL): HostEvent | null => {
  switch (event.type) {
    case 'draw':
      return event.phase === 'start' ? { type: 'tool', weapon } : null
    case 'shot':
      return { type: 'shot', weapon, shots: event.shots, recoil, rounds: event.rounds, mode: event.mode }
    case 'misfire':
      return { type: 'shot', weapon, shots: 0, recoil: NO_RECOIL, rounds: 1 }
    case 'reload':
      return { type: 'reload', weapon, phase: event.phase }
    case 'empty':
      return { type: 'empty', weapon }
    case 'mode':
      return { type: 'mode', weapon, mode: event.mode }
    case 'fault':
      return { type: 'fault', weapon, fault: event.fault }
    case 'clear':
      return { type: 'clear', weapon, fault: event.fault, phase: event.phase }
    case 'safety':
      return { type: 'safety', weapon, on: event.on }
    default:
      return null
  }
}
