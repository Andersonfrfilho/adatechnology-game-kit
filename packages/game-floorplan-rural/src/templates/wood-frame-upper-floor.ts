import type { DoorDef, FloorDef, RoomDef, WindowDef } from '@adatechnology/game-floorplan'
import { WOOD_FRAME } from './wood-frame-config'
import type { createWoodFrameConfig } from './wood-frame-config'

const MASTER_WIDTH = 4.0
const SUITE_BATH_WIDTH = 2.0
const LANDING_START = 6.4

/** Upper floor of the two-storey wood frame house: master suite, two to four bedrooms, a corridor and the stairs. */
export function createWoodFrameUpperFloor(configOf: ReturnType<typeof createWoodFrameConfig>): FloorDef {
  const stairs = WOOD_FRAME.stairsWidth
  const thirdWidth = (w: number): number => w - stairs - 3.4
  return {
    label: 'upper_floor', ceiling: 2.6,
    rooms: (w, d, op) => { const c = configOf(op), q3w = thirdWidth(w), v1 = LANDING_START
      return [
        { id: 'master', type: 'bedroom', label: 'suite_master', rect: [0, 0, MASTER_WIDTH, 4.6] },
        { id: 'bathroom_suite', type: 'bathroom', label: 'bathroom_suite', library: 'bathroom_wc', rect: [MASTER_WIDTH, 0, MASTER_WIDTH + SUITE_BATH_WIDTH, 4.6] },
        { id: 'bedroom_2', type: 'bedroom', label: 'bedroom_2', rect: [MASTER_WIDTH + SUITE_BATH_WIDTH, 0, w, 4.6] },
        { id: 'corridor_upper', type: 'corridor', label: 'corridor', rect: [0, 4.6, w, v1] },
        c.bedrooms >= 3 ? { id: 'bedroom_3', type: 'bedroom', label: 'bedroom_3', rect: [0, v1, q3w, d] } : { id: 'bedroom_3', type: 'office', label: 'study_room', rect: [0, v1, q3w, d] },
        c.bedrooms >= 4 ? { id: 'bedroom_4', type: 'bedroom', label: 'bedroom_4', rect: [q3w, v1, w - stairs, d] } : { id: 'bedroom_4', type: 'office', label: 'office', rect: [q3w, v1, w - stairs, d] },
        { id: 'stairs_upper', type: 'stairs', label: 'stairs', rect: [w - stairs, v1, w, v1 + 4.2], link: [0, 1] },
        { id: 'bathroom_guest', type: 'bathroom', label: 'bathroom_guest', library: 'bathroom_wc', rect: [w - stairs, v1 + 4.2, w, d] },
      ] satisfies RoomDef[] },
    doors: (w) => { const q3w = thirdWidth(w); return [
      { a: 'corridor_upper', b: 'master', at: 2.0, width: 0.85, opensTo: 'master' },
      { a: 'master', b: 'bathroom_suite', at: 3.3, width: 0.75, opensTo: 'bathroom_suite' },
      { a: 'corridor_upper', b: 'bedroom_2', at: (MASTER_WIDTH + SUITE_BATH_WIDTH + w) / 2, width: 0.85, opensTo: 'bedroom_2' },
      { a: 'corridor_upper', b: 'stairs_upper', at: w - 0.65, width: 0.8, opensTo: 'corridor_upper' },
      { a: 'corridor_upper', b: 'bedroom_3', at: q3w / 2, width: 0.85, opensTo: 'bedroom_3' },
      { a: 'corridor_upper', b: 'bedroom_4', at: (q3w + w - stairs) / 2, width: 0.85, opensTo: 'bedroom_4' },
      { a: 'stairs_upper', b: 'bathroom_guest', at: w - 0.65, width: 0.7, opensTo: 'bathroom_guest' },
    ] satisfies DoorDef[] },
    windows: (w, d) => { const q3w = thirdWidth(w), v1 = LANDING_START; return [
      { room: 'master', side: 'front', at: MASTER_WIDTH / 2, width: 1.4 }, { room: 'master', side: 'left', at: 2.3, width: 1.2 },
      { room: 'bedroom_2', side: 'front', at: (MASTER_WIDTH + SUITE_BATH_WIDTH + w) / 2, width: 1.4 }, { room: 'bedroom_2', side: 'right', at: 2.3, width: 1.2 },
      { room: 'bedroom_3', side: 'left', at: (v1 + d) / 2, width: 1.4 }, { room: 'bedroom_3', side: 'back', at: q3w / 2, width: 1.4 },
      { room: 'bedroom_4', side: 'back', at: (q3w + w - stairs) / 2, width: 1.4 }, { room: 'bathroom_guest', side: 'right', at: d - 1.0, width: 0.6, y0: 2.1, y1: 2.5 },
    ] satisfies WindowDef[] },
  }
}
