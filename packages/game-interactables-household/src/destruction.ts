import type { PartDestruction } from '@adatechnology/game-interactables'

/**
 * Destruction tags of the pack: plain ids that match `@adatechnology/game-destruction` (materials, joint kinds). This package does not depend
 * on the SDK; the host maps the tags to the SDK's parts. `body` is the default for everything that is not a movable part.
 */
export interface TypeDestruction {
  body: { material: string; joint: string }
  /** First match wins. A string matches the part id exactly, a RegExp is tested against it. */
  parts: Array<[string | RegExp, PartDestruction]>
}

const door = (material: string, joint = 'hinge', piece = 'door'): PartDestruction => ({ material, joint, piece })
const drawer: PartDestruction = { material: 'mdf', joint: 'clip', piece: 'drawer' }
const knob: PartDestruction = { material: 'plastic', joint: 'clip', piece: 'knob' }
const tap: PartDestruction = { material: 'steel', joint: 'screw', piece: 'handle' }
const mdfBody = { material: 'mdf', joint: 'screw' }
const cabinet: TypeDestruction = { body: mdfBody, parts: [[/^drawer/, drawer], [/^door/, door('mdf')]] }
const fridgeLike: TypeDestruction = { body: { material: 'steel', joint: 'weld' }, parts: [[/^door/, door('steel')]] }
const bin: TypeDestruction = { body: { material: 'plastic', joint: 'fused' }, parts: [['lid', door('plastic', 'hinge', 'lid')]] }
const upholstery = { material: 'fabric', joint: 'glue' }

export const DESTRUCTION: Record<string, TypeDestruction> = {
  fridge: fridgeLike,
  fridge_compact: fridgeLike,
  kitchen_cabinet_base: cabinet,
  kitchen_cabinet_wall: cabinet,
  pantry: cabinet,
  wardrobe: cabinet,
  dresser: cabinet,
  nightstand: cabinet,
  bathroom_cabinet: cabinet,
  stove: { body: { material: 'steel', joint: 'weld' }, parts: [['oven_door', door('steel')], [/^knob/, knob]] },
  gas_bottle: { body: { material: 'steel', joint: 'weld' }, parts: [['valve', { material: 'copper', joint: 'screw', piece: 'valve' }]] },
  sink_kitchen: { body: { material: 'ceramic', joint: 'glue' }, parts: [['tap_handle', tap], [/^door/, door('mdf')]] },
  sink_bathroom: { body: { material: 'ceramic', joint: 'glue' }, parts: [['tap_handle', tap], [/^door/, door('mdf')]] },
  utility_sink: { body: { material: 'ceramic', joint: 'glue' }, parts: [['tap_handle', tap]] },
  shower: {
    body: { material: 'tempered_glass', joint: 'clip' },
    parts: [['valve', { material: 'steel', joint: 'screw', piece: 'handle' }], ['glass_door', { material: 'tempered_glass', joint: 'clip', piece: 'glass' }]],
  },
  toilet: {
    body: { material: 'ceramic', joint: 'bolt' },
    parts: [['lid', door('plastic', 'hinge', 'lid')], ['flush_button', { material: 'plastic', joint: 'clip', piece: 'button' }]],
  },
  wall_socket: { body: { material: 'plastic', joint: 'screw' }, parts: [] },
  wall_switch: { body: { material: 'plastic', joint: 'screw' }, parts: [['rocker', { material: 'plastic', joint: 'clip', piece: 'rocker' }]] },
  service_entrance: { body: { material: 'steel', joint: 'bolt' }, parts: [['meter_door', door('steel')]] },
  conduit_run: { body: { material: 'plastic', joint: 'clip' }, parts: [] },
  electrical_panel: {
    body: { material: 'steel', joint: 'screw' },
    parts: [[/^breaker/, { material: 'plastic', joint: 'clip', piece: 'breaker' }], ['door', door('steel')]],
  },
  power_meter: { body: { material: 'plastic', joint: 'screw' }, parts: [['door', door('plastic')]] },
  tv: { body: { material: 'plastic', joint: 'screw' }, parts: [['power', { material: 'plastic', joint: 'clip', piece: 'button' }]] },
  microwave: { body: { material: 'steel', joint: 'screw' }, parts: [['door', door('steel')], ['dial', knob]] },
  washing_machine: { body: { material: 'steel', joint: 'screw' }, parts: [['dial', knob], ['door', door('tempered_glass')]] },
  sofa: { body: upholstery, parts: [] },
  armchair: { body: upholstery, parts: [] },
  dining_chair: { body: { material: 'wood_hard', joint: 'screw' }, parts: [] },
  bed_double: { body: { material: 'wood_soft', joint: 'screw' }, parts: [] },
  bed_single: { body: { material: 'wood_soft', joint: 'screw' }, parts: [] },
  bench: { body: { material: 'wood_soft', joint: 'nail' }, parts: [] },
  blinds: {
    body: { material: 'aluminium', joint: 'clip' },
    parts: [[/^slat_/, { material: 'aluminium', joint: 'clip', piece: 'slat' }], ['raise', { material: 'aluminium', joint: 'tie', piece: 'cord' }]],
  },
  curtain: { body: { material: 'fabric', joint: 'tie' }, parts: [[/^panel_/, { material: 'fabric', joint: 'tie', piece: 'curtain' }]] },
  trash_bin: bin,
  wheelie_bin: bin,
  mailbox: {
    body: { material: 'steel', joint: 'weld' },
    parts: [['flap', door('steel', 'hinge', 'flap')], ['flag', { material: 'steel', joint: 'hinge', piece: 'flag' }]],
  },
  dog_house: { body: { material: 'plywood', joint: 'nail' }, parts: [] },
  bbq: { body: { material: 'brick', joint: 'mortar' }, parts: [['counter_door', door('steel')]] },
  clothesline: { body: { material: 'steel', joint: 'weld' }, parts: [[/^cloth_/, { material: 'fabric', joint: 'tie', piece: 'cloth' }]] },
}

/** Tags of one movable part of a type, or undefined when the type has no rule for it. */
export function partDestruction(type: string, partId: string): PartDestruction | undefined {
  const rule = DESTRUCTION[type]?.parts.find(([m]) => (typeof m === 'string' ? m === partId : m.test(partId)))
  return rule ? { ...rule[1] } : undefined
}
