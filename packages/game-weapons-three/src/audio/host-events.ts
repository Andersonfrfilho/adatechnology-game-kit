import type { FaultId, FireMode, ReloadStageId, WeaponEvent } from '@adatechnology/game-weapons'
import type { HostEvent } from '@adatechnology/game-contracts'

/**
 * The weapon event a host event stands for, so `mechanicalSoundOf` can pick its sound: reload stages, cycle, dry fire and misfire, jam, clear, safety, mode and feed.
 * Shots that fired a projectile have their own sound (`computeShotSound`), so they are not here.
 */
export const weaponEventOf = (event: HostEvent): WeaponEvent | undefined => {
  switch (event.type) {
    case 'misfire':
      return { type: 'misfire', at: 0 }
    case 'stage':
      return { type: 'reload_stage', stage: event.stage as ReloadStageId, at: 0 }
    case 'empty':
    case 'feed':
      return { type: event.type, at: 0 }
    case 'cycle':
      return { type: 'cycle', phase: event.phase, at: 0 }
    case 'mode':
      return { type: 'mode', mode: event.mode as FireMode, at: 0 }
    case 'fault':
      return { type: 'fault', fault: event.fault as FaultId, at: 0 }
    case 'clear':
      return { type: 'clear', fault: event.fault as FaultId, phase: event.phase, at: 0 }
    case 'safety':
      return { type: 'safety', on: event.on, at: 0 }
    default:
      return undefined
  }
}
