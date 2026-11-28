import type { Player } from '../player'

/** An infection stage as `Player.stage()` answers it. */
export type InfectionStage = ReturnType<Player['stage']>

/** What the HUD shows of a body, read from its state: plain numbers, so a game with its own body fills it too. */
export type PlayerHudView = {
  readonly alive: boolean
  readonly health: number
  readonly maxHealth: number
  readonly stamina: number
  readonly maxStamina: number
  readonly bleeding: boolean
  /** The open wounds by kind, oldest first (`scratch`, `laceration`, `bite`, or a game's own kinds). */
  readonly wounds: readonly string[]
  readonly infection: InfectionStage
  /** Hunger and thirst, 0 fed and quenched up to `needMax` (`advanceNeeds`); absent, the HUD shows no needs. */
  readonly hunger?: number
  readonly thirst?: number
  readonly needMax?: number
  /** The level past which a need costs health (`NeedsRules.starvingAt`): the bar turns red there. */
  readonly needStarving?: number
}

/** The HUD's view of a `game-player` body now, as a new object (a frame loop refills one with `writePlayerHudView`). */
/** The body the HUD reads: a `game-player` body, or one with the same fields (`needs` absent or null: no hunger and thirst bars). */
export type PlayerHudSource = Pick<Player, 'state' | 'derived' | 'stage'> & { readonly needs?: { readonly max: number; readonly starvingAt: number } | null }

export const playerHudViewOf = (player: PlayerHudSource): PlayerHudView => writePlayerHudView(player, createPlayerHudView())

/** A view the host keeps and refills every frame (`writePlayerHudView`), so the frame allocates nothing. */
export type MutablePlayerHudView = { -readonly [K in keyof PlayerHudView]: PlayerHudView[K] }

/** An empty view to refill. */
export const createPlayerHudView = (): MutablePlayerHudView => ({ alive: true, health: 0, maxHealth: 0, stamina: 0, maxStamina: 0, bleeding: false, wounds: [], infection: 'none' })

/** Writes the body's numbers now into `view` (no allocation) and answers it. */
export function writePlayerHudView(player: PlayerHudSource, view: MutablePlayerHudView): MutablePlayerHudView {
  const { state, derived } = player
  view.alive = state.alive
  view.health = state.health
  view.maxHealth = derived.maxHealth
  view.stamina = state.stamina
  view.maxStamina = derived.maxStamina
  view.bleeding = state.bleeding > 0
  view.wounds = state.wounds
  view.infection = state.infected ? player.stage() : 'none'
  const needs = player.needs
  view.hunger = needs ? state.hunger : undefined
  view.thirst = needs ? state.thirst : undefined
  view.needMax = needs?.max
  view.needStarving = needs?.starvingAt
  return view
}
