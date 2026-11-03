import type { Three, THREE_NS } from '../three'

/** Bones of the instanced body (`body-geometry.ts`) and texels per bone in the clip texture: a rotation and a displacement. */
export const CLIP_BONES = 12
export const CLIP_TEXELS = CLIP_BONES * 2
/** Rows sampled per second of a clip (the bake rate of the D12 ladder). */
export const CLIP_RATE = 30
/** Clips a texture may hold: the index is four bits of `iD.z`. */
export const CLIP_LIMIT = 16

export type ClipLimp = 'left' | 'right' | 'drag'

/** A looping clip of the instanced body's walk, as numbers of the shader's own walk (`bodyAnim`) plus the gait styles of the identity extension. */
export type SegmentClipSpec = {
  readonly id: string
  /** Rows of the clip: its cycles at 30 Hz. */
  readonly frames: number
  /** Walk cycles the clip spans (a lurch is two). */
  readonly cycles?: number
  /** 0 arms hanging as the wandering zombie, 1 raised toward the prey (blended per instance by the arms). */
  readonly armRaise: number
  readonly sway?: number
  readonly bendPulse?: number
  readonly limp?: ClipLimp
  readonly stagger?: boolean
}

export type SegmentClipSet = {
  readonly specs: readonly SegmentClipSpec[]
  /** First row of each clip. */
  readonly start: readonly number[]
  readonly frames: readonly number[]
  readonly cycles: readonly number[]
  readonly rows: number
  /** RGBA32F, `CLIP_TEXELS` wide: per bone a quaternion (x, y, z, w) and a displacement (x, y, z, 0). */
  readonly data: Float32Array
}

type Quat = readonly [number, number, number, number]

const IDENTITY: Quat = [0, 0, 0, 1]
const axisAngle = (axis: 0 | 1 | 2, angle: number): Quat => {
  const half = angle / 2
  const q: [number, number, number, number] = [0, 0, 0, Math.cos(half)]
  q[axis] = Math.sin(half)
  return q
}
const multiply = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const rotateX = (angle: number): Quat => axisAngle(0, angle)
const rotateZ = (angle: number): Quat => axisAngle(2, angle)

const TWO_PI = Math.PI * 2
const WALK_FRAMES = 24
const LEAN_PART = 0.3
const ARM_FORWARD = [-0.12, -1.35] as const
const STAGGER_ARM = -0.95

/** The clips of the kit: each gait family with its arms down and its arms raised (the crowd blends the two by how far the agent has raised its arms). */
const family = (id: string, rest: Omit<SegmentClipSpec, 'id' | 'frames' | 'armRaise'>, frames = WALK_FRAMES): readonly SegmentClipSpec[] => [
  { id: `${id}_down`, frames, armRaise: 0, ...rest },
  { id: `${id}_up`, frames, armRaise: 1, ...rest },
]

export const SEGMENT_CLIPS: readonly SegmentClipSpec[] = [
  ...family('walk', {}),
  ...family('limp_left', { limp: 'left' }),
  ...family('limp_right', { limp: 'right' }),
  ...family('drag', { limp: 'drag' }),
  ...family('lurch', { bendPulse: 1, cycles: 2 }, WALK_FRAMES * 2),
  ...family('shamble', { sway: 0.1 }),
  ...family('stagger', { stagger: true }),
]

const limpOf = (limp: ClipLimp | undefined, left: boolean, ph: number): Quat => {
  if (limp === 'drag') return left ? rotateX(0.55) : IDENTITY
  if (limp === 'left' && left) return rotateX(-0.32 * (0.5 + 0.5 * Math.sin(ph)))
  if (limp === 'right' && !left) return rotateX(-0.32 * (0.5 + 0.5 * Math.sin(ph)))
  return IDENTITY
}

