import type * as THREE_NS from 'three'
import type { Film, FilmProfile } from '@adatechnology/game-fluids'
import type { ThreeLib } from '../types'

/** The page's drop size: a radius in millimetres drawn as a sphere of `radius * 0.0013` m, stretched along its flight by its speed (F258-262). */
const METRES_PER_MM = 0.0013
const STRETCH_PER_SPEED = 0.35
const MAX_STRETCH = 3.5
const BEAD_HANG = 0.0012
const BEAD_SCALE = 0.0011

export interface FilmDrops {
  readonly drops: THREE_NS.InstancedMesh
  readonly bead: THREE_NS.Mesh
  setProfile(profile: FilmProfile): void
  /** Writes the film's drops in flight and the drip's bead into the meshes; answers how many drops are drawn. */
  sync(film: Film): number
  dispose(): void
}

export function createFilmDrops(THREE: ThreeLib, capacity: number, profile: FilmProfile): FilmDrops {
  const material = new THREE.MeshStandardMaterial({ color: profile.dropColor, roughness: 0.12, metalness: 0.15, transparent: true, opacity: profile.dropOpacity })
  const geometry = new THREE.IcosahedronGeometry(1, 1)
  const drops = new THREE.InstancedMesh(geometry, material, capacity)
  drops.frustumCulled = false
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  drops.name = 'film_drops'
  const beadGeometry = new THREE.SphereGeometry(1, 10, 8)
  const bead = new THREE.Mesh(beadGeometry, material)
  bead.visible = false
  bead.name = 'film_bead'
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < capacity; i++) drops.setMatrixAt(i, hidden)
  const up = new THREE.Vector3(0, 1, 0)
  const direction = new THREE.Vector3()
  const location = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const matrix = new THREE.Matrix4()
  return {
    drops,
    bead,
    setProfile(next) {
      material.color.setHex(next.dropColor)
      material.opacity = next.dropOpacity
    },
    sync(film) {
      const { active, position, velocity, radius } = film.drops
      let drawn = 0
      for (let i = 0; i < capacity; i++) {
        if (!active[i]) {
          drops.setMatrixAt(i, hidden)
          continue
        }
        const o = i * 3
        const speed = Math.hypot(velocity[o]!, velocity[o + 1]!, velocity[o + 2]!)
        direction.set(velocity[o]!, velocity[o + 1]!, velocity[o + 2]!).normalize()
        rotation.setFromUnitVectors(up, direction)
        const size = radius[i]! * METRES_PER_MM
        matrix.compose(location.set(position[o]!, position[o + 1]!, position[o + 2]!), rotation, scale.set(size, size * (1 + Math.min(MAX_STRETCH, speed * STRETCH_PER_SPEED)), size))
        drops.setMatrixAt(i, matrix)
        drawn++
      }
      drops.instanceMatrix.needsUpdate = true
      const state = film.bead
      bead.visible = state.visible
      if (state.visible) {
        const r = state.radius
        bead.position.set(state.position[0], state.position[1] - r * BEAD_HANG, state.position[2])
        bead.scale.set(r * BEAD_SCALE, r * BEAD_SCALE * (1 + state.swell * 0.7), r * BEAD_SCALE)
      }
      return drawn
    },
    dispose() {
      geometry.dispose()
      beadGeometry.dispose()
      material.dispose()
    },
  }
}
