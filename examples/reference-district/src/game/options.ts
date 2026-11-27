import type * as THREE_NS from 'three'

import type { KitWorld } from '@adatechnology/game-kit-defaults/world'
import type { LampShares } from '@adatechnology/game-urban'
import type { UtilityNetworks } from '@adatechnology/game-urban/networks'
import type { ZoneFog } from '@adatechnology/game-weather-three'

import type { DistrictLeaks } from './assemble/leaks'
import type { DistrictSewers } from './assemble/networks'
import type { Houses } from './assemble/houses'
import type { DistrictHud } from './assemble/hud'
import type { PlayerRig } from './assemble/player'
import type { Horde } from './assemble/horde'
import type { DistrictLoadingText } from './loading'
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
  /** Where the kit's recorded sounds are served (default `./sfx/`); `null` plays the recipes only; `false` makes a silent world. */
  readonly sounds?: string | null | false
  /** The threads of the page's coordinator (default the automatic count; `0` runs every job on the main thread). */
  readonly workers?: number | 'auto'
  /** The words of the HUD and the death screen: `pt-BR` (default) or `en`. */
  readonly locale?: string
  /** The name the HUD shows at the top left (the scenario); absent, none. */
  readonly title?: string
  /** What "restart the scene" does: the page rebuilds the district from the same options (same seed, same scene). Default: reload the page with the same address. */
  readonly onRestart?: () => void
  /** The texts of the loading card shown while the district is assembled (default `DISTRICT_LOADING_TEXT`, pt-BR); `false` shows no card. */
  readonly loading?: DistrictLoadingText | false
}

export type District = {
  readonly THREE: typeof THREE_NS
  readonly world: KitWorld
  readonly site: Site
  /** The utility networks as data (`game-urban/networks`), for the drawing of T2.8d and the outages of T2.8f. */
  readonly networks: UtilityNetworks
  /** What shows of the buried networks and the pipes under the street; each blow that digs the ground is answered in `sewers.breaches`. */
  readonly sewers: DistrictSewers
  /** What the breaks leak, the houses that lose their water and the covers that fly off, with their events (`createDistrictLeaks`). */
  readonly leaks: DistrictLeaks
  readonly houses: Houses
  readonly horde: Horde
  readonly player: PlayerRig
  readonly hud: DistrictHud
  /** Stops the loop and gives every resource back. */
  dispose(): void
}
