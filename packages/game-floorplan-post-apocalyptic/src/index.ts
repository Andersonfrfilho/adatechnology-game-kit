import type { FloorplanEngine } from '@adatechnology/game-floorplan'
import { postApocalypticItems } from './items'
import { LEGACY_STREAMS } from './legacy-seeds'
import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'
import { abandonedState, fortifiedState } from './state'

export interface PostApocalypticOptions {
  /**
   * Weights of the state drawn from the seed when `options.state` is not given.
   * Default `{ fortified: 0.35, abandoned: 0.45, normal: 0.2 }`. Pass `null` to always default to `normal`.
   */
  distribution?: Record<string, number> | null
}

export const version = '0.1.0'

/** Default draw: 35% fortified, 45% abandoned, 20% normal. */
export const defaultDistribution: Record<string, number> = { fortified: 0.35, abandoned: 0.45, normal: 0.2 }

/** State names this pack adds. */
export const postApocalypticStates = ['fortified', 'abandoned'] as const

/** Registers the `fortified` and `abandoned` states, their items and the default seed distribution. */
export function register(engine: FloorplanEngine, options: PostApocalypticOptions = {}): void {
  engine.registerLocale('en', enLocale)
  engine.registerLocale('pt-BR', ptBrLocale)
  engine.registerItems(postApocalypticItems)
  engine.registerWallTop('barbed_wire', 0.3)
  engine.registerState('fortified', fortifiedState)
  engine.registerState('abandoned', abandonedState)
  const distribution = options.distribution === undefined ? defaultDistribution : options.distribution
  engine.setStateDistribution(distribution, LEGACY_STREAMS.distribution)
}

export { postApocalypticItems, fortifiedState, abandonedState, enLocale, ptBrLocale }
