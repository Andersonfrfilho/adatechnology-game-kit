import type * as THREE_NS from 'three'
import { lerp } from './math'

interface Spot {
  mesh: THREE_NS.Mesh
  kind: 'puddle' | 'ash'
  home: string
  x: number
  z: number
  radius: number
  target: number
}

const MAX_RADIUS = 1.2

/** Flat discs on the ground: puddles of melted material and piles of ash. Nearby ones merge; the oldest go when the cap is reached. */
export class GroundSpots {
  private readonly spots: Spot[] = []
  private readonly geometry: THREE_NS.CircleGeometry
  private readonly materials = new Map<string, THREE_NS.MeshBasicMaterial>()

  constructor(
    private readonly THREE: typeof THREE_NS,
    private readonly scene: THREE_NS.Scene,
    private readonly groundAt: (x: number, z: number) => number,
    private readonly cap: number,
  ) {
    this.geometry = new THREE.CircleGeometry(1, 20)
    this.geometry.rotateX(-Math.PI / 2)
  }

  get count(): number {
    return this.spots.length
  }

  private material(kind: 'puddle' | 'ash', color: number): THREE_NS.MeshBasicMaterial {
    const key = `${kind}:${color}`
    let m = this.materials.get(key)
    if (!m) {
      m = new this.THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: kind === 'puddle' ? 0.88 : 0.95,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
      this.materials.set(key, m)
    }
    return m
  }

  /** Add (or grow) a spot at (x, z). `radius` is the radius this addition contributes. */
  add(kind: 'puddle' | 'ash', x: number, z: number, radius: number, color: number, home: string): void {
    for (const s of this.spots) {
      if (s.kind !== kind) continue
      const d = Math.hypot(s.x - x, s.z - z)
      if (d < Math.max(s.target, radius) * 0.9) {
        s.target = Math.min(MAX_RADIUS, Math.sqrt(s.target * s.target + radius * radius * 0.5))
        return
      }
    }
    while (this.spots.length >= this.cap) this.remove(this.spots[0])
    const mesh = new this.THREE.Mesh(this.geometry, this.material(kind, color))
    const y = this.groundAt(x, z) + 0.004 + (this.spots.length % 8) * 0.0004
    mesh.position.set(x, y, z)
    mesh.scale.setScalar(0.001)
    mesh.renderOrder = 1
    mesh.userData.destructionDebris = true
    this.scene.add(mesh)
    this.spots.push({ mesh, kind, home, x, z, radius: 0.001, target: Math.min(MAX_RADIUS, radius) })
  }

  private remove(s: Spot): void {
    const i = this.spots.indexOf(s)
    if (i >= 0) this.spots.splice(i, 1)
    this.scene.remove(s.mesh)
  }

  update(dt: number): void {
    const k = Math.min(1, dt * 3)
    for (const s of this.spots) {
      if (Math.abs(s.radius - s.target) < 1e-4) continue
      s.radius = lerp(s.radius, s.target, k)
      s.mesh.scale.setScalar(s.radius)
    }
  }

  /** Remove the spots made for one object (after its `restore`). */
  removeHome(home: string): void {
    for (const s of [...this.spots]) if (s.home === home) this.remove(s)
  }

  clear(): void {
    for (const s of [...this.spots]) this.remove(s)
  }

  dispose(): void {
    this.clear()
    this.geometry.dispose()
    for (const m of this.materials.values()) m.dispose()
    this.materials.clear()
  }
}
