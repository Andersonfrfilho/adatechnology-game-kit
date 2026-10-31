import type * as THREE_NS from 'three'
import type { ControlValue } from '@adatechnology/game-contracts'
import { markKitOrigin } from '@adatechnology/game-contracts'
import { colorOfChunk, createVfx, hexToLinearRgb } from '@adatechnology/game-vfx'
import type { ScreenState, VfxWorld, WorkshopEngine } from '@adatechnology/game-vfx'
import { createChunkLayer, createGlowLayer, createPuffLayer, createSparkLayer } from './instanced'
import type { PuffUniforms } from './instanced'
import { createLightLayer } from './lights'
import { createMarkLayer } from './marks'
import { createMeshLayerProbes } from './mesh-layer'
import { createScreenOverlay } from './screen-overlay'
import { createShockLayer } from './shocks'
import { createSpriteLayer } from './sprites'
import type { ThreeLib, VfxRenderer, VfxRendererOptions } from './types'
import { createWorkshopLayers } from './workshop-layers'
import type { WorkshopLayers } from './workshop-layers'

const LAB_LIGHT_DIRECTION = [-14, 26, 12] as const
const SKY_COLOR = 0x6f7c92
const GROUND_COLOR = 0x2a241f
const LOD_BANDS: Readonly<Record<string, number | null>> = { auto: null, near: 1, middle: 0.5, far: 0.2 }
/** The quality names the bench offers, as the Workshop's levels (0 keeps every particle). */
const QUALITY_LEVELS: Readonly<Record<string, number>> = { high: 0, medium: 1, low: 2 }
/** `configure({ layer_<id>: false })` hides a layer of the renderer: `puffs`, `sparks`, `glows`, `debris`, `shock`, `sprites`. */
export const VFX_LAYERS = ['puffs', 'sparks', 'glows', 'debris', 'shock', 'sprites'] as const
const LAYER_PREFIX = 'layer_'
const SHAKE_REACH = 0.18
const SHAKE_FLOOR = 0.001

function isWorld(value: unknown): value is VfxWorld {
  return typeof value === 'object' && value !== null && 'explosion' in value && typeof (value as VfxWorld).explosion === 'function'
}

