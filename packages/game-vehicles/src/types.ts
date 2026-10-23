/**
 * Internal shape of the kit while the modules are installing. Modules attach the public API to it (`kit.x = ...`)
 * and share helpers through `kit._`. The public, typed view of the same object is `VehicleKit` in `api.ts`.
 */
export interface Kit {
  THREE: any
  V3: any
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
