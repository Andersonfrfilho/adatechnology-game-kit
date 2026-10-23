import type { RoomColorDef } from '@adatechnology/game-floorplan'

/** Shop room colours. The `order` values slot into the residential palette stream (13 to 15). */
export const commercialRoomColors: RoomColorDef[] = [
  { order: 13, type: 'shop', wall: (c) => [c.H0, 0.9] },
  { order: 14, type: 'counter', wall: (c) => [c.H0, 0.9] },
  { order: 15, type: 'stockroom', wall: () => [35, 0.8], neutral: true },
]
