import type { DestructibleSpec } from '@adatechnology/game-destruction'

/**
 * The sound key of a vehicle's door, hood or trunk lid (`vehicle_door_shut`...): a car leaf has its own sounds, not those of its sheet metal. The part's
 * role tag (`door`, `hood`, `lid`, from game-vehicles) says which; an untagged leaf counts as a door.
 */
export const vehicleLeafKey = (spec: DestructibleSpec, part: string, moment: 'open' | 'shut'): string => {
  const tags = spec.parts.find((p) => p.id === part)?.tags ?? []
  const leaf = tags.includes('hood') ? 'hood' : tags.includes('lid') || tags.includes('trunk') ? 'trunk' : 'door'
  return `vehicle_${leaf}_${moment}`
}
