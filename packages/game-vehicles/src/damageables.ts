/**
 * Damageable parts: what a bullet, a bat or a crash can hurt on a built vehicle, as boxes. Port of `coletarDanificaveis` and `tipoDaZona`
 * (frota-leve.js 14391-14405), driven by the zones the kit already derives, so it works for any vehicle of any pack.
 */
import type { Kit } from './types'

export type DamageableMaterial = 'metal' | 'glass' | 'rubber' | 'fuel'
export type DamageableSide = 'center' | 'left' | 'right'

/** What a zone is, by type: the material it is made of and the part name a game shows. */
export interface DamageableKind {
  material: DamageableMaterial
  part: string
}

/** Zone type (and, for some, `fxKey` or `sub`) to material and part. A game replaces or adds entries with `kit.damageableKinds`. */
export const defaultDamageableKinds: Record<string, DamageableKind> = {
  door: { material: 'metal', part: 'door' },
  hood: { material: 'metal', part: 'hood' },
  lid: { material: 'metal', part: 'lid' },
  bumper: { material: 'metal', part: 'bumper' },
  glass: { material: 'glass', part: 'window' },
  'glass:windshield': { material: 'glass', part: 'windshield' },
  light: { material: 'glass', part: 'headlight' },
  'light:taillight': { material: 'glass', part: 'taillight' },
  wheel: { material: 'rubber', part: 'wheel' },
  'internal:fuel_tank': { material: 'fuel', part: 'fuel_tank' },
}

export function installDamageables(kit: Kit): void {
  const THREE = kit.THREE
  kit.damageableKinds = { ...defaultDamageableKinds }

  const kindOf = (zone: any): DamageableKind | null => {
    const kinds = kit.damageableKinds
    if (zone.type === 'internal') return zone.sub ? kinds[`internal:${zone.sub}`] || null : null
    return kinds[`${zone.type}:${zone.fxKey}`] || kinds[zone.type] || null
  }

  /**
   * Every damageable zone of a built vehicle: `{ material, zone, part, side, box }`. `box` is a `THREE.Box3` in the coordinates of
   * `c.vehicle`, or in the frame of `matrix` when one is given (for example the output frame of `game-vehicles-three`).
   */
  kit.damageables = function (c: any, matrix?: any) {
    const out: any[] = []
    for (const zone of c.zones || []) {
      const kind = kindOf(zone)
      if (!kind || !zone.box) continue
      const b = zone.box
      const box = new THREE.Box3(new THREE.Vector3(b.x0, b.y0, b.z0), new THREE.Vector3(b.x1, b.y1, b.z1))
      if (matrix) box.applyMatrix4(matrix)
      out.push({ material: kind.material, zone: zone.id, part: kind.part, side: zone.side === 0 ? 'center' : zone.side < 0 ? 'left' : 'right', box })
    }
    return out
  }
}
