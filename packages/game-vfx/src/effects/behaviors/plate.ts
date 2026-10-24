import type { Behavior } from '../behavior'

/** The geometry of a box plate as three.js lays out its vertices: `BoxGeometry(width, height, depth, columns, rows, 1)` moved by `(shiftX, shiftY)`. */
export interface PlateGeometry {
  readonly width: number
  readonly height: number
  readonly columns: number
  readonly rows: number
  readonly shiftX: number
  readonly shiftY: number
}

/** The metal door of the page: 1.1 x 2.2 m, 14 x 24 segments, hinged at its left edge (W960). */
export const METAL_DOOR: PlateGeometry = { width: 1.1, height: 2.2, columns: 14, rows: 24, shiftX: 0.56, shiftY: 1.1 }

/** Every vertex of the plate seen from the front (x, y), the front and back faces and the four thin edges, each vertex once per face it belongs to. */
export function plateVertices(geometry: PlateGeometry): readonly (readonly [number, number])[] {
  const { width, height, columns, rows, shiftX, shiftY } = geometry
  const xs = Array.from({ length: columns + 1 }, (_, column) => (column * width) / columns - width / 2)
  const ys = Array.from({ length: rows + 1 }, (_, row) => (row * height) / rows - height / 2)
  const vertices: [number, number][] = []
  // the sides (px, nx): two vertices, front and back, for each row; then top and bottom (py, ny): the same for each column; then the two big faces
  for (const x of [width / 2, -width / 2]) for (const y of ys) for (let depth = 0; depth < 2; depth++) vertices.push([x, y])
  for (const y of [height / 2, -height / 2]) for (const x of xs) for (let depth = 0; depth < 2; depth++) vertices.push([x, y])
  for (let face = 0; face < 2; face++) for (const y of ys) for (const x of xs) vertices.push([x, y])
  return vertices.map(([x, y]) => [x + shiftX, y + shiftY] as const)
}

interface DentArgs {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly depth: number
}

/**
 * `dentAt` (W1002): pushes the vertices within `radius` of a hit in and draws one random number for each, so how many it draws depends on how the plate
 * is cut. The model counts them; the deformed mesh belongs to whoever draws the door.
 */
let doorVertices: ReturnType<typeof plateVertices> | undefined

export function createPlateBehavior(geometry: PlateGeometry = METAL_DOOR): Behavior {
  const vertices = geometry === METAL_DOOR ? (doorVertices ??= plateVertices(geometry)) : plateVertices(geometry)
  let dents: { x: number; y: number; radius: number; depth: number; vertices: number }[] = []
  return {
    reset() {
      dents = []
    },
    act(host, action, args) {
      if (action !== 'dent') return
      const { x, y, radius, depth } = args as DentArgs
      let touched = 0
      for (const [vertexX, vertexY] of vertices) {
        if (Math.hypot(vertexX - x, vertexY - y) < radius) {
          host.engine.random.next()
          touched++
        }
      }
      dents.push({ x, y, radius, depth, vertices: touched })
    },
    query(_host, name) {
      if (name === 'dents') return dents
      throw new Error(`plate: unknown query ${name}`)
    },
    update() {},
  }
}
