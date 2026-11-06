import type * as THREE_NS from 'three'

/** The three.js namespace the host passes (typed by `@types/three`; the package binds to no version at runtime). */
export type Three = typeof THREE_NS

/**
 * Internal shape of the kit while the modules are installing. Modules attach the public API to it (`kit.x = ...`)
 * and share helpers through `kit._`. The public, typed view of the same object is `VehicleKit` in `api.ts`.
 */
export interface Kit {
  THREE: Three
  V3: Three['Vector3']
  PI: number
  document: any
  strings: any
  t: (key: string, vars?: Record<string, unknown>) => string
  matchers: any
  hash: any
  clamp: any
  smooth: any
  /** Helpers shared between modules (not public). */
  _: Record<string, any>
  [key: string]: any
}
