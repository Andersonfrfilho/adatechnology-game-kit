import { debrisColor, debrisFamily, dustColor } from '@adatechnology/game-destruction'
import type { DestructionEvent, MaterialDef, Vec3 } from '@adatechnology/game-destruction'
import { DEBRIS_COLOR_VARIABLE, DUST_COLOR_VARIABLE } from '@adatechnology/game-vfx'

/** How long a hit point stays the place a stage of the same part happens at (s): the stage comes in the same batch as the hit. */
const HIT_POINT_SECONDS = 1

/** The family and the colours an effect of the event map is played with: the `{material}` of the map and the values its recipe reads. */
export interface FamilyPlay {
  readonly material: string
  readonly values: Readonly<Record<string, number>>
}

/** The family of the material and the colours of its debris and dust, for `vfx.play`. */
export function familyPlay(def: MaterialDef | undefined, partColor?: number): FamilyPlay {
  const dust = dustColor(def, partColor)
  return {
    material: debrisFamily(def),
    values: { [DEBRIS_COLOR_VARIABLE]: debrisColor(def, partColor), ...(dust !== undefined ? { [DUST_COLOR_VARIABLE]: dust } : {}) },
  }
}

/** The world point a destruction event happened at, when it carries one. */
function pointOf(ev: DestructionEvent): Vec3 | undefined {
  switch (ev.type) {
    case 'hole':
    case 'crack':
      return ev.worldPoint
    case 'spall':
    case 'debris':
      return ev.point
    case 'chip':
      return ev.center
    default:
      return undefined
  }
}

/**
 * Where each part was last hit. A stage 1 carries no point of its own (only the stage 2 opening has one), so its splinters, chips or shards are thrown
 * from the hit that set it off, not from the root of the object (the middle of a house).
 */
export class HitPoints {
  private readonly points = new Map<string, { point: Vec3; time: number }>()

  note(ev: DestructionEvent, time: number): void {
    const point = pointOf(ev)
    if (!point || !('part' in ev)) return
    this.points.set(`${ev.object}|${ev.part}`, { point, time })
  }

  /** The last hit on the part, if it was recent. */
  of(objectId: string, partId: string, time: number): Vec3 | undefined {
    const hit = this.points.get(`${objectId}|${partId}`)
    return hit && time - hit.time <= HIT_POINT_SECONDS ? hit.point : undefined
  }

  forget(objectId: string): void {
    for (const key of this.points.keys()) if (key.startsWith(`${objectId}|`)) this.points.delete(key)
  }
}
