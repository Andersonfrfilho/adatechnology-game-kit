import { poleHeightsOf } from './networks/aerial'
import type { DistributionSpec } from './pole-specs'

/** A point of a pole in its own frame: `x` toward the road (where the lamp hangs), `y` up from the ground, `z` along the line. */
export type PolePoint = readonly [number, number, number]

/** What a piece of a distribution pole is, so a drawing can keep what another already draws (the single arm draws `arm`, `lamp` and the tank). */
export type HardwareRole = 'crossarm' | 'insulator' | 'lv_clamp' | 'telecom_clamp' | 'bracket' | 'bushing' | 'arm' | 'lamp' | 'tank'

/** A box of the pole in its frame: `y` is the base, as the builder's boxes. */
export type HardwareBox = { readonly role: HardwareRole; readonly x: number; readonly y: number; readonly z: number; readonly width: number; readonly height: number; readonly depth: number; readonly color: number }
/** An upright cylinder (the transformer tank): `y` is the base. */
export type HardwareCylinder = { readonly role: 'tank'; readonly x: number; readonly y: number; readonly z: number; readonly radius: number; readonly height: number; readonly color: number; readonly segments: number }

/** Where each conductor is fixed on the pole, in its frame. */
export type PoleAttachments = {
  /** The three medium-voltage phases, on the tops of the pin insulators. */
  readonly mv: readonly PolePoint[]
  /** The low-voltage multiplexed cable in its suspension clamp. */
  readonly lv: PolePoint
  /** One clamp per telecom cable, the first on top. */
  readonly telecom: readonly PolePoint[]
  /** The transformer: its three bushing tops (medium voltage in) and the side of its tank the low voltage leaves from. */
  readonly transformer?: { readonly mv: readonly PolePoint[]; readonly lv: PolePoint }
  /** The guy wire's eye, under the crossarm. */
  readonly guy: PolePoint
}

/** The pieces and fixing points of a distribution pole. The lens is apart: its colour is the lamp's state. */
export type PoleHardware = { readonly boxes: readonly HardwareBox[]; readonly cylinders: readonly HardwareCylinder[]; readonly lens?: HardwareBox; readonly attachments: PoleAttachments }

export type PoleHardwareOptions = {
  /** The pole carries the medium voltage (its crossarm and insulators). */
  readonly mv: boolean
  /** A transformer hangs on it. */
  readonly transformer: boolean
  /** Its street light (arm, luminaire, lens). */
  readonly lamp: boolean
  /** Telecom cables fixed on it, `cableGap` apart (the network's `rules.layout.telecom.cableGap`). */
  readonly cables: number
  readonly cableGap: number
  /** The low voltage clamp: default true. A light column of an underground street carries none (its cable comes up inside it). */
  readonly lv?: boolean
}

/** Least free gap between two pieces that touch (CLAUDE.md §13). */
const GAP = 0.002

/** The crossarm and its three pin insulators, the top of each insulator in the medium-voltage band's top. */
function mediumVoltage(spec: DistributionSpec): { boxes: HardwareBox[]; mv: PolePoint[] } {
  const { crossarm, insulators, slots } = spec
  const [bottom, top] = slots.bands.mv
  const pin = top - bottom - crossarm.height - GAP
  const boxes: HardwareBox[] = [{ role: 'crossarm', x: crossarm.reach, y: bottom, z: 0, width: crossarm.width, height: crossarm.height, depth: crossarm.depth, color: crossarm.color }]
  for (const x of insulators.at) boxes.push({ role: 'insulator', x, y: bottom + crossarm.height + GAP, z: 0, width: insulators.radius * 2, height: pin, depth: insulators.radius * 2, color: insulators.color })
  return { boxes, mv: insulators.at.map((x): PolePoint => [x, top, 0]) }
}

