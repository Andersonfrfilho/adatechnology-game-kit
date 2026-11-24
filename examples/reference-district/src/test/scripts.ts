import type { PlanPoint } from '@adatechnology/game-urban'

import {
  DataError,
  readBoolean,
  readField,
  readList,
  readInteger,
  readNumber,
  readOneOf,
  readOptional,
  readPositive,
  readPositiveInteger,
  readPoint,
  readRecord,
  readShare,
  readStrict,
  readString,
} from '../game/read'
import type { Reader } from '../game/read'

export const SCENARIO_IDS = ['tipico', 'pior', 'caos'] as const
export type ScenarioId = (typeof SCENARIO_IDS)[number]

export const SCRIPT_IDS = ['street', 'crossing'] as const
export type ScriptId = (typeof SCRIPT_IDS)[number]

/** The closed list of event kinds; each one is run by the package named in the design. */
export const EVENT_KINDS = ['shoot', 'throw', 'detonate', 'fire_line', 'horde_release', 'vehicle_drive', 'door', 'open_container'] as const
export type EventKind = (typeof EVENT_KINDS)[number]

/** Gaps of the SDK (spec 011 §3.1): an event that needs one is kept in the script, marked, and the phase records "pending". */
export type PendingLimit = 'L15' | 'L16' | 'L17'

export type ScenarioSettings = {
  readonly zombies: number
  readonly weather: 'overcast' | 'rain'
  readonly timeOfDay: 'day' | 'night'
  /** Marks a value the spec does not fix. */
  readonly note?: string
}

export type CameraCue = { readonly at: number; readonly mode: 'shoulder' | 'first' | 'vehicle' }
export type PathPoint = { readonly at: number; readonly x: number; readonly z: number }
export type Phase = { readonly id: string; readonly from: number; readonly to: number }

type EventBase = { readonly at: number; readonly pending?: PendingLimit; readonly note?: string }

export type ScriptEvent = EventBase &
  (
    | { readonly kind: 'shoot'; readonly shooter: 'player' | 'police'; readonly weapon: string; readonly to: PlanPoint; readonly shots: number }
    | { readonly kind: 'throw'; readonly explosive: string; readonly to: PlanPoint }
    | { readonly kind: 'detonate'; readonly explosive: string; readonly to: PlanPoint }
    | { readonly kind: 'fire_line'; readonly points: readonly PlanPoint[] }
    /** `share` is the part of the scenario's zombies released at once, in (0, 1]. */
    | { readonly kind: 'horde_release'; readonly zone: string; readonly share: number }
    | { readonly kind: 'vehicle_drive'; readonly vehicle: string; readonly path: readonly PlanPoint[]; readonly speed: number }
    | { readonly kind: 'door'; readonly door: string; readonly open: boolean }
    | { readonly kind: 'open_container'; readonly container: string }
  )

export type Script = {
  readonly id: ScriptId
  readonly scenarios: readonly ScenarioId[]
  readonly seed: number
  readonly camera: readonly CameraCue[]
  readonly path: readonly PathPoint[]
  readonly phases: readonly Phase[]
  readonly events: readonly ScriptEvent[]
}

export type Scripts = {
  readonly scenarios: Readonly<Record<ScenarioId, ScenarioSettings>>
  readonly scripts: readonly Script[]
}

const readScenarioSettings: Reader<ScenarioSettings> = (value, path) => {
  const record = readStrict(['zombies', 'weather', 'timeOfDay', 'note'])(value, path)
  return {
    zombies: readField(record, path, 'zombies', readPositiveInteger),
    weather: readField(record, path, 'weather', readOneOf(['overcast', 'rain'])),
    timeOfDay: readField(record, path, 'timeOfDay', readOneOf(['day', 'night'])),
    note: readOptional(record, path, 'note', readString),
  }
}

const readCameraCue: Reader<CameraCue> = (value, path) => {
  const record = readStrict(['at', 'mode'])(value, path)
  return { at: readField(record, path, 'at', readNumber), mode: readField(record, path, 'mode', readOneOf(['shoulder', 'first', 'vehicle'])) }
}

