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
  /** Height (m) water streams fall to when the emitter has no `reach`. Default 0. */
  floorY?: number
  /** Most water streams drawn at once (one draw call each). Default 6. */
  maxStreams?: number
  /** Most gas flame rings drawn at once (all rings share one draw call). Default 16. */
  maxFlames?: number
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
  /** Water stream meshes (tapered, translucent, following the gravity arc) and the one mesh holding every gas flame ring. */
  meshes: { group: ThreeNS.Group; streams: ThreeNS.Mesh[]; flames: ThreeNS.Mesh }
  clear(): void
  dispose(): void
}

const POOLS: PoolKind[] = ['smoke', 'steam', 'fire', 'water', 'spark']
const WEIGHT: Record<PoolKind, number> = { smoke: 0.27, steam: 0.15, fire: 0.2, water: 0.28, spark: 0.1 }

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
  /** Water only: the height at which the particle ends (splashes, droplets). */
  ground: Float32Array
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

/** Vertical streaks of water (alpha only matters); scrolled along the stream to show the flow. */
function makeStreaks(THREE: ThreeLib): ThreeNS.DataTexture {
  const W = 16
  const H = 64
  const data = new Uint8Array(W * H * 4)
  const hash = (x: number, y: number): number => {
    let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 7, 668265263)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const col = 0.35 + 0.65 * hash(x, 0)
      const row = 0.55 + 0.45 * Math.sin(((y / H) * 3 + hash(x, 1) * 6) * Math.PI * 2)
      const i = (y * W + x) * 4
      data[i] = data[i + 1] = data[i + 2] = 255
      data[i + 3] = Math.round(255 * Math.min(1, col * row * 1.3))
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
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
      ground: new Float32Array(cap).fill(-1e9),
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
  let clock = 0

  const spawn = (p: Pool, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, tint: number, flag = 0, ground = -1e9): void => {
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
    p.ground[i] = ground
  }

  const emitFrom = (e: ActiveEmitter, n: number): void => {
    const k = Math.min(1, Math.max(0, e.intensity))
    const size = e.size > 0 ? e.size : 0.2
    const [px, py, pz] = e.pos
    for (let j = 0; j < n; j++) {
      switch (e.kind) {
        case 'smoke':
          // thick, slow, wide plume
          spawn(pools.smoke, px + (rand() - 0.5) * size * 0.6, py, pz + (rand() - 0.5) * size * 0.6, (rand() - 0.5) * 0.2, 0.45 + rand() * 0.45, (rand() - 0.5) * 0.2, 2.8 + rand() * 1.8, size * 0.6, size * 2.6, 0.3 + rand() * 0.25, 0)
          break
        case 'steam':
          spawn(pools.steam, px + (rand() - 0.5) * size * 0.5, py, pz + (rand() - 0.5) * size * 0.5, (rand() - 0.5) * 0.12, 0.3 + rand() * 0.3, (rand() - 0.5) * 0.12, 1.3 + rand() * 1.1, size * 0.3, size * 1.3, 0.92, 0)
          break
        case 'fire':
          spawn(pools.fire, px + (rand() - 0.5) * size * 0.7, py, pz + (rand() - 0.5) * size * 0.7, (rand() - 0.5) * 0.25, 0.8 + rand() * 0.9 * k, (rand() - 0.5) * 0.25, 0.35 + rand() * 0.4, size * 0.75, size * 0.15, rand(), 0)
          break
        case 'flame': {
          // soft blue glow over the ring (the ring of little flames itself is a mesh)
          const a = rand() * Math.PI * 2
          const r = size * 0.8
          spawn(pools.fire, px + Math.cos(a) * r, py + 0.01, pz + Math.sin(a) * r, 0, 0.06 + rand() * 0.1, 0, 0.14 + rand() * 0.12, size * 0.55, size * 0.15, rand(), 1)
          break
        }
        case 'spark': {
          const a = rand() * Math.PI * 2
          const up = 0.4 + rand() * 0.6
          const sp = 1.2 + rand() * 2
          spawn(pools.spark, px, py, pz, Math.cos(a) * sp * (1 - up * 0.5), up * sp * 1.4, Math.sin(a) * sp * (1 - up * 0.5), 0.35 + rand() * 0.5, size * 0.18, size * 0.05, rand(), 0)
          break
        }
        case 'water':
          break
      }
    }
  }

  // ---- water: a tapered translucent stream along the gravity arc, droplets around it and a splash where it lands ----------------
  interface Arc {
    x: number
    y: number
    z: number
    vx: number
    vy: number
    vz: number
    /** Flight time to the landing height. */
    t: number
    stopY: number
    r0: number
    r1: number
  }
  const arc: Arc = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, stopY: 0, r0: 0, r1: 0 }
  const floorY = options.floorY ?? 0
  const arcOf = (e: ActiveEmitter, k: number): boolean => {
    let [dx, dy, dz] = e.dir
    const len = Math.hypot(dx, dy, dz)
    if (len < 1e-6) {
      dx = 0
      dy = -1
      dz = 0
    } else {
      dx /= len
      dy /= len
      dz /= len
    }
    const speed = 0.7 + 1.8 * k
    const stopY = e.reach !== undefined ? Math.max(e.pos[1] - e.reach, floorY) : floorY
    const drop = e.pos[1] - stopY
    if (drop < 0.02) return false
    const vy = dy * speed
    arc.x = e.pos[0]
    arc.y = e.pos[1]
    arc.z = e.pos[2]
    arc.vx = dx * speed
    arc.vy = vy
    arc.vz = dz * speed
    arc.t = Math.min(2.5, (vy + Math.sqrt(vy * vy + 19.6 * drop)) / 9.8)
    arc.stopY = stopY
    const size = e.size > 0 ? e.size : 0.05
    if (size < 0.1) {
      // a tap: a thin jet that narrows as it speeds up
      arc.r0 = Math.max(0.004, size * 0.5)
      arc.r1 = arc.r0 * 0.55
    } else {
      // a shower or a leak: a spray that opens a little
      arc.r0 = size * 0.45
      arc.r1 = arc.r0 * 1.2
    }
    return true
  }

  const emitWater = (e: ActiveEmitter, k: number, nSpray: number, nSplash: number, nMist: number): void => {
    const size = e.size > 0 ? e.size : 0.05
    const wide = size >= 0.1
    for (let j = 0; j < nSpray; j++) {
      const s = rand()
      const t = s * arc.t
      const r = (arc.r0 + (arc.r1 - arc.r0) * s) * (0.7 + rand() * 0.5)
      const a = rand() * Math.PI * 2
      const ox = Math.cos(a) * r
      const oz = Math.sin(a) * r
      spawn(
        pools.water,
        arc.x + arc.vx * t + ox,
        arc.y + arc.vy * t - 4.9 * t * t,
        arc.z + arc.vz * t + oz,
        arc.vx + (wide ? ox * 1.2 : 0) + (rand() - 0.5) * 0.25,
        arc.vy - 9.8 * t,
        arc.vz + (wide ? oz * 1.2 : 0) + (rand() - 0.5) * 0.25,
        0.22 + rand() * 0.25,
        0.011 + rand() * 0.012,
        0.009 + rand() * 0.008,
        rand(),
        2,
        arc.stopY,
      )
    }
    const ex = arc.x + arc.vx * arc.t
    const ez = arc.z + arc.vz * arc.t
    for (let j = 0; j < nSplash; j++) {
      const a = rand() * Math.PI * 2
      const r = arc.r1 * Math.sqrt(rand())
      const sp = (wide ? 0.5 : 0.25) + rand() * 0.7
      spawn(pools.water, ex + Math.cos(a) * r, arc.stopY + 0.005, ez + Math.sin(a) * r, Math.cos(a) * sp, 0.9 + rand() * 1.3, Math.sin(a) * sp, 0.3 + rand() * 0.25, 0.014 + rand() * 0.018, 0.01, rand(), 3, arc.stopY)
    }
    for (let j = 0; j < nMist; j++) {
      const a = rand() * Math.PI * 2
      const r = arc.r1 * 1.4 * Math.sqrt(rand())
      spawn(pools.water, ex + Math.cos(a) * r, arc.stopY + 0.02, ez + Math.sin(a) * r, Math.cos(a) * 0.15, 0.18 + rand() * 0.15, Math.sin(a) * 0.15, 0.7 + rand() * 0.5, 0.06 + size * 0.2, 0.2 + size * 0.5, rand(), 4, arc.stopY)
    }
    void k
  }

  const emitDrip = (e: ActiveEmitter, n: number): void => {
    const size = e.size > 0 ? e.size : 0.05
    const stopY = e.reach !== undefined ? Math.max(e.pos[1] - e.reach, floorY) : floorY
    for (let j = 0; j < n; j++) {
      const sx = (rand() - 0.5) * 0.01
      const sz = (rand() - 0.5) * 0.01
      spawn(pools.water, e.pos[0] + sx, e.pos[1], e.pos[2] + sz, e.dir[0] * 0.08, e.dir[1] * 0.08, e.dir[2] * 0.08, 1.4, size * 0.22, size * 0.2, rand(), 1, stopY)
    }
  }

  const RATE: Record<EmitterKind, number> = { smoke: 42, steam: 48, fire: 150, flame: 55, spark: 40, water: 0 }

  // Stream meshes ----------------------------------------------------------------------------------------------------------------
  const SEG = 12
  const SIDES = 8
  const maxStreams = Math.max(0, Math.floor(options.maxStreams ?? 6))
  const streaksTex = makeStreaks(THREE)
  const streamMat = new THREE.MeshBasicMaterial({ color: 0x9cccff, map: streaksTex, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })
  const streamIndex: number[] = []
  for (let i = 0; i < SEG; i++) {
    for (let m = 0; m < SIDES; m++) {
      const a = i * (SIDES + 1) + m
      const b = a + SIDES + 1
      streamIndex.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const group = new THREE.Group()
  group.name = 'effects:meshes'
  scene.add(group)
  const streams: ThreeNS.Mesh[] = []
  for (let i = 0; i < maxStreams; i++) {
    const geo = new THREE.BufferGeometry()
    const n = (SEG + 1) * (SIDES + 1)
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage))
    const uv = new Float32Array(n * 2)
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage))
    geo.setIndex(streamIndex)
    const mesh = new THREE.Mesh(geo, streamMat)
    mesh.frustumCulled = false
    mesh.visible = false
    mesh.name = `effects:stream${i}`
    group.add(mesh)
    streams.push(mesh)
  }

  const writeStream = (mesh: ThreeNS.Mesh, k: number): void => {
    const geo = mesh.geometry
    const pos = (geo.getAttribute('position') as ThreeNS.BufferAttribute).array as Float32Array
    const col = (geo.getAttribute('color') as ThreeNS.BufferAttribute).array as Float32Array
    const uv = (geo.getAttribute('uv') as ThreeNS.BufferAttribute).array as Float32Array
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG
      const t = s * arc.t
      const cx = arc.x + arc.vx * t
      const cy = arc.y + arc.vy * t - 4.9 * t * t
      const cz = arc.z + arc.vz * t
      let tx = arc.vx
      let ty = arc.vy - 9.8 * t
      let tz = arc.vz
      const tl = Math.hypot(tx, ty, tz) || 1
      tx /= tl
      ty /= tl
      tz /= tl
      // binormal = tangent x up, normal = tangent x binormal
      let bx = tz
      const by = 0
      let bz = -tx
      const bl = Math.hypot(bx, bz)
      if (bl < 1e-4) {
        bx = 1
        bz = 0
      } else {
        bx /= bl
        bz /= bl
      }
      const nx = ty * bz - tz * by
      const ny = tz * bx - tx * bz
      const nz = tx * by - ty * bx
      const r = arc.r0 + (arc.r1 - arc.r0) * s
      const alpha = Math.min(1, s * 7) * (0.95 - 0.3 * s) * Math.min(1, 0.55 + k)
      for (let m = 0; m <= SIDES; m++) {
        const a = (m / SIDES) * Math.PI * 2
        const ca = Math.cos(a) * r
        const sa = Math.sin(a) * r
        const v = i * (SIDES + 1) + m
        pos[v * 3] = cx + bx * ca + nx * sa
        pos[v * 3 + 1] = cy + by * ca + ny * sa
        pos[v * 3 + 2] = cz + bz * ca + nz * sa
        col[v * 4] = col[v * 4 + 1] = col[v * 4 + 2] = 1
        col[v * 4 + 3] = alpha
        uv[v * 2] = (m / SIDES) * 3
        uv[v * 2 + 1] = s * arc.t * 2.2
      }
    }
    ;(geo.getAttribute('position') as ThreeNS.BufferAttribute).needsUpdate = true
    ;(geo.getAttribute('color') as ThreeNS.BufferAttribute).needsUpdate = true
    ;(geo.getAttribute('uv') as ThreeNS.BufferAttribute).needsUpdate = true
    mesh.visible = true
  }

  // Gas flame rings: every burner is a ring of small blue cones; all rings share one dynamic mesh (one draw call) ------------------
  const CONES = 16
  const maxFlames = Math.max(0, Math.floor(options.maxFlames ?? 16))
  const flameGeo = new THREE.BufferGeometry()
  const flamePos = new THREE.BufferAttribute(new Float32Array(maxFlames * CONES * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage)
  const flameCol = new THREE.BufferAttribute(new Float32Array(maxFlames * CONES * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage)
  flameGeo.setAttribute('position', flamePos)
  flameGeo.setAttribute('color', flameCol)
  const flameIdx: number[] = []
  for (let i = 0; i < maxFlames * CONES; i++) {
    const v = i * 4
    flameIdx.push(v, v + 1, v + 3, v + 1, v + 2, v + 3, v + 2, v, v + 3)
  }
  flameGeo.setIndex(flameIdx)
  flameGeo.setDrawRange(0, 0)
  const flames = new THREE.Mesh(
    flameGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  )
  flames.frustumCulled = false
  flames.visible = false
  flames.name = 'effects:flames'
  group.add(flames)

  const hashOf = (id: string): number => {
    let h = 2166136261
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
    return ((h >>> 0) % 1000) / 1000
  }

  const writeFlame = (slot: number, e: ActiveEmitter, time: number): void => {
    const pa = flamePos.array as Float32Array
    const ca = flameCol.array as Float32Array
    const k = Math.min(1, Math.max(0, e.intensity))
    const size = e.size > 0 ? e.size : 0.05
    const R = size * 0.8
    const bw = Math.max(0.004, size * 0.13)
    const phase = hashOf(e.id) * 40
    for (let c = 0; c < CONES; c++) {
      const a = (c / CONES) * Math.PI * 2
      const ux = Math.cos(a)
      const uz = Math.sin(a)
      const bx = e.pos[0] + ux * R
      const bz = e.pos[2] + uz * R
      const by = e.pos[1]
      const h = (0.025 + size * 0.45) * k * (0.55 + 0.45 * Math.abs(Math.sin(time * 19 + c * 2.3 + phase)))
      const v = (slot * CONES + c) * 4
      // base triangle: tangent +, tangent -, radial out; apex leans slightly inwards
      const tx = -uz * bw
      const tz = ux * bw
      pa.set([bx + tx, by, bz + tz, bx - tx, by, bz - tz, bx + ux * bw * 0.9, by, bz + uz * bw * 0.9, bx - ux * h * 0.12, by + h, bz - uz * h * 0.12], v * 3)
      const lo = 0.3 * k
      ca.set([0.2 * k, 0.45 * k, 1 * k, 0.2 * k, 0.45 * k, 1 * k, 0.2 * k, 0.45 * k, 1 * k, 0.02 * lo, 0.1 * lo, 0.5 * lo], v * 3)
    }
  }

  const advance = (p: Pool, dt: number): void => {
    let i = 0
    const swayX = wind[0]
    const swayZ = wind[1]
    while (i < p.count) {
      p.age[i] += dt
      const age = p.age[i]
      const life = p.life[i]
      if (age >= life || (p.kind === 'water' && p.pos[i * 3 + 1] < p.ground[i])) {
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
          p.ground[i] = p.ground[last]
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
          if (p.flags[i] !== 4) p.vel[j + 1] -= 9.8 * dt
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
      if (p.kind === 'water' && p.pos[j + 1] < p.ground[i]) {
        // landed: stay on the surface and fade out this frame
        p.pos[j + 1] = p.ground[i]
        p.age[i] = p.life[i]
      }
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
          alpha = 0.55 * Math.min(1, u * 8) * (1 - u)
          ca[j] = ca[j + 1] = ca[j + 2] = p.tint[i]
          break
        case 'steam':
          alpha = 0.4 * Math.min(1, u * 6) * (1 - u)
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
        default: {
          const f = p.flags[i]
          alpha = f === 4 ? 0.16 * (1 - u) : f === 3 ? 0.8 * (1 - u * 0.5) : f === 2 ? 0.65 * (1 - u * 0.6) : 0.8
          ca[j] = f === 4 ? 0.85 : 0.5
          ca[j + 1] = f === 4 ? 0.92 : 0.74
          ca[j + 2] = 1
        }
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
    meshes: { group, streams, flames },
    update(dt, emitters, cam) {
      if (cam) camera = cam
      refreshScale(camera)
      const step = Math.min(Math.max(dt, 0), 0.1)
      stamp++
      clock += step
      streaksTex.offset.y = -(clock * 2.4) % 1
      let nStreams = 0
      let nFlames = 0
      const due = (key: string, rate: number): number => {
        let d = debt.get(key)
        if (!d) {
          d = { carry: 0, stamp }
          debt.set(key, d)
        }
        d.stamp = stamp
        d.carry += rate * step
        const n = Math.floor(d.carry)
        d.carry -= n
        return n
      }
      for (let i = 0; i < emitters.length; i++) {
        const e = emitters[i]
        if (!(e.intensity > 0)) continue
        const k = Math.min(1, e.intensity)
        const size = e.size > 0 ? e.size : 0.05
        if (e.kind === 'water') {
          if (k < 0.25) {
            const n = due(e.id, 3 + k * 10)
            if (n > 0) emitDrip(e, n)
          } else if (arcOf(e, k)) {
            const nSpray = due(e.id, (60 + 260 * Math.min(size, 0.4)) * k)
            const nSplash = due(`${e.id}#s`, (45 + 90 * Math.min(size, 0.4)) * k)
            const nMist = due(`${e.id}#m`, 6 * k * (1 + size * 4))
            emitWater(e, k, nSpray, nSplash, nMist)
            if (nStreams < streams.length) writeStream(streams[nStreams++], k)
          }
          continue
        }
        if (e.kind === 'flame' && nFlames < maxFlames) writeFlame(nFlames++, e, clock)
        const n = due(e.id, RATE[e.kind] * k)
        if (n > 0) emitFrom(e, n)
      }
      for (let i = nStreams; i < streams.length; i++) streams[i].visible = false
      flames.visible = nFlames > 0
      flameGeo.setDrawRange(0, nFlames * CONES * 9)
      flamePos.needsUpdate = true
      flameCol.needsUpdate = true
      if (debt.size > emitters.length * 3 + 8) {
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
      for (const m of streams) m.visible = false
      flames.visible = false
    },
    dispose() {
      for (const kind of POOLS) {
        scene.remove(objects[kind])
        objects[kind].geometry.dispose()
        ;(objects[kind].material as ThreeNS.Material).dispose()
      }
      scene.remove(group)
      for (const m of streams) m.geometry.dispose()
      flameGeo.dispose()
      ;(flames.material as ThreeNS.Material).dispose()
      streamMat.dispose()
      streaksTex.dispose()
      sprite.dispose()
    },
  }
}
