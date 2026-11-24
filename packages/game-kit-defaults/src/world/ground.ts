import type * as THREE_NS from 'three'

import type { GroundLayout, Hit } from '@adatechnology/game-contracts'
import type { DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import { impactKey, impactSoundKeys } from '@adatechnology/game-destruction-three'
import type { DestructionRenderer, SoundDetail } from '@adatechnology/game-destruction-three'
import type { FluidWorld } from '@adatechnology/game-fluids'
import { DEFAULT_PROFILE, createTerrain, createTerrainImpl } from '@adatechnology/game-terrain'
import type { Terrain, TerrainBlowResult, TerrainBudget } from '@adatechnology/game-terrain'
import { createTerrainRenderer } from '@adatechnology/game-terrain-three'
import type { TerrainRenderer } from '@adatechnology/game-terrain-three'

import type { ThreeNamespace } from './view'

/** Object id of the floor in the destruction world. */
export const GROUND_ID = 'room_ground'
/** What the floor is made of when the game gives no layout: a concrete slab. */
export const DEFAULT_GROUND_LAYOUT: GroundLayout = { surface: DEFAULT_PROFILE }
const TERRAIN_CELL = 0.1
/** A huge arena gets coarser cells, not more memory. */
const TERRAIN_MAX_CELLS = 1000
const GROUND_SPLASH_MAX_LITRES = 3
/** The most debris a blow or a splash on the ground throws at once. */
export const GROUND_BURST_MAX = 28
const GROUND_BURST_PER_METRE = 30
const GROUND_DUST_RADIUS = 0.2
const GROUND_FIRE_EVERY = 0.3
const SMOKE_CHANCE = 0.25

/** What stands over the terrain at a point: the height of its top, 0 where there is none. */
export type GroundProvider = (x: number, z: number) => number
export type GroundProviderFactory = (renderer: DestructionRenderer) => GroundProvider
export type GroundBlowHandler = (result: TerrainBlowResult, hit?: Hit) => void

export type KitWorldGround = {
  readonly terrain: Terrain
  readonly view: TerrainRenderer
  /** The height a body rests on at (x, z): the highest top the providers know of over the terrain, or the terrain. */
  at(x: number, z: number): number
  on(event: 'blow', handler: GroundBlowHandler): () => void
  /** A top that holds things (a table, a shelf board), made once the destruction renderer exists. */
  addProvider(make: GroundProviderFactory): void
  /** Host internal: the destruction renderer now exists. */
  attach(renderer: DestructionRenderer): void
  /** The ground is an object of the world: shots, blows, blasts and flames reach it like anything else. Registers it again after the world was reloaded. */
  register(): void
  /** Host internal: burning cells flame and smoke every `GROUND_FIRE_EVERY` seconds of the simulation. */
  showFire(dt: number): void
  /** What a blow on the ground shows and sounds (debris, dust, a splash, the impact), as when the ground's own `onBlow` runs: for a blow the game applied itself. */
  showBlow(result: TerrainBlowResult, hit?: Hit): void
  /** The fire clock at zero, the layout as it is (a game that laid the ground itself). */
  resetFire(): void
  /** Back to the layout the world started with and the fire clock at zero. */
  reset(): void
}

export type GroundDeps = {
  readonly THREE: ThreeNamespace
  readonly scene: THREE_NS.Scene
  readonly world: DestructionWorld
  readonly bounds: readonly [number, number, number, number]
  readonly layout?: GroundLayout
  readonly budget?: Partial<TerrainBudget>
  readonly name: string
  readonly random: () => number
  readonly renderer: () => DestructionRenderer
  readonly fluids: () => FluidWorld
  readonly playSound: (key: string, point: Vec3, volume: number, detail?: SoundDetail) => void
}

export function createGround(deps: GroundDeps): KitWorldGround {
  const { world } = deps
  const [minX, minZ, maxX, maxZ] = deps.bounds
  const layout: GroundLayout = deps.layout ?? DEFAULT_GROUND_LAYOUT
  const terrain = createTerrain({
    bounds: [minX, minZ, maxX, maxZ],
    cellSize: Math.max(TERRAIN_CELL, Math.max(maxX - minX, maxZ - minZ) / TERRAIN_MAX_CELLS),
    layout,
    ...(deps.budget ? { budget: deps.budget } : {}),
    // a crater, a slab that gave way or sand that slid takes the ground from under what stands there: the world settles, cracks or drops it
    onGroundLoss: (loss) => world.groundLoss(loss),
  })
  const view = createTerrainRenderer(deps.THREE, { terrain })
  deps.scene.add(view.group)
  const providers: GroundProvider[] = []
  const pending: GroundProviderFactory[] = []
  const blowHandlers = new Set<GroundBlowHandler>()
  let attached: DestructionRenderer | null = null
  let fireClock = 0

  const at = (x: number, z: number): number => {
    let top = 0
    for (const provider of providers) top = Math.max(top, provider(x, z))
    const floor = terrain.heightAt(x, z)
    return top > 0 ? Math.max(top, floor) : floor
  }

  const showBlow = (result: TerrainBlowResult, hit?: Hit): void => {
    const renderer = deps.renderer()
    const material = terrain.material(result.removed[0]?.material ?? result.exposed)
    const def = world.materials.get(material.id)
    const size = Math.min(GROUND_BURST_MAX, Math.ceil(result.radius * GROUND_BURST_PER_METRE))
    renderer.emit(material.debris === 'clods' ? 'dust' : material.debris === 'blocks' ? 'chips' : material.debris, result.point as Vec3, [0, 1, 0], Math.max(2, size), Math.min(4, 1 + result.radius * 4))
    if (result.radius > GROUND_DUST_RADIUS) renderer.emit('dust', result.point as Vec3, [0, 1, 0], size, 1.4)
    const litres = Math.min(GROUND_SPLASH_MAX_LITRES, 0.1 + result.radius * 2)
    // water on water leaves no stain: the terrain drew its rings
    if (result.water) {
      // a round splashed where it crossed the surface and a charge where it went off: a blow or a body only stirs it
      if (hit?.type !== 'ballistic' && hit?.type !== 'explosive') renderer.emit('foam', [result.point[0], result.water.level + 0.05, result.point[2]], [0, 1, 0], Math.max(6, size * 2), 2 + result.radius * 4)
    } else if (material.splash) deps.fluids().splash(material.splash, [result.point[0], result.point[1] + 0.05, result.point[2]], litres, [0, 1.5 + result.radius * 3, 0])
    deps.playSound(impactKey(def), result.point as Vec3, Math.min(1, 0.25 + result.radius), impactSoundKeys(material.id, def))
    for (const handler of [...blowHandlers]) handler(result, hit)
  }
  const impl = createTerrainImpl(terrain, { id: GROUND_ID, name: deps.name, onBlow: showBlow })

  return {
    terrain,
    view,
    at,
    on(_event, handler) {
      blowHandlers.add(handler)
      return () => blowHandlers.delete(handler)
    },
    addProvider(make) {
      if (attached) providers.push(make(attached))
      else pending.push(make)
    },
    attach(renderer) {
      attached = renderer
      terrain.onDeform((region) => renderer.wakeRegion(region.x, region.z, region.radius))
      for (const make of pending.splice(0)) providers.push(make(renderer))
    },
    register() {
      if (!world.has(GROUND_ID)) world.register(impl, { id: GROUND_ID })
    },
    showFire(dt) {
      fireClock += dt
      if (fireClock < GROUND_FIRE_EVERY) return
      fireClock = 0
      const renderer = deps.renderer()
      for (const [x, z] of terrain.burningPoints()) {
        const y = terrain.heightAt(x, z)
        renderer.emit('fire', [x, y + 0.05, z], [0, 1, 0], 3, 1.6)
        if (deps.random() < SMOKE_CHANCE) renderer.emit('smoke', [x, y + 0.2, z], [0, 1, 0], 1, 1)
      }
    },
    showBlow,
    resetFire() {
      fireClock = 0
    },
    reset() {
      terrain.setLayout(layout)
      fireClock = 0
    },
  }
}
