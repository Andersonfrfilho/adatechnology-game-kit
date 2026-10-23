import type * as THREE_NS from 'three'
import { Rng, clamp, hashPoint } from './util'
import type { ThreeLib } from './types'

const VERTEX = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
attribute float aSoft;
uniform float uScale;
varying vec4 vColor;
varying float vSoft;
void main() {
  vColor = aColor;
  vSoft = aSoft;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

// Round sprite drawn in the fragment shader: no textures.
const FRAGMENT = /* glsl */ `
varying vec4 vColor;
varying float vSoft;
void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (d > 1.0 || vColor.a <= 0.001) discard;
  float edge = mix(smoothstep(1.0, 0.8, d), 1.0 - d, vSoft);
  gl_FragColor = vec4(vColor.rgb, vColor.a * edge);
}
`

/**
 * A fixed pool of round point sprites: splash droplets (ballistic, they die on the floor they hit) and steam (soft, rising puffs).
 * One draw call. When the pool is full the oldest slot is reused.
 */
export class ParticlePool {
  readonly points: THREE_NS.Points
  private readonly geometry: THREE_NS.BufferGeometry
  private readonly material: THREE_NS.ShaderMaterial
  private readonly capacity: number
  private next = 0
  private readonly pos: Float32Array
  private readonly size: Float32Array
  private readonly color: Float32Array
  private readonly soft: Float32Array
  private readonly vel: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private readonly size0: Float32Array
  private readonly size1: Float32Array
  private readonly alpha: Float32Array
  private readonly floorY: Float32Array
  private readonly kind: Uint8Array
  private readonly rgb: Float32Array
  private readonly rng = new Rng(1234567)
  private alive = 0

  constructor(
    private readonly THREE: ThreeLib,
    capacity: number,
    pointScale: number,
  ) {
    this.capacity = capacity
    this.pos = new Float32Array(capacity * 3)
    this.size = new Float32Array(capacity)
    this.color = new Float32Array(capacity * 4)
    this.soft = new Float32Array(capacity)
    this.vel = new Float32Array(capacity * 3)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)
    this.size0 = new Float32Array(capacity)
    this.size1 = new Float32Array(capacity)
    this.alpha = new Float32Array(capacity)
    this.floorY = new Float32Array(capacity)
    this.kind = new Uint8Array(capacity)
    this.rgb = new Float32Array(capacity * 3)
    this.life.fill(0)
    const T = THREE
    this.geometry = new T.BufferGeometry()
    const attr = (array: Float32Array, n: number) => {
      const a = new T.BufferAttribute(array, n)
      a.setUsage(T.DynamicDrawUsage)
      return a
    }
    this.geometry.setAttribute('position', attr(this.pos, 3))
    this.geometry.setAttribute('aSize', attr(this.size, 1))
    this.geometry.setAttribute('aColor', attr(this.color, 4))
    this.geometry.setAttribute('aSoft', attr(this.soft, 1))
    this.material = new T.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uScale: { value: pointScale } },
      transparent: true,
      depthWrite: false,
    })
    this.points = new T.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = 4
    this.points.name = 'fluid_particles'
  }

  get count(): number {
    return this.alive
  }

  private slot(): number {
    const i = this.next
    this.next = (this.next + 1) % this.capacity
    return i
  }

  private setColor(i: number, hex: number): void {
    this.rgb[i * 3] = ((hex >> 16) & 255) / 255
    this.rgb[i * 3 + 1] = ((hex >> 8) & 255) / 255
    this.rgb[i * 3 + 2] = (hex & 255) / 255
  }

  /** Droplets thrown up by an impact; `floorY` is the height they stop at. */
  splash(point: [number, number, number], intensity: number, hex: number, opacity: number, count: number): void {
    const rng = new Rng(hashPoint(point[0], point[1], point[2]) ^ this.next)
    const n = Math.max(2, Math.round(count * (0.35 + 0.65 * clamp(intensity, 0, 1))))
    for (let k = 0; k < n; k++) {
      const i = this.slot()
      const a = rng.next() * Math.PI * 2
      const h = (0.25 + rng.next() * 0.9) * (0.4 + intensity)
      const up = (0.7 + rng.next() * 1.5) * (0.5 + intensity)
      this.pos.set([point[0], point[1] + 0.01, point[2]], i * 3)
      this.vel.set([Math.cos(a) * h, up, Math.sin(a) * h], i * 3)
      this.life[i] = this.maxLife[i] = 0.45 + rng.next() * 0.45
      this.size0[i] = 0.012 + rng.next() * 0.014
      this.size1[i] = this.size0[i] * 0.7
      this.alpha[i] = clamp(opacity + 0.2, 0.35, 1)
      this.soft[i] = 0
      this.kind[i] = 0
      this.floorY[i] = point[1]
      this.setColor(i, hex)
    }
  }

  /** One puff of steam rising from `point`. */
  steam(point: [number, number, number]): void {
    const i = this.slot()
    const r = this.rng
    this.pos.set([point[0] + (r.next() - 0.5) * 0.04, point[1], point[2] + (r.next() - 0.5) * 0.04], i * 3)
    this.vel.set([(r.next() - 0.5) * 0.06, 0.22 + r.next() * 0.12, (r.next() - 0.5) * 0.06], i * 3)
    this.life[i] = this.maxLife[i] = 1.2 + r.next() * 0.6
    this.size0[i] = 0.03
    this.size1[i] = 0.1
    this.alpha[i] = 0.24
    this.soft[i] = 1
    this.kind[i] = 1
    this.floorY[i] = -1e9
    this.setColor(i, 0xf4f8ff)
  }

  update(dt: number, gravity: number): void {
    let alive = 0
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) {
        this.size[i] = 0
        this.color[i * 4 + 3] = 0
        continue
      }
      this.life[i] -= dt
      const k = 1 - this.life[i] / this.maxLife[i]
      if (this.life[i] <= 0) {
        this.size[i] = 0
        this.color[i * 4 + 3] = 0
        continue
      }
      alive++
      if (this.kind[i] === 0) {
        this.vel[i * 3 + 1] -= gravity * dt
      } else {
        // Steam drifts sideways a little while rising.
        this.vel[i * 3] += Math.sin((k + i) * 7) * 0.02 * dt
      }
      this.pos[i * 3] += this.vel[i * 3] * dt
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt
      if (this.kind[i] === 0 && this.pos[i * 3 + 1] < this.floorY[i]) {
        this.life[i] = 0
        alive--
        this.size[i] = 0
        this.color[i * 4 + 3] = 0
        continue
      }
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * k
      const fade = this.kind[i] === 1 ? Math.min(1, k * 4) * (1 - k) : 1 - k * k
      this.color[i * 4] = this.rgb[i * 3]
      this.color[i * 4 + 1] = this.rgb[i * 3 + 1]
      this.color[i * 4 + 2] = this.rgb[i * 3 + 2]
      this.color[i * 4 + 3] = this.alpha[i] * fade
    }
    this.alive = alive
    for (const name of ['position', 'aSize', 'aColor', 'aSoft']) (this.geometry.getAttribute(name) as THREE_NS.BufferAttribute).needsUpdate = true
  }

  clear(): void {
    this.life.fill(0)
    this.alive = 0
    this.update(0, 0)
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
