import type * as THREE_NS from 'three'
import { rail, scope } from '../details'
import type { AttachmentBuildContext, AttachmentModel, AttachmentModelBuilder } from './types'

interface OpticLook {
  /** The page's `scope` kind: 1 red dot, 2 short scope, 3 and 4 long scopes. */
  readonly kind: 1 | 2 | 3 | 4
  /** Colour of the lens for the night and thermal sights. */
  readonly lens?: number
}

const OPTICS: Readonly<Record<string, OpticLook>> = {
  red_dot: { kind: 1 },
  holographic_sight: { kind: 1 },
  acog_4x: { kind: 2 },
  scope_3_9x: { kind: 3 },
  scope_6_24x: { kind: 4 },
  night_vision_scope: { kind: 3, lens: 0x35ff6a },
  thermal_scope: { kind: 3, lens: 0xff8a3a },
  pso_1: { kind: 2 },
  fixed_scope_10x: { kind: 4 },
}

const ADAPTER_LENGTH = 0.1
const ADAPTER_BACK = 0.05

const tinted = (context: AttachmentBuildContext, group: THREE_NS.Group, color: number): THREE_NS.Material => {
  const { THREE, M } = context.kit
  const lens = new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.9, emissive: color, emissiveIntensity: 0.6 })
  group.traverse((node) => {
    const mesh = node as THREE_NS.Mesh
    if (mesh.isMesh && mesh.material === M.lens) mesh.material = lens
  })
  return lens
}

/** An optic by the gallery's `scope(kind)` (the same drawing the rifles ship with), on a short rail when the top of the weapon has none. */
export const buildOptic: AttachmentModelBuilder = (context) => {
  const look = OPTICS[context.attachment.model]
  if (!look) return null
  const { kit, frame } = context
  const group = kit.group()
  scope(kit, group, look.kind, 0, 0, 0)
  if (!frame.hasRail && frame.mount === 'rail_top') rail(kit, group, -ADAPTER_BACK, ADAPTER_LENGTH, -0.003, 0, frame.receiverWidth * 0.68)
  if (look.lens === undefined) return group
  const lens = tinted(context, group, look.lens)
  return { object: group, dispose: (): void => lens.dispose() } satisfies AttachmentModel
}

export const OPTIC_MODEL_IDS: readonly string[] = Object.keys(OPTICS)
