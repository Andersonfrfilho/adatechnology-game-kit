import type { DestructionWorld } from '@adatechnology/game-destruction'
import type { DestructionRenderer } from '@adatechnology/game-destruction-three'
import type { FluidRenderer } from '@adatechnology/game-fluids-three'
import type { WaterEffects } from '@adatechnology/game-vfx'
import type { VfxRenderer } from '@adatechnology/game-vfx-three'

import type { KitWorldDestruction } from './destruction'
import type { KitWorldFrame } from './frame'
import type { KitWorldGround } from './ground'
import type { KitWorldFilm, KitWorldFluids } from './liquids'
import type { KitWorldPieces } from './pieces'
import type { KitWorldSound } from './sound'

export type ResetDeps = {
  readonly world: DestructionWorld
  readonly destruction: KitWorldDestruction
  readonly renderer: DestructionRenderer
  readonly ground: KitWorldGround
  readonly fluids: KitWorldFluids
  readonly liquids: KitWorldFilm
  readonly fluidView: FluidRenderer
  readonly water: WaterEffects
  readonly effects: VfxRenderer
  readonly sound: KitWorldSound
  readonly pieces: KitWorldPieces
  readonly frame: KitWorldFrame
}

/** The worlds back to their seeded start, so a run after it does what the same run does on a new host. What the game spawned in them is the game's to take out first. */
export function createReset(deps: ResetDeps): () => void {
  const { world, destruction, renderer, ground, fluids, liquids } = deps
  return () => {
    deps.frame.blastPacing?.clear()
    deps.sound.destruction?.reset()
    ground.reset()
    deps.pieces.clear()
    deps.effects.world.clear()
    deps.water.clear()
    deps.fluids.fluids.clearStains([0, 0, 0], 1e4)
    deps.fluidView.clear()
    liquids.film.clear()
    renderer.reset()
    if (destruction.pristine) {
      for (const id of world.ids()) world.remove(id)
      world.load(destruction.pristine)
      ground.register()
    }
    fluids.reset()
    liquids.random.seed = 1
  }
}