/** The tank on its bracket on the field side, under the crossarm, with three bushings on its lid. */
function transformerOf(spec: DistributionSpec): { boxes: HardwareBox[]; tank: HardwareCylinder; points: NonNullable<PoleAttachments['transformer']> } {
  const t = spec.transformer
  const x = -t.offset
  const tank: HardwareCylinder = { role: 'tank', x, y: t.y, z: 0, radius: t.radius, height: t.height, color: t.color, segments: t.segments }
  const { bushings } = spec
  const lid = t.y + t.height + GAP
  const zs = [-bushings.spread, 0, bushings.spread]
  const boxes: HardwareBox[] = [
    { role: 'bracket', x: x / 2, y: t.y + t.height * 0.6, z: 0, width: t.offset, height: 0.08, depth: 0.1, color: spec.lowVoltage.color },
    ...zs.map((z): HardwareBox => ({ role: 'bushing', x, y: lid, z, width: bushings.radius * 2, height: bushings.height, depth: bushings.radius * 2, color: bushings.color })),
  ]
  return { boxes, tank, points: { mv: zs.map((z): PolePoint => [x, lid + bushings.height, z]), lv: [x + t.radius, t.y + t.height * 0.3, 0] } }
}

/** The arm over the road, the luminaire at its end and the lens under the luminaire (2 mm apart). */
function lampOf(spec: DistributionSpec): { boxes: HardwareBox[]; lens: HardwareBox } {
  const { arm, lamp } = spec
  const lensHeight = 0.03
  return {
    boxes: [
      { role: 'arm', x: arm.reach, y: arm.y, z: 0, width: arm.width, height: arm.height, depth: arm.depth, color: arm.color },
      { role: 'lamp', x: lamp.reach, y: lamp.y, z: 0, width: lamp.width, height: lamp.height, depth: lamp.depth, color: arm.color },
    ],
    lens: { role: 'lamp', x: lamp.reach, y: lamp.y - lensHeight - GAP, z: 0, width: lamp.width * 0.8, height: lensHeight, depth: lamp.depth * 0.8, color: spec.lens.unlit },
  }
}

/**
 * The hardware of a distribution pole in its own frame, every fixing height read from its bands (`slots`) as the network generator reads them:
 * the crossarm with its pin insulators at the medium voltage, the transformer under it, the low-voltage cable's suspension clamp on the field
 * side, the street light's arm over the road, and one telecom clamp per cable under the lamp. Pure; the drawing places and instances it.
 */
export function distributionHardwareOf(spec: DistributionSpec, o: PoleHardwareOptions): PoleHardware {
  const heights = poleHeightsOf(spec.slots)
  const boxes: HardwareBox[] = []
  const cylinders: HardwareCylinder[] = []
  const mv = mediumVoltage(spec)
  if (o.mv || o.transformer) boxes.push(...mv.boxes)
  const lvAt: PolePoint = [-spec.lowVoltage.out, heights.lv, 0]
  if (o.lv !== false) boxes.push({ role: 'lv_clamp', x: -spec.lowVoltage.out / 2 - spec.mast.radiusTop / 2, y: heights.lv - 0.06, z: 0, width: spec.lowVoltage.out - spec.mast.radiusTop + 0.06, height: 0.12, depth: 0.08, color: spec.lowVoltage.color })
  const { telecom } = spec
  const cables = Math.max(o.cables, 0)
  const telecomAt = Array.from({ length: cables }, (_, index): PolePoint => [-telecom.out, heights.telecom - index * o.cableGap, 0])
  if (cables > 0) {
    const bottom = heights.telecom - (cables - 1) * o.cableGap - 0.05
    boxes.push({ role: 'telecom_clamp', x: -telecom.out / 2 - spec.mast.radiusTop / 2, y: bottom, z: 0, width: telecom.out - spec.mast.radiusTop + 0.04, height: heights.telecom + 0.05 - bottom, depth: 0.06, color: telecom.color })
  }
  const transformer = o.transformer ? transformerOf(spec) : undefined
  if (transformer) {
    boxes.push(...transformer.boxes)
    cylinders.push(transformer.tank)
  }
  const lamp = o.lamp ? lampOf(spec) : undefined
  if (lamp) boxes.push(...lamp.boxes)
  const attachments: PoleAttachments = { mv: mv.mv, lv: lvAt, telecom: telecomAt, guy: [0, spec.slots.bands.mv[0] - 0.15, 0], ...(transformer ? { transformer: transformer.points } : {}) }
  return { boxes, cylinders, ...(lamp ? { lens: lamp.lens } : {}), attachments }
}
