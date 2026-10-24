/** Tone of a cell: what is nearest to the camera there. */
export const TONE_EMPTY = 0
export const TONE_SOLID = 1
export const TONE_METAL = 2
export type Tone = typeof TONE_SOLID | typeof TONE_METAL

export interface Raster {
  readonly width: number
  readonly height: number
  readonly tone: Uint8Array
}

/** Triangles are flat: ax ay az bx by bz cx cy cz tone, x and y in cells, z the depth (larger is nearer). */
export const TRIANGLE_STRIDE = 10

const EDGE_TOLERANCE = 1e-9

/** A z-buffer over cell centres: the nearest triangle names the tone of the cell. Two-sided, so a model needs no winding order. */
export function rasterize(triangles: readonly number[], width: number, height: number): Raster {
  const tone = new Uint8Array(width * height)
  const depth = new Float64Array(width * height).fill(-Infinity)
  for (let at = 0; at < triangles.length; at += TRIANGLE_STRIDE) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz, kind] = triangles.slice(at, at + TRIANGLE_STRIDE) as [number, number, number, number, number, number, number, number, number, number]
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
    if (Math.abs(area) < 1e-12) continue
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5))
    const x1 = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx) - 0.5))
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5))
    const y1 = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy) - 0.5))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5
        const py = y + 0.5
        const wa = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area
        const wb = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area
        const wc = 1 - wa - wb
        if (wa < -EDGE_TOLERANCE || wb < -EDGE_TOLERANCE || wc < -EDGE_TOLERANCE) continue
        const z = wa * az + wb * bz + wc * cz
        const index = y * width + x
        const nearest = depth[index] as number
        if (z < nearest) continue
        depth[index] = z
        tone[index] = kind
      }
    }
  }
  return { width, height, tone }
}

/** The cells of the raster whose tone passes `keep`, as a 0/1 mask. */
export function maskOf(raster: Raster, keep: (tone: number) => boolean): Uint8Array {
  const mask = new Uint8Array(raster.tone.length)
  for (let index = 0; index < mask.length; index++) mask[index] = keep(raster.tone[index] as number) ? 1 : 0
  return mask
}
