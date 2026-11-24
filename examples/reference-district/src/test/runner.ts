import type { ScenarioSettings, Script, ScriptEvent } from './scripts'
import type { CameraCue } from './scripts'
import { yawToward } from './scenario'

/** The numbers a world is told apart by at the end of a phase; `null` marks a part that could not be read then (a blast still open). */
export type WorldHash = Readonly<Record<string, number | null>>

/** What the world did with a command: it ran it, or the SDK lacks what it needs (a lacuna of the spec, never faked). */
export type ActionResult = { readonly status: 'done' } | { readonly status: 'pending'; readonly limit: string; readonly reason: string }

export type PlayerSpot = { readonly x: number; readonly z: number; readonly yaw: number; readonly vx: number; readonly vz: number }

/** What the runner needs of a world: the fixed step, the body, the camera, the events of the script and a hash. The page's one is `createScriptWorld`; the unit test's is a fake. */
export type ScriptWorld = {
  /** Seconds of one fixed step. */
  readonly tick: number
  /** One fixed step of the simulation, never wall-clock. */
  step(): void
  placePlayer(spot: PlayerSpot): void
  setCamera(mode: CameraCue['mode']): ActionResult
  act(event: ScriptEvent, context: { readonly zombies: number }): ActionResult
  hash(): WorldHash
}

export type PhaseEdge = { readonly id: string; readonly edge: 'start' | 'end'; readonly time: number }

export type RunOptions = {
  /** Called at each edge of a phase, at its world time: how the gauge learns which phase a frame belongs to. */
  readonly onPhase?: (edge: PhaseEdge) => void
}

export type EventRecord = {
  readonly index: number
  readonly kind: ScriptEvent['kind']
  readonly at: number
  readonly tick: number
  readonly status: ActionResult['status']
  /** The lacuna that stopped it, for a pending event. */
  readonly limit?: string
  /** Who marked it pending: the script file, or the world that lacks the piece. */
  readonly source?: 'script' | 'world'
}

export type CueRecord = { readonly at: number; readonly mode: CameraCue['mode']; readonly status: ActionResult['status']; readonly limit?: string }

export type PhaseRecord = { readonly id: string; readonly from: number; readonly to: number; readonly endTick: number; readonly hash: WorldHash }

export type RunResult = {
  readonly scriptId: Script['id']
  readonly seed: number
  readonly ticks: number
  readonly phases: readonly PhaseRecord[]
  readonly events: readonly EventRecord[]
  readonly cues: readonly CueRecord[]
}

type PathSample = { readonly x: number; readonly z: number; readonly vx: number; readonly vz: number }

/** The body's place at a time: the script's points joined by straight lines, held before the first and after the last. */
export function pathAt(path: Script['path'], time: number): PathSample {
  const first = path[0]
  const last = path[path.length - 1]
  if (!first || !last) throw new Error('the script has no path')
  if (time <= first.at) return { x: first.x, z: first.z, vx: 0, vz: 0 }
  if (time >= last.at) return { x: last.x, z: last.z, vx: 0, vz: 0 }
  const next = path.findIndex((point) => point.at > time)
  const from = path[next - 1]
  const to = path[next]
  if (!from || !to) throw new Error('the script path is not in time order')
  const span = to.at - from.at
  const share = (time - from.at) / span
  return { x: from.x + (to.x - from.x) * share, z: from.z + (to.z - from.z) * share, vx: (to.x - from.x) / span, vz: (to.z - from.z) / span }
}

/** The tick of the world at a time of the script (the scripts' times are multiples of the step, so this is exact). */
const tickOf = (time: number, tick: number): number => Math.round(time / tick)

type PhaseState = { readonly phase: Script['phases'][number]; readonly startTick: number; readonly endTick: number; isOpen: boolean; isClosed: boolean }

/**
 * Runs a script on a world at the fixed step: at each tick the body is put where the path says, the camera cues and the events due at that time run, then the world takes one step.
 * A phase ends, and its hash is taken, when the world's time reaches its `to` (before any event of that same time). An event the script marks pending is skipped and recorded, and so is one the
 * world answers pending. Time is counted in ticks, never read from a clock: the same script on the same world gives the same records.
 */
export function runScript(world: ScriptWorld, script: Script, scenario: ScenarioSettings, options: RunOptions = {}): RunResult {
  const { tick } = world
  const states: PhaseState[] = script.phases.map((phase) => ({ phase, startTick: Math.max(0, tickOf(phase.from, tick)), endTick: tickOf(phase.to, tick), isOpen: false, isClosed: false }))
  const ticks = Math.max(...states.map((state) => state.endTick))
  const due = script.events.map((event, index) => ({ event, index, at: tickOf(event.at, tick) })).sort((a, b) => a.at - b.at || a.index - b.index)
  const lastEvent = due[due.length - 1]
  if (lastEvent && lastEvent.at >= ticks) throw new Error(`the script "${script.id}" has an event at ${lastEvent.event.at} s, after its last phase`)

  const phases: PhaseRecord[] = []
  const events: EventRecord[] = []
  const cues: CueRecord[] = []
  const toPhase = (state: PhaseState, edge: PhaseEdge['edge'], time: number): void => options.onPhase?.({ id: state.phase.id, edge, time })
  const advancePhases = (at: number): void => {
    for (const state of states) {
      if (!state.isOpen && state.startTick <= at) {
        state.isOpen = true
        toPhase(state, 'start', at * tick)
      }
      if (state.isOpen && !state.isClosed && state.endTick <= at) {
        state.isClosed = true
        phases.push({ id: state.phase.id, from: state.phase.from, to: state.phase.to, endTick: state.endTick, hash: world.hash() })
        toPhase(state, 'end', at * tick)
      }
    }
  }
  const cueTicks = script.camera.map((cue) => tickOf(cue.at, tick))
  let nextCue = 0
  let nextEvent = 0
  let yaw = 0
  const [first, second] = script.path
  if (first && second) yaw = yawToward(first, second)

  for (let at = 0; at < ticks; at++) {
    advancePhases(at)
    const sample = pathAt(script.path, at * tick)
    if (sample.vx !== 0 || sample.vz !== 0) yaw = yawToward({ x: 0, z: 0 }, { x: sample.vx, z: sample.vz })
    world.placePlayer({ x: sample.x, z: sample.z, yaw, vx: sample.vx, vz: sample.vz })
    for (; nextCue < script.camera.length && (cueTicks[nextCue] ?? Infinity) <= at; nextCue++) {
      const cue = script.camera[nextCue]
      if (!cue) break
      const result = world.setCamera(cue.mode)
      cues.push({ at: cue.at, mode: cue.mode, status: result.status, ...(result.status === 'pending' ? { limit: result.limit } : {}) })
    }
    for (; nextEvent < due.length && (due[nextEvent]?.at ?? Infinity) <= at; nextEvent++) {
      const item = due[nextEvent]
      if (item) events.push(runEvent(world, item, at, scenario))
    }
    world.step()
  }
  advancePhases(ticks)
  return { scriptId: script.id, seed: script.seed, ticks, phases, events, cues }
}

function runEvent(world: ScriptWorld, item: { readonly event: ScriptEvent; readonly index: number }, at: number, scenario: ScenarioSettings): EventRecord {
  const { event, index } = item
  const base = { index, kind: event.kind, at: event.at, tick: at }
  if (event.pending) return { ...base, status: 'pending', limit: event.pending, source: 'script' }
  const result = world.act(event, { zombies: scenario.zombies })
  if (result.status === 'pending') return { ...base, status: 'pending', limit: result.limit, source: 'world' }
  return { ...base, status: 'done' }
}
