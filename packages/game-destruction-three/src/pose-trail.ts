import type * as THREE_NS from 'three'

const FLOATS = 7
const FIRST_CAPACITY = 64

/** What a trail reads and writes of an object: its position and rotation. */
export type TrailObject = Pick<THREE_NS.Object3D, 'position' | 'quaternion' | 'updateMatrix' | 'updateMatrixWorld'>

/**
 * The pose an object had before its last step and the one it has after, to draw between them (`interpolate`). Poses live in two typed arrays indexed in the order the
 * objects were recorded, so a frame makes no object; the arrays grow by doubling, only when more objects than ever are recorded. The step pose is kept apart from what is
 * drawn: `restore` gives it back to the objects before anything reads them, so a simulation never reads a drawn pose.
 *
 * A tick is `begin` (the objects as they stand are the previous pose), `record` for each object that may move, then `commit` (as they stand now is the pose of the step).
 * `blend` writes the pose between the two; `restore` writes the step pose back (also done by `begin`).
 */
export class PoseTrail {
  private objects: TrailObject[] = []
  private previous = new Float64Array(FIRST_CAPACITY * FLOATS)
  private current = new Float64Array(FIRST_CAPACITY * FLOATS)
  private count = 0
  private isCommitted = false
  private isBlended = false

  /** How many objects the trail holds. */
  get size(): number {
    return this.count
  }

  /** Whether the objects are showing a pose that is not the step's. */
  get isDrawing(): boolean {
    return this.isBlended
  }

  begin(): void {
    this.restore()
    this.objects.length = 0
    this.count = 0
    this.isCommitted = false
  }

  record(object: TrailObject): void {
    if ((this.count + 1) * FLOATS > this.previous.length) this.grow()
    write(this.previous, this.count * FLOATS, object)
    this.objects.push(object)
    this.count++
  }

  commit(): void {
    for (let i = 0; i < this.count; i++) write(this.current, i * FLOATS, this.objects[i] as TrailObject)
    this.isCommitted = true
  }

  /** The objects drawn `alpha` of the way from the previous pose to the step's (1 and over: the step's, to the bit). Nothing is drawn before a commit. */
  blend(alpha: number): void {
    if (!this.isCommitted) return
    const t = alpha < 0 ? 0 : alpha
    const p = this.previous
    const c = this.current
    for (let i = 0; i < this.count; i++) {
      const at = i * FLOATS
      const object = this.objects[i] as TrailObject
      if (t >= 1) copyPose(object, c, at)
      else if (t <= 0) copyPose(object, p, at)
      else put(object, p, at, c, at, t)
      object.updateMatrix()
    }
    this.isBlended = true
  }

  /** The step pose back on the objects, and their matrices with it: a simulation reads `matrixWorld` too. */
  restore(): void {
    if (!this.isBlended) return
    this.isBlended = false
    for (let i = 0; i < this.count; i++) {
      const object = this.objects[i] as TrailObject
      copyPose(object, this.current, i * FLOATS)
      object.updateMatrix()
      object.updateMatrixWorld()
    }
  }

  /** The objects are let go (what leaves the scene is not kept alive by the trail). */
  clear(): void {
    this.restore()
    this.objects.length = 0
    this.count = 0
    this.isCommitted = false
  }

  private grow(): void {
    const bigger = (old: Float64Array<ArrayBuffer>): Float64Array<ArrayBuffer> => {
      const array = new Float64Array(old.length * 2)
      array.set(old)
      return array
    }
    this.previous = bigger(this.previous)
    this.current = bigger(this.current)
  }
}

function write(into: Float64Array, at: number, object: TrailObject): void {
  const { position: p, quaternion: q } = object
  into[at] = p.x
  into[at + 1] = p.y
  into[at + 2] = p.z
  into[at + 3] = q.x
  into[at + 4] = q.y
  into[at + 5] = q.z
  into[at + 6] = q.w
}

function copyPose(object: TrailObject, from: Float64Array, at: number): void {
  object.position.set(from[at] as number, from[at + 1] as number, from[at + 2] as number)
  object.quaternion.set(from[at + 3] as number, from[at + 4] as number, from[at + 5] as number, from[at + 6] as number)
}

/** Writes the pose `t` (between 0 and 1, exclusive) of the way from `a` to `b` (lerp of the position, slerp of the rotation) into the object. */
function put(object: TrailObject, a: Float64Array, ai: number, b: Float64Array, bi: number, t: number): void {
  const ax = a[ai] as number
  const ay = a[ai + 1] as number
  const az = a[ai + 2] as number
  object.position.set(ax + ((b[bi] as number) - ax) * t, ay + ((b[bi + 1] as number) - ay) * t, az + ((b[bi + 2] as number) - az) * t)
  slerpInto(object.quaternion, a, ai + 3, b, bi + 3, t)
}

function slerpInto(out: TrailObject['quaternion'], a: Float64Array, ai: number, b: Float64Array, bi: number, t: number): void {
  const ax = a[ai] as number
  const ay = a[ai + 1] as number
  const az = a[ai + 2] as number
  const aw = a[ai + 3] as number
  let bx = b[bi] as number
  let by = b[bi + 1] as number
  let bz = b[bi + 2] as number
  let bw = b[bi + 3] as number
  let dot = ax * bx + ay * by + az * bz + aw * bw
  if (dot < 0) {
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
    dot = -dot
  }
  let from = 1 - t
  let to = t
  if (dot < 0.9995) {
    const angle = Math.acos(dot)
    const sine = Math.sin(angle)
    from = Math.sin((1 - t) * angle) / sine
    to = Math.sin(t * angle) / sine
  }
  const x = ax * from + bx * to
  const y = ay * from + by * to
  const z = az * from + bz * to
  const w = aw * from + bw * to
  const length = Math.hypot(x, y, z, w) || 1
  out.set(x / length, y / length, z / length, w / length)
}
