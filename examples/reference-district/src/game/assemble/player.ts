import type * as THREE_NS from 'three'

import { create as createCameraRig } from '@adatechnology/game-camera'
import type { CameraRig } from '@adatechnology/game-camera'
import { createPlayerAvatar } from '@adatechnology/game-characters-three'
import type { PlayerAvatar } from '@adatechnology/game-characters-three'
import type { NavGrid, PlayerCrowdLike } from '@adatechnology/game-crowd'
import { createPlayer } from '@adatechnology/game-player'
import type { Player } from '@adatechnology/game-player'
import type { KitWorld } from '@adatechnology/game-kit-defaults/world'

import type { CameraChoice } from '../options'

const WALK_KEYS: Readonly<Record<string, readonly [forward: number, right: number]>> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
}
const RUN_KEYS = ['ShiftLeft', 'ShiftRight']
const CYCLE_KEY = 'KeyV'
const START_PITCH = 0.1

export type PlayerRig = {
  readonly player: Player
  readonly avatar: PlayerAvatar
  readonly camera: CameraRig
  /** Where the view looks (radians; yaw 0 looks toward -z). A scripted run sets it and the keys are not needed. */
  readonly view: { yaw: number; pitch: number }
  /** What the scripted run holds down in place of the keys: `forward` and `right` in -1..1. */
  readonly held: { forward: number; right: number; run: boolean }
  setMode(mode: CameraChoice): void
  /** Puts the body back as it began (where it stood, its vitals, alive) looking the way it looked; the world stays as it is. */
  backToStart(): void
  /** Hands the body the crowd it fights and is held by (the crowd is made after the body, which it hunts). */
  bindCrowd(crowd: PlayerCrowdLike): void
  /** One fixed step: reads the keys and moves the body on the nav grid. */
  step(dt: number): void
  /** One frame: poses the avatar by the body's speed and places the camera. */
  pose(dt: number): void
  dispose(): void
}

export type PlayerRigParams = {
  readonly THREE: typeof THREE_NS
  readonly world: KitWorld
  readonly grid: NavGrid
  readonly start: { readonly x: number; readonly z: number; readonly yaw: number }
  readonly mode: CameraChoice
  readonly seed: number
}

/**
 * The player of the district: the body of `game-player` walking on the nav grid (the horde reads the same grid), the avatar of `game-characters-three` posed by its speed and the camera
 * of `game-camera` in third person over the shoulder or in first person. Keys: WASD or arrows walk, shift runs, V swaps the camera, a click takes the mouse for the look.
 */
export function createPlayerRig({ THREE, world, grid, start, mode, seed }: PlayerRigParams): PlayerRig {
  const inWater = (x: number, z: number): boolean => world.ground.terrain.waterAt(x, z) !== null
  const player = createPlayer({ seed, position: start, world: { solidAt: grid.solidAt, cellKind: grid.cellKind, inWater } })
  const avatar = createPlayerAvatar(THREE)
  world.view.scene.add(avatar.root)
  const camera = createCameraRig(THREE, { locale: 'pt-BR' })
  camera.setMode(mode)
  const view = { yaw: start.yaw, pitch: START_PITCH }
  const startSave = player.save()
  const held = { forward: 0, right: 0, run: false }
  const keys = new Set<string>()
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    keys.add(event.code)
    if (event.code === CYCLE_KEY) camera.setMode(camera.mode === 'first' ? 'shoulder' : 'first')
  }
  const onKeyUp = (event: KeyboardEvent): void => void keys.delete(event.code)
  const onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== world.view.domElement) return
    camera.look(view, { dx: event.movementX, dy: event.movementY })
  }
  const onClick = (): void => void world.view.domElement?.requestPointerLock?.()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousemove', onMouseMove)
  world.view.domElement?.addEventListener('click', onClick)

  const isRunning = (): boolean => held.run || RUN_KEYS.some((code) => keys.has(code))
  const walkOf = (): { forward: number; right: number } => {
    let forward = held.forward
    let right = held.right
    for (const code of keys) {
      const step = WALK_KEYS[code]
      if (step) [forward, right] = [forward + step[0], right + step[1]]
    }
    return { forward: Math.max(-1, Math.min(1, forward)), right: Math.max(-1, Math.min(1, right)) }
  }

  return {
    player,
    avatar,
    camera,
    view,
    held,
    setMode: (next: CameraChoice) => camera.setMode(next),
    backToStart() {
      player.load(startSave)
      view.yaw = start.yaw
      view.pitch = START_PITCH
      held.forward = 0
      held.right = 0
      held.run = false
    },
    bindCrowd: (crowd) => player.setWorld({ solidAt: grid.solidAt, cellKind: grid.cellKind, inWater, crowd }),
    step(dt) {
      const walk = walkOf()
      player.update(dt, { forward: walk.forward, right: walk.right, run: isRunning(), yaw: view.yaw })
      player.state.y = world.ground.at(player.state.x, player.state.z)
    },
    pose(dt) {
      const { state } = player
      const running = isRunning()
      avatar.root.position.set(state.x, state.y, state.z)
      avatar.root.rotation.set(0, view.yaw + Math.PI, 0)
      avatar.update(dt, { speed: Math.hypot(state.vx, state.vz), running, crouch: state.crouch })
      avatar.root.updateMatrixWorld(true)
      const isFirst = camera.isFirstPerson()
      avatar.setView(isFirst ? 'first' : 'third', isFirst ? world.view.camera : null)
      camera.update(world.view.camera, { x: state.x, y: state.y, z: state.z, yaw: view.yaw, pitch: view.pitch, crouching: state.crouch, alive: state.alive, deathT: state.deathTime }, dt)
    },
    dispose() {
      if (document.pointerLockElement === world.view.domElement) document.exitPointerLock()
      avatar.root.removeFromParent()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      world.view.domElement?.removeEventListener('click', onClick)
      avatar.dispose()
    },
  }
}
