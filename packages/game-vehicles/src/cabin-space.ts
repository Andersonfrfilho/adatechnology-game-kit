/** Interior clearance measurement: derives `SeatSpace[]` and `DoorOpening[]` for every built vehicle (Spec 012 R5). */
import type { DoorOpening, SeatRole, SeatSpace, Vec3 } from '@adatechnology/game-contracts'

import type { Object3D } from './three-types'
import type { DamageZone } from './api'
import type { BuildContext, Kit } from './types'

/** Raw seat metadata recorded by `kit.seat(...)` before cabin geometry and zones are finalised. */
export type RawSeatEntry = {
  readonly id?: string
  readonly role?: SeatRole
  readonly hipPoint: Vec3
  readonly seatWidth: number
  readonly seatLen: number
  readonly facing: Vec3
  readonly isBench: boolean
  readonly benchIndex: number
  readonly benchCount: number
  readonly open?: boolean
  readonly doorId?: string
  readonly headroomMetres?: number
  readonly legroomMetres?: number
  readonly widthMetres?: number
  readonly parent?: Object3D | null
}

const HEADROOM_RAY_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.06, 0],
  [-0.06, 0],
  [0, -0.06],
  [0, 0.06],
]

const HEADROOM_START_OFFSET = 0.02
const HEADROOM_MIN_HIT = 0.2
const LEGROOM_KNEE_OFFSET = 0.12
const LEGROOM_START_PAD = 0.02
const LEGROOM_MIN_HIT = 0.02
const SHOULDER_HEIGHT_OFFSET = 0.38
const SHOULDER_MIN_HIT = 0.14
const ROW_EPSILON = 0.25
const NEIGHBOR_ROW_TOLERANCE = 0.35
const DOOR_ROOF_TRIM = 0.05

const round4 = (value: number): number => (Number.isFinite(value) ? Math.round(value * 10000) / 10000 : value)

type DoorRecord = {
  readonly opening: DoorOpening
  readonly center: Vec3
  readonly side: number
}

