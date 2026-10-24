import type * as THREE_NS from 'three'
import type { FluidEvent, StainState, StreamState } from '@adatechnology/game-fluids'
import { createVfx } from '@adatechnology/game-vfx'
import { createVfxRenderer } from '@adatechnology/game-vfx-three'
import { LiquidBody } from './liquid-body'
import { MaterialCache } from './materials'
import { profileOf } from './quality'
import { FluidSprites } from './sprites'
import { StainVisual } from './stains'
import { StreamVisual } from './streams'
import type { BindOptions, FluidQuality, FluidRenderer, FluidRendererOptions, FluidRendererStats, ThreeLib } from './types'

let rendererCount = 0

/**
 * Draws a `FluidWorld` with three.js. It only reads the world state (plus `splash` events for droplets), so a LAN client that receives the
 * same world state draws the same liquids.
 */
export function createFluidRenderer(THREE: ThreeLib, options: FluidRendererOptions): FluidRenderer {
  const { scene, fluids } = options
  const quality: FluidQuality = options.quality ?? 'medium'
  const profile = profileOf(quality)
  const materials = new MaterialCache(THREE, options.envMap ?? null)
  const root = new THREE.Group()
  root.name = 'fluid_renderer'
  scene.add(root)
  // The droplets and steam are sprites of the effects world: the host's shared one, or one made here and stepped in `update`.
  const vfx = options.vfx ?? createVfx({ profile: quality, gravity: fluids.gravity, sprites: { capacity: profile.maxParticles } })
  const ownVfx = options.vfx ? undefined : createVfxRenderer(THREE, { scene, camera: options.camera ?? new THREE.PerspectiveCamera(), vfx, pointScale: options.pointScale ?? 600 })
  const particles = new FluidSprites(vfx, `fluids-${++rendererCount}`)
  const dropGeometry = new THREE.SphereGeometry(1, 8, 6)

  const bodies = new Map<string, LiquidBody>()
  const streamsActive = new Map<string, StreamVisual>()
  const streamsFree: StreamVisual[] = []
  let streamsCreated = 0
  const stainsActive = new Map<string, StainVisual>()
  const stainsFree: StainVisual[] = []
  let stainsCreated = 0
  let time = 0
  let disposed = false

  const offSplash = fluids.on('splash', (e: FluidEvent) => {
    if (e.type !== 'splash' || disposed) return
    const def = fluids.liquids.get(e.liquid)
    if (!def) return
    particles.splash(e.point, e.intensity, def.color, def.opacity, profile.splashDroplets)
  })

  // ---- streams ----

  const acquireStream = (id: string): StreamVisual | null => {
    let v = streamsFree.pop() ?? null
    if (!v) {
      if (streamsCreated >= profile.maxStreams) return null
      streamsCreated++
      v = new StreamVisual(THREE, profile, dropGeometry)
      root.add(v.tube, v.drops)
    }
    v.start(id)
    return v
  }

  const releaseStream = (v: StreamVisual): void => {
    v.hide()
    streamsActive.delete(v.id)
    streamsFree.push(v)
  }

  const syncStreams = (dt: number): void => {
    const live = fluids.streams()
    const seen = new Set<string>()
    // Biggest first, so the budget keeps the visible ones.
    live.sort((a: StreamState, b: StreamState) => b.rate - a.rate)
    for (const s of live) {
      seen.add(s.id)
      let v = streamsActive.get(s.id)
      if (!v) {
        const fresh = acquireStream(s.id)
        if (!fresh) continue
        v = fresh
        streamsActive.set(s.id, v)
      }
      const def = fluids.liquids.get(s.liquid)
      if (!def) continue
      v.ghostAge = -1
      v.setMaterial(materials.liquidStream(def))
      v.update(s, fluids.gravity, dt, profile, time)
    }
    for (const v of [...streamsActive.values()]) {
      if (seen.has(v.id)) continue
      // The world ended it: let it break into drops.
      if (v.ghostAge < 0) v.ghostAge = 0
      if (!v.state || v.finished) {
        releaseStream(v)
        continue
      }
      v.update(v.state, fluids.gravity, dt, profile, time)
      if (v.finished) releaseStream(v)
    }
  }

  // ---- stains ----

  const syncStains = (): void => {
    const all = fluids.stains()
    // Keep the newest stains when the budget is smaller than the world.
    const wanted = all.length > profile.maxStains ? [...all].sort((a: StainState, b: StainState) => (a.age ?? 0) - (b.age ?? 0)).slice(0, profile.maxStains) : all
    const ids = new Set(wanted.map((s: StainState) => s.id))
    for (const [id, v] of [...stainsActive]) {
      if (ids.has(id)) continue
      v.hide()
      stainsActive.delete(id)
      stainsFree.push(v)
    }
    for (const s of wanted) {
      const def = fluids.liquids.get(s.liquid)
      if (!def) continue
      let v = stainsActive.get(s.id)
      if (!v) {
        v = stainsFree.pop()
        if (!v) {
          if (stainsCreated >= profile.maxStains) continue
          v = new StainVisual(THREE, profile, stainsCreated++)
          root.add(v.group)
        }
        v.stainId = s.id
        v.signature = Number.NaN
        v.assign(def, materials)
        stainsActive.set(s.id, v)
      }
      v.update(s, def, profile)
    }
  }

  // ---- public ----

  const renderer: FluidRenderer = {
    bindContainer(containerId: string, object: THREE_NS.Object3D, opts: BindOptions = {}) {
      renderer.unbindContainer(containerId)
      bodies.set(containerId, new LiquidBody(THREE, containerId, object, opts.innerOffset ?? [0, 0, 0]))
    },

    unbindContainer(containerId: string) {
      const body = bodies.get(containerId)
      if (!body) return
      body.dispose()
      bodies.delete(containerId)
    },

    update(dt: number) {
      if (disposed) return
      time += dt
      for (const body of bodies.values()) body.update(dt, fluids, materials, profile, particles)
      syncStreams(dt)
      syncStains()
      ownVfx?.update(dt)
    },

    clear() {
      for (const v of [...streamsActive.values()]) releaseStream(v)
      for (const [id, v] of [...stainsActive]) {
        v.hide()
        stainsActive.delete(id)
        stainsFree.push(v)
      }
      if (ownVfx) vfx.clear()
      else vfx.sprites().clear()
    },

    dispose() {
      if (disposed) return
      disposed = true
      offSplash()
      for (const body of bodies.values()) body.dispose()
      bodies.clear()
      for (const v of [...streamsActive.values(), ...streamsFree]) v.dispose()
      for (const v of [...stainsActive.values(), ...stainsFree]) v.dispose()
      streamsActive.clear()
      stainsActive.clear()
      streamsFree.length = 0
      stainsFree.length = 0
      ownVfx?.dispose()
      dropGeometry.dispose()
      materials.dispose()
      scene.remove(root)
      root.clear()
    },

    stats(): FluidRendererStats {
      let triangles = 0
      let containers = 0
      for (const body of bodies.values()) {
        triangles += body.triangles
        if (body.visible) containers++
      }
      for (const v of streamsActive.values()) triangles += v.triangles
      for (const v of stainsActive.values()) triangles += v.triangles
      return {
        quality,
        containers,
        streams: streamsActive.size,
        stains: stainsActive.size,
        particles: particles.count,
        triangles,
        budget: { stains: profile.maxStains, streams: profile.maxStreams, particles: profile.maxParticles },
      }
    },
  }

  return renderer
}

