import type * as THREE_NS from 'three'
import type { MeshParticle, MeshPool } from '@adatechnology/game-vfx'
import type { ThreeLib } from './types'

const SPHERE_DEFAULT_WIDTH = 8
const SPHERE_DEFAULT_HEIGHT = 6

export interface MeshLayer {
  readonly group: THREE_NS.Group
  /** Puts a mesh on every live solid particle and takes it off the ones that ended; answers how many are drawn. */
  sync(): number
  dispose(): void
}

function geometryOf(THREE: ThreeLib, particle: MeshParticle): THREE_NS.BufferGeometry {
  switch (particle.shape) {
    case 'cone': return new THREE.ConeGeometry(particle.radius, particle.height, particle.segments || undefined, particle.segments2 || 1, false)
    case 'cone_open': return new THREE.ConeGeometry(particle.radius, particle.height, particle.segments || undefined, particle.segments2 || 1, true)
    case 'sphere': return new THREE.SphereGeometry(particle.radius, particle.segments || SPHERE_DEFAULT_WIDTH, particle.segments2 || SPHERE_DEFAULT_HEIGHT)
    case 'icosahedron': return new THREE.IcosahedronGeometry(particle.radius, particle.segments)
  }
}

/** The materials the gallery gives these: a flat, translucent colour (added to what is behind it for a flash), or a rough grey that the scene's lights shade (smoke). */
function materialOf(THREE: ThreeLib, particle: Pick<MeshParticle, 'lit' | 'color' | 'opacity' | 'additive'>): THREE_NS.Material {
  if (particle.lit) return new THREE.MeshStandardMaterial({ color: particle.color, roughness: 1, metalness: 0, transparent: true, opacity: particle.opacity, depthWrite: false })
  return new THREE.MeshBasicMaterial({ color: particle.color, transparent: true, opacity: particle.opacity, depthWrite: false, ...(particle.additive ? { blending: THREE.AdditiveBlending } : {}) })
}

/** One throwaway mesh per material the layer draws with (lit smoke, flat, additive flash), for a host to compile their shader programs before the first effect needs them. */
export function createMeshLayerProbes(THREE: ThreeLib): THREE_NS.Mesh[] {
  const geometry = new THREE.BoxGeometry(0.001, 0.001, 0.001)
  return [{ lit: true, additive: false }, { lit: false, additive: false }, { lit: false, additive: true }].map(
    (kind) => new THREE.Mesh(geometry, materialOf(THREE, { ...kind, color: 0x808080, opacity: 0.5 })),
  )
}

/**
 * The Workshop's solid particles (`MeshPool`) as three.js meshes, one each, like the gallery: the geometry and the material belong to the mesh and go with it. A mesh sits at
 * the group's point plus the group's turn applied to the piece's place times the scale, turned by the group's turn and then by the piece's own Euler angles.
 */
export function createMeshLayer(THREE: ThreeLib, pool: MeshPool): MeshLayer {
  const group = new THREE.Group()
  group.name = 'workshop-meshes'
  const drawn = new Map<number, THREE_NS.Mesh>()
  const frame = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const turn = new THREE.Quaternion()
  const offset = new THREE.Vector3()

  function release(mesh: THREE_NS.Mesh): void {
    mesh.removeFromParent()
    mesh.geometry.dispose()
    ;(mesh.material as THREE_NS.Material).dispose()
  }

  return {
    group,
    sync() {
      const live = new Set<number>()
      for (const particle of pool.particles) {
        live.add(particle.id)
        let mesh = drawn.get(particle.id)
        if (!mesh) {
          mesh = new THREE.Mesh(geometryOf(THREE, particle), materialOf(THREE, particle))
          mesh.frustumCulled = false
          mesh.renderOrder = particle.additive ? 5 : 3
          drawn.set(particle.id, mesh)
          group.add(mesh)
        }
        frame.set(particle.frame[0], particle.frame[1], particle.frame[2], particle.frame[3])
        offset.set(particle.at[0], particle.at[1], particle.at[2]).multiplyScalar(particle.scale).applyQuaternion(frame)
        mesh.position.set(particle.x + offset.x, particle.y + offset.y, particle.z + offset.z)
        turn.setFromEuler(euler.set(particle.rx, particle.ry, particle.rz))
        mesh.quaternion.copy(frame).multiply(turn)
        mesh.scale.setScalar(particle.scale)
        ;(mesh.material as THREE_NS.Material).opacity = particle.opacity
      }
      for (const [id, mesh] of drawn) {
        if (live.has(id)) continue
        release(mesh)
        drawn.delete(id)
      }
      return pool.count
    },
    dispose() {
      for (const mesh of drawn.values()) release(mesh)
      drawn.clear()
      group.removeFromParent()
    },
  }
}
