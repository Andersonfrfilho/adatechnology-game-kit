import { catenary, createCord } from '@adatechnology/game-interactables-three'
import type { AttachmentModel, AttachmentModelBuilder } from './types'

const SAG = 0.2
const STRAP_RADIUS = 0.007
const CORD_POINTS = 12

/** The sling: a swivel at each end and a strap hanging between them on a catenary (the cord of the interactables). Positions are relative to the front swivel. */
export const buildSling: AttachmentModelBuilder = ({ kit, frame }): AttachmentModel | null => {
  if (!frame.secondary) return null
  const { THREE, M } = kit
  const group = kit.group()
  const rear: [number, number, number] = [frame.secondary[0] - frame.position[0], frame.secondary[1] - frame.position[1], frame.secondary[2] - frame.position[2]]
  for (const at of [[0, 0, 0], rear] as const) {
    const swivel = kit.torus(group, new THREE.TorusGeometry(0.006, 0.0015, 6, 12), M.metal, at[0], at[1], at[2])
    swivel.rotation.y = Math.PI / 2
  }
  const strap = createCord(THREE, catenary(rear, [0, 0, 0], SAG, CORD_POINTS), STRAP_RADIUS, M.olive)
  group.add(strap)
  return {
    object: group,
    dispose() {
      strap.geometry.dispose()
    },
  }
}
