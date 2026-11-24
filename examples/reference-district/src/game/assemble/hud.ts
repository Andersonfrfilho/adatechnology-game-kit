import { playerTextOf } from '@adatechnology/game-player'
import { createDeathScreen, createPlayerHud, playerHudViewOf } from '@adatechnology/game-player/hud'
import type { PlayerHudWeapon } from '@adatechnology/game-player/hud'
import type { CameraRig } from '@adatechnology/game-camera'

import type { PlayerRig } from './player'

export type DistrictHud = {
  /** One fixed step: counts the time the body has lived. */
  step(dt: number): void
  /** One frame: the bars, the crosshair of the view and the death screen. */
  frame(): void
  /** The weapon in the hand; the district's body holds none, a game that hands it one sets it here. */
  setWeapon(weapon: PlayerHudWeapon | null): void
  dispose(): void
}

export type DistrictHudParams = {
  readonly container: HTMLElement
  /** The parts of the player rig the HUD reads. */
  readonly rig: Pick<PlayerRig, 'player' | 'backToStart'> & { readonly camera: Pick<CameraRig, 'isFirstPerson'> }
  readonly locale: string
  readonly title?: string
  /** Rebuilds the scene from its seed (the death screen's first button, Enter or R). */
  readonly onRestart: () => void
}

/**
 * The HUD of the district, all of it from `game-player/hud`: the body's vitals, the weapon when the hand holds one, the crosshair in the first person, the scenario's name and the body's
 * messages; when the body dies, the death screen with "restart the scene" and "back to the start" (the body goes back to where it began, the world stays as it is).
 */
export function createDistrictHud({ container, rig, locale, title, onRestart }: DistrictHudParams): DistrictHud {
  const hud = createPlayerHud({ container, locale, ...(title === undefined ? {} : { title }) })
  hud.setWeapon(null)
  let lived = 0
  const death = createDeathScreen({
    container,
    locale,
    onRestart,
    onBackToStart: () => {
      rig.backToStart()
      lived = 0
    },
  })
  const offMessage = rig.player.on('message', ({ id, seconds }) => hud.message(playerTextOf(id, locale), seconds))
  return {
    step(dt) {
      if (rig.player.state.alive) lived += dt
    },
    frame() {
      const { state } = rig.player
      hud.update(playerHudViewOf(rig.player))
      hud.setView(rig.camera.isFirstPerson() && state.alive ? 'first' : 'third')
      death.update({ alive: state.alive, deathTime: state.deathTime, cause: state.cause, survivedSeconds: lived })
    },
    setWeapon: (weapon) => hud.setWeapon(weapon),
    dispose() {
      offMessage()
      death.dispose()
      hud.dispose()
    },
  }
}
