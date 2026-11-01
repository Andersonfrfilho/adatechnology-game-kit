import type { Three, THREE_NS } from '../three'

import { walkPoseVertex } from './impostor-pose'

/** Views around the body and steps of the walk the atlas holds for each silhouette. */
export const IMPOSTOR_ANGLES = 8
export const IMPOSTOR_FRAMES = 8
/** The channel scales the shader reads back: the bone and the material class are indexes stored in a byte. */
export const IMPOSTOR_BONE_SCALE = 20
export const IMPOSTOR_MATERIAL_SCALE = 30

export type ImpostorBody = {
  /** A far level of detail of a baked body (the 5-segment one). */
  readonly geometry: THREE_NS.BufferGeometry
  /** The height of that body, which sets the cell the silhouette is drawn in (default the top of its bounding box). */
  readonly height?: number
}

export type ImpostorAtlasOptions = {
  /** Pixels of a cell (default 32 × 48). */
  readonly cellWidth?: number
  readonly cellHeight?: number
  /** Cells in a row of the atlas (default 32). */
  readonly columns?: number
}

/** Where a silhouette's cell sits in the geometry units of its body: half the width, the bottom and the height. */
export type ImpostorBox = { readonly halfWidth: number; readonly bottom: number; readonly height: number }

export type ImpostorAtlas = {
  /** Bone, material class, shade and coverage per texel. */
  readonly texture: THREE_NS.DataTexture
  /** The colour the baked body gives the texel (square root of the linear colour), alongside `texture`. */
  readonly colorTexture: THREE_NS.DataTexture
  readonly silhouettes: number
  readonly cellWidth: number
  readonly cellHeight: number
  readonly columns: number
  readonly rows: number
  readonly boxes: readonly ImpostorBox[]
  /** The bytes of the texture (RGBA8): bone, material class, shade, coverage. */
  readonly pixels: Uint8Array
  readonly colorPixels: Uint8Array
  dispose(): void
}

const CELL_WIDTH = 32
const CELL_HEIGHT = 48
const COLUMNS = 32
const BOX_HALF_WIDTH = 0.41
const BOX_BOTTOM = -0.04
const BOX_HEIGHT = 1.14
const LIGHT: readonly [number, number, number] = [-0.35, 0.75, 0.55]
const LIGHT_LENGTH = Math.hypot(...LIGHT)
const AMBIENT = 0.45
const COVERED = 255
const OWN_COLOR_MATERIAL = 6
/** The material class of the legs above the shoes: the trousers the identity palette recolours (the same rule the body shader has). */
export const TROUSERS_CLASS = 2
const LEG_BONES = new Set([4, 5, 9, 10])
/** Height of the shoe on the baked body, metres: above it a leg is trousers. */
export const SHOE_HEIGHT = 0.1

type Vec3 = readonly [number, number, number]

/** Rasterises one posed, turned body into the cell at (`originX`, `originY`) of the atlas bytes. */
const rasterise = (layers: { readonly pixels: Uint8Array; readonly colors: Uint8Array }, stride: number, origin: { readonly x: number; readonly y: number }, cell: { readonly width: number; readonly height: number }, box: ImpostorBox, triangles: readonly Triangle[]): void => {
  const depth = new Float32Array(cell.width * cell.height).fill(-Infinity)
  const toPixel = (u: number, v: number): readonly [number, number] => [((u + box.halfWidth) / (2 * box.halfWidth)) * cell.width, ((v - box.bottom) / box.height) * cell.height]
  for (const triangle of triangles) {
    const screen = triangle.points.map((point) => toPixel(point[0], point[1]))
    const minX = Math.max(0, Math.floor(Math.min(...screen.map((p) => p[0]))))
    const maxX = Math.min(cell.width - 1, Math.ceil(Math.max(...screen.map((p) => p[0]))))
    const minY = Math.max(0, Math.floor(Math.min(...screen.map((p) => p[1]))))
    const maxY = Math.min(cell.height - 1, Math.ceil(Math.max(...screen.map((p) => p[1]))))
    const [a, b, c] = screen as [readonly [number, number], readonly [number, number], readonly [number, number]]
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if (Math.abs(area) < 1e-6) continue
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5
        const py = y + 0.5
        const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area
        const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue
        const z = w0 * triangle.points[0]![2] + w1 * triangle.points[1]![2] + w2 * triangle.points[2]![2]
        const at = y * cell.width + x
        if (z <= depth[at]!) continue
        depth[at] = z
        const out = ((origin.y + y) * stride + origin.x + x) * 4
        layers.pixels[out] = triangle.bone * IMPOSTOR_BONE_SCALE
        layers.pixels[out + 1] = triangle.material * IMPOSTOR_MATERIAL_SCALE
        layers.pixels[out + 2] = triangle.shade
        layers.pixels[out + 3] = COVERED
        layers.colors.set(triangle.color, out)
      }
    }
  }
}

type Triangle = { readonly points: readonly [Vec3, Vec3, Vec3]; readonly bone: number; readonly material: number; readonly shade: number; readonly color: readonly [number, number, number, number] }

