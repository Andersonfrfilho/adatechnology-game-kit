import type * as THREE_NS from 'three'

import { SPRITE_KINDS, createVfx, patchSpriteKinds } from '@adatechnology/game-vfx'
import type { SpriteKindDef } from '@adatechnology/game-vfx'
import { createVfxRenderer } from '@adatechnology/game-vfx-three'
import type { VfxRenderer } from '@adatechnology/game-vfx-three'
import type { LightBudget } from '@adatechnology/game-render-three'
import type { Terrain } from '@adatechnology/game-terrain'

import type { KitWorldQuality } from './light'
import type { ThreeNamespace } from './view'

export type KitWorldEffects = VfxRenderer

/** One effects world for the whole world: the destruction and fluid renderers and every module draw into it, and the host steps it once per frame. */
export function createEffects(THREE: ThreeNamespace, options: {
  readonly scene: THREE_NS.Scene
  readonly lights: LightBudget
  readonly camera: THREE_NS.Camera
  readonly container: HTMLElement
  readonly quality: KitWorldQuality
  readonly pointScale: number
  readonly terrain: Terrain
  readonly groundAt: (x: number, z: number) => number
  readonly particles?: Readonly<Record<string, Partial<SpriteKindDef> | null>>
}): KitWorldEffects {
  const { terrain } = options
  return createVfxRenderer(THREE, {
    scene: options.scene,
    lights: options.lights,
    camera: options.camera,
    overlay: options.container,
    quality: options.quality,
    pointScale: options.pointScale,
    vfx: createVfx({
      profile: options.quality,
      ...(options.particles ? { sprites: { kinds: patchSpriteKinds(SPRITE_KINDS, options.particles) } } : {}),
      groundAt: options.groundAt,
      marklessAt: (x, z) => terrain.waterAt(x, z) !== null,
      // the dirt crater of the effects only where the ground is loose; rock, asphalt and a slab keep the soot and the bowl the terrain itself dug
      cratersAt: (x, z) => terrain.material(terrain.columnAt(x, z).material).reposeDegrees !== undefined,
    }),
  })
}
