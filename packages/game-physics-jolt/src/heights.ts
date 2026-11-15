import type { BodyId, HeightRegion } from '@adatechnology/game-physics'

import { HEIGHT_BLOCK, NO_COLLISION } from './constants'
import type { JoltWorldHost } from './world-host'

/** How far (m) past the field's lowest or highest sample a height may be and still count as inside: the range Jolt reports is the samples' own, with its rounding. */
const RANGE_SLACK = 1e-5

/**
 * The height field body's heights are now `heights` (the whole field, `size` a side), and only `region` differs from what it holds: written into the shape it already
 * has (`HeightFieldShape::SetHeights`) instead of a new one. Jolt takes whole blocks, so the rectangle is widened to the block grid, and the samples it adds are written
 * from `heights` too, never read back. A height outside the range the field was made with would be clamped, so that returns false with the shape untouched, as it does
 * for a body that is no height field and a region off it. The body's bounds are told to the broadphase after, as Jolt asks.
 *
 * What Jolt does besides (measured, T3.8q): it requantizes the blocks left of and above the written ones from their own dequantized samples, and those move down, up to
 * 4.4e-5 m a write and without limit over many (1.8 mm over 50). Nothing else outside the widened rectangle changes. A caller that writes the same field again and again
 * makes a new shape now and then (`setShape` from the exact heights), which resets it.
 */
export const updateHeights = (w: JoltWorldHost, id: BodyId, region: HeightRegion, heights: ArrayLike<number>): boolean => {
  const J = w.J
  const e = w.entry(id)
  const shape = e.body.GetShape()
  if (shape.GetSubType() !== J.EShapeSubType_HeightField) return false
  const field = J.castObject(shape, J.HeightFieldShape)
  const count = field.GetSampleCount()
  // the samples past the field's size are holes (`heightFieldSettings`)
  let size = count
  while (size > 0 && field.IsNoCollision(size - 1, 0)) size--
  const block = HEIGHT_BLOCK
  const x0 = Math.floor(region.x / block) * block
  const z0 = Math.floor(region.z / block) * block
  const sizeX = Math.ceil((region.x + region.sizeX) / block) * block - x0
  const sizeZ = Math.ceil((region.z + region.sizeZ) / block) * block - z0
  if (region.x < 0 || region.z < 0 || region.sizeX < 1 || region.sizeZ < 1 || region.x + region.sizeX > size || region.z + region.sizeZ > size || heights.length < size * size) return false
  const low = field.GetMinHeightValue() - RANGE_SLACK
  const high = field.GetMaxHeightValue() + RANGE_SLACK
  const memory = new J.ArrayFloat()
  try {
    memory.resize(sizeX * sizeZ)
    const at = J.getPointer(memory.data()) >> 2
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const inside = x0 + x < size && z0 + z < size
        const h = inside ? heights[(z0 + z) * size + x0 + x]! : NO_COLLISION
        if (inside && !(h >= low && h <= high)) return false
        J.HEAPF32[at + z * sizeX + x] = h
      }
    }
    field.SetHeights(x0, z0, sizeX, sizeZ, memory.data(), sizeX, w.iface.GetTempAllocator())
  } finally {
    J.destroy(memory)
  }
  w.bi.NotifyShapeChanged(e.id, e.body.GetShape().GetCenterOfMass(), false, J.EActivation_DontActivate)
  return true
}
