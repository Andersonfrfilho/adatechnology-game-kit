import type * as THREE_NS from 'three'

import { startDistrict } from './main'
import type { District, DistrictOptions } from './options'

export type DistrictSession = {
  /** The district up now (a new one after each restart). */
  readonly district: District
  /** Gives the district back and builds it again from the same options: the same seed and the same data make the same scene. */
  restart(): Promise<District>
  dispose(): void
}

export type DistrictSessionHooks = {
  /** Builds a district (default `startDistrict`; a test passes its own). */
  readonly start?: (THREE: typeof THREE_NS, options: DistrictOptions) => Promise<District>
  /** Called with every district the session brings up, the first one and each restart's. */
  readonly onStart?: (district: District) => void
}

/** The district with its restart: the death screen's "restart the scene" rebuilds it in the page, with no reload. */
export async function startDistrictSession(THREE: typeof THREE_NS, options: Omit<DistrictOptions, 'onRestart'>, { start = startDistrict, onStart }: DistrictSessionHooks = {}): Promise<DistrictSession> {
  let pending: Promise<District> | null = null
  const restart = (): Promise<District> => {
    if (pending) return pending
    current.dispose()
    pending = start(THREE, withRestart).then((district) => {
      current = district
      pending = null
      onStart?.(district)
      return district
    })
    return pending
  }
  const withRestart: DistrictOptions = { ...options, onRestart: () => void restart() }
  let current = await start(THREE, withRestart)
  onStart?.(current)
  return {
    get district() {
      return current
    },
    restart,
    dispose: () => current.dispose(),
  }
}
