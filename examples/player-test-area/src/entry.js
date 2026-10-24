// Bundle entry (IIFE global `PlayerArea`): the player bench module of @adatechnology/game-player, ready for any room page:
// `PlayerArea.loadInto(room)` loads it with `room.loadModule` and opens its area. The module is written against the generic contracts only: the room's
// camera is the player body, and the footsteps and flesh sounds go to the room's engine (`host.audio`).
// Bench: individual infection (off by default), agility, vigor, seed; hurt, bite, grab, push, knife, bandage, knocked down, crouch, start again.
// Metrics: health, stamina, bleeding, wounds, infection, time left, panic, aim spread, grab timer, last noise, footsteps, message.
import { PLAYER_DEFAULTS, createPlayer, createPlayerTestModule } from '@adatechnology/game-player'

export { PLAYER_DEFAULTS, createPlayer, createPlayerTestModule }

/** The module for the room's locale (`?lang=en` or pt-BR); other pages (the furniture area) load it next to their own. */
export function createModule(options = {}) {
  const locale = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  return createPlayerTestModule({ ...options, locale })
}

/** Creates the module, loads it and opens the player area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const report = room.loadModule(createModule(options))
  room.openArea('player_area')
  return report
}
