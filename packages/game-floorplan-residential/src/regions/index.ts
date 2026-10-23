import type { ResidentialRegion } from './types'
import { br } from './br'

/** Available regions. To add one (for example `us`), create `regions/us/` with the same shape and list it here. */
export const regions: Record<string, ResidentialRegion> = { br }

export function resolveRegion(region: string | ResidentialRegion | undefined): ResidentialRegion {
  if (region && typeof region === 'object') return region
  const id = region ?? 'br'
  const found = regions[id]
  if (!found) throw new Error(`Unknown residential region: ${id}. Available: ${Object.keys(regions).join(', ')}`)
  return found
}
export type { ResidentialRegion }
