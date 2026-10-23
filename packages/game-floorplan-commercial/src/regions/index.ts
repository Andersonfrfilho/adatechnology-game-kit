import type { CommercialRegion } from './types'
import { br } from './br'

/** Available regions. To add one (for example `us`), create `regions/us/` with the same shape and list it here. */
export const regions: Record<string, CommercialRegion> = { br }

export function resolveRegion(region: string | CommercialRegion | undefined): CommercialRegion {
  if (region && typeof region === 'object') return region
  const id = region ?? 'br'
  const found = regions[id]
  if (!found) throw new Error(`Unknown commercial region: ${id}. Available: ${Object.keys(regions).join(', ')}`)
  return found
}
export type { CommercialRegion }
