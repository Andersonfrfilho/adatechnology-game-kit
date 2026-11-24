/**
 * What the generator could not lay by its rules and laid anyway, for the game to see (the validator still reports what breaks a rule):
 * a pole with no free ground but in front of a gate, a pole whose own consumers are over the largest transformer, a lot out of every reach.
 */
export type NetworkWarning = {
  readonly code: 'pole_on_avoid' | 'transformer_over_capacity' | 'lot_out_of_reach'
  readonly id: string
  readonly detail?: string
}
