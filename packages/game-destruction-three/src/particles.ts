import type * as THREE_NS from 'three'
import type { DebrisKind, Vec3 } from '@adatechnology/game-destruction'
import { clamp, createRng, hexToRgb, lerp } from './math'

/** Every particle kind the renderer can emit. */
export type ParticleKind = DebrisKind | 'fire' | 'flash' | 'foam'

interface KindDef {
  additive: boolean
  /** Life range in seconds. */
  life: [number, number]
  /** Start size range in metres (billboard diameter). */
  size: [number, number]
  /** Size multiplier reached at the end of the life. */
  grow: number
  /** Gravity multiplier (1 = full gravity). */
  gravity: number
  /** Constant upward acceleration in m/s² (heat, steam). */
  rise: number
  /** Velocity damping per second. */
  drag: number
  c0: number
  c1: number
  alpha: number
  /** Fraction of the life spent fading in. */
  fadeIn: number
  /** How much of the emission direction follows the surface normal (1) versus a random direction (0). */
  cone: number
  /** What happens at ground height. */
  ground: 'none' | 'bounce' | 'stop' | 'land'
  flutter?: number
  flicker?: number
}

const KINDS: Record<ParticleKind, KindDef> = {
  fire: { additive: true, life: [0.45, 0.9], size: [0.1, 0.2], grow: 0.3, gravity: 0, rise: 2.4, drag: 1.2, c0: 0xffc040, c1: 0xc02000, alpha: 0.9, fadeIn: 0.12, cone: 0.7, ground: 'none', flicker: 0.35 },
  smoke: { additive: false, life: [1.8, 3.2], size: [0.14, 0.24], grow: 3.2, gravity: 0, rise: 0.7, drag: 0.8, c0: 0x666666, c1: 0x9a9a9a, alpha: 0.35, fadeIn: 0.15, cone: 0.6, ground: 'none' },
  sparks: { additive: true, life: [0.25, 0.6], size: [0.018, 0.03], grow: 0.5, gravity: 1, rise: 0, drag: 0.3, c0: 0xfff2a0, c1: 0xff6a10, alpha: 1, fadeIn: 0.02, cone: 0.55, ground: 'bounce' },
  dust: { additive: false, life: [1, 2], size: [0.08, 0.14], grow: 2.5, gravity: 0.05, rise: 0, drag: 2.5, c0: 0x8d8579, c1: 0x8d8579, alpha: 0.4, fadeIn: 0.1, cone: 0.4, ground: 'none' },
  shards: { additive: true, life: [0.8, 1.4], size: [0.02, 0.035], grow: 0.8, gravity: 1, rise: 0, drag: 0.2, c0: 0xdff4ff, c1: 0x9fd0ff, alpha: 0.9, fadeIn: 0.03, cone: 0.5, ground: 'bounce', flicker: 0.5 },
  splinters: { additive: false, life: [0.8, 1.5], size: [0.02, 0.035], grow: 1, gravity: 1, rise: 0, drag: 0.3, c0: 0xa0764a, c1: 0x7a5530, alpha: 1, fadeIn: 0.02, cone: 0.5, ground: 'bounce' },
  chips: { additive: false, life: [0.8, 1.5], size: [0.025, 0.04], grow: 1, gravity: 1, rise: 0, drag: 0.3, c0: 0x8a8378, c1: 0x6e685f, alpha: 1, fadeIn: 0.02, cone: 0.5, ground: 'bounce' },
  fibers: { additive: false, life: [1.5, 2.5], size: [0.02, 0.03], grow: 1, gravity: 0.15, rise: 0, drag: 2, c0: 0xb8a888, c1: 0xb8a888, alpha: 0.9, fadeIn: 0.05, cone: 0.4, ground: 'stop', flutter: 2.5 },
  leaves: { additive: false, life: [1.5, 2.8], size: [0.03, 0.05], grow: 1, gravity: 0.15, rise: 0, drag: 2, c0: 0x5b9a3c, c1: 0x4a7f30, alpha: 0.95, fadeIn: 0.05, cone: 0.4, ground: 'stop', flutter: 2.8 },
  drips: { additive: false, life: [2, 3], size: [0.025, 0.035], grow: 1, gravity: 1, rise: 0, drag: 0, c0: 0x6a6a6a, c1: 0x6a6a6a, alpha: 1, fadeIn: 0.01, cone: 0.2, ground: 'land' },
  ash: { additive: false, life: [2, 4], size: [0.02, 0.04], grow: 1.2, gravity: 0.08, rise: 0, drag: 1.5, c0: 0x2a2623, c1: 0x1a1816, alpha: 0.8, fadeIn: 0.1, cone: 0.5, ground: 'stop', flutter: 0.6 },
  steam: { additive: false, life: [1, 2], size: [0.12, 0.2], grow: 3, gravity: 0, rise: 0.9, drag: 1, c0: 0xffffff, c1: 0xe0e8ee, alpha: 0.35, fadeIn: 0.15, cone: 0.6, ground: 'none' },
  flash: { additive: true, life: [0.12, 0.2], size: [1.2, 1.8], grow: 1.6, gravity: 0, rise: 0, drag: 0, c0: 0xfff3c0, c1: 0xff9030, alpha: 1, fadeIn: 0.1, cone: 0, ground: 'none' },
  foam: { additive: false, life: [1, 1.8], size: [0.06, 0.1], grow: 1.5, gravity: 0.6, rise: 0, drag: 1.5, c0: 0xf4f8ff, c1: 0xdde6f0, alpha: 0.8, fadeIn: 0.05, cone: 0.5, ground: 'stop' },
}