/** The quaternion of every bone at a step of a clip, and the displacement of the whole body, from the maths of the shader's walk. */
const sampleBones = (spec: SegmentClipSpec, step: number): { readonly quats: Quat[]; readonly bounce: number } => {
  const cycles = spec.cycles ?? 1
  const ph = (step / spec.frames) * TWO_PI * cycles
  const raise = spec.armRaise
  const quats: Quat[] = Array.from({ length: CLIP_BONES }, () => IDENTITY)
  for (const bone of [4, 5]) {
    const legSign = bone === 4 ? 1 : -1
    const swing = rotateX(-Math.sin(ph) * legSign * 0.5)
    quats[bone] = multiply(limpOf(spec.limp, bone === 4, ph), swing)
    quats[bone + 5] = rotateX(Math.max(0, Math.cos(ph + (legSign > 0 ? 0 : Math.PI))) * 0.85)
  }
  for (const bone of [2, 3]) {
    const side = bone === 2 ? -1 : 1
    const armSwing = Math.sin(ph) * side
    const forward = (1 - raise) * (ARM_FORWARD[0] + armSwing * 0.3) + raise * (ARM_FORWARD[1] + armSwing * 0.18)
    const arm = multiply(rotateX(forward), rotateZ(side * 0.08))
    quats[bone] = spec.stagger ? multiply(rotateX(STAGGER_ARM + 0.25 * Math.sin(ph)), arm) : arm
    quats[bone + 5] = rotateX((1 - raise) * (-0.3 - Math.max(0, armSwing) * 0.3) + raise * -0.15)
  }
  quats[11] = rotateX(0.05)
  const bend = (spec.bendPulse ?? 0) * 0.22 * Math.max(0, Math.sin(ph * 0.5)) ** 2 + (spec.stagger ? 0.18 + 0.22 * Math.sin(2 * ph) : 0)
  const sway = (spec.sway ?? 0) * Math.sin(ph) + (spec.stagger ? 0.2 * Math.sin(ph) : 0)
  quats[0] = multiply(multiply(rotateX(bend), rotateZ(sway)), rotateX(LEAN_PART))
  return { quats, bounce: Math.abs(Math.sin(ph)) * 0.035 }
}

/** Samples the clips at 30 Hz into one table (the rows of every clip one after the other): pure, no GPU. */
export const bakeSegmentClips = (specs: readonly SegmentClipSpec[] = SEGMENT_CLIPS): SegmentClipSet => {
  if (specs.length > CLIP_LIMIT) throw new Error(`game-characters-three: a clip texture holds at most ${CLIP_LIMIT} clips`)
  const start: number[] = []
  let rows = 0
  for (const spec of specs) {
    start.push(rows)
    rows += spec.frames
  }
  const data = new Float32Array(rows * CLIP_TEXELS * 4)
  specs.forEach((spec, index) => {
    for (let step = 0; step < spec.frames; step++) {
      const { quats, bounce } = sampleBones(spec, step)
      const row = (start[index]! + step) * CLIP_TEXELS * 4
      quats.forEach((quat, bone) => {
        data.set(quat, row + bone * 8)
        data.set(bone === 0 ? [0, bounce, 0, 0] : [0, 0, 0, 0], row + bone * 8 + 4)
      })
    }
  })
  return { specs, start, frames: specs.map((spec) => spec.frames), cycles: specs.map((spec) => spec.cycles ?? 1), rows, data }
}

/** What a body material needs of the clips: the texture and the three tables, as shared uniforms. */
export type SegmentClipUniforms = {
  readonly uClips: { value: THREE_NS.DataTexture }
  readonly uClipStart: { value: number[] }
  readonly uClipFrames: { value: number[] }
  readonly uClipCycles: { value: number[] }
}

const padded = (values: readonly number[], fill: number): number[] => Array.from({ length: CLIP_LIMIT }, (_, index) => values[index] ?? fill)

/**
 * The clip texture (economy ladder, step 3): RGBA32F, `CLIP_TEXELS` (24) wide, one row per sampled step, `NearestFilter` with no mipmaps: float texels are not
 * filterable everywhere and a blend would mix neighbouring bones. The shader blends two rows itself.
 */
export const createSegmentClipUniforms = (three: Three, set: SegmentClipSet = bakeSegmentClips()): SegmentClipUniforms => {
  const texture = new three.DataTexture(set.data as Float32Array<ArrayBuffer>, CLIP_TEXELS, set.rows, three.RGBAFormat, three.FloatType)
  texture.minFilter = three.NearestFilter
  texture.magFilter = three.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return { uClips: { value: texture }, uClipStart: { value: padded(set.start, 0) }, uClipFrames: { value: padded(set.frames, 1) }, uClipCycles: { value: padded(set.cycles, 1) } }
}

/** The index of a clip by id (the crowd picks its family by name). */
export const clipIndexOf = (set: SegmentClipSet, id: string): number => {
  const index = set.specs.findIndex((spec) => spec.id === id)
  if (index < 0) throw new Error(`game-characters-three: no clip "${id}"`)
  return index
}
