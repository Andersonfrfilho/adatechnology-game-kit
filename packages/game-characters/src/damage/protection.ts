import type { BodySlot } from '@adatechnology/game-contracts'

import type { PenetrationModel, ProjectileInfo, ProtectionLayer } from './types'

/** The layered protection of T3: `1 − Π(1 − value·condition)`, at most `cap`. */
export const LAYERED_PROTECTION_CAP = 0.9

export type LayeredProtectionParams = {
  readonly layers: readonly ProtectionLayer[]
  readonly attack: 'bite' | 'scratch'
  /** 0..1 condition per layer id (worn, torn); 1 by default. */
  readonly conditions?: Readonly<Record<string, number>>
}

export const layeredProtection = ({ layers, attack, conditions }: LayeredProtectionParams): number => {
  const through = layers.reduce((left, layer) => left * (1 - (layer[attack] ?? 0) * (conditions?.[layer.id] ?? 1)), 1)
  return Math.min(LAYERED_PROTECTION_CAP, 1 - through)
}

/** The layers worn that cover any of `slots` and are not used up. */
export const layersOn = (worn: readonly ProtectionLayer[], slots: readonly BodySlot[], consumed: ReadonlySet<string>): ProtectionLayer[] =>
  worn.filter((layer) => !consumed.has(layer.id) && layer.slots.some((slot) => slots.includes(slot)))

/** What the layers over a segment do to one blow. */
export type ProtectionOutcome = {
  /** A consumable layer took the whole projectile (a helmet): no damage, and the layer is used up. */
  readonly absorbedBy?: string
  /** Share of the points that gets through the ballistic layers. */
  readonly ballistic: number
  /** Penetration resistance the layers add (the `physical` model). */
  readonly resistance: number
  /** Factor on limb damage (a turnout coat). */
  readonly limbs: number
  /** Factor on fire damage. */
  readonly fire: number
}

export type ProtectParams = {
  readonly layers: readonly ProtectionLayer[]
  readonly projectile?: ProjectileInfo
  readonly model: PenetrationModel
}

/** A stopped projectile does the layer's `blunt` share; one that goes through, `pass` (default `blunt`). Non-projectiles ignore ballistic layers. */
export const protect = ({ layers, projectile, model }: ProtectParams): ProtectionOutcome => {
  let ballistic = 1
  let resistance = 0
  for (const layer of layers) {
    const armour = layer.ballistic
    if (!armour || !projectile) continue
    const stops = model.stops(layer, projectile)
    if (stops && armour.consumable) return { absorbedBy: layer.id, ballistic: 0, resistance: armour.resistance, limbs: 1, fire: 1 }
    ballistic *= stops ? armour.blunt : (armour.pass ?? armour.blunt)
    resistance += armour.resistance
  }
  const limbs = layers.reduce((factor, layer) => factor * (layer.limbs ?? 1), 1)
  const fire = layers.reduce((factor, layer) => factor * (layer.fire ?? 1), 1)
  return { ballistic, resistance, limbs, fire }
}
