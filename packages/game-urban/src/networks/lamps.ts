import { flickerPhaseOf, lampStateOf } from '../lamps'
import type { LampShares, LampState } from '../lamps'
import type { UtilityNetworks } from './types'

/** A street light of the network with the state of its lamp: `pole` is the pole its `light_feed` comes from. */
export type NetworkLamp = LampState & { readonly id: string; readonly pole: string; readonly at: readonly [number, number, number]; readonly flickerPhase?: number }

export type NetworkLampsParams = {
  readonly networks: UtilityNetworks
  /** The share of lamps that work and the share that flicker (the rest are burnt out). */
  readonly shares: LampShares
  /** By day every lamp is off. */
  readonly isNight: boolean
}

/**
 * Every `light` node with its lamp's state, `lampStateOf` by the network's seed and the node's place (the same draw a pole of the scene had), and
 * a failing lamp's flicker phase (`flickerPhaseOf`). A lamp is on at night when its state says so; the transformer that feeds it is T2.8f.
 */
export function networkLampsOf({ networks, shares, isNight }: NetworkLampsParams): NetworkLamp[] {
  const feeds = new Map(networks.edges.filter((edge) => edge.kind === 'light_feed').map((edge) => [edge.to, edge.from]))
  return networks.nodes
    .filter((node) => node.kind === 'light')
    .map((node): NetworkLamp => {
      const [x, , z] = node.at
      const state = isNight ? lampStateOf({ seed: networks.seed, x, z, shares }) : { on: false, flicker: false }
      return { id: node.id, pole: feeds.get(node.id) ?? '', at: node.at, ...state, ...(state.flicker ? { flickerPhase: flickerPhaseOf(x, z) } : {}) }
    })
}
