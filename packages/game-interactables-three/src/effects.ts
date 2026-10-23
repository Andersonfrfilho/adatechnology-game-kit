import type { ActiveEmitter, EmitterKind } from '@adatechnology/game-interactables'
import type { CanvasFactory, ThreeLib, ThreeNS } from './types'

export interface EffectsOptions {
  /** Total particles alive at once, shared by all kinds (split by weight). Default 800. */
  maxParticles?: number
  /** Used to paint the soft sprite on a canvas. Without it (or without a 2D context) a data texture is generated. */
  document?: CanvasFactory
  /** Seed of the random spread. Default 1. */
  seed?: number
  /** Wind vector [x, z] in m/s that bends smoke and steam. Default [0, 0]. */
  wind?: [number, number]
  /** Viewport height in pixels, used to size the point sprites. Update with `setViewHeight` on resize. Default 720. */
  viewHeight?: number
  /** Camera whose vertical field of view sizes the sprites (read again every `update`, so zoom and fov changes follow). Default: a 90 degree lens. */
  camera?: PerspectiveLike
}

/** What the effects read from a camera. */
export interface PerspectiveLike {
  /** Vertical field of view in degrees. */
  fov: number
  zoom?: number
}

export interface EffectsStats {
  alive: number
  capacity: number
  byKind: Record<PoolKind, number>
}

export type PoolKind = 'smoke' | 'steam' | 'fire' | 'water' | 'spark'

export interface Effects {
  /** Spawns for the active emitters and advances every particle by `dt` seconds. No allocations per frame once warmed up. */
  update(dt: number, emitters: readonly ActiveEmitter[], camera?: PerspectiveLike): void
  /** Camera used for the sprite size (or `null` to go back to a 90 degree lens). */
  setCamera(camera: PerspectiveLike | null): void
  setWind(x: number, z: number): void
  setViewHeight(px: number): void
  stats(): EffectsStats
  /** The Points objects (one per kind). */
  objects: Record<PoolKind, ThreeNS.Points>
  clear(): void
  dispose(): void
}

const POOLS: PoolKind[] = ['smoke', 'steam', 'fire', 'water', 'spark']
const WEIGHT: Record<PoolKind, number> = { smoke: 0.3, steam: 0.15, fire: 0.25, water: 0.2, spark: 0.1 }

interface Pool {
  kind: PoolKind
  cap: number
  count: number
  pos: Float32Array
  vel: Float32Array
  age: Float32Array
  life: Float32Array
  size0: Float32Array
  size1: Float32Array
  tint: Float32Array
  flags: Uint8Array
  aSize: ThreeNS.BufferAttribute
  aAlpha: ThreeNS.BufferAttribute
  aColor: ThreeNS.BufferAttribute
  aPos: ThreeNS.BufferAttribute
  points: ThreeNS.Points
}

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(aSize * uScale / max(-mv.z, 0.05), 1.0);
  gl_Position = projectionMatrix * mv;
}
`
const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(vColor, vAlpha * t.a);
}
`

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Soft round sprite (alpha only matters). Canvas when possible, otherwise generated data. */
function makeSprite(THREE: ThreeLib, doc: CanvasFactory | undefined): ThreeNS.Texture {
  const N = 64
  try {
    const canvas = doc?.createElement('canvas')
    const ctx = canvas?.getContext?.('2d')
    if (canvas && ctx && ctx.createRadialGradient) {
      canvas.width = N
      canvas.height = N
      const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.4, 'rgba(255,255,255,0.55)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, N, N)
      const tex = new THREE.CanvasTexture(canvas)
      return tex
    }
  } catch {
    // fall through to the data texture
  }
  const data = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2)
      const a = d >= 1 ? 0 : Math.pow(1 - d, 1.6)
      const i = (y * N + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.round(a * 255)
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
}

/**
 * Pooled particle effects: smoke, steam, fire (and the blue gas `flame` ring), water streams with drips, and sparks.
 * One `Points` per kind, fixed-size buffers, swap-remove; the total alive never exceeds `maxParticles`.
 */
