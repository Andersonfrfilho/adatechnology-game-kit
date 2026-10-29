export type Point = readonly [number, number]
export type Loop = readonly Point[]

// Directions walked along cell edges with the filled cell on the right (y grows down): right, down, left, up.
const STEP_X = [1, 0, -1, 0] as const
const STEP_Y = [0, 1, 0, -1] as const

/**
 * The outlines of a 0/1 mask as closed loops of grid vertices, the filled side on the right: outer boundaries run clockwise on screen, holes the other way.
 * Where two cells touch only at a corner the walk turns right, so the diagonal pair stays apart; the scan order makes the result the same every run.
 */
export function traceMask(mask: Uint8Array, width: number, height: number): Loop[] {
  const stride = width + 1
  const edges = new Uint8Array(stride * (height + 1) * 4)
  const filled = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1
  const mark = (x: number, y: number, direction: number): void => {
    edges[(y * stride + x) * 4 + direction] = 1
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!filled(x, y)) continue
      if (!filled(x, y - 1)) mark(x, y, 0)
      if (!filled(x + 1, y)) mark(x + 1, y, 1)
      if (!filled(x, y + 1)) mark(x + 1, y + 1, 2)
      if (!filled(x - 1, y)) mark(x, y + 1, 3)
    }
  }
  const loops: Loop[] = []
  for (let start = 0; start < edges.length; start++) {
    if (edges[start] !== 1) continue
    const points: Point[] = []
    let edge = start
    do {
      edges[edge] = 0
      const direction = edge % 4
      const vertex = (edge - direction) / 4
      const x = vertex % stride
      const y = (vertex - x) / stride
      points.push([x, y])
      const nextX = x + (STEP_X[direction] as number)
      const nextY = y + (STEP_Y[direction] as number)
      const base = (nextY * stride + nextX) * 4
      let following = -1
      for (const turn of [1, 0, 3]) {
        const candidate = (direction + turn) % 4
        if (edges[base + candidate] === 1) {
          following = base + candidate
          break
        }
      }
      if (following < 0) break
      edge = following
    } while (edge !== start)
    loops.push(dropCollinear(points))
  }
  return loops
}

const dropCollinear = (points: Point[]): Point[] =>
  points.filter((point, index) => {
    const before = points[(index + points.length - 1) % points.length] as Point
    const after = points[(index + 1) % points.length] as Point
    return (point[0] - before[0]) * (after[1] - point[1]) !== (point[1] - before[1]) * (after[0] - point[0])
  })

/** Twice the signed area (shoelace): positive for the clockwise-on-screen outer loops of `traceMask`. */
export const signedArea = (loop: Loop): number => {
  let sum = 0
  for (let index = 0; index < loop.length; index++) {
    const [ax, ay] = loop[index] as Point
    const [bx, by] = loop[(index + 1) % loop.length] as Point
    sum += ax * by - bx * ay
  }
  return sum
}

const distanceToSegment = (point: Point, from: Point, to: Point): number => {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / lengthSquared))
  return Math.hypot(point[0] - (from[0] + t * dx), point[1] - (from[1] + t * dy))
}

const simplifyOpen = (points: readonly Point[], tolerance: number): Point[] => {
  if (points.length < 3) return [...points]
  const first = points[0] as Point
  const last = points[points.length - 1] as Point
  let worst = 0
  let worstAt = 0
  for (let index = 1; index < points.length - 1; index++) {
    const distance = distanceToSegment(points[index] as Point, first, last)
    if (distance > worst) {
      worst = distance
      worstAt = index
    }
  }
  if (worst <= tolerance) return [first, last]
  const left = simplifyOpen(points.slice(0, worstAt + 1), tolerance)
  return [...left.slice(0, -1), ...simplifyOpen(points.slice(worstAt), tolerance)]
}

/** Douglas-Peucker on a closed loop: split at the vertex farthest from the first one so the seam is not special. */
export function simplifyLoop(loop: Loop, tolerance: number): Loop {
  if (loop.length < 4) return loop
  const origin = loop[0] as Point
  let farthest = 0
  let farthestAt = 0
  loop.forEach((point, index) => {
    const distance = Math.hypot(point[0] - origin[0], point[1] - origin[1])
    if (distance > farthest) {
      farthest = distance
      farthestAt = index
    }
  })
  const first = simplifyOpen(loop.slice(0, farthestAt + 1), tolerance)
  const second = simplifyOpen([...loop.slice(farthestAt), origin], tolerance)
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}
