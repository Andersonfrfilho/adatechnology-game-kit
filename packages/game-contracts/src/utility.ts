/** The street networks a lot can be connected to. A network of a city reads these; it never sees the house that produced them. */
export type UtilityNetwork = 'power' | 'telecom' | 'sewer' | 'storm' | 'water'

/**
 * Where a lot takes one street network: the house produces one per network it has (from its plan), the street network consumes it, and
 * neither core imports the other. A game connects a building of its own through the same type.
 *
 * - `power` is the anchor of the service drop on the meter post (or the facade); the network links it to the low voltage, never to the
 *   medium voltage. `telecom` has its own anchor, about 0.6 m lower. `sewer` is the outlet of the inspection box, `storm` the downspout
 *   outlet at the kerb and `water` the meter stand.
 * - `frame: 'plan'` is in the house's plan (u, v and y over the lot floor); `'world'` has been through the lot's placement. A street
 *   network takes only `'world'`.
 */
export type UtilityConnection = {
  /** Id of the lot of the site (`Lot.id`). */
  readonly lot: string
  readonly network: UtilityNetwork
  readonly frame: 'plan' | 'world'
  /**
   * Metres. Anchor, outlet or stand, as the network says. For the buried networks (sewer, storm, water) `at[1]` is the ground level at
   * that point, never the pipe: the depth of a sewer is `at[1] - invert`.
   */
  readonly at: readonly [number, number, number]
  /** Sewer: level of the bottom of the pipe at the inspection box outlet (metres, same axis as `at[1]`). */
  readonly invert?: number
  /** Power: the load installed by the house's circuits, kVA. */
  readonly installedKva?: number
}
