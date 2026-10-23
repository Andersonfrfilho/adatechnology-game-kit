import type { VehicleKit, VehicleSpec } from '@adatechnology/game-vehicles'

/** Label of a part or a glass pane: a locale key (`fleet.labels.<key>`) with its translated text. */
export interface FleetLabel {
  key: string
  label: string
}

/** Helpers that one vehicle file exposes to the files installed after it (the water and air builders). */
export interface FleetShared {
  /** Hull, wing, fuselage, propeller, rotor and navigation light builders (set by the water/air file). */
  EA?: any
  /** Helpers of the plane file used by the helicopter file. */
  GH?: any
}

/** What every vehicle file receives when it is installed. */
export interface FleetContext {
  kit: VehicleKit
  /** Registers a vehicle (skipped when the game picked other vehicles). */
  register(spec: VehicleSpec, build: (c: any, kit: VehicleKit) => void): void
  shared: FleetShared
  /** Translates a key of the pack table (`fleet.<key>`). */
  t(key: string, vars?: Record<string, unknown>): string
  /** Builds the label object of a part or glass pane from `fleet.labels.<key>`. */
  label(key: string): FleetLabel
}
