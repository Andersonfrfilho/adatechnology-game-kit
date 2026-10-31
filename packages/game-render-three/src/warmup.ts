import type { Camera, Scene } from 'three'

import { fogStateOf, lightSignature } from './lights/scene-state'
import type { FogState } from './lights/types'
import { createMaterialAnchors } from './pools/anchors'
import { hasMissingDistanceMaterial } from './probes'
import type { ThreeLib } from './three-lib'
import type { EffectWarmup, ProgramWarmup, WarmupContext, WarmupOptions, WarmupProbe, WarmupReport, WarmupRenderer } from './warmup-types'

const EFFECT_STEP_SECONDS = 1 / 50
const DEFAULT_EFFECT_FRAMES = 3
const WARM_FOG_DENSITY = 0.01
const WARM_FOG_FAR = 100

type LinkCounter = { count: number }

function register<TItem>(items: Set<TItem>, item: TItem): () => void {
  items.add(item)
  return () => void items.delete(item)
}

function countLinks(context: WarmupContext, counters: WeakMap<WarmupContext, LinkCounter>): void {
  const existing = counters.get(context)
  if (existing !== undefined) {
    existing.count = 0
    return
  }
  const counter: LinkCounter = { count: 0 }
  counters.set(context, counter)
  const original = context.linkProgram.bind(context)
  context.linkProgram = (program) => {
    counter.count++
    original(program)
  }
}

function failedProgram(renderer: WarmupRenderer): string | undefined {
  for (const program of renderer.info.programs ?? []) {
    const diagnostics = (program as { diagnostics?: { runnable?: boolean; programLog?: string } }).diagnostics
    if (diagnostics?.runnable === false) return diagnostics.programLog ?? 'program failed to link'
  }
  return undefined
}

export function createProgramWarmup(THREE: Pick<ThreeLib, 'Group' | 'Sprite' | 'SpriteMaterial' | 'DataTexture' | 'Fog' | 'FogExp2'>): ProgramWarmup {
  const probes = new Set<WarmupProbe>()
  const effects = new Set<EffectWarmup>()
  const textures = new Set<Parameters<WarmupRenderer['initTexture']>[0]>()
  const anchors = createMaterialAnchors()
  const linkCounters = new WeakMap<WarmupContext, LinkCounter>()

  function setFog(scene: Scene, state: FogState): void {
    const color = scene.fog?.color.getHex() ?? 0
    if (state === 'none') scene.fog = null
    else if (state === 'linear' && (scene.fog as { isFog?: boolean } | null)?.isFog !== true) scene.fog = new THREE.Fog(color, 1, WARM_FOG_FAR)
    else if (state === 'exp2' && (scene.fog as { isFogExp2?: boolean } | null)?.isFogExp2 !== true) scene.fog = new THREE.FogExp2(color, WARM_FOG_DENSITY)
  }

  function draw(renderer: WarmupRenderer, scene: Scene, camera: Camera, target: WarmupOptions['target']): void {
    renderer.setRenderTarget(target ?? null)
    renderer.compile(scene, camera)
    renderer.render(scene, camera)
  }

  function playEffect(renderer: WarmupRenderer, scene: Scene, camera: Camera, effect: EffectWarmup, target: WarmupOptions['target']): void {
    effect.play()
    for (let frame = 0; frame < (effect.frames ?? DEFAULT_EFFECT_FRAMES); frame++) {
      effect.step(EFFECT_STEP_SECONDS)
      renderer.setRenderTarget(target ?? null)
      renderer.render(scene, camera)
    }
    effect.stop()
  }

  return {
    anchors,
    register: (probe) => register(probes, probe),
    registerEffect: (effect) => register(effects, effect),
    registerTexture: (texture) => register(textures, texture),
    warmUp(renderer, scene, camera, options = {}): WarmupReport {
      const started = performance.now()
      const { lights, target } = options
      anchors.bind(renderer)
      const originalFog = scene.fog
      const states = options.fogStates ?? [fogStateOf(scene)]
      lights?.seal(renderer, scene, { fogStates: options.fogStates, cameras: [camera], target })
      scene.traverse((object) => {
        const light = object as { castShadow?: boolean; shadow?: { needsUpdate: boolean } }
        if (light.castShadow === true && light.shadow !== undefined) light.shadow.needsUpdate = true
      })
      const built = [...probes].map((probe) => ({ probe, built: probe.build() }))
      for (const { probe, built: item } of built) {
        const missing = hasMissingDistanceMaterial(item.group)
        if (missing !== undefined) throw new Error(`warmup probe "${probe.id}": instanced mesh "${missing}" casts shadows with a customDepthMaterial but no customDistanceMaterial`)
        scene.add(item.group)
      }
      for (const state of states) {
        setFog(scene, state)
        draw(renderer, scene, camera, target)
      }
      scene.fog = originalFog
      for (const effect of effects) playEffect(renderer, scene, camera, effect, target)
      for (const texture of textures) renderer.initTexture(texture)
      for (const { built: item } of built) {
        scene.remove(item.group)
        item.dispose()
        for (const material of item.materials) anchors.offer(material)
      }
      const context = renderer.getContext()
      const uniformVectors = Number(context.getParameter(context.MAX_FRAGMENT_UNIFORM_VECTORS))
      const failure = failedProgram(renderer)
      if (failure !== undefined) {
        throw new Error(`a shader program failed to link (MAX_FRAGMENT_UNIFORM_VECTORS ${uniformVectors}, lights: ${lightSignature(scene)}): ${failure}`)
      }
      countLinks(context, linkCounters)
      return {
        programs: renderer.info.programs?.length ?? 0,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        milliseconds: performance.now() - started,
        lightSignature: lightSignature(scene),
        uniformVectors,
        anchors: anchors.size,
      }
    },
    linkedSince(renderer) {
      return linkCounters.get(renderer.getContext())?.count ?? 0
    },
  }
}
