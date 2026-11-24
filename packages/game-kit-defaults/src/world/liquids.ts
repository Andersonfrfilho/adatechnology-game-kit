import type * as THREE_NS from 'three'

import { createFilmLcg, createFluids } from '@adatechnology/game-fluids'
import type { FluidWorld, LiquidDef, SurfaceSpec } from '@adatechnology/game-fluids'
import { createFilmBridge, createFilmManager, createFluidRenderer } from '@adatechnology/game-fluids-three'
import type { FluidRenderer } from '@adatechnology/game-fluids-three'
import { createWaterEffects } from '@adatechnology/game-vfx'
import type { VfxWorld, WaterEffects } from '@adatechnology/game-vfx'
import { createWaterEffectsLayer } from '@adatechnology/game-vfx-three'
import type { WaterLayer } from '@adatechnology/game-vfx-three'
import type { Terrain } from '@adatechnology/game-terrain'

import type { KitWorldQuality, ThreeNamespace } from './view'

export type KitWorldFluids = {
  readonly fluids: FluidWorld
  /** The fluid world is the host's: it is put back to its start on `reset`. A fluid world the game handed in is the game's to reset. */
  readonly isOwned: boolean
  reset(): void
}

export function createFluidWorld(options: {
  readonly fluids?: FluidWorld
  readonly locale: string
  readonly liquids?: LiquidDef[]
  readonly groundAt: (x: number, z: number) => number
  readonly surfaces: readonly SurfaceSpec[]
}): KitWorldFluids {
  const isOwned = !options.fluids
  const fluids = options.fluids ?? createFluids({ seed: 1, locale: options.locale, liquids: options.liquids, groundAt: options.groundAt })
  const pristine = isOwned ? fluids.serialize() : null
  for (const surface of options.surfaces) fluids.addSurface(surface)
  return {
    fluids,
    isOwned,
    reset() {
      if (!pristine) return
      fluids.load(pristine)
      for (const surface of options.surfaces) fluids.addSurface(surface)
    },
  }
}

export type KitWorldFilm = {
  readonly view: FluidRenderer
  /** The running film of the liquids that have one (blood, fuel, oil): grids near the player, fed by the leaks of the fluid world. */
  readonly film: ReturnType<typeof createFilmManager>
  readonly bridge: ReturnType<typeof createFilmBridge>
  readonly random: { seed: number }
}

export function createLiquidViews(options: {
  readonly THREE: ThreeNamespace
  readonly scene: THREE_NS.Scene
  readonly camera: THREE_NS.Camera
  readonly gl: THREE_NS.WebGLRenderer
  readonly fluids: FluidWorld
  readonly groundAt: (x: number, z: number) => number
  readonly quality: KitWorldQuality
  readonly pointScale: number
  readonly vfx: VfxWorld
}): KitWorldFilm {
  const { THREE, scene, camera, gl, fluids, groundAt } = options
  const view = createFluidRenderer(THREE, { scene, fluids, quality: options.quality, pointScale: options.pointScale, vfx: options.vfx })
  const random = createFilmLcg(1)
  const film = createFilmManager(THREE, {
    scene,
    camera,
    random,
    fluids,
    groundAt,
    ...(typeof (gl as Partial<THREE_NS.WebGLRenderer>).copyTextureToTexture === 'function' ? { gpu: gl } : {}),
  })
  return { view, film, bridge: createFilmBridge({ fluids, manager: film, random }), random }
}

export type KitWorldWater = { readonly water: WaterEffects; readonly view: WaterLayer }

/** What rounds and blasts do to water: a splash by calibre and by charge, rings and foam that stop at the shore, waves that push what floats. */
export function createWater({ THREE, scene, terrain }: { readonly THREE: ThreeNamespace; readonly scene: THREE_NS.Scene; readonly terrain: Terrain }): KitWorldWater {
  const water = createWaterEffects({ levelAt: (x, z) => terrain.waterAt(x, z)?.level ?? null })
  const view = createWaterEffectsLayer(THREE, water)
  scene.add(view.group)
  return { water, view }
}
