import type * as THREE_NS from 'three'

import type { KitWorld } from '@adatechnology/game-kit-defaults/world'
import type { LampShares } from '@adatechnology/game-urban'
import type { ZoneFog } from '@adatechnology/game-weather-three'

import type { Houses } from './assemble/houses'
import type { PlayerRig } from './assemble/player'
import type { Horde } from './assemble/horde'
import type { Site } from './site'

/** The two views of the district: the third person over the shoulder (`?camera=third`) and the first person. There is no view from above. */
export type CameraChoice = 'shoulder' | 'first'

export type DistrictOptions = {
  readonly container: HTMLElement
  /** The zombies of the horde, spread over the zones the district names. */
  readonly zombies: number
  /** Agents the crowd has room for beyond `zombies`: the ones a scripted run releases later (default none). */
  readonly hordeReserve?: number
  /** Ids of the horde zones of the site to fill (default all of them). */
  readonly hordeZones?: readonly string[]
  /** A state of `game-weather` held for the whole run (`overcast`, `heavy_rain`...). */
  readonly weather: string
  /** Hour of the day the world is held at, 0 to 24. */
  readonly hour: number
  /** The street lamps at night: the share that works and the share that flickers, chosen by the site's seed; the rest are burnt out. Default every lamp works. */
  readonly lights?: LampShares
  /** Fog laid over the weather's own (the zone fog of `game-weather-three`). Default the weather's fog alone. */
  readonly fog?: ZoneFog
  readonly camera: CameraChoice
  /** Where the player stands and which way the view looks (yaw 0 looks toward -z). Default: the main street, looking east. */
  readonly start?: { readonly x: number; readonly z: number; readonly yaw: number }
  /** Physics of the pieces: Jolt by default, the kit's own solver with `'own'` (the browser tests without wasm). */
  readonly physics?: 'jolt' | 'own'
  /** Where the kit's recorded sounds are served (default `./sfx/`); `null` plays the recipes only; `false` makes a silent world. */
  readonly sounds?: string | null | false
  /** The threads of the page's coordinator (default the automatic count; `0` runs every job on the main thread). */
  readonly workers?: number | 'auto'
}

export type District = {
  readonly THREE: typeof THREE_NS
  readonly world: KitWorld
  readonly site: Site
  readonly houses: Houses
  readonly horde: Horde
  readonly player: PlayerRig
  /** Stops the loop and gives every resource back. */
  dispose(): void
}