/** The triangles of a body at a walk step seen from the angle step `angle`: points as (screen x, screen y, depth towards the viewer). */
const trianglesOf = (geometry: THREE_NS.BufferGeometry, step: number, angle: number): Triangle[] => {
  const source = geometry.index ? geometry.toNonIndexed() : geometry
  const position = source.attributes.position as THREE_NS.BufferAttribute
  const normal = source.attributes.normal as THREE_NS.BufferAttribute
  const bones = source.attributes.bone as THREE_NS.BufferAttribute
  const paint = source.attributes.vcol as THREE_NS.BufferAttribute
  const pivot = source.attributes.pivot as THREE_NS.BufferAttribute
  const parentPivot = source.attributes.ppivot as THREE_NS.BufferAttribute
  const azimuth = (angle / IMPOSTOR_ANGLES) * Math.PI * 2
  const right: Vec3 = [Math.cos(azimuth), 0, -Math.sin(azimuth)]
  const toward: Vec3 = [Math.sin(azimuth), 0, Math.cos(azimuth)]
  const triangles: Triangle[] = []
  for (let first = 0; first + 2 < position.count; first += 3) {
    const points: Vec3[] = []
    let lambert = 0
    for (let k = 0; k < 3; k++) {
      const index = first + k
      const posed = walkPoseVertex([position.getX(index), position.getY(index), position.getZ(index)], [normal.getX(index), normal.getY(index), normal.getZ(index)], { bone: bones.getX(index), pivot: [pivot.getX(index), pivot.getY(index), pivot.getZ(index)], parentPivot: [parentPivot.getX(index), parentPivot.getY(index), parentPivot.getZ(index)] }, step, IMPOSTOR_FRAMES)
      const p = posed.position
      points.push([p[0] * right[0] + p[2] * right[2], p[1], p[0] * toward[0] + p[2] * toward[2]])
      const n = posed.normal
      const view: Vec3 = [n[0] * right[0] + n[2] * right[2], n[1], n[0] * toward[0] + n[2] * toward[2]]
      lambert += Math.max(0, (view[0] * LIGHT[0] + view[1] * LIGHT[1] + view[2] * LIGHT[2]) / LIGHT_LENGTH)
    }
    const bone = bones.getX(first)
    const rest = position.getY(first)
    const material = paint.getW(first) === OWN_COLOR_MATERIAL && LEG_BONES.has(bone) && rest > SHOE_HEIGHT ? TROUSERS_CLASS : paint.getW(first)
    const squareRoot = (value: number): number => Math.round(Math.sqrt(Math.min(1, Math.max(0, value))) * 255)
    triangles.push({ points: points as unknown as readonly [Vec3, Vec3, Vec3], bone, material, color: [squareRoot(paint.getX(first)), squareRoot(paint.getY(first)), squareRoot(paint.getZ(first)), 255], shade: Math.round((AMBIENT + (1 - AMBIENT) * (lambert / 3)) * 255) })
  }
  return triangles
}

const topOf = (geometry: THREE_NS.BufferGeometry): number => {
  geometry.computeBoundingBox()
  return geometry.boundingBox!.max.y
}

/**
 * The impostor atlas (economy ladder, step 2): each silhouette drawn on the CPU at 8 views and 8 steps of the walk from the far level of its baked body.
 * A texel holds the bone (the group the shader tints and the missing limbs hide), the material class (skin, shirt, trousers...), the baked shade and the coverage;
 * the colours are not in it, they come per instance. RGBA8 and `NearestFilter`: the bone is an index and must not be blended between texels.
 */
export const bakeImpostorAtlas = (three: Three, bodies: readonly ImpostorBody[], options: ImpostorAtlasOptions = {}): ImpostorAtlas => {
  const cellWidth = options.cellWidth ?? CELL_WIDTH
  const cellHeight = options.cellHeight ?? CELL_HEIGHT
  const columns = options.columns ?? COLUMNS
  const cells = bodies.length * IMPOSTOR_FRAMES * IMPOSTOR_ANGLES
  const rows = Math.ceil(cells / columns)
  const stride = columns * cellWidth
  const pixels = new Uint8Array(stride * rows * cellHeight * 4)
  const colorPixels = new Uint8Array(pixels.length)
  const boxes: ImpostorBox[] = bodies.map((body) => {
    const height = body.height ?? topOf(body.geometry)
    return { halfWidth: BOX_HALF_WIDTH * height, bottom: BOX_BOTTOM * height, height: BOX_HEIGHT * height }
  })
  bodies.forEach((body, silhouette) => {
    for (let frame = 0; frame < IMPOSTOR_FRAMES; frame++) {
      for (let angle = 0; angle < IMPOSTOR_ANGLES; angle++) {
        const cell = (silhouette * IMPOSTOR_FRAMES + frame) * IMPOSTOR_ANGLES + angle
        rasterise({ pixels, colors: colorPixels }, stride, { x: (cell % columns) * cellWidth, y: Math.floor(cell / columns) * cellHeight }, { width: cellWidth, height: cellHeight }, boxes[silhouette]!, trianglesOf(body.geometry, frame, angle))
      }
    }
  })
  const layer = (bytes: Uint8Array<ArrayBuffer>): THREE_NS.DataTexture => {
    const texture = new three.DataTexture(bytes, stride, rows * cellHeight, three.RGBAFormat, three.UnsignedByteType)
    texture.minFilter = three.NearestFilter
    texture.magFilter = three.NearestFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    return texture
  }
  const texture = layer(pixels)
  const colorTexture = layer(colorPixels)
  return { texture, colorTexture, silhouettes: bodies.length, cellWidth, cellHeight, columns, rows, boxes, pixels, colorPixels, dispose: () => (texture.dispose(), colorTexture.dispose()) }
}
