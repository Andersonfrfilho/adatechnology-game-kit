import type { HardwareBox } from '@adatechnology/game-urban/networks'

import type { Vec3 } from './catenary'
import { worldOf } from './pole-frames'
import type { NetworkIndex, PoleFrame } from './pole-frames'
import type { GuyAnchor } from './wire-runs'

/** A box of the drawing in the world: `y` is its centre, turned `ry` about y. */
export type WorldBox = { readonly x: number; readonly y: number; readonly z: number; readonly ry: number; readonly width: number; readonly height: number; readonly depth: number; readonly color: number }
/** A cylinder in the world: its centre and the direction of its axis (a transformer stands, a reserve coil hangs across the line). */
export type WorldCylinder = { readonly x: number; readonly y: number; readonly z: number; readonly axis: Vec3; readonly radius: number; readonly height: number; readonly color: number }
/** A mast in the world: its foot. */
export type WorldMast = { readonly specId: string; readonly x: number; readonly y: number; readonly z: number; readonly ry: number }
/** The lens of a pole's lamp. */
export type WorldLens = { readonly pole: string; readonly box: WorldBox }

/** The splice box and its reserve coil, and the guy's anchor rod, as the poles' hardware. */
const SPLICE = { width: 0.16, height: 0.3, depth: 0.42, drop: 0.28, color: 0x2a2c2e } as const
const COIL = { radius: 0.32, thickness: 0.07, along: 0.75, drop: 0.5, color: 0x1e1f21 } as const
const ANCHOR = { width: 0.08, height: 0.3, depth: 0.08, sunk: 0.1 } as const

const boxIn = (frame: PoleFrame, box: HardwareBox): WorldBox => {
  const [x, y, z] = worldOf(frame, [box.x, box.y + box.height / 2, box.z])
  return { x, y, z, ry: frame.ry, width: box.width, height: box.height, depth: box.depth, color: box.color }
}

export type NetworkPieces = { readonly masts: WorldMast[]; readonly boxes: WorldBox[]; readonly cylinders: WorldCylinder[]; readonly lenses: WorldLens[] }

/** Every instanced piece of the drawing: the masts, the hardware boxes, the transformer cylinders and reserve coils, the lenses. */
export function piecesOf({ frames, index, guys }: { readonly frames: ReadonlyMap<string, PoleFrame>; readonly index: NetworkIndex; readonly guys: readonly GuyAnchor[] }): NetworkPieces {
  const out: NetworkPieces = { masts: [], boxes: [], cylinders: [], lenses: [] }
  for (const frame of frames.values()) {
    out.masts.push({ specId: frame.specId, x: frame.x, y: frame.y, z: frame.z, ry: frame.ry })
    for (const box of frame.hardware.boxes) out.boxes.push(boxIn(frame, box))
    for (const cylinder of frame.hardware.cylinders) {
      const [x, y, z] = worldOf(frame, [cylinder.x, cylinder.y + cylinder.height / 2, cylinder.z])
      out.cylinders.push({ x, y, z, axis: [0, 1, 0], radius: cylinder.radius, height: cylinder.height, color: cylinder.color })
    }
    if (frame.hardware.lens) out.lenses.push({ pole: frame.id, box: boxIn(frame, frame.hardware.lens) })
  }
  for (const guy of guys) {
    const frame = frames.get(guy.pole)
    if (frame) out.boxes.push({ x: guy.at[0], y: guy.at[1] + ANCHOR.height / 2 - ANCHOR.sunk, z: guy.at[2], ry: frame.ry, width: ANCHOR.width, height: ANCHOR.height, depth: ANCHOR.depth, color: frame.spec.guy.color })
  }
  for (const node of index.nodes.values()) {
    if (node.kind !== 'splice') continue
    const pole = (index.at.get(node.id) ?? []).map((edge) => (edge.from === node.id ? edge.to : edge.from)).map((id) => frames.get(id)).find((frame) => frame !== undefined)
    if (!pole) continue
    const at = { ...pole, x: node.at[0], z: node.at[2], y: 0 }
    const ox = pole.hardware.attachments.telecom[0]?.[0] ?? 0
    const [x, , z] = worldOf(at, [ox, 0, 0])
    out.boxes.push({ x, y: node.at[1] - SPLICE.drop, z, ry: pole.ry, width: SPLICE.width, height: SPLICE.height, depth: SPLICE.depth, color: SPLICE.color })
    const coil = worldOf(at, [ox, node.at[1] - COIL.drop, COIL.along])
    out.cylinders.push({ x: coil[0], y: coil[1], z: coil[2], axis: [pole.road[0], 0, pole.road[1]], radius: COIL.radius, height: COIL.thickness, color: COIL.color })
  }
  return out
}
