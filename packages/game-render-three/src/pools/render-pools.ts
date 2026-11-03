import type { GeometryPool } from './geometry'
import type { MaterialPool } from './material'

/** The pools a host lends its adapters (`host.pools`): geometries and materials that outlive the effect that asked for them. */
export interface RenderPools {
  readonly geometries: GeometryPool
  readonly materials: MaterialPool
}

/** For adapters that receive the pools as `unknown` through the host (the contract does not know three). */
export function isRenderPools(value: unknown): value is RenderPools {
  const candidate = value as Partial<RenderPools> | null | undefined
  return typeof candidate === 'object' && candidate !== null && typeof candidate.geometries?.acquire === 'function' && typeof candidate.materials?.acquire === 'function'
}