export function createEffects(THREE: ThreeLib, scene: ThreeNS.Object3D, options: EffectsOptions = {}): Effects {
  const total = Math.max(POOLS.length, Math.floor(options.maxParticles ?? 800))
  const rand = mulberry(options.seed ?? 1)
  const wind: [number, number] = [options.wind?.[0] ?? 0, options.wind?.[1] ?? 0]
  const sprite = makeSprite(THREE, options.document)
  let viewHeight = options.viewHeight ?? 720
  let camera: PerspectiveLike | null = options.camera ?? null
  const scale = { value: 0 }
  /** Point size in pixels is size * viewHeight / (2 tan(fov / 2)) / distance. */
  const refreshScale = (cam: PerspectiveLike | null): void => {
    const fov = cam ? 2 * Math.atan(Math.tan((Math.min(Math.max(cam.fov, 1), 175) * Math.PI) / 360) / Math.max(cam.zoom ?? 1, 0.01)) : Math.PI / 2
    scale.value = viewHeight / (2 * Math.tan(fov / 2))
  }
  refreshScale(camera)

  const pools = {} as Record<PoolKind, Pool>
  const objects = {} as Record<PoolKind, ThreeNS.Points>
  let used = 0
  POOLS.forEach((kind, i) => {
    const cap = i === POOLS.length - 1 ? Math.max(1, total - used) : Math.max(1, Math.floor(total * WEIGHT[kind]))
    used += cap
    const geo = new THREE.BufferGeometry()
    const aPos = new THREE.BufferAttribute(new Float32Array(cap * 3), 3)
    const aSize = new THREE.BufferAttribute(new Float32Array(cap), 1)
    const aAlpha = new THREE.BufferAttribute(new Float32Array(cap), 1)
    const aColor = new THREE.BufferAttribute(new Float32Array(cap * 3), 3)
    for (const a of [aPos, aSize, aAlpha, aColor]) a.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', aPos)
    geo.setAttribute('aSize', aSize)
    geo.setAttribute('aAlpha', aAlpha)
    geo.setAttribute('aColor', aColor)
    geo.setDrawRange(0, 0)
    const additive = kind === 'fire' || kind === 'spark'
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: sprite }, uScale: scale },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    const points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    points.name = `effects:${kind}`
    scene.add(points)
    objects[kind] = points
    pools[kind] = {
      kind,
      cap,
      count: 0,
      pos: new Float32Array(cap * 3),
      vel: new Float32Array(cap * 3),
      age: new Float32Array(cap),
      life: new Float32Array(cap),
      size0: new Float32Array(cap),
      size1: new Float32Array(cap),
      tint: new Float32Array(cap),
      flags: new Uint8Array(cap),
      aSize,
      aAlpha,
      aColor,
      aPos,
      points,
    }
  })

  /** Fractional spawns carried over per emitter id (the Map only grows with distinct ids and is pruned by stamp). */
  const debt = new Map<string, { carry: number; stamp: number }>()
  let stamp = 0

  const spawn = (p: Pool, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, tint: number, flag = 0): void => {
    if (p.count >= p.cap) return
    const i = p.count++
    p.pos[i * 3] = x
    p.pos[i * 3 + 1] = y
    p.pos[i * 3 + 2] = z
    p.vel[i * 3] = vx
    p.vel[i * 3 + 1] = vy
    p.vel[i * 3 + 2] = vz
    p.age[i] = 0
    p.life[i] = life
    p.size0[i] = s0
    p.size1[i] = s1
    p.tint[i] = tint
    p.flags[i] = flag
  }

  const emitFrom = (e: ActiveEmitter, n: number): void => {
    const k = Math.min(1, Math.max(0, e.intensity))
    const size = e.size > 0 ? e.size : 0.2
    const [px, py, pz] = e.pos
    const [dx, dy, dz] = e.dir
    for (let j = 0; j < n; j++) {
      switch (e.kind) {
        case 'smoke':
          spawn(pools.smoke, px + (rand() - 0.5) * size * 0.4, py, pz + (rand() - 0.5) * size * 0.4, (rand() - 0.5) * 0.15, 0.5 + rand() * 0.4, (rand() - 0.5) * 0.15, 2.4 + rand() * 1.6, size * 0.35, size * 1.6, 0.35 + rand() * 0.2, 0)
          break
        case 'steam':
          spawn(pools.steam, px + (rand() - 0.5) * size * 0.3, py, pz + (rand() - 0.5) * size * 0.3, (rand() - 0.5) * 0.1, 0.35 + rand() * 0.25, (rand() - 0.5) * 0.1, 1.1 + rand() * 0.9, size * 0.25, size * 1.1, 0.9, 0)
          break
        case 'fire':
          spawn(pools.fire, px + (rand() - 0.5) * size * 0.5, py, pz + (rand() - 0.5) * size * 0.5, (rand() - 0.5) * 0.2, 0.7 + rand() * 0.8 * k, (rand() - 0.5) * 0.2, 0.3 + rand() * 0.35, size * 0.5, size * 0.1, rand(), 0)
          break
        case 'flame': {
          // gas burner: a small blue ring that licks upward
          const a = rand() * Math.PI * 2
          const r = size * 0.5
          spawn(pools.fire, px + Math.cos(a) * r, py, pz + Math.sin(a) * r, Math.cos(a) * 0.05, 0.12 + rand() * 0.18, Math.sin(a) * 0.05, 0.16 + rand() * 0.14, size * 0.28, size * 0.08, rand(), 1)
          break
        }
        case 'spark': {
          const a = rand() * Math.PI * 2
          const up = 0.4 + rand() * 0.6
          const sp = 1.2 + rand() * 2
          spawn(pools.spark, px, py, pz, Math.cos(a) * sp * (1 - up * 0.5), up * sp * 1.4, Math.sin(a) * sp * (1 - up * 0.5), 0.35 + rand() * 0.5, size * 0.18, size * 0.05, rand(), 0)
          break
        }
        case 'water': {
          const drip = k < 0.25
          const speed = drip ? 0.08 : 1.4 + k * 2.2
          const sx = (rand() - 0.5) * (drip ? 0.01 : 0.05)
          const sz = (rand() - 0.5) * (drip ? 0.01 : 0.05)
          spawn(pools.water, px + sx, py, pz + sz, dx * speed + sx, dy * speed, dz * speed + sz, drip ? 1.4 : 0.9, drip ? size * 0.22 : size * 0.12, drip ? size * 0.2 : size * 0.1, rand(), drip ? 1 : 0)
          break
        }
      }
    }
  }

  const RATE: Record<EmitterKind, number> = { smoke: 14, steam: 22, fire: 55, flame: 90, spark: 40, water: 90 }

  const advance = (p: Pool, dt: number): void => {
    let i = 0
    const swayX = wind[0]
    const swayZ = wind[1]
    while (i < p.count) {
      p.age[i] += dt
      const age = p.age[i]
      const life = p.life[i]
      if (age >= life || (p.kind === 'water' && p.pos[i * 3 + 1] < -50)) {
        // swap-remove
        const last = --p.count
        if (i !== last) {
          p.pos.copyWithin(i * 3, last * 3, last * 3 + 3)
          p.vel.copyWithin(i * 3, last * 3, last * 3 + 3)
          p.age[i] = p.age[last]
          p.life[i] = p.life[last]
          p.size0[i] = p.size0[last]
          p.size1[i] = p.size1[last]
          p.tint[i] = p.tint[last]
          p.flags[i] = p.flags[last]
        }
        continue
      }
      const j = i * 3
      switch (p.kind) {
        case 'smoke':
        case 'steam':
          p.vel[j] += (swayX - p.vel[j]) * Math.min(1, dt * 0.8)
          p.vel[j + 2] += (swayZ - p.vel[j + 2]) * Math.min(1, dt * 0.8)
          break
        case 'water':
          p.vel[j + 1] -= 9.8 * dt
          break
        case 'spark':
          p.vel[j + 1] -= 7 * dt
          break
        case 'fire':
          p.vel[j] += (swayX * 0.1 - p.vel[j]) * Math.min(1, dt * 2)
          break
      }
      p.pos[j] += p.vel[j] * dt
      p.pos[j + 1] += p.vel[j + 1] * dt
      p.pos[j + 2] += p.vel[j + 2] * dt
      i++
    }
  }

  const write = (p: Pool): void => {
    const n = p.count
    const pa = p.aPos.array as Float32Array
    const sa = p.aSize.array as Float32Array
    const aa = p.aAlpha.array as Float32Array
    const ca = p.aColor.array as Float32Array
    for (let i = 0; i < n; i++) {
      const u = p.age[i] / p.life[i]
      const j = i * 3
      pa[j] = p.pos[j]
      pa[j + 1] = p.pos[j + 1]
      pa[j + 2] = p.pos[j + 2]
      sa[i] = p.size0[i] + (p.size1[i] - p.size0[i]) * u
      let alpha: number
      switch (p.kind) {
        case 'smoke':
          alpha = 0.4 * Math.min(1, u * 8) * (1 - u)
          ca[j] = ca[j + 1] = ca[j + 2] = p.tint[i]
          break
        case 'steam':
          alpha = 0.3 * Math.min(1, u * 6) * (1 - u)
          ca[j] = ca[j + 1] = ca[j + 2] = p.tint[i]
          break
        case 'fire':
          alpha = (p.flags[i] ? 0.95 : 0.8) * (1 - u * u)
          if (p.flags[i]) {
            ca[j] = 0.25 + 0.15 * p.tint[i]
            ca[j + 1] = 0.5 + 0.2 * p.tint[i]
            ca[j + 2] = 1
          } else {
            // yellow core -> orange -> red as it rises
            ca[j] = 1
            ca[j + 1] = Math.max(0.15, 0.85 - u * 0.7 - p.tint[i] * 0.1)
            ca[j + 2] = Math.max(0, 0.25 - u * 0.25)
          }
          break
        case 'spark':
          alpha = 1 - u
          ca[j] = 1
          ca[j + 1] = 0.75 - u * 0.4
          ca[j + 2] = 0.3
          break
        default:
          alpha = p.flags[i] ? 0.75 : 0.55
          ca[j] = 0.55
          ca[j + 1] = 0.75
          ca[j + 2] = 1
      }
      aa[i] = alpha
    }
    p.aPos.needsUpdate = true
    p.aSize.needsUpdate = true
    p.aAlpha.needsUpdate = true
    p.aColor.needsUpdate = true
    p.points.geometry.setDrawRange(0, n)
  }

  return {
    objects,
    update(dt, emitters, cam) {
      if (cam) camera = cam
      refreshScale(camera)
      const step = Math.min(Math.max(dt, 0), 0.1)
      stamp++
      for (let i = 0; i < emitters.length; i++) {
        const e = emitters[i]
        if (!(e.intensity > 0)) continue
        let d = debt.get(e.id)
        if (!d) {
          d = { carry: 0, stamp }
          debt.set(e.id, d)
        }
        d.stamp = stamp
        const k = Math.min(1, e.intensity)
        let rate = RATE[e.kind] * k
        if (e.kind === 'water' && k < 0.25) rate = 3 + k * 10
        d.carry += rate * step
        const n = Math.floor(d.carry)
        d.carry -= n
        if (n > 0) emitFrom(e, n)
      }
      if (debt.size > emitters.length + 8) {
        for (const [id, d] of debt) if (d.stamp !== stamp) debt.delete(id)
      }
      for (const kind of POOLS) {
        advance(pools[kind], step)
        write(pools[kind])
      }
    },
    setWind(x, z) {
      wind[0] = x
      wind[1] = z
    },
    setCamera(cam) {
      camera = cam
      refreshScale(camera)
    },
    setViewHeight(px) {
      viewHeight = px
      refreshScale(camera)
    },
    stats() {
      const byKind = {} as Record<PoolKind, number>
      let alive = 0
      let capacity = 0
      for (const kind of POOLS) {
        byKind[kind] = pools[kind].count
        alive += pools[kind].count
        capacity += pools[kind].cap
      }
      return { alive, capacity, byKind }
    },
    clear() {
      for (const kind of POOLS) {
        pools[kind].count = 0
        write(pools[kind])
      }
      debt.clear()
    },
    dispose() {
      for (const kind of POOLS) {
        scene.remove(objects[kind])
        objects[kind].geometry.dispose()
        ;(objects[kind].material as ThreeNS.Material).dispose()
      }
      sprite.dispose()
    },
  }
}
