import type * as THREE_NS from 'three'
import type { ControlValue } from '@adatechnology/game-contracts'
import { colorOfChunk, createVfx, hexToLinearRgb } from '@adatechnology/game-vfx'
import type { VfxWorld } from '@adatechnology/game-vfx'
import { createChunkLayer, createGlowLayer, createPuffLayer, createSparkLayer } from './instanced'
import type { PuffUniforms } from './instanced'
import { createLightLayer } from './lights'
import { createMarkLayer } from './marks'
import { createScreenOverlay } from './screen-overlay'
import { createShockLayer } from './shocks'
import { createSpriteLayer } from './sprites'
import type { ThreeLib, VfxRenderer, VfxRendererOptions } from './types'

const LAB_LIGHT_DIRECTION = [-14, 26, 12] as const
const SKY_COLOR = 0x6f7c92
const GROUND_COLOR = 0x2a241f
const LOD_BANDS: Readonly<Record<string, number | null>> = { auto: null, near: 1, middle: 0.5, far: 0.2 }
const SHAKE_REACH = 0.18
const SHAKE_FLOOR = 0.001

function isWorld(value: unknown): value is VfxWorld {
  return typeof value === 'object' && value !== null && 'explosion' in value && typeof (value as VfxWorld).explosion === 'function'
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
  const root = new THREE.Group()
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
  const marks = createMarkLayer(THREE, { ground: pools.ground, createCanvas: options.createCanvas, rockGeometry, plateGeometry })
  root.add(puffs.mesh, sparks.mesh, glows.mesh, chunks.rocks, chunks.plates, shocks.group, lights.group, sprites.additive, sprites.normal, marks.group)
  const stopMarks = world.onMarks((event) => marks.handle(event))
  const overlay = options.overlay ? createScreenOverlay(options.overlay) : undefined
  let drawCalls = 0
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
    const glow = pools.lights.glow
    uniforms.uGlowPos.value.set(glow.x, glow.y, glow.z)
    uniforms.uGlowCol.value.set(glow.color[0], glow.color[1], glow.color[2])
    uniforms.uGlowI.value = glow.intensity
    drawCalls = Number(lastDrawn.puffs > 0) + Number(lastDrawn.sparks > 0) + Number(lastDrawn.glows > 0) + Number(chunks.rocks.count > 0) + Number(chunks.plates.count > 0) + Number(sprites.additive.geometry.drawRange.count > 0) + Number(sprites.normal.geometry.drawRange.count > 0) + lastDrawn.shocks * 2 + marks.count()
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
        ...(request.seed !== undefined ? { seed: request.seed } : {}),
        ...(request.param !== undefined ? { param: request.param } : {}),
      })
    },
    stop: (handle) => world.stop(handle),
    configure(settings: Readonly<Record<string, ControlValue>>) {
      const band = settings.lod_band
      if (typeof band === 'string' && band in LOD_BANDS) world.forceLod(LOD_BANDS[band] ?? null)
    },
    catalog: () => [...world.catalog(), ...world.effectIds()],
    update(dt) {
      clock += dt
      uniforms.uTime.value = clock
      followCamera()
      world.update(dt)
      marks.update(dt)
      syncAll()
      overlay?.update(world.screen())
    },
    applyCamera() {
      const shake = world.screen().shake
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
    screen: () => world.screen(),
    dispose() {
      stopMarks()
      overlay?.dispose()
      for (const layer of [puffs, sparks, glows, chunks, shocks, lights, marks, sprites]) layer.dispose()
      rockGeometry.dispose()
      plateGeometry.dispose()
      options.scene.remove(root)
    },
  }
}
