// @ts-check
// Whether this machine runs on the charger or on its battery, read from Linux's /sys/class/power_supply. The GPU checks of the pre-push
// (browser-checks.mjs, perf-gate.mjs) only run on the charger (dono, 2026-11-06): on battery the laptop throttles the GPU, the frame times read slower
// than main without the branch being worse, and an hour of browser suites drains it; so on battery they are skipped with a message and the push goes on.
//   PRE_PUSH_ON_BATTERY=1   run the GPU checks on battery anyway
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const POWER_SUPPLY_DIR = '/sys/class/power_supply'

/** @typedef {'charger' | 'battery' | 'unknown'} PowerSource */
/** @typedef {{ name: string, type: string, scope: string, online: string | null, status: string | null }} Supply */

/** @param {string} dir @param {string} file @returns {string | null} */
const readValue = (dir, file) => {
  try {
    return readFileSync(join(dir, file), 'utf8').trim()
  } catch {
    return null
  }
}

/** Every power supply the kernel lists. @param {string} [dir] @returns {Supply[]} */
export const readSupplies = (dir = POWER_SUPPLY_DIR) => {
  if (!existsSync(dir)) return []
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.map((name) => {
    const path = join(dir, name)
    return { name, type: readValue(path, 'type') ?? '', scope: readValue(path, 'scope') ?? 'System', online: readValue(path, 'online'), status: readValue(path, 'status') }
  })
}

/**
 * Where the power comes from. A wireless mouse's or a phone's battery (scope Device) is not the machine's. 'unknown' (no list, not Linux) and a desktop
 * (no battery) count as the charger: only a machine that is sure to be on its battery skips.
 * @param {readonly Supply[]} supplies @returns {PowerSource}
 */
export const powerSource = (supplies) => {
  const own = supplies.filter((supply) => supply.scope.toLowerCase() !== 'device')
  if (own.length === 0) return 'unknown'
  const adapters = own.filter((supply) => supply.type !== 'Battery' && supply.online !== null)
  if (adapters.some((supply) => supply.online === '1')) return 'charger'
  const batteries = own.filter((supply) => supply.type === 'Battery')
  if (batteries.length === 0) return 'charger'
  if (adapters.length > 0) return 'battery'
  // no adapter listed: the battery's own status says it
  return batteries.some((battery) => battery.status === 'Discharging') ? 'battery' : 'charger'
}

/**
 * The reason to skip the GPU checks, or null to run them.
 * @param {NodeJS.ProcessEnv} [env] @param {readonly Supply[]} [supplies] @returns {string | null}
 */
export const batterySkipReason = (env = process.env, supplies = readSupplies()) => {
  if (env.PRE_PUSH_ON_BATTERY === '1') return null
  if (powerSource(supplies) !== 'battery') return null
  return 'on battery, plug in the charger to run them (PRE_PUSH_ON_BATTERY=1 runs them anyway); the push goes on'
}
