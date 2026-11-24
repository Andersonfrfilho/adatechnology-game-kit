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
}

/** The HUD's view of a `game-player` body now. */
export function playerHudViewOf(player: Pick<Player, 'state' | 'derived' | 'stage'>): PlayerHudView {
  const { state, derived } = player
  return {
    alive: state.alive,
    health: state.health,
    maxHealth: derived.maxHealth,
    stamina: state.stamina,
    maxStamina: derived.maxStamina,
    bleeding: state.bleeding > 0,
    wounds: state.wounds,
    infection: state.infected ? player.stage() : 'none',
  }
}
