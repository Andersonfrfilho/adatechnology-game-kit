import { JOINT_BY_MATERIALS, MATERIALS } from '@adatechnology/game-destruction';
import type { JointKind } from '@adatechnology/game-contracts';

/** What a footing is cast in: a lot wall, a pole or a threshold is set in concrete (the footing, the ground beam, the post hole). */
const FOOTING_MATERIAL = 'concrete';

/**
 * The joint that sets a part of this material in its concrete footing, as the materials data joins them (`JOINT_BY_MATERIALS`): brick, stone and concrete
 * are mortared, steel is bolted, timber is screwed. A material the data does not know is screwed, as `inferJoints` does.
 */
export function footingJointOf(material: string): JointKind {
  const part = MATERIALS.find((m) => m.id === material)
  const footing = MATERIALS.find((m) => m.id === FOOTING_MATERIAL)
  return part && footing ? JOINT_BY_MATERIALS(part, footing) : 'screw'
}
