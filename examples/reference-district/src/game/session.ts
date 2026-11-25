import type * as THREE_NS from 'three'

import { startDistrict } from './main'
import type { District, DistrictOptions } from './options'

export type DistrictSession = {
  /** The district up now (a new one after each restart); undefined while a restart builds it or after `dispose`. */
  readonly district: District | undefined
  /** Gives the district back and builds it again from the same options: the same seed and the same data make the same scene. A restart asked during one answers the same promise. */
  restart(): Promise<District>
  /** Gives the district back; one a pending restart brings up afterwards is given back as soon as it is built. */
  dispose(): void
}

export type DistrictSessionHooks = {
  /** Builds a district (default `startDistrict`; a test passes its own). */
  readonly start?: (THREE: typeof THREE_NS, options: DistrictOptions) => Promise<District>
  /** Called with every district the session brings up, the first one and each restart's. */
  readonly onStart?: (district: District) => void
  /** A restart that failed (default: the console). */
  readonly onError?: (error: unknown) => void
}

/** The district with its restart: the death screen's "restart the scene" rebuilds it in the page, with no reload. */
export async function startDistrictSession(THREE: typeof THREE_NS, options: Omit<DistrictOptions, 'onRestart'>, hooks: DistrictSessionHooks = {}): Promise<DistrictSession> {
  const { start = startDistrict, onStart, onError = (error: unknown) => console.error(error) } = hooks
  let current: District | undefined
  let pending: Promise<District> | null = null
  let isDisposed = false

  const build = async (): Promise<District> => {
    const district = await start(THREE, withRestart)
    if (isDisposed) {
      district.dispose()
      throw new Error('the district session was disposed while it restarted')
    }
    current = district
    onStart?.(district)
    return district
  }
  const restart = (): Promise<District> => {
    if (pending) return pending
    if (isDisposed) return Promise.reject(new Error('the district session is disposed'))
    const old = current
    current = undefined
    old?.dispose()
    pending = build().finally(() => {
      pending = null
    })
    return pending
  }
  const withRestart: DistrictOptions = { ...options, onRestart: () => void restart().catch(onError) }
  await build()
  return {
    get district() {
      return current
    },
    restart,
    dispose() {
      isDisposed = true
      const old = current
      current = undefined
      old?.dispose()
    },
  }
}
