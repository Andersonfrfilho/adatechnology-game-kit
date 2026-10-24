import { createArsenal } from '../../src'
import type { Arsenal, FireMode, ReloadRequest, TriggerResult, Vec3, WeaponDef, WeaponEvent, WeaponState } from '../../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const FRAME = 1 / 60
const HOLD_SECONDS = 0.6
const SETTLE_SECONDS = 3
const RELOAD_LIMIT_SECONDS = 60
const FIRE_LIMIT = 400

export interface StepRecord {
  readonly step: string
  readonly status?: string
  readonly shots: number
  readonly rounds: number
  readonly uses: string
  readonly ammo: number
  readonly reserve: number
  readonly heat: number
  readonly events: string
}

export interface WeaponRecord {
  readonly id: string
  readonly steps: readonly StepRecord[]
}

const round = (value: number, places = 2): number => Math.round(value * 10 ** places) / 10 ** places

const eventLabel = (event: WeaponEvent): string => {
  switch (event.type) {
    case 'shot':
      return `shot:${event.mode}:${event.shots}/${event.rounds}`
    case 'reload':
      return `reload:${event.phase}:${event.kind}`
    case 'reload_stage':
      return `stage:${event.stage}`
    case 'mode':
      return `mode:${event.mode}`
    case 'fault':
      return `fault:${event.fault}`
    case 'clear':
      return `clear:${event.fault}:${event.phase}`
    case 'safety':
      return `safety:${event.on ? 'on' : 'off'}`
    case 'cook':
      return `cook:${event.phase}`
    case 'draw':
    case 'cycle':
      return `${event.type}:${event.phase}`
    default:
      return event.type
  }
}

/** Events in order, each with its time on the weapon clock; a run of the same event (an automatic burst) is one entry with its count and last time. */
export const summarizeEvents = (events: readonly WeaponEvent[]): string => {
  const parts: string[] = []
  let index = 0
  while (index < events.length) {
    const first = events[index] as WeaponEvent
    const label = eventLabel(first)
    let last = first
    let count = 1
    while (index + count < events.length && eventLabel(events[index + count] as WeaponEvent) === label) last = events[index + count++] as WeaponEvent
    parts.push(count === 1 ? `${label}@${round(first.at)}` : `${label}×${count}@${round(first.at)}-${round(last.at)}`)
    index += count
  }
  return parts.join(' ')
}

const seedOf = (id: string): number => [...id].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 7)

const useKinds = (results: readonly TriggerResult[]): string => {
  const counts = new Map<string, number>()
  for (const result of results) for (const use of result.uses) counts.set(use.kind, (counts.get(use.kind) ?? 0) + 1)
  return [...counts].map(([kind, count]) => `${kind}×${count}`).join(',')
}

const statusOf = (results: readonly TriggerResult[]): string => [...new Set(results.map((result) => result.status))].join('>')

const snapshot = (weapon: WeaponState, step: string, results: readonly TriggerResult[]): StepRecord => ({
  step,
  ...(results.length ? { status: statusOf(results) } : {}),
  shots: results.reduce((sum, result) => sum + result.shots.length, 0),
  rounds: results.reduce((sum, result) => sum + result.rounds, 0),
  uses: useKinds(results),
  ammo: round(weapon.ammo, 3),
  reserve: weapon.reserve,
  heat: round(weapon.heat, 1),
  events: summarizeEvents(weapon.drain()),
})

const wait = (weapon: WeaponState, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += FRAME) weapon.update(FRAME)
}

const pull = (weapon: WeaponState): TriggerResult => {
  const result = weapon.trigger(ORIGIN, AIM, 0, false)
  return weapon.release(ORIGIN, AIM) ?? result
}

const hold = (weapon: WeaponState, seconds: number): TriggerResult[] => {
  const results: TriggerResult[] = []
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += FRAME) {
    results.push(weapon.trigger(ORIGIN, AIM, FRAME, true))
    weapon.update(FRAME)
  }
  const released = weapon.release(ORIGIN, AIM)
  if (released) results.push(released)
  return results
}

const HELD_KINDS: ReadonlySet<string> = new Set(['flame', 'heat', 'extinguisher', 'tool'])

/** One trigger action fitted to the mode: a pull, or a held trigger where the mode keeps firing while it is down. */
const fireOnce = (weapon: WeaponState): TriggerResult[] => {
  const mode: FireMode = weapon.mode
  if (HELD_KINDS.has(weapon.def.action.kind)) return hold(weapon, HOLD_SECONDS)
  if (mode === 'auto' || mode === 'burst') return hold(weapon, HOLD_SECONDS)
  return [pull(weapon)]
}