export function installCabinSpace(kit: Kit) {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const raycaster = new THREE.Raycaster()
  const originVec = new V3()
  const dirVec = new V3()

  function castFirst(
    c: BuildContext,
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    minDist: number,
  ): number {
    originVec.set(ox, oy, oz)
    dirVec.set(dx, dy, dz)
    raycaster.set(originVec, dirVec)
    const hits = raycaster.intersectObject(c.vehicle, true)
    const ignored = c._noCabinRayObjs
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i]
      if (!h) continue
      if (h.object.visible === false || h.object.userData?.noCabinRay === true || ignored?.has(h.object)) continue
      if (h.distance >= minDist) return h.distance
    }
    return Number.POSITIVE_INFINITY
  }

  function measureHeadroom(c: BuildContext, hip: Vec3): number {
    let minClearance = Number.POSITIVE_INFINITY
    for (let i = 0; i < HEADROOM_RAY_OFFSETS.length; i++) {
      const offset = HEADROOM_RAY_OFFSETS[i]!
      const dist = castFirst(c, hip[0] + offset[0], hip[1] + HEADROOM_START_OFFSET, hip[2] + offset[1], 0, 1, 0, HEADROOM_MIN_HIT)
      const clear = Number.isFinite(dist) ? dist + HEADROOM_START_OFFSET : Number.POSITIVE_INFINITY
      if (clear < minClearance) minClearance = clear
    }
    return round4(minClearance)
  }

  function measureLegroom(c: BuildContext, hip: Vec3, facing: Vec3, seatLen: number): number {
    const startOffset = seatLen / 2 + LEGROOM_START_PAD
    const dist = castFirst(
      c,
      hip[0] + facing[0] * startOffset,
      hip[1] + LEGROOM_KNEE_OFFSET,
      hip[2] + facing[2] * startOffset,
      facing[0],
      0,
      facing[2],
      LEGROOM_MIN_HIT,
    )
    return Number.isFinite(dist) ? round4(startOffset + dist) : Number.POSITIVE_INFINITY
  }

  function measureShoulderWidth(c: BuildContext, raw: RawSeatEntry, allRaw: readonly RawSeatEntry[], headroom: number): number {
    const hip = raw.hipPoint
    const fx = raw.facing[0]
    const fz = raw.facing[2]
    // Lateral unit vector perpendicular to seat facing in XZ plane
    const lx = -fz
    const lz = fx
    const sy = hip[1] + SHOULDER_HEIGHT_OFFSET

    const wallPos = castFirst(c, hip[0], sy, hip[2], lx, 0, lz, SHOULDER_MIN_HIT)
    const wallNeg = castFirst(c, hip[0], sy, hip[2], -lx, 0, -lz, SHOULDER_MIN_HIT)

    let neighborPos = Number.POSITIVE_INFINITY
    let neighborNeg = Number.POSITIVE_INFINITY
    for (let i = 0; i < allRaw.length; i++) {
      const other = allRaw[i]
      if (!other || other === raw) continue
      const dx = other.hipPoint[0] - hip[0]
      const dy = Math.abs(other.hipPoint[1] - hip[1])
      const dz = other.hipPoint[2] - hip[2]
      if (dy > NEIGHBOR_ROW_TOLERANCE) continue
      const alongFacing = Math.abs(dx * fx + dz * fz)
      if (alongFacing > NEIGHBOR_ROW_TOLERANCE) continue
      const alongLat = dx * lx + dz * lz
      if (alongLat > 0.05 && alongLat / 2 < neighborPos) neighborPos = alongLat / 2
      else if (alongLat < -0.05 && -alongLat / 2 < neighborNeg) neighborNeg = -alongLat / 2
    }

    const halfFallback = Number.isFinite(headroom) ? raw.seatWidth / 2 : Number.POSITIVE_INFINITY
    const posSpace = Math.min(wallPos, neighborPos)
    const negSpace = Math.min(wallNeg, neighborNeg)
    const leftAvail = Number.isFinite(posSpace) ? posSpace : halfFallback
    const rightAvail = Number.isFinite(negSpace) ? negSpace : halfFallback
    const total = leftAvail + rightAvail
    return round4(total)
  }

  function collectDoors(c: BuildContext): DoorRecord[] {
    const records: DoorRecord[] = []
    const seen = new Set<string>()
    const explicit = (c._explicitDoors || []) as DoorOpening[]
    for (let i = 0; i < explicit.length; i++) {
      const d = explicit[i]!
      if (seen.has(d.id)) continue
      seen.add(d.id)
      const side = d.id.includes('left') ? -1 : d.id.includes('right') ? 1 : 0
      records.push({ opening: d, center: [0, 0, side], side })
    }

    const zones = (c.zones || []) as DamageZone[]
    const cabin = c.meta?.cabin as { y0?: number; y1?: number } | undefined
    const ghRoof = c.meta?.glasshouse?.roof as number | undefined
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i]
      if (!z || z.type !== 'door' || !z.box || seen.has(z.id)) continue
      seen.add(z.id)
      const b = z.box
      const dx = Math.abs(b.x1 - b.x0)
      const dz = Math.abs(b.z1 - b.z0)
      const dy = Math.abs(b.y1 - b.y0)
      const isSideDoor = dx >= dz
      const widthMetres = isSideDoor ? dx : dz
      let heightMetres = dy
      if (isSideDoor && ghRoof != null) {
        const floorY = cabin?.y0 != null ? cabin.y0 + 0.05 : b.y0
        const roofY = ghRoof - DOOR_ROOF_TRIM
        if (roofY - floorY > heightMetres) heightMetres = roofY - floorY
      }
      const center: Vec3 = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2]
      const side = typeof z.side === 'number' ? z.side : center[2] < -0.1 ? -1 : center[2] > 0.1 ? 1 : 0
      records.push({
        opening: {
          id: z.id,
          widthMetres: round4(widthMetres),
          heightMetres: round4(heightMetres),
        },
        center,
        side,
      })
    }
    return records
  }

  function pickDoorId(hip: Vec3, doors: readonly DoorRecord[]): string | undefined {
    if (doors.length === 0) return undefined
    const seatSide = hip[2] < -0.05 ? -1 : hip[2] > 0.05 ? 1 : 0
    let bestId: string | undefined
    let bestScore = Number.POSITIVE_INFINITY
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i]!
      const dx = d.center[0] - hip[0]
      const dz = d.center[2] - hip[2]
      const sidePenalty = seatSide !== 0 && d.side !== 0 && seatSide !== d.side ? 10 : 0
      const score = dx * dx + dz * dz + sidePenalty
      if (score < bestScore) {
        bestScore = score
        bestId = d.opening.id
      }
    }
    return bestId
  }

  function inferRole(c: BuildContext, raw: RawSeatEntry, maxX: number, driverAssigned: boolean): SeatRole {
    if (raw.role) return raw.role
    const kind = c.meta?.kind
    if (kind === 'bike') return 'rider'
    if (kind === 'tank') return 'crew'
    if (Math.abs(raw.facing[2]) > 0.5) return 'cargo'
    const isFrontRow = raw.hipPoint[0] >= maxX - ROW_EPSILON
    if (kind === 'plane' || kind === 'heli') return isFrontRow ? 'pilot' : 'crew'
    if (isFrontRow) {
      if (!driverAssigned && raw.hipPoint[2] <= 0.05) return 'driver'
      return 'front_passenger'
    }
    return 'rear'
  }

  function finalizeCabinSpaces(c: BuildContext): void {
    c.root.updateMatrixWorld(true)
    const doorRecords = collectDoors(c)
    c.doors = doorRecords.map((r) => r.opening)

    const seats: SeatSpace[] = []
    const usedIds = new Set<string>()
    const pushSeat = (seat: SeatSpace): void => {
      let id = seat.id
      if (usedIds.has(id)) {
        let suffix = 2
        while (usedIds.has(`${id}_${suffix}`)) suffix++
        id = `${id}_${suffix}`
      }
      usedIds.add(id)
      seats.push(id === seat.id ? seat : { ...seat, id })
    }

    const explicit = (c._explicitSeats || []) as SeatSpace[]
    for (let i = 0; i < explicit.length; i++) {
      pushSeat(explicit[i]!)
    }

    const invVehicle = new THREE.Matrix4().copy(c.vehicle.matrixWorld).invert()
    const tmpPoint = new V3()
    const rawSeats: RawSeatEntry[] = ((c._rawSeats || []) as RawSeatEntry[]).map((entry) => {
      if (!entry.parent || entry.parent === c.vehicle) return entry
      entry.parent.updateMatrixWorld(true)
      tmpPoint.set(entry.hipPoint[0], entry.hipPoint[1], entry.hipPoint[2]).applyMatrix4(entry.parent.matrixWorld).applyMatrix4(invVehicle)
      return { ...entry, hipPoint: [tmpPoint.x, tmpPoint.y, tmpPoint.z] as Vec3 }
    })
    // Vehicles that record `c.seatTops` directly (e.g. open boats) without calling `kit.seat`
    if (rawSeats.length === 0 && explicit.length === 0 && Array.isArray(c.seatTops) && c.seatTops.length > 0) {
      const isOpenBoat = c.meta?.kind === 'boat'
      for (let i = 0; i < c.seatTops.length; i++) {
        const st = c.seatTops[i]!
        rawSeats.push({
          hipPoint: [st.x, st.y, st.z],
          seatWidth: st.w,
          seatLen: st.l,
          facing: [1, 0, 0],
          isBench: false,
          benchIndex: 0,
          benchCount: 1,
          open: isOpenBoat,
        })
      }
    }
    let maxX = Number.NEGATIVE_INFINITY
    for (let i = 0; i < rawSeats.length; i++) {
      const x = rawSeats[i]!.hipPoint[0]
      if (x > maxX) maxX = x
    }

    let driverAssigned = seats.some((s) => s.role === 'driver')
    for (let i = 0; i < rawSeats.length; i++) {
      const raw = rawSeats[i]!
      const role = inferRole(c, raw, maxX, driverAssigned)
      if (role === 'driver') driverAssigned = true
      const isOpen = raw.open === true
      const headroomMetres = isOpen
        ? Number.POSITIVE_INFINITY
        : raw.headroomMetres != null
          ? round4(raw.headroomMetres)
          : measureHeadroom(c, raw.hipPoint)
      const legroomMetres = isOpen
        ? Number.POSITIVE_INFINITY
        : raw.legroomMetres != null
          ? round4(raw.legroomMetres)
          : measureLegroom(c, raw.hipPoint, raw.facing, raw.seatLen)
      const widthMetres = isOpen
        ? Number.POSITIVE_INFINITY
        : raw.widthMetres != null
          ? round4(raw.widthMetres)
          : measureShoulderWidth(c, raw, rawSeats, headroomMetres)
      const doorId = isOpen ? undefined : raw.doorId !== undefined ? raw.doorId : pickDoorId(raw.hipPoint, doorRecords)
      const sideTag = raw.hipPoint[2] < -0.05 ? 'left' : raw.hipPoint[2] > 0.05 ? 'right' : 'center'
      const defaultId = role === 'driver' ? 'driver' : role === 'front_passenger' ? `front_${sideTag}` : `${role}_${sideTag}`
      const hipPoint: Vec3 = [round4(raw.hipPoint[0]), round4(raw.hipPoint[1]), round4(raw.hipPoint[2])]

      const seatSpace: SeatSpace =
        doorId !== undefined
          ? { id: raw.id ?? defaultId, role, hipPoint, headroomMetres, legroomMetres, widthMetres, doorId }
          : { id: raw.id ?? defaultId, role, hipPoint, headroomMetres, legroomMetres, widthMetres }
      pushSeat(seatSpace)
    }

    const kind = c.meta?.kind
    if (seats.length === 0 && rawSeats.length === 0 && (kind === 'bike' || kind === 'quad')) {
      const zones = (c.zones || []) as DamageZone[]
      const seatZone = zones.find((z) => z.id === 'seat' && z.box)
      const hipPoint: Vec3 = seatZone?.box
        ? [
            round4((seatZone.box.x0 + seatZone.box.x1) / 2),
            round4(seatZone.box.y0 + (seatZone.box.y1 - seatZone.box.y0) * 0.75),
            round4((seatZone.box.z0 + seatZone.box.z1) / 2),
          ]
        : [round4(((c.meta?.rear ?? -1) + (c.meta?.front ?? 1)) * 0.25), round4((c.meta?.top ?? 1.1) * 0.75), 0]
      pushSeat({
        id: 'rider',
        role: 'rider',
        hipPoint,
        headroomMetres: Number.POSITIVE_INFINITY,
        legroomMetres: Number.POSITIVE_INFINITY,
        widthMetres: Number.POSITIVE_INFINITY,
      })
    }

    c.seats = seats
  }

  kit.finalizeCabinSpaces = finalizeCabinSpaces
  kit._.finalizeCabinSpaces = finalizeCabinSpaces
  return { finalizeCabinSpaces }
}