/** The overlay shows the Lab's screen and the Workshop's together: the stronger of each field. */
function mergeScreens(lab: ScreenState, workshop: ScreenState | undefined): ScreenState {
  if (!workshop) return lab
  const merged = { ...lab }
  for (const key of Object.keys(lab) as (keyof ScreenState)[]) merged[key] = Math.max(lab[key], workshop[key])
  return merged
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Draws a `VfxWorld`: the Lab's shaders, debris, shock, lights, marks and the screen overlay, and plays effects asked of it by id (`EffectSink`). */
export function createVfxRenderer(THREE: ThreeLib, options: VfxRendererOptions): VfxRenderer {
  const reducedMotion = options.reducedMotion ?? prefersReducedMotion()
  const requested = options.vfx
  const world = isWorld(requested) ? requested : createVfx({ profile: options.quality ?? 'medium', reducedMotion, ...requested })
  const pools = world.pools()
  // The probes of the last warm-up keep their materials until the next one: a program is destroyed when the last material that uses it is disposed (every solid particle disposes its own),
  // and a material that does not use lights keeps the program of the lights it was first drawn with, so each warm-up needs materials of its own.
  let anchors: { readonly meshes: THREE_NS.Mesh[]; readonly group: THREE_NS.Group } | undefined
  const releaseAnchors = (): void => {
    if (!anchors) return
    anchors.meshes[0]?.geometry.dispose()
    for (const mesh of anchors.meshes) (mesh.material as THREE_NS.Material).dispose()
    anchors = undefined
  }
  const root = markKitOrigin(new THREE.Group(), { owner: 'game-vfx-three', kind: 'effect' })
  options.scene.add(root)

  const direction = new THREE.Vector3(...(options.lightDirection ?? LAB_LIGHT_DIRECTION)).normalize()
  const sky = hexToLinearRgb(SKY_COLOR)
  const ground = hexToLinearRgb(GROUND_COLOR)
  const uniforms: PuffUniforms = {
    uLight: { value: direction },
    uSky: { value: new THREE.Vector3(sky[0] * 0.55, sky[1] * 0.55, sky[2] * 0.55) },
    uGround: { value: new THREE.Vector3(ground[0] * 0.6, ground[1] * 0.6, ground[2] * 0.6) },
    uGlowPos: { value: new THREE.Vector3() },
    uGlowCol: { value: new THREE.Vector3(1, 0.5, 0.2) },
    uGlowI: { value: 0 },
    uTime: { value: 0 },
  }
  const puffs = createPuffLayer(THREE, pools.puffs, uniforms)
  const sparks = createSparkLayer(THREE, pools.sparks)
  const glows = createGlowLayer(THREE, pools.glows)
  const rockGeometry = new THREE.DodecahedronGeometry(0.5, 0)
  const plateGeometry = new THREE.BoxGeometry(1, 1, 1)
  const chunks = createChunkLayer(THREE, pools.chunks, { rock: rockGeometry, plate: plateGeometry }, colorOfChunk)
  const shocks = createShockLayer(THREE, pools.shocks)
  const sprites = createSpriteLayer(THREE, world.sprites(), options.pointScale ?? 700)
  const lights = createLightLayer(THREE, pools.lights, options.lightScale ?? Math.PI)
  const marks = createMarkLayer(THREE, { ground: pools.ground, createCanvas: options.createCanvas, rockGeometry, plateGeometry, ...options.markLimits })
  root.add(puffs.mesh, sparks.mesh, glows.mesh, chunks.rocks, chunks.plates, shocks.group, lights.group, sprites.additive, sprites.normal, marks.group)
  const stopMarks = world.onMarks((event) => marks.handle(event))
  const overlay = options.overlay ? createScreenOverlay(options.overlay) : undefined
  let drawCalls = 0
  let workshopLayers: WorkshopLayers | undefined
  let workshopEngine: WorkshopEngine | undefined
  const layerOn = new Map<string, boolean>()
  const layerObjects = (): Record<string, THREE_NS.Object3D[]> => ({
    puffs: [puffs.mesh],
    sparks: [sparks.mesh],
    glows: [glows.mesh],
    debris: [chunks.rocks, chunks.plates],
    shock: [shocks.group],
    sprites: [sprites.additive, sprites.normal, ...(workshopLayers ? [workshopLayers.group] : [])],
  })
  const applyLayers = (): void => {
    for (const [id, objects] of Object.entries(layerObjects())) for (const object of objects) object.visible = layerOn.get(id) !== false
  }
  const screenNow = (): ScreenState => mergeScreens(world.screen(), world.peekWorkshop()?.screen)
  let clock = 0
  const lastDrawn = { puffs: 0, sparks: 0, glows: 0, chunks: 0, shocks: 0, sprites: 0 }

  function followCamera(): void {
    const position = options.camera.position
    world.setCamera([position.x, position.y, position.z])
  }

  function syncAll(): void {
    lastDrawn.puffs = puffs.sync()
    lastDrawn.sparks = sparks.sync()
    lastDrawn.glows = glows.sync()
    lastDrawn.chunks = chunks.sync()
    lastDrawn.shocks = shocks.sync()
    lastDrawn.sprites = sprites.sync()
    lights.sync()
    const engine = world.peekWorkshop()
    if (engine && engine !== workshopEngine) {
      workshopLayers?.dispose()
      if (workshopLayers) root.remove(workshopLayers.group)
      workshopEngine = engine
      workshopLayers = createWorkshopLayers(THREE, engine, options.pointScale ?? 700, 1)
      root.add(workshopLayers.group)
      applyLayers()
    }
    const workshopCalls = workshopLayers?.sync() ?? 0
    const glow = pools.lights.glow
    uniforms.uGlowPos.value.set(glow.x, glow.y, glow.z)
    uniforms.uGlowCol.value.set(glow.color[0], glow.color[1], glow.color[2])
    uniforms.uGlowI.value = glow.intensity
    drawCalls = Number(lastDrawn.puffs > 0) + Number(lastDrawn.sparks > 0) + Number(lastDrawn.glows > 0) + Number(chunks.rocks.count > 0) + Number(chunks.plates.count > 0) + Number(sprites.additive.geometry.drawRange.count > 0) + Number(sprites.normal.geometry.drawRange.count > 0) + lastDrawn.shocks * 2 + marks.count() + workshopCalls
  }

  return {
    world,
    play(request) {
      followCamera()
      const explosion = world.explosion(request.effect, request.point, {
        ...(request.direction ? { direction: request.direction } : {}),
        ...(request.seed !== undefined ? { seed: request.seed } : {}),
        ...(request.scale !== undefined ? { scale: request.scale } : {}),
      })
      if (explosion !== null) return explosion
      return world.play(request.effect, request.point, {
        ...(request.direction ? { direction: request.direction } : {}),
        ...(request.normal ? { normal: request.normal } : {}),
        ...(request.orientation ? { orientation: request.orientation } : {}),
        ...(request.seed !== undefined ? { seed: request.seed } : {}),
        ...(request.param !== undefined ? { param: request.param } : {}),
        ...(request.values ? { values: request.values } : {}),
      })
    },
    stop: (handle) => world.stop(handle),
    configure(settings: Readonly<Record<string, ControlValue>>) {
      const band = settings.lod_band
      if (typeof band === 'string' && band in LOD_BANDS) world.forceLod(LOD_BANDS[band] ?? null)
      const quality = settings.quality
      if (typeof quality === 'string' && quality in QUALITY_LEVELS) world.workshop().setQuality(QUALITY_LEVELS[quality] ?? 0)
      let layersChanged = false
      for (const [key, value] of Object.entries(settings)) {
        if (!key.startsWith(LAYER_PREFIX) || typeof value !== 'boolean') continue
        layerOn.set(key.slice(LAYER_PREFIX.length), value)
        layersChanged = true
      }
      if (layersChanged) applyLayers()
    },
    catalog: () => [...world.catalog(), ...world.effectIds()],
    update(dt) {
      clock += dt
      uniforms.uTime.value = clock
      followCamera()
      world.update(dt)
      marks.update(dt)
      syncAll()
      overlay?.update(screenNow())
    },
    warmUpProbes() {
      releaseAnchors()
      const meshes = createMeshLayerProbes(THREE)
      for (const mesh of meshes) mesh.frustumCulled = false
      const group = new THREE.Group()
      group.add(...meshes)
      anchors = { meshes, group }
      return { group, dispose: () => {} }
    },
    applyCamera() {
      const shake = screenNow().shake
      if (reducedMotion || !(shake > SHAKE_FLOOR)) return () => {}
      const camera = options.camera as THREE_NS.Camera
      const base = camera.position.clone()
      const reach = shake * SHAKE_REACH
      camera.position.x += Math.sin(clock * 71) * reach
      camera.position.y += Math.sin(clock * 53 + 1) * reach * 0.7
      camera.position.z += Math.sin(clock * 67 + 2) * reach
      return () => camera.position.copy(base)
    },
    stats() {
      const { lastBlast, ...counters } = world.stats()
      return { ...counters, last_puffs: lastBlast.puffs, last_sparks: lastBlast.sparks, last_chunks: lastBlast.chunks, last_lights: lastBlast.lights, drawCalls }
    },
    screen: screenNow,
    dispose() {
      releaseAnchors()
      stopMarks()
      overlay?.dispose()
      workshopLayers?.dispose()
      for (const layer of [puffs, sparks, glows, chunks, shocks, lights, marks, sprites]) layer.dispose()
      rockGeometry.dispose()
      plateGeometry.dispose()
      options.scene.remove(root)
    },
  }
}