const KIND_IDS = Object.keys(KINDS) as ParticleKind[]
const KIND_INDEX: Record<string, number> = {}
KIND_IDS.forEach((k, i) => (KIND_INDEX[k] = i))
const KIND_LIST: KindDef[] = KIND_IDS.map((k) => KINDS[k])

/** Per-spawn overrides. */
export interface SpawnOptions {
  /** `0xRRGGBB`: replaces the kind's colour ramp. */
  color?: number
  /** Multiplier on the start size. */
  size?: number
  /** Multiplier on the life. */
  life?: number
  /** Multiplier on the peak alpha. */
  alpha?: number
  /** Non-zero: a `drips` particle that reaches the ground calls `onLand` with this tag. */
  tag?: number
}

const VERT = `
uniform float uScale;
attribute float size;
attribute float alpha;
attribute vec3 pcolor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = alpha;
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(size * uScale / max(0.1, -mv.z), 256.0);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}`

interface PoolHost {
  groundAt: (x: number, z: number) => number
  gravity: number
  onLand: (x: number, y: number, z: number, color: number, tag: number) => void
}

/** One fixed-size ring buffer of particles drawn as a single `THREE.Points` with a soft round sprite computed in the shader. */
class Pool {
  readonly points: THREE_NS.Points
  readonly geometry: THREE_NS.BufferGeometry
  readonly material: THREE_NS.ShaderMaterial
  live = 0
  private next = 0
  private high = 0
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly alp: Float32Array
  private readonly siz: Float32Array
  private readonly vel: Float32Array
  private readonly age: Float32Array
  private readonly life: Float32Array
  private readonly size0: Float32Array
  private readonly alive: Uint8Array
  private readonly kind: Uint8Array
  private readonly seed: Float32Array
  private readonly alphaMul: Float32Array
  private readonly tag: Int32Array
  private readonly colorHex: Int32Array
  private readonly rgbStart: Float32Array
  private readonly rgbEnd: Float32Array
  private readonly bounced: Uint8Array

