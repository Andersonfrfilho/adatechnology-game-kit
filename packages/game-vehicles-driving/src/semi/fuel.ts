export interface FuelModel {
  /** Litres per second at idle. */
  idleRate: number
  /** Extra litres per second at full throttle and redline. */
  fullRate: number
  /** Extra consumption per unit of cargo mass over the vehicle's own mass (0.5 = +50% when the load equals the vehicle). */
  loadFactor: number
  /** Extra consumption of a wrecked engine (0.4 = up to +40% at zero health). */
  damagedEngineExtra: number
}

export const defaultFuelModel: FuelModel = { idleRate: 0.0003, fullRate: 0.0035, loadFactor: 0.5, damagedEngineExtra: 0.4 }

/**
 * Litres per second: it depends on the RPM, the throttle, the weight of the cargo and the state of the engine
 * (Frota document, section 04: "a damaged engine spends up to 40% more").
 */
export function fuelRate(model: FuelModel, rpmFraction: number, throttle: number, loadRatio: number, engineHealth: number): number {
  const base = model.idleRate + model.fullRate * Math.max(0, Math.min(1, rpmFraction)) * Math.max(0, Math.min(1, throttle))
  return base * (1 + model.loadFactor * Math.max(0, loadRatio)) * (1 + model.damagedEngineExtra * (1 - Math.max(0, Math.min(1, engineHealth))))
}
