import type * as THREE_NS from 'three'
import type { GroundExcavation } from '@adatechnology/game-contracts'

/** The name of the stage group whose trenches and pits are open (`buildInstallationsStage` keeps them in its `userData.excavations`, in the plan's frame). */
const INSTALLATIONS_STAGE = 'stage:4:installations'

/** A point of the plan's frame in the world, on the ground (y 0). */
function toWorld(THREE: { Vector3: typeof THREE_NS.Vector3 }, object: THREE_NS.Object3D, x: number, z: number): THREE_NS.Vector3 {
  return new THREE.Vector3(x, 0, z).applyMatrix4(object.matrixWorld)
}

/** One excavation of the plan's frame in the world: its rectangle turned with the house, its falling bed kept at the same ends. */
function excavationInWorld(THREE: { Vector3: typeof THREE_NS.Vector3 }, object: THREE_NS.Object3D, e: GroundExcavation): GroundExcavation {
  const [x0, z0, x1, z1] = e.rect
  const a = toWorld(THREE, object, x0, z0), b = toWorld(THREE, object, x1, z1)
  const rect = [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)] as const
  if (e.toDepth === undefined) return { rect, depth: e.depth }
  // the bed's near end (`depth`) is at the plan rectangle's least coordinate along it: where that end lands decides which end the world's `depth` is
  const alongX = e.along !== 'z'
  const near = alongX ? toWorld(THREE, object, x0, (z0 + z1) / 2) : toWorld(THREE, object, (x0 + x1) / 2, z0)
  const far = alongX ? toWorld(THREE, object, x1, (z0 + z1) / 2) : toWorld(THREE, object, (x0 + x1) / 2, z1)
  const worldAlongX = Math.abs(far.x - near.x) >= Math.abs(far.z - near.z)
  const nearFirst = worldAlongX ? near.x <= far.x : near.z <= far.z
  return { rect, depth: nearFirst ? e.depth : e.toDepth, toDepth: nearFirst ? e.toDepth : e.depth, along: worldAlongX ? 'x' : 'z' }
}

/**
 * The trenches and pits a house has open at its construction level, in world coordinates: what the host's terrain digs (`GroundLayout.excavations`). None once
 * they are backfilled (the installations stage hidden).
 */
export function openExcavations(THREE: { Vector3: typeof THREE_NS.Vector3 }, houseGroup: THREE_NS.Object3D): GroundExcavation[] {
  const stage = houseGroup.children.find((child) => child.name === INSTALLATIONS_STAGE)
  if (!stage?.visible) return []
  const dug = stage.userData.excavations as readonly GroundExcavation[] | undefined
  if (!dug?.length) return []
  stage.updateWorldMatrix(true, false)
  return dug.map((e) => excavationInWorld(THREE, stage, e))
}
