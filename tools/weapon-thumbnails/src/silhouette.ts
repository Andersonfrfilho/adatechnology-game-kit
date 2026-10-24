import type * as THREE_NS from 'three'

import { boundsOf, collectTriangles, fitTriangles } from './project'
import type { View } from './project'
import { maskOf, rasterize, TONE_EMPTY, TONE_SOLID } from './raster'
import { signedArea, simplifyLoop, traceMask } from './trace'
import type { Loop } from './trace'

/** The viewBox: 4:1, in the units the path coordinates use. */
export const VIEW_WIDTH = 800
export const VIEW_HEIGHT = 200
/** Empty margin on every side, the same for every weapon. */
export const VIEW_PADDING = 12
// cells per viewBox unit: the outline is traced at twice the resolution it is written in, then simplified
const SUPERSAMPLE = 2
const SIMPLIFY_TOLERANCE = 1.1
const MIN_LOOP_AREA = 6
// the parts that are not solid (steel and the like) are drawn lighter; the solid ones (polymer, wood, paint) go on top at full strength
const LIGHT_OPACITY = '.6'

const format = (cells: number): string => {
  const value = Math.round((cells / SUPERSAMPLE) * 10) / 10
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const pathOf = (loops: readonly Loop[]): string =>
  loops
    .map((loop) => `M${loop.map(([x, y]) => `${format(x)} ${format(y)}`).join(' ')}Z`)
    .join('')

const outlinesOf = (mask: Uint8Array, width: number, height: number): Loop[] =>
  traceMask(mask, width, height)
    .filter((loop) => Math.abs(signedArea(loop)) >= MIN_LOOP_AREA)
    .map((loop) => simplifyLoop(loop, SIMPLIFY_TOLERANCE))
    .filter((loop) => loop.length >= 3)

/**
 * The silhouette of an object as a compact SVG: one path for everything that shows, lighter, and one for the solid parts on top, both `currentColor`
 * (the page sets the colour). Same object and view, same bytes. Undefined when nothing of the object shows.
 */
export function silhouetteSvg(THREE: typeof THREE_NS, root: THREE_NS.Object3D, view: View): string | undefined {
  const triangles = collectTriangles(THREE, root, view)
  const box = boundsOf(triangles)
  if (!box) return undefined
  const width = VIEW_WIDTH * SUPERSAMPLE
  const height = VIEW_HEIGHT * SUPERSAMPLE
  fitTriangles(triangles, box, width, height, VIEW_PADDING * SUPERSAMPLE)
  const raster = rasterize(triangles, width, height)
  const everything = outlinesOf(maskOf(raster, (tone) => tone !== TONE_EMPTY), width, height)
  if (everything.length === 0) return undefined
  const solid = outlinesOf(maskOf(raster, (tone) => tone === TONE_SOLID), width, height)
  const solidPath = solid.length > 0 ? `<path d="${pathOf(solid)}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" fill="currentColor" fill-rule="evenodd"><path fill-opacity="${LIGHT_OPACITY}" d="${pathOf(everything)}"/>${solidPath}</svg>\n`
}
