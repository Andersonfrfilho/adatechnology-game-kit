import type * as THREE_NS from 'three'

import { DEFERRED_QUEUE_ID } from '@adatechnology/game-contracts'
import {
  createGeometryPool,
  createLightBudget,
  createMaterialPool,
  createProgramWarmup,
  createStaticBatchQueue,
  shadowCasterProbes,
  spriteProbes,
} from '@adatechnology/game-render-three'
import type { EffectWarmup, LightBudget, ProgramWarmup, RenderPools, StaticBatchQueue, WarmupProbe } from '@adatechnology/game-render-three'
import { explosionEffectIds } from '@adatechnology/game-vfx'

import type { ThreeNamespace } from './view'

/** Slots of the light budget (perf.mjs on a real GPU: p50 and p99 of every phase the same as with 13 and 3, and the fixed cost of the light loop is lost in the noise). */
const DEFAULT_LIGHT_SIZES = { point: 16, spot: 4, pointShadows: 0, hemisphere: 1 } as const
/** The fog the scene may be in while the world runs: none, the weather's linear fog and its exponential one. */
const WARMED_FOG_STATES = ['none', 'linear', 'exp2'] as const
const WARMED_FIRE_EFFECTS = 1

export type KitWorldRenderBudget = {
  /** The one owner of the point and spot lights: its size is what the clients ask of it. */
  readonly lights: LightBudget
  /** What the effects and the modules ask for instead of making their own; the warm-up's anchors keep the programs of the materials that are given back. */
  readonly warmup: ProgramWarmup
  readonly pools: RenderPools
  /** One queue for the still meshes of every object the host batches. */
  readonly staticBatchQueue: StaticBatchQueue
  /** The warm-up has run at least once: the lights check re-runs it when the sealed state breaks. */
  readonly isWarmedUp: () => boolean
  warmUp(): void
  dispose(): void
}

/** What an adapter with probes (`warmUpProbes()`) gives the warm-up: the programs of its decals, effects and liquids linked at load. */
export type ProbeAdapter = { warmUpProbes(): { readonly group: unknown; dispose(): void } }

const materialsOf = (group: THREE_NS.Object3D): THREE_NS.Material[] => {
  const found = new Set<THREE_NS.Material>()
  group.traverse((object) => {
    const material = (object as THREE_NS.Mesh).material as THREE_NS.Material | THREE_NS.Material[] | undefined
    for (const each of Array.isArray(material) ? material : material ? [material] : []) found.add(each)
  })
  return [...found]
}

export const probeOf = (id: string, adapter: ProbeAdapter): WarmupProbe => ({
  id,
  build() {
    const probe = adapter.warmUpProbes()
    const group = probe.group as THREE_NS.Object3D
    return { group, materials: materialsOf(group), dispose: () => probe.dispose() }
  },
})

export function createRenderBudget(THREE: ThreeNamespace, options: {
  readonly scene: THREE_NS.Scene
  readonly camera: THREE_NS.Camera
  readonly gl: THREE_NS.WebGLRenderer
  readonly lightSizes?: { readonly point?: number; readonly spot?: number }
}): KitWorldRenderBudget {
  const { scene, camera, gl } = options
  const lights = createLightBudget(THREE, scene, { ...DEFAULT_LIGHT_SIZES, ...options.lightSizes })
  const warmup = createProgramWarmup(THREE)
  const pools: RenderPools = { geometries: createGeometryPool(), materials: createMaterialPool({ anchors: warmup.anchors, renderer: gl }) }
  const staticBatchQueue = createStaticBatchQueue({ id: DEFERRED_QUEUE_ID.STATIC_BATCH })
  let warmedUp = false
  return {
    lights,
    warmup,
    pools,
    staticBatchQueue,
    isWarmedUp: () => warmedUp,
    warmUp() {
      warmup.warmUp(gl, scene, camera, { lights, fogStates: WARMED_FOG_STATES, materials: pools.materials.registeredMaterials?.() ?? [] })
      warmedUp = true
    },
    dispose() {
      lights.dispose()
      pools.materials.dispose()
      pools.geometries.dispose()
    },
  }
}

type WarmedEffects = {
  readonly root: THREE_NS.Object3D
  readonly play: (query: { effect: string; point: [number, number, number]; direction: [number, number, number]; normal: [number, number, number] }) => number | null
  readonly stop: (handle: number) => void
  readonly update: (dt: number) => void
  readonly world: { clear(): void }
  readonly catalog?: () => readonly string[]
}

/** The adapters whose materials the world makes on demand: each one's probes are drawn once at load, and a blast of every explosive and a flame are drawn a few frames, so nothing links in play. */
export function registerWarmupProbes(THREE: ThreeNamespace, budget: KitWorldRenderBudget, adapters: Readonly<Record<string, ProbeAdapter>>, effects: WarmedEffects): void {
  const { warmup } = budget
  for (const [id, adapter] of Object.entries(adapters)) warmup.register(probeOf(id, adapter))
  warmup.register(spriteProbes(THREE))
  // a textured caster on each side: the depth program of a textured wall that first enters the sun's box in play is linked here
  warmup.register(shadowCasterProbes(THREE))
  const catalogIds = effects.catalog?.() ?? []
  // every explosion of the effects catalogue, one flame, and every impact (the spark of a bullet on metal, wood, glass...) so a shot never pays for its first buffers in play
  for (const id of [...explosionEffectIds(), ...catalogIds.filter((each) => /fire|flame/i.test(each)).slice(0, WARMED_FIRE_EFFECTS), ...catalogIds.filter((each) => /^impact_/.test(each))]) {
    if (catalogIds.includes(id)) warmup.registerEffect(warmedEffect(id, effects))
  }
}

function warmedEffect(id: string, effects: WarmedEffects): EffectWarmup {
  let handle: number | null = null
  return {
    id: `vfx:${id}`,
    // the world was drawn in every fog state just before: each frame of a blast draws the effects alone
    root: () => effects.root,
    play() {
      handle = effects.play({ effect: id, point: [0, 0.1, -4], direction: [0, 1, 0], normal: [0, 1, 0] })
    },
    step: (dt) => effects.update(dt),
    stop() {
      if (handle !== null) effects.stop(handle)
      effects.world.clear()
      effects.update(0)
    },
  }
}
