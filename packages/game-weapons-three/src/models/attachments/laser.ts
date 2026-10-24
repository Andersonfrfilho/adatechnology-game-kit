import type { AttachmentModel, AttachmentModelBuilder } from './types'

const DEFAULT_RANGE = 120
const DEFAULT_COLOR = 0xff0000
const BEAM_WIDTH = 0.0025
const DOT_RADIUS = 0.012

/**
 * The laser sight: a body with an emitter on its rail, a thin beam along the barrel and a dot where it lands. The host measures how far the beam goes (`raycast`, in metres);
 * with no host the beam reaches the range of the data and there is no dot. Off until it is turned on.
 */
export const buildLaser: AttachmentModelBuilder = ({ kit, attachment, frame, raycast }): AttachmentModel => {
  const { THREE, M, box, cylinderX } = kit
  const length = attachment.dims?.length ?? 0.08
  const half = (attachment.dims?.diameter ?? 0.025) / 2
  const range = attachment.laser?.range ?? DEFAULT_RANGE
  const color = attachment.laser?.color ?? DEFAULT_COLOR
  const group = kit.group()
  const offset = frame.side === 0 ? { y: -(half + 0.004), z: 0 } : { y: 0, z: frame.side * (half + 0.004) }
  box(group, 0.03, 0.012, 0.028, M.dark, 0, frame.side === 0 ? -0.002 : 0, 0)
  box(group, length, half * 2, half * 2, M.dark, 0, offset.y, offset.z)
  const emitter = new THREE.MeshBasicMaterial({ color: 0x551111 })
  cylinderX(group, half * 0.5, 0.004, emitter, length / 2 + 0.001, offset.y, offset.z, 10)
  const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, BEAM_WIDTH, BEAM_WIDTH), glow)
  const dot = new THREE.Mesh(new THREE.SphereGeometry(DOT_RADIUS, 10, 8), new THREE.MeshBasicMaterial({ color }))
  const front = length / 2 + 0.004
  beam.position.set(front, offset.y, offset.z)
  dot.position.set(front, offset.y, offset.z)
  beam.visible = false
  dot.visible = false
  group.add(beam, dot)
  const origin = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const scale = new THREE.Vector3()
  let isOn = false
  return {
    object: group,
    setOn(on) {
      isOn = on
      emitter.color.setHex(on ? color : 0x551111)
      beam.visible = on
      if (!on) dot.visible = false
    },
    update() {
      if (!isOn) return
      group.updateWorldMatrix(true, false)
      group.getWorldPosition(origin)
      direction.set(1, 0, 0).transformDirection(group.matrixWorld)
      group.getWorldScale(scale)
      const hit = raycast?.(origin, direction, range) ?? null
      const reach = (hit ?? range) / Math.max(scale.x, 1e-6)
      beam.scale.x = reach
      beam.position.x = front + reach / 2
      dot.visible = hit !== null
      dot.position.x = front + reach
    },
    dispose() {
      beam.geometry.dispose()
      dot.geometry.dispose()
      glow.dispose()
      emitter.dispose()
      dot.material.dispose()
    },
  }
}

