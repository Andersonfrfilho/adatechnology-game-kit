import type { RoomColorDef } from '@adatechnology/game-floorplan'

/**
 * Wall and floor colours per residential room type. `order` is the position in the palette's
 * seeded stream (the commercial pack fills 13 to 15), so palettes stay identical to the original.
 */
export const residentialRoomColors: RoomColorDef[] = [
  { order: 0, type: 'living', wall: (c) => [c.H0, 0.9] },
  { order: 1, type: 'kitchen', wall: (c) => [c.H0 + 12, 0.92], floor: [35, 0.08, 0.55] },
  { order: 2, type: 'bedroom', wall: (c) => [c.H1, 0.88] },
  { order: 3, type: 'bathroom', wall: () => [200, 0.93], floor: [200, 0.06, 0.55], neutral: true },
  { order: 4, type: 'corridor', wall: (c) => [c.H0, 0.93] },
  { order: 5, type: 'hall', wall: (c) => [c.H0, 0.91] },
  { order: 6, type: 'dining', wall: (c) => [c.H2, 0.88] },
  { order: 7, type: 'laundry', wall: () => [200, 0.92], floor: [200, 0.06, 0.55], neutral: true },
  { order: 8, type: 'garage', wall: () => [35, 0.72], floor: [35, 0.04, 0.5], neutral: true },
  { order: 9, type: 'office', wall: (c) => [c.H1, c.style === 'high' ? 0.55 : 0.86] },
  { order: 10, type: 'stairs', wall: (c) => [c.H0, 0.92] },
  { order: 11, type: 'balcony', wall: (c) => [c.H0, 0.88], floor: [28, 0.2, 0.5] },
  { order: 12, type: 'terrace', wall: (c) => [c.H0, 0.88], floor: [28, 0.35, 0.4] },
  { order: 16, type: 'closet', wall: (c) => [c.H0, 0.9] },
  { order: 17, type: 'spa', wall: () => [28, 0.6], floor: [28, 0.3, 0.4], neutral: true },
  { order: 18, type: 'cinema', wall: (c) => [c.H1, 0.3], neutral: true },
  { order: 19, type: 'gourmet', wall: (c) => [c.H2, 0.84] },
  { order: 20, type: 'elevator', wall: () => [220, 0.5], floor: [220, 0.03, 0.3], neutral: true },
  { order: 21, type: 'void', wall: (c) => [c.H0, 0.92] },
]