const setMode = (weapon: WeaponState, mode: FireMode): void => {
  for (let guard = 0; guard < 10 && weapon.mode !== mode; guard++) weapon.cycleMode()
}

const fireStep = (weapon: WeaponState, step: string): StepRecord => {
  const results = fireOnce(weapon)
  wait(weapon, SETTLE_SECONDS)
  return snapshot(weapon, step, results)
}

const emptyOut = (weapon: WeaponState): StepRecord => {
  const results: TriggerResult[] = []
  for (let guard = 0; guard < FIRE_LIMIT && weapon.ammo > 0; guard++) {
    results.push(...fireOnce(weapon))
    wait(weapon, 0.7)
  }
  results.push(pull(weapon))
  wait(weapon, SETTLE_SECONDS)
  const record = snapshot(weapon, 'empty', results)
  return { ...record, status: results[results.length - 1]?.status ?? record.status ?? '' }
}

const reloadStep = (weapon: WeaponState, request: ReloadRequest): StepRecord => {
  const started = weapon.reload(request)
  wait(weapon, started ? RELOAD_LIMIT_SECONDS : SETTLE_SECONDS)
  return { ...snapshot(weapon, `reload:${request}:${started ? 'started' : 'refused'}`, []) }
}

/** Spends rounds without recording them, so the next reload has something to load. */
const spendRounds = (weapon: WeaponState): void => {
  for (let guard = 0; guard < 2 && weapon.ammo > 0; guard++) {
    fireOnce(weapon)
    wait(weapon, 0.7)
  }
  weapon.drain()
}

const reloadSteps = (weapon: WeaponState): StepRecord[] => {
  const steps = [reloadStep(weapon, 'auto')]
  for (const request of ['full', 'one_by_one'] as const) {
    spendRounds(weapon)
    steps.push(reloadStep(weapon, request))
  }
  return steps
}

const safetyStep = (weapon: WeaponState): StepRecord => {
  weapon.setSafety(true)
  const blocked = pull(weapon)
  weapon.setSafety(false)
  return snapshot(weapon, 'safety', [blocked])
}

const FIRE_KINDS: ReadonlySet<string> = new Set(['firearm', 'launcher'])

/** A forced jam (every round faults) and the clearing of it, on a weapon of its own so the other steps keep their seeds. */
const faultSteps = (arsenal: Arsenal, id: string): StepRecord[] => {
  const weapon = arsenal.create(id, { seed: seedOf(id) })
  weapon.draw()
  wait(weapon, 1)
  weapon.drain()
  const first = fireOnce(weapon)
  wait(weapon, SETTLE_SECONDS)
  const steps = [snapshot(weapon, 'fault', first)]
  const cleared = weapon.clearFault()
  wait(weapon, 2)
  steps.push({ ...snapshot(weapon, `clear:${cleared ? 'started' : 'refused'}`, []), status: weapon.fault ?? 'none' })
  return steps
}

/** Every step of one weapon with the rule as ported: draw, safety, each fire mode, empty, the reloads it supports and a forced jam with its clearing. */
export const recordWeapon = (def: WeaponDef, clean: Arsenal, jammy: Arsenal): WeaponRecord => {
  const weapon = clean.create(def.id, { seed: seedOf(def.id) })
  const steps: StepRecord[] = []
  weapon.draw()
  wait(weapon, 1)
  steps.push(snapshot(weapon, 'draw', []))
  const action = def.action
  if (action.kind === 'firearm' && action.modes.length > 0) {
    steps.push(safetyStep(weapon))
    for (const mode of action.modes) {
      setMode(weapon, mode)
      steps.push(fireStep(weapon, `fire:${mode}`))
    }
  } else {
    if (FIRE_KINDS.has(action.kind)) steps.push(safetyStep(weapon))
    steps.push(fireStep(weapon, 'use'))
  }
  steps.push(emptyOut(weapon))
  if (FIRE_KINDS.has(action.kind) || action.kind === 'flame') steps.push(...reloadSteps(weapon))
  if (action.kind === 'throwable') steps.push(reloadStep(weapon, 'auto'))
  if (FIRE_KINDS.has(action.kind)) steps.push(...faultSteps(jammy, def.id))
  return { id: def.id, steps }
}

/** The whole catalogue, in the order of the arsenal: the two arsenals differ only in the rule that forces a jam. */
export const recordCatalogue = (): WeaponRecord[] => {
  const clean = createArsenal({ rules: { faults: false } })
  const jammy = createArsenal({ rules: { faults: true, faultChance: () => 1 } })
  return [...clean.weapons.values()].map((def) => recordWeapon(def, clean, jammy))
}
