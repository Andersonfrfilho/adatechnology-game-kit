// The layout of the house-connections area: one labelled row of every piece a house puts on its utility connection (the SDK's pieces by catalogue id, and a sign where the SDK
// has no drawing yet), and the floor of the street segment with the connected lot behind it. Pure given the room's `measure` and the planned lot.
import type { AreaPlacement, GroundLayout, GroundZone, ModuleArea } from '@adatechnology/game-contracts'
import type { ItemSize } from '@adatechnology/game-test-room'

import { CONNECTION_GAPS, CONNECTION_PIECES, GAP_PREFIX, textOf } from './house-connections-data.js'
import { STREET } from './house-connections-lot.js'
import type { ConnectedLotPlan } from './house-connections-lot.js'
import type { Locale } from './house-tables-data.js'

/** z of the front edge of the row (where the signs lie); the player looks at it from z = 36. */
export const ROW_FRONT = 22
const SLOT_MIN = 1.9
const SLOT_GAP = 0.7
const SIGN_STRIP = 0.7
const GAP_WIDTH = 2.6
const GAP_MARKER = 0.6
const EYE: readonly [number, number, number] = [0, 1.7, 36]

export interface ConnectionsLayout {
  readonly area: ModuleArea
  readonly ground: GroundLayout
  /** Catalogue ids the room did not have (left out). */
  readonly missing: readonly string[]
  readonly laid: ReadonlySet<string>
  /** Connection points of the lot that have no piece in the SDK: id and world position. */
  readonly gapPoints: ReadonlyMap<string, readonly [number, number]>
}

export interface LayConnectionsOptions {
  readonly measure: (itemId: string) => ItemSize | null
  readonly locale: Locale
  readonly planned: ConnectedLotPlan
}

function measureOf(measure: LayConnectionsOptions['measure'], item: string): ItemSize | null {
  try {
    return measure(item)
  } catch {
    return null
  }
}

/** The world point where the lot's house takes each network a gap names. */
function gapPointsOf(planned: ConnectedLotPlan): Map<string, readonly [number, number]> {
  const at = (network: string): readonly [number, number] | undefined => {
    const connection = planned.connections.find((entry) => entry.network === network)
    return connection ? [connection.at[0], connection.at[2]] : undefined
  }
  const points = new Map<string, readonly [number, number]>()
  const place = (id: string, point: readonly [number, number] | undefined): void => void (point && points.set(id, point))
  place('water_meter_box', at('water'))
  place('inspection_box_cover', at('sewer'))
  place('sewer_lateral', at('sewer'))
  place('downspout_mouth', at('storm'))
  return points
}

const street = (): GroundZone[] => {
  const half = STREET.width / 2
  const reach = STREET.halfLength
  return [
    { rect: [-reach, STREET.axis - half - STREET.sidewalk, reach, STREET.axis - half], surface: 'concrete_slab' },
    { rect: [-reach, STREET.axis - half, reach, STREET.axis + half], surface: 'road', label: 'Rua' },
    { rect: [-reach, STREET.axis + half, reach, STREET.axis + half + STREET.sidewalk], surface: 'concrete_slab' },
  ]
}

export function layConnections({ measure, locale, planned }: LayConnectionsOptions): ConnectionsLayout {
  const missing: string[] = []
  const placements: AreaPlacement[] = []
  const zones: GroundZone[] = [{ rect: [planned.lotRect[0], planned.lotRect[1], planned.lotRect[2], planned.lotRect[3]], surface: 'lawn' }, ...street()]
  const slots: Array<{ readonly width: number; readonly depth: number; readonly piece?: (typeof CONNECTION_PIECES)[number]; readonly gap?: (typeof CONNECTION_GAPS)[number] }> = []
  for (const piece of CONNECTION_PIECES) {
    const size = measureOf(measure, piece.item)
    if (!size) missing.push(piece.item)
    else slots.push({ piece, width: Math.max(size.w, SLOT_MIN) + SLOT_GAP, depth: size.d })
  }
  for (const gap of CONNECTION_GAPS) slots.push({ gap, width: GAP_WIDTH + SLOT_GAP, depth: GAP_MARKER })
  const depth = Math.max(...slots.map((slot) => slot.depth))
  const centreZ = ROW_FRONT - SIGN_STRIP - depth / 2
  const total = slots.reduce((sum, slot) => sum + slot.width, 0)
  const laid = new Set<string>()
  let x = -total / 2
  for (const slot of slots) {
    const centreX = x + slot.width / 2
    const rect: [number, number, number, number] = [x + SLOT_GAP / 4, centreZ - depth / 2 - 0.1, x + slot.width - SLOT_GAP / 4, ROW_FRONT]
    if (slot.piece) {
      placements.push({ item: slot.piece.item, position: [centreX, 0, centreZ], asleep: true, ...(slot.piece.rotationY === undefined ? {} : { rotationY: slot.piece.rotationY }) })
      zones.push({ rect, surface: 'concrete_slab', label: textOf(locale, slot.piece.name) })
      laid.add(slot.piece.item)
    } else if (slot.gap) zones.push({ rect, surface: 'dirt', label: `${textOf(locale, GAP_PREFIX)}${textOf(locale, slot.gap.name)}` })
    x += slot.width
  }
  const gapPoints = gapPointsOf(planned)
  for (const gap of CONNECTION_GAPS) {
    const point = gapPoints.get(gap.id)
    if (point) zones.push({ rect: [point[0] - GAP_MARKER / 2, point[1] - GAP_MARKER / 2, point[0] + GAP_MARKER / 2, point[1] + GAP_MARKER / 2], surface: 'dirt', label: textOf(locale, gap.name) })
  }
  return { area: { placements, view: { eye: [...EYE], target: [0, 1.2, 14] } }, ground: { surface: 'lawn', zones }, missing, laid, gapPoints }
}
