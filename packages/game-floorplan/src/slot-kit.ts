import type { SlotDef, SlotKit } from './types'

/** Builders for the slot definitions of a room library. */
export const slotKit: SlotKit = {
  wall: (id, side, pos, size, cats, o) => Object.assign({ id, anchor: 'wall', side, pos, size, cats }, o) as SlotDef,
  corner: (id, corner, size, cats, o) => Object.assign({ id, anchor: 'corner', corner, size, cats }, o) as SlotDef,
  center: (id, fx, fz, size, cats, o) => Object.assign({ id, anchor: 'center', fx, fz, size, cats }, o) as SlotDef,
  windowSlot: (id, size, cats, o) => Object.assign({ id, anchor: 'window', size, cats }, o) as SlotDef,
  on: (id, parent, cats, o) => Object.assign({ id, anchor: 'on', on: parent, cats }, o) as SlotDef,
  inside: (id, parent, cats, o) => Object.assign({ id, anchor: 'inside', on: parent, cats }, o) as SlotDef,
}
