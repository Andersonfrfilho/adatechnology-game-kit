import type { CameraRig } from '@adatechnology/game-camera'
import { playerTextOf } from '@adatechnology/game-player'
import { createDeathScreen, createPlayerHud, createPlayerHudView, writePlayerHudView } from '@adatechnology/game-player/hud'
import type { PlayerHudWeapon } from '@adatechnology/game-player/hud'

import type { PlayerRig } from './player'

export type DistrictHud = {
  /** One fixed step: counts the time the body has lived. */
  step(dt: number): void
  /** One frame: the bars, the crosshair of the view and the death screen (it allocates nothing). */
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
  /** Rebuilds the scene from its seed (the death screen's first button, or R). */
  readonly onRestart: () => void
  /** The game's canvas: it takes the focus back when the death screen shuts (a click on it takes the mouse again, as always). */
  readonly canvas?: HTMLElement
}

/**
 * The HUD of the district, all of it from `game-player/hud`: the body's vitals, the weapon when the hand holds one, the crosshair in the first person, the scenario's name and the body's
 * messages; when the body dies, the death screen with "restart the scene" and "back to the start" (the body goes back to where it began, the world stays as it is).
 */
export function createDistrictHud({ container, rig, locale, title, onRestart, canvas }: DistrictHudParams): DistrictHud {
  const hud = createPlayerHud({ container, locale, ...(title === undefined ? {} : { title }) })
  hud.setWeapon(null)
  if (canvas && !canvas.hasAttribute('tabindex')) canvas.tabIndex = -1
  let lived = 0
  const death = createDeathScreen({
    container,
    locale,
    onRestart,
    onBackToStart: () => {
      rig.backToStart()
      lived = 0
    },
    ...(canvas ? { returnFocus: canvas } : {}),
  })
  const view = createPlayerHudView()
  const body = { alive: true, deathTime: 0, cause: '', survivedSeconds: 0 }
  const offMessage = rig.player.on('message', ({ id, seconds }) => hud.message(playerTextOf(id, locale), seconds))
  return {
    step(dt) {
      if (rig.player.state.alive) lived += dt
    },
    frame() {
      const { state } = rig.player
      hud.update(writePlayerHudView(rig.player, view))
      hud.setView(rig.camera.isFirstPerson() && state.alive ? 'first' : 'third')
      body.alive = state.alive
      body.deathTime = state.deathTime
      body.cause = state.cause
      body.survivedSeconds = lived
      death.update(body)
    },
    setWeapon: (weapon) => hud.setWeapon(weapon),
    dispose() {
      offMessage()
      death.dispose()
      hud.dispose()
    },
  }
}
