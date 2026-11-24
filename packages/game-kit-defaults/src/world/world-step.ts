import type * as THREE_NS from 'three'

import type { AudioEngine } from '@adatechnology/game-audio'
import type { DestructionWorld } from '@adatechnology/game-destruction'
import type { DestructionRenderer } from '@adatechnology/game-destruction-three'
import type { FluidWorld } from '@adatechnology/game-fluids'
import type { FluidRenderer } from '@adatechnology/game-fluids-three'
import type { PhysicsLoop } from '@adatechnology/game-physics'
import type { VfxRenderer, WaterLayer } from '@adatechnology/game-vfx-three'
import type { WaterEffects } from '@adatechnology/game-vfx'

import type { KitWorldGround } from './ground'
import type { KitWorldLight } from './light'
import type { KitWorldFilm } from './liquids'
import { STEPS_PER_TICK } from './simulation-phases'
import type { KitWorldSound } from './sound'
import type { ThreeNamespace } from './view'
import type { KitWorldRules } from './world-rules'

/** What runs before or after the world's own step, inside the one `room.simulate` system; `isTick` is false in the legacy path (a `dt` that is not a tick). */
export type StepSystem = (dt: number, isTick: boolean) => void

/** Where a host's system runs inside `room.simulate-frame` (`lateSimulate`, -1000) and `room.simulate-end` (`lateSimulate`, 1000), by what the host's own part has run before it. */
export const FRAME_SLOTS = ['beforeFrame', 'afterSound', 'afterWaterView', 'afterFilm', 'afterFrame', 'beforePresent', 'afterPresent'] as const
export type FrameSlot = (typeof FRAME_SLOTS)[number]
export type FrameSlotSystem = (dt: number) => void

export type WorldStepDeps = {
  readonly THREE: ThreeNamespace
  readonly camera: THREE_NS.Camera
  readonly world: DestructionWorld
  readonly fluids: FluidWorld
  readonly fluidView: FluidRenderer
  readonly film: KitWorldFilm
  readonly renderer: DestructionRenderer
  readonly physicsLoop: PhysicsLoop | null
  readonly ground: KitWorldGround
  readonly water: WaterEffects
  readonly waterView: WaterLayer
  readonly effects: VfxRenderer
  readonly light: KitWorldLight
  readonly sound: KitWorldSound
  readonly audio: AudioEngine | null
  readonly rules: KitWorldRules
}

export type WorldStep = {
  readonly fixed: (dt: number, isTick: boolean) => void
  readonly frame: (dt: number) => void
  readonly frameEnd: (dt: number) => void
  readonly beforeWorld: Set<StepSystem>
  readonly afterWorld: Set<StepSystem>
  onSlot(slot: FrameSlot, system: FrameSlotSystem): () => void
  /** Times the world's own step repeats (`fastForward`): fire only in the first. */
  repeat: number
}

/**
 * The world's part of the step, in the order the room runs it (`design-host.md` §4.1): the player's action before, then `world.update` (repeated by `fastForward`,
 * fire only in the first repetition), the fluids, the physics, the renderer, the ground's fire and the water; what a host does after the world comes last.
 */
export function createWorldStep(deps: WorldStepDeps): WorldStep {
  const { camera, world, fluids, renderer, physicsLoop, ground, water, rules } = deps
  const beforeWorld = new Set<StepSystem>()
  const afterWorld = new Set<StepSystem>()
  const state = { repeat: 1 }
  const slots = Object.fromEntries(FRAME_SLOTS.map((slot) => [slot, new Set<FrameSlotSystem>()])) as Record<FrameSlot, Set<FrameSlotSystem>>
  const run = (slot: FrameSlot, dt: number): void => {
    for (const system of slots[slot]) system(dt)
  }
  const listenerDirection = new deps.THREE.Vector3()
  return {
    beforeWorld,
    afterWorld,
    onSlot(slot, system) {
      slots[slot].add(system)
      return () => slots[slot].delete(system)
    },
    get repeat() {
      return state.repeat
    },
    set repeat(value) {
      state.repeat = value
    },
    fixed(dt, isTick) {
      for (const system of beforeWorld) system(dt, isTick)
      for (let i = 0; i < state.repeat; i++) {
        world.update(dt)
        if (i === 0) rules.fire(dt)
        fluids.update(dt)
      }
      rules.beforePhysics()
      if (isTick) physicsLoop?.stepFixed(STEPS_PER_TICK)
      else physicsLoop?.step(dt)
      renderer.update(dt)
      ground.showFire(dt)
      water.setCamera([camera.position.x, camera.position.y, camera.position.z])
      water.update(dt)
      for (const system of afterWorld) system(dt, isTick)
    },
    frame(dt) {
      run('beforeFrame', dt)
      deps.light.followSun([camera.position.x, camera.position.y, camera.position.z])
      deps.sound.destruction?.update(dt)
      run('afterSound', dt)
      ground.view.sync(camera.position)
      deps.effects.update(dt)
      deps.waterView.sync()
      run('afterWaterView', dt)
      deps.fluidView.update(dt)
      deps.film.bridge.update(dt)
      deps.film.film.update(dt)
      run('afterFilm', dt)
      if (deps.audio) {
        // the listener is the camera: where it stands and which way it looks (yaw 0 faces -z)
        const look = camera.getWorldDirection(listenerDirection)
        deps.audio.setListener({ position: [camera.position.x, camera.position.y, camera.position.z], yaw: Math.atan2(-look.x, -look.z) })
      }
      run('afterFrame', dt)
    },
    frameEnd(dt) {
      run('beforePresent', dt)
      // the gun is posed and the view turned for this frame: a flash that rides on a muzzle is drawn on this frame's muzzle
      deps.effects.present()
      run('afterPresent', dt)
    },
  }
}