const readPathPoint: Reader<PathPoint> = (value, path) => {
  const record = readStrict(['at', 'x', 'z'])(value, path)
  return { at: readField(record, path, 'at', readNumber), x: readField(record, path, 'x', readNumber), z: readField(record, path, 'z', readNumber) }
}

const readPhase: Reader<Phase> = (value, path) => {
  const record = readStrict(['id', 'from', 'to'])(value, path)
  const phase = { id: readField(record, path, 'id', readString), from: readField(record, path, 'from', readNumber), to: readField(record, path, 'to', readNumber) }
  if (phase.to <= phase.from) throw new DataError(`${path}.to`, 'expected a time after `from`')
  return phase
}

const EVENT_KEYS: Readonly<Record<EventKind, readonly string[]>> = {
  shoot: ['shooter', 'weapon', 'to', 'shots'],
  throw: ['explosive', 'to'],
  detonate: ['explosive', 'to'],
  fire_line: ['points'],
  horde_release: ['zone', 'share'],
  vehicle_drive: ['vehicle', 'path', 'speed'],
  door: ['door', 'open'],
  open_container: ['container'],
}

function readEvent(value: unknown, path: string): ScriptEvent {
  const kind = readField(readRecord(value, path), path, 'kind', readOneOf(EVENT_KINDS))
  const record = readStrict(['at', 'kind', 'pending', 'note', ...EVENT_KEYS[kind]])(value, path)
  const base: EventBase = {
    at: readField(record, path, 'at', readNumber),
    pending: readOptional(record, path, 'pending', readOneOf(['L15', 'L16', 'L17'])),
    note: readOptional(record, path, 'note', readString),
  }
  const text = (key: string): string => readField(record, path, key, readString)
  const point = (key: string): PlanPoint => readField(record, path, key, readPoint)
  switch (kind) {
    case 'shoot':
      return { ...base, kind, shooter: readField(record, path, 'shooter', readOneOf(['player', 'police'])), weapon: text('weapon'), to: point('to'), shots: readField(record, path, 'shots', readPositiveInteger) }
    case 'throw':
      return { ...base, kind, explosive: text('explosive'), to: point('to') }
    case 'detonate':
      return { ...base, kind, explosive: text('explosive'), to: point('to') }
    case 'fire_line':
      return { ...base, kind, points: readField(record, path, 'points', readList(readPoint, 2)) }
    case 'horde_release':
      return { ...base, kind, zone: text('zone'), share: readField(record, path, 'share', readShare) }
    case 'vehicle_drive':
      return { ...base, kind, vehicle: text('vehicle'), path: readField(record, path, 'path', readList(readPoint, 2)), speed: readField(record, path, 'speed', readPositive) }
    case 'door':
      return { ...base, kind, door: text('door'), open: readField(record, path, 'open', readBoolean) }
    case 'open_container':
      return { ...base, kind, container: text('container') }
  }
}

const readScript: Reader<Script> = (value, path) => {
  const record = readStrict(['id', 'scenarios', 'seed', 'camera', 'path', 'phases', 'events'])(value, path)
  return {
    id: readField(record, path, 'id', readOneOf(SCRIPT_IDS)),
    scenarios: readField(record, path, 'scenarios', readList(readOneOf(SCENARIO_IDS))),
    seed: readField(record, path, 'seed', readInteger),
    camera: readField(record, path, 'camera', readList(readCameraCue)),
    path: readField(record, path, 'path', readList(readPathPoint)),
    phases: readField(record, path, 'phases', readList(readPhase)),
    events: readField(record, path, 'events', readList(readEvent)),
  }
}

/** Checks the parsed JSON of a scripts file; an error names the field (`$.scripts[1].events[4].at`). */
export function parseScripts(json: unknown): Scripts {
  const record = readStrict(['scenarios', 'scripts'])(json, '$')
  const scenarios = readField(record, '$', 'scenarios', readStrict(SCENARIO_IDS))
  return {
    scenarios: {
      tipico: readField(scenarios, '$.scenarios', 'tipico', readScenarioSettings),
      pior: readField(scenarios, '$.scenarios', 'pior', readScenarioSettings),
      caos: readField(scenarios, '$.scenarios', 'caos', readScenarioSettings),
    },
    scripts: readField(record, '$', 'scripts', readList(readScript)),
  }
}
