/** How the body shader's `iD` (identity) and `iAcc` (accessory pivot) attributes are packed: whole numbers in floats, so every field survives the GPU. */

export const GAIT_STYLE = { NORMAL: 0, LIMP_LEFT: 1, LIMP_RIGHT: 2, DRAG: 3, LURCH: 4, SHAMBLE: 5 } as const
export type GaitStyle = (typeof GAIT_STYLE)[keyof typeof GAIT_STYLE]

/** The accessory bits of `iD.y` bits 7 to 10: the batch of each accessory kind is fixed, a body carries any mix. */
export const ACCESSORY_BIT = { CAP: 1, HELMET: 2, BACKPACK: 4, EXTRA: 8 } as const

/** Pose index of a body that is staggering (not in `INSTANCE_POSES`: the base chunk draws any unknown pose as the walk, the extension adds the stagger on top). */
export const STAGGER_POSE = 8

/** Trousers of the identity palette, 16 colours as hex (the shader and the impostor read the same table). */
export const TROUSER_PALETTE = [
  0x2b3a55, 0x3a4f78, 0x1c1c20, 0x4a4a4e, 0x6b5a3c, 0x7a6a48, 0x3f4a34, 0x5a3a2a, 0x2a2f38, 0x5d6572, 0x6a2f2a, 0x4a3a52, 0x8a8470, 0x24323a, 0x35302a, 0x56606a,
] as const

export type IdentityLook = {
  /** 2 bits per region (0 head, 1 torso, 2 left arm, 3 right arm, 4 left leg, 5 right leg): 0 none, 1 light, 2 severe. */
  readonly wounds: number
  /** 0 old and dark to 15 fresh and bright. */
  readonly freshness: number
  /** Index into `TROUSER_PALETTE`. */
  readonly trousers: number
  readonly gaitStyle: number
  readonly accessories: number
  /** Clip indexes (4 bits each), the blend toward the second (0..1) and the clip speed step (0..15: 0.75 to 1.25). */
  readonly clipA?: number
  readonly clipB?: number
  readonly clipBlend?: number
  readonly clipSpeed?: number
  /** Lean toward a direction (radians) by an amount 0..1 (a shove, a thrown body's tumble). */
  readonly leanAngle?: number
  readonly leanAmount?: number
}

export const CLIP_SPEED_MIN = 0.75
export const CLIP_SPEED_SPAN = 0.5
const TWO_PI = Math.PI * 2

/** The four floats of `iD` for a look. */
export const packIdentity = (look: IdentityLook): readonly [number, number, number, number] => {
  const x = (look.wounds & 0xfff) + 4096 * (look.freshness & 15)
  const y = (look.trousers & 15) + 16 * (look.gaitStyle & 7) + 128 * (look.accessories & 15)
  const blend = Math.round(Math.min(1, Math.max(0, look.clipBlend ?? 0)) * 255)
  const z = ((look.clipA ?? 0) & 15) + 16 * ((look.clipB ?? 0) & 15) + 256 * blend + 65536 * ((look.clipSpeed ?? 7) & 15)
  const turns = (((look.leanAngle ?? 0) % TWO_PI) + TWO_PI) % TWO_PI
  const w = (Math.round((turns / TWO_PI) * 256) & 255) + 256 * Math.round(Math.min(1, Math.max(0, look.leanAmount ?? 0)) * 255)
  return [x, y, z, w]
}

/** The look back from the four floats (tests and the impostor path). */
export const unpackIdentity = ([x, y, z, w]: readonly [number, number, number, number]): Required<IdentityLook> => ({
  wounds: x % 4096,
  freshness: Math.floor(x / 4096) % 16,
  trousers: y % 16,
  gaitStyle: Math.floor(y / 16) % 8,
  accessories: Math.floor(y / 128) % 16,
  clipA: z % 16,
  clipB: Math.floor(z / 16) % 16,
  clipBlend: (Math.floor(z / 256) % 256) / 255,
  clipSpeed: Math.floor(z / 65536) % 16,
  leanAngle: ((w % 256) / 256) * TWO_PI,
  leanAmount: (Math.floor(w / 256) % 256) / 255,
})

/** The speed factor of a clip speed step. */
export const clipSpeedOf = (step: number): number => CLIP_SPEED_MIN + (step / 15) * CLIP_SPEED_SPAN

/** The shader's hex colour as a GLSL `vec3(r, g, b)` literal. */
export const glslColor = (hex: number): string => `vec3(${[(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((channel) => (channel / 255).toFixed(4)).join(',')})`
