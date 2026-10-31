import type * as THREE_NS from 'three'
import type { MeshParticle, MeshPool } from '@adatechnology/game-vfx'
import type { ThreeLib } from './types'

const SPHERE_DEFAULT_WIDTH = 8
const SPHERE_DEFAULT_HEIGHT = 6
/** Idle meshes kept per kind of material, for the next particles to reuse. */
const MAX_PARKED_MESHES_PER_KIND = 256

export interface MeshLayer {
  readonly group: THREE_NS.Group
  /** Puts a mesh on every live solid particle and takes it off the ones that ended; answers how many are drawn. */
  sync(): number
  dispose(): void
}

/** A unit shape (radius 1, height 1): the size of each particle is the mesh's scale, so one geometry serves every size. */
function geometryOf(THREE: ThreeLib, particle: MeshParticle): THREE_NS.BufferGeometry {
  switch (particle.shape) {
    case 'cone': return new THREE.ConeGeometry(1, 1, particle.segments || undefined, particle.segments2 || 1, false)
    case 'cone_open': return new THREE.ConeGeometry(1, 1, particle.segments || undefined, particle.segments2 || 1, true)
    case 'sphere': return new THREE.SphereGeometry(1, particle.segments || SPHERE_DEFAULT_WIDTH, particle.segments2 || SPHERE_DEFAULT_HEIGHT)
    case 'icosahedron': return new THREE.IcosahedronGeometry(1, particle.segments)
  }
}

function isCone(particle: MeshParticle): boolean {
  return particle.shape === 'cone' || particle.shape === 'cone_open'
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

interface DrawnMesh {
  readonly mesh: THREE_NS.Mesh
  readonly parkingKey: string
  stamp: number
}

function geometryKeyOf(particle: MeshParticle): string {
  return `${particle.shape}:${particle.segments}:${particle.segments2}`
}

/**
 * The Workshop's solid particles (`MeshPool`) as three.js meshes, one each, like the gallery. The look is the gallery's; what changed is where the parts come from: a geometry is
 * shared by every particle of the same shape and size, and a mesh whose particle ended is parked, with its material, for the next particle of the same kind instead of being
 * disposed, so an explosion allocates nothing on the GPU once one of its kind has gone off. A mesh sits at the group's point plus the group's turn applied to the piece's
 * place times the scale, turned by the group's turn and then by the piece's own Euler angles.
 */
export function createMeshLayer(THREE: ThreeLib, pool: MeshPool): MeshLayer {
  const group = new THREE.Group()
  group.name = 'workshop-meshes'
  const drawn = new Map<number, DrawnMesh>()
  const geometries = new Map<string, THREE_NS.BufferGeometry>()
  const parked = new Map<string, THREE_NS.Mesh[]>()
  const frame = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const turn = new THREE.Quaternion()
  const offset = new THREE.Vector3()
  let stamp = 0

  function geometryFor(particle: MeshParticle): THREE_NS.BufferGeometry {
    const key = geometryKeyOf(particle)
    let geometry = geometries.get(key)
    if (!geometry) {
      geometry = geometryOf(THREE, particle)
      geometries.set(key, geometry)
    }
    return geometry
  }

  function acquire(particle: MeshParticle): DrawnMesh {
    const parkingKey = `${geometryKeyOf(particle)}|${particle.lit}|${particle.additive}`
    const mesh = parked.get(parkingKey)?.pop() ?? new THREE.Mesh(geometryFor(particle), materialOf(THREE, particle))
    ;(mesh.material as THREE_NS.MeshBasicMaterial).color.set(particle.color)
    mesh.frustumCulled = false
    mesh.renderOrder = particle.additive ? 5 : 3
    group.add(mesh)
    return { mesh, parkingKey, stamp }
  }

  function park(entry: DrawnMesh): void {
    entry.mesh.removeFromParent()
    let free = parked.get(entry.parkingKey)
    if (!free) {
      free = []
      parked.set(entry.parkingKey, free)
    }
    if (free.length < MAX_PARKED_MESHES_PER_KIND) free.push(entry.mesh)
    else (entry.mesh.material as THREE_NS.Material).dispose()
  }

  return {
    group,
    sync() {
      stamp++
      for (const particle of pool.particles) {
        let entry = drawn.get(particle.id)
        if (!entry) {
          entry = acquire(particle)
          drawn.set(particle.id, entry)
        }
        entry.stamp = stamp
        const mesh = entry.mesh
        frame.set(particle.frame[0], particle.frame[1], particle.frame[2], particle.frame[3])
        offset.set(particle.at[0], particle.at[1], particle.at[2]).multiplyScalar(particle.scale).applyQuaternion(frame)
        mesh.position.set(particle.x + offset.x, particle.y + offset.y, particle.z + offset.z)
        turn.setFromEuler(euler.set(particle.rx, particle.ry, particle.rz))
        mesh.quaternion.copy(frame).multiply(turn)
        mesh.scale.set(particle.radius * particle.scale, (isCone(particle) ? particle.height : particle.radius) * particle.scale, particle.radius * particle.scale)
        ;(mesh.material as THREE_NS.Material).opacity = particle.opacity
      }
      for (const [id, entry] of drawn) {
        if (entry.stamp === stamp) continue
        park(entry)
        drawn.delete(id)
      }
      return pool.count
    },
    dispose() {
      for (const entry of drawn.values()) park(entry)
      drawn.clear()
      for (const free of parked.values()) for (const mesh of free) (mesh.material as THREE_NS.Material).dispose()
      parked.clear()
      for (const geometry of geometries.values()) geometry.dispose()
      geometries.clear()
      group.removeFromParent()
    },
  }
}