  constructor(
    THREE: typeof THREE_NS,
    readonly capacity: number,
    additive: boolean,
    pointScale: number,
  ) {
    const n = Math.max(1, capacity)
    this.pos = new Float32Array(n * 3)
    this.col = new Float32Array(n * 3)
    this.alp = new Float32Array(n)
    this.siz = new Float32Array(n)
    this.vel = new Float32Array(n * 3)
    this.age = new Float32Array(n)
    this.life = new Float32Array(n)
    this.size0 = new Float32Array(n)
    this.alive = new Uint8Array(n)
    this.kind = new Uint8Array(n)
    this.seed = new Float32Array(n)
    this.alphaMul = new Float32Array(n)
    this.tag = new Int32Array(n)
    this.colorHex = new Int32Array(n)
    this.rgbStart = new Float32Array(n * 3)
    this.rgbEnd = new Float32Array(n * 3)
    this.bounced = new Uint8Array(n)
    this.geometry = new THREE.BufferGeometry()
    const attr = (a: Float32Array, size: number) => {
      const at = new THREE.BufferAttribute(a, size)
      at.setUsage(THREE.DynamicDrawUsage)
      return at
    }
    this.geometry.setAttribute('position', attr(this.pos, 3))
    this.geometry.setAttribute('pcolor', attr(this.col, 3))
    this.geometry.setAttribute('alpha', attr(this.alp, 1))
    this.geometry.setAttribute('size', attr(this.siz, 1))
    this.geometry.setDrawRange(0, 0)
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: pointScale } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.name = additive ? 'destruction-particles-additive' : 'destruction-particles'
    this.points.renderOrder = additive ? 11 : 10
  }

  spawn(kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, def: KindDef, rnd: () => number, o?: SpawnOptions): void {
    if (this.capacity <= 0) return
    const i = this.next
    this.next = (this.next + 1) % this.capacity
    if (this.alive[i]) this.live--
    this.alive[i] = 1
    this.live++
    if (i + 1 > this.high) this.high = i + 1
    this.kind[i] = kind
    this.pos[i * 3] = x
    this.pos[i * 3 + 1] = y
    this.pos[i * 3 + 2] = z
    this.vel[i * 3] = vx
    this.vel[i * 3 + 1] = vy
    this.vel[i * 3 + 2] = vz
    this.age[i] = 0
    this.life[i] = lerp(def.life[0], def.life[1], rnd()) * (o?.life ?? 1)
    this.size0[i] = lerp(def.size[0], def.size[1], rnd()) * (o?.size ?? 1)
    this.seed[i] = rnd()
    this.alphaMul[i] = o?.alpha ?? 1
    this.tag[i] = o?.tag ?? 0
    this.colorHex[i] = o?.color ?? -1
    this.rgbStart.set(hexToRgb(o?.color ?? def.c0), i * 3)
    this.rgbEnd.set(hexToRgb(o?.color ?? def.c1), i * 3)
    this.bounced[i] = 0
    this.siz[i] = this.size0[i]
    this.alp[i] = 0
  }

  private kill(i: number): void {
    if (!this.alive[i]) return
    this.alive[i] = 0
    this.live--
    this.alp[i] = 0
    this.siz[i] = 0
  }

  clear(): void {
    this.alive.fill(0)
    this.alp.fill(0)
    this.siz.fill(0)
    this.live = 0
    this.high = 0
    this.next = 0
    this.geometry.setDrawRange(0, 0)
  }

  /** Move a live particle (used by external pushes such as blasts). */
  push(cx: number, cy: number, cz: number, radius: number, speed: number): void {
    for (let i = 0; i < this.high; i++) {
      if (!this.alive[i]) continue
      const dx = this.pos[i * 3] - cx
      const dy = this.pos[i * 3 + 1] - cy
      const dz = this.pos[i * 3 + 2] - cz
      const d = Math.hypot(dx, dy, dz)
      if (d > radius || d < 1e-4) continue
      const f = (1 - d / radius) * speed
      this.vel[i * 3] += (dx / d) * f
      this.vel[i * 3 + 1] += (dy / d) * f
      this.vel[i * 3 + 2] += (dz / d) * f
    }
  }

  update(dt: number, host: PoolHost): void {
    let top = 0
    for (let i = 0; i < this.high; i++) {
      if (!this.alive[i]) continue
      const def = KIND_LIST[this.kind[i]]
      const age = (this.age[i] += dt)
      const life = this.life[i]
      if (age >= life) {
        this.kill(i)
        continue
      }
      const t = age / life
      const i3 = i * 3
      let vx = this.vel[i3]
      let vy = this.vel[i3 + 1]
      let vz = this.vel[i3 + 2]
      vy += (def.rise - def.gravity * host.gravity) * dt
      if (def.flutter) {
        const ph = age * 7 + this.seed[i] * 40
        vx += Math.sin(ph) * def.flutter * dt
        vz += Math.cos(ph * 1.3) * def.flutter * dt
      }
      if (def.drag > 0) {
        const k = Math.exp(-def.drag * dt)
        vx *= k
        vy *= k
        vz *= k
      }
      const x = this.pos[i3] + vx * dt
      let y = this.pos[i3 + 1] + vy * dt
      const z = this.pos[i3 + 2] + vz * dt
      if (def.ground !== 'none') {
        const gy = host.groundAt(x, z) + 0.005
        if (y < gy) {
          if (def.ground === 'land') {
            const tag = this.tag[i]
            if (tag !== 0) host.onLand(x, gy, z, this.colorHex[i] >= 0 ? this.colorHex[i] : def.c0, tag)
            this.kill(i)
            continue
          }
          y = gy
          if (def.ground === 'bounce' && !this.bounced[i]) {
            this.bounced[i] = 1
            vy = Math.abs(vy) * 0.35
            vx *= 0.6
            vz *= 0.6
          } else {
            vx = vy = vz = 0
          }
        }
      }
      this.vel[i3] = vx
      this.vel[i3 + 1] = vy
      this.vel[i3 + 2] = vz
      this.pos[i3] = x
      this.pos[i3 + 1] = y
      this.pos[i3 + 2] = z
      this.siz[i] = this.size0[i] * lerp(1, def.grow, t)
      this.col[i3] = lerp(this.rgbStart[i3], this.rgbEnd[i3], t)
      this.col[i3 + 1] = lerp(this.rgbStart[i3 + 1], this.rgbEnd[i3 + 1], t)
      this.col[i3 + 2] = lerp(this.rgbStart[i3 + 2], this.rgbEnd[i3 + 2], t)
      let env = t < def.fadeIn ? t / def.fadeIn : 1 - (t - def.fadeIn) / (1 - def.fadeIn)
      if (def.flicker) env *= 1 - def.flicker * (0.5 + 0.5 * Math.sin(age * 38 + this.seed[i] * 50))
      this.alp[i] = clamp(env, 0, 1) * def.alpha * this.alphaMul[i]
      top = i + 1
    }
    this.high = top
    this.geometry.setDrawRange(0, top)
    for (const name of ['position', 'pcolor', 'alpha', 'size']) {
      ;(this.geometry.getAttribute(name) as THREE_NS.BufferAttribute).needsUpdate = true
    }
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

export interface ParticleSystemOptions {
  capacity: number
  scene: THREE_NS.Scene
  /** Count multiplier for bursts (0.6 on low quality). */
  density: number
  /** Pixels of point size per metre at a distance of one metre; roughly `viewportHeight / (2 * tan(fov / 2))`. */
  pointScale: number
  groundAt: (x: number, z: number) => number
  gravity: number
  onLand: (x: number, y: number, z: number, color: number, tag: number) => void
}

/**
 * Two pooled particle systems (additive and normal blending), each a single `THREE.Points` with fixed-size buffers used as a ring. The Points are
 * added to the scene on first use and removed again by `detach`, so an idle renderer leaves nothing in the scene.
 */
export class ParticleSystem {
  private readonly add: Pool
  private readonly normal: Pool
  private readonly rng = createRng(0x9e3779b1)
  private attached = false
  private readonly host: PoolHost

  constructor(
    THREE: typeof THREE_NS,
    private readonly o: ParticleSystemOptions,
  ) {
    const addCap = Math.floor(o.capacity * 0.4)
    this.add = new Pool(THREE, addCap, true, o.pointScale)
    this.normal = new Pool(THREE, o.capacity - addCap, false, o.pointScale)
    this.host = { groundAt: o.groundAt, gravity: o.gravity, onLand: o.onLand }
  }

  get capacity(): number {
    return this.add.capacity + this.normal.capacity
  }

  get live(): number {
    return this.add.live + this.normal.live
  }

  private ensureAttached(): void {
    if (this.attached) return
    this.attached = true
    this.o.scene.add(this.add.points, this.normal.points)
  }

  /** Remove the Points from the scene (they come back on the next emit). */
  detach(): void {
    if (!this.attached) return
    this.attached = false
    this.o.scene.remove(this.add.points, this.normal.points)
  }

  /** Spawn one particle with an explicit velocity. */
  spawn(kind: ParticleKind, p: Vec3, v: Vec3, opts?: SpawnOptions): void {
    const def = KINDS[kind]
    this.ensureAttached()
    ;(def.additive ? this.add : this.normal).spawn(KIND_INDEX[kind], p[0], p[1], p[2], v[0], v[1], v[2], def, this.rng, opts)
  }

  /** Spawn `count` particles leaving `point` around `normal` at about `speed` m/s. */
  burst(kind: ParticleKind, point: Vec3, normal: Vec3, count: number, speed = 1, opts?: SpawnOptions): void {
    const def = KINDS[kind]
    const n = Math.max(0, Math.round(count * this.o.density))
    const rnd = this.rng
    const nl = Math.hypot(normal[0], normal[1], normal[2]) || 1
    const nx = normal[0] / nl
    const ny = normal[1] / nl
    const nz = normal[2] / nl
    for (let k = 0; k < n; k++) {
      // random unit vector
      const u = rnd() * 2 - 1
      const ph = rnd() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const rx = s * Math.cos(ph)
      const ry = u
      const rz = s * Math.sin(ph)
      let dx = nx * def.cone + rx * (1 - def.cone)
      let dy = ny * def.cone + ry * (1 - def.cone)
      let dz = nz * def.cone + rz * (1 - def.cone)
      // a little scatter even for a pure cone, and never push into the surface for debris
      dx += rx * 0.35
      dy += ry * 0.35
      dz += rz * 0.35
      const l = Math.hypot(dx, dy, dz) || 1
      const sp = speed * (0.35 + 0.65 * rnd())
      const jitter = 0.01 + (def.size[1] > 0.5 ? 0.15 : 0.02)
      this.spawn(
        kind,
        [point[0] + (rnd() - 0.5) * jitter, point[1] + (rnd() - 0.5) * jitter, point[2] + (rnd() - 0.5) * jitter],
        [(dx / l) * sp, (dy / l) * sp, (dz / l) * sp],
        opts,
      )
    }
  }

  /** Blast wave: shove live particles away from a point. */
  push(point: Vec3, radius: number, speed: number): void {
    this.add.push(point[0], point[1], point[2], radius, speed)
    this.normal.push(point[0], point[1], point[2], radius, speed)
  }

  update(dt: number): void {
    if (this.add.live > 0 || this.add.points.geometry.drawRange.count > 0) this.add.update(dt, this.host)
    if (this.normal.live > 0 || this.normal.points.geometry.drawRange.count > 0) this.normal.update(dt, this.host)
  }

  clear(): void {
    this.add.clear()
    this.normal.clear()
    this.detach()
  }

  dispose(): void {
    this.detach()
    this.add.dispose()
    this.normal.dispose()
  }
}
