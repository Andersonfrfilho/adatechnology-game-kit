/**
 * The frame the physics step is handed to a worker in: one buffer holding every array the contact and the pressure read (the inputs), the deltas and fields they give back
 * (the outputs) and the grid occupancy. One layout for the shared buffer and for the transferred one, so the two paths run the same step over the same bytes.
 */

const F32_INPUTS = ['x', 'z', 'y', 'vx', 'vz', 'pushX', 'pushZ', 'mass', 'build', 'aimX', 'aimZ', 'driveFactor', 'fieldPrev'] as const
const U8_INPUTS = ['band', 'balance', 'state', 'type'] as const
const F32_OUTPUTS = ['deltaX', 'deltaZ', 'deltaPushX', 'deltaPushZ', 'deltaVx', 'deltaVz', 'field', 'shove', 'doorLoad'] as const

/** Header slots (Float64): the step's inputs, then its results. */
export const HEADER = { n: 0, h: 1, playerOn: 2, playerX: 3, playerZ: 4, contacts: 5, maxOverlap: 6, overlapSum: 7, playerLoad: 8, drivers: 9, fieldMax: 10, size: 16 } as const

export type FrameShape = { readonly capacity: number; readonly cells: number }

export type PhysicsFrame = {
  readonly header: Float64Array
  readonly f32: { readonly [K in (typeof F32_INPUTS)[number] | (typeof F32_OUTPUTS)[number]]: Float32Array }
  readonly u8: { readonly [K in (typeof U8_INPUTS)[number]]: Uint8Array }
  readonly identity: Uint32Array
  readonly doorCell: Int32Array
  readonly occ: Uint8Array
}

const align8 = (bytes: number): number => Math.ceil(bytes / 8) * 8

/** Bytes of a frame; the arrays follow the header in the order of the lists above. */
export const frameBytes = ({ capacity, cells }: FrameShape): number => HEADER.size * 8 + (F32_INPUTS.length + F32_OUTPUTS.length + 2) * align8(capacity * 4) + U8_INPUTS.length * align8(capacity) + align8(cells)

export function createFrame(buffer: ArrayBufferLike, shape: FrameShape): PhysicsFrame {
  const { capacity, cells } = shape
  let offset = 0
  const take = <T>(make: (buffer: ArrayBufferLike, offset: number, length: number) => T, bytesPerElement: number, length: number): T => {
    const view = make(buffer, offset, length)
    offset += align8(length * bytesPerElement)
    return view
  }
  const f64 = (b: ArrayBufferLike, o: number, l: number): Float64Array => new Float64Array(b, o, l)
  const f32 = (b: ArrayBufferLike, o: number, l: number): Float32Array => new Float32Array(b, o, l)
  const u8 = (b: ArrayBufferLike, o: number, l: number): Uint8Array => new Uint8Array(b, o, l)
  const header = take(f64, 8, HEADER.size)
  const floats = {} as Record<string, Float32Array>
  for (const key of [...F32_INPUTS, ...F32_OUTPUTS]) floats[key] = take(f32, 4, capacity)
  const identity = take((b, o, l) => new Uint32Array(b, o, l), 4, capacity)
  const doorCell = take((b, o, l) => new Int32Array(b, o, l), 4, capacity)
  const bytes = {} as Record<string, Uint8Array>
  for (const key of U8_INPUTS) bytes[key] = take(u8, 1, capacity)
  const occ = take(u8, 1, cells)
  return { header, f32: floats as PhysicsFrame['f32'], u8: bytes as PhysicsFrame['u8'], identity, doorCell, occ }
}

/** The inputs of the step, by the name the store gives them. */
export const INPUT_KEYS = { f32: F32_INPUTS, u8: U8_INPUTS } as const
