import type * as THREE_NS from 'three'

import { discardObject3D } from '@adatechnology/game-shapes-three'

import type { Missing } from './site'

const WARNING_COLOR = 0xffa000
const LABEL_WIDTH_PX = 512
const LABEL_LINE_PX = 44
const LABEL_METRES_PER_PX = 0.012

/** The three lines of a warning box's label: what is missing, who owns it and the task that puts it there. */
export function labelLines(entry: Missing): readonly [string, string, string] {
  return [entry.what, `dono: ${entry.owner.join(', ')}`, `tarefa ${entry.task}`]
}

export type MissingBoxes = {
  readonly group: THREE_NS.Group
  dispose(): void
}

function labelOf(THREE: typeof THREE_NS, entry: Missing): THREE_NS.Sprite {
  const lines = labelLines(entry)
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_WIDTH_PX
  canvas.height = LABEL_LINE_PX * lines.length + LABEL_LINE_PX / 2
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = 'rgba(20, 14, 0, 0.85)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffb300'
    context.font = `bold ${LABEL_LINE_PX - 8}px sans-serif`
    lines.forEach((line, index) => context.fillText(line, 12, LABEL_LINE_PX * (index + 1) - 8))
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }))
  sprite.scale.set(canvas.width * LABEL_METRES_PER_PX, canvas.height * LABEL_METRES_PER_PX, 1)
  sprite.renderOrder = 10
  return sprite
}

/**
 * A warning box where a piece the kit still lacks belongs: a wire box over the piece's rectangle and height, with a label that says what is missing, who owns it and which task
 * replaces it. It is a mark for whoever builds the scene, not a piece of the game: it is not in the physics, not in the destruction world and nothing collides with it (CLAUDE.md §12). It goes
 * when the `missing` list of the site no longer has the entry.
 */
export function createMissingBoxes(THREE: typeof THREE_NS, missing: readonly Missing[]): MissingBoxes {
  const group = new THREE.Group()
  group.name = 'missing-pieces'
  for (const entry of missing) {
    const [x0, z0, x1, z1] = entry.rect
    const box = new THREE.BoxGeometry(x1 - x0, entry.height, z1 - z0)
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: WARNING_COLOR }))
    wire.position.set((x0 + x1) / 2, entry.height / 2, (z0 + z1) / 2)
    box.dispose()
    wire.userData.missing = entry.id
    const label = labelOf(THREE, entry)
    label.position.set((x0 + x1) / 2, entry.height + (label.scale.y / 2) + 0.3, (z0 + z1) / 2)
    group.add(wire, label)
  }
  return {
    group,
    dispose() {
      group.removeFromParent()
      discardObject3D(group)
    },
  }
}
