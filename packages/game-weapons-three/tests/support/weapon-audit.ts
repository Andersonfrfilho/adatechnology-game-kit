import * as THREE from 'three'
import { createToolClipPlayer, toolAnimationStep } from '@adatechnology/game-contracts'
import type { HostEvent } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import type { Arsenal, ReloadRequest, WeaponDef, WeaponEvent } from '@adatechnology/game-weapons'
import { buildToolClips } from '../../src/animation/clip-set'
import { createModelRig } from '../../src/fx/rig'
import { buildWeaponModelById, hasWeaponModel } from '../../src/models'
import { holdOfModel } from '../../src/fx/hand-hold'
import { handWorkOf } from '../../src/fx/hand-work'

/** The four ways a reload can go for one weapon, as the rule plans them: what is asked of the weapon and in what state. */
export const SCENARIOS = [
  { id: 'tactical', request: 'auto', ammo: 'partial' },
  { id: 'empty', request: 'auto', ammo: 'empty' },
  { id: 'one_by_one', request: 'one_by_one', ammo: 'partial' },
  { id: 'full', request: 'full', ammo: 'empty' },
] as const satisfies ReadonlyArray<{ id: string; request: ReloadRequest; ammo: 'partial' | 'empty' }>

export interface ReloadRun {
  scenario: (typeof SCENARIOS)[number]['id']
  /** What the rule planned: `tactical`, `empty` or `one_by_one`. */
  kind: string
  /** Seconds of the rule's reload phase. */
  seconds: number
  /** The steps the rule emits, with their second since the start. */
  stages: Array<{ stage: string; at: number }>
  /** The clip the viewmodel plays for it and its length after scaling to the rule's seconds; null when the model has none. */
  clip: { name: string; seconds: number; markers: Array<{ stage: string; at: number }> } | null
}

export interface WeaponAudit {
  id: string
  name: string
  def: WeaponDef
  family: string | undefined
  /** The builder family of the model (`pistol`, `rifle`, `boltmag`...). */
  modelFamily: string
  caliberCase: string
  /** What the hands do to the parts during the reload clips (`data/hand-work.json`): the hand, the anchor kind and the clips it works in. */
  works: Array<{ hand: 'R' | 'L'; anchor: string; part: string | null; clips: readonly string[] }>
  runs: ReloadRun[]
}

const ORIGIN: [number, number, number] = [0, 1.5, 0]
const AHEAD: [number, number, number] = [0, 0, -1]

/** The weapon drawn, with `partial` (one round fired) or no round left (every one fired). */
const prepare = (arsenal: Arsenal, id: string, ammo: 'partial' | 'empty') => {
  const weapon = arsenal.create(id, { reserve: 9999, seed: 7 })
  weapon.update(5)
  const rounds = ammo === 'empty' ? weapon.capacity + 2 : 1
  for (let shot = 0; shot < rounds && (ammo === 'empty' ? weapon.ammo > 0 : shot < 1); shot++) {
    weapon.trigger(ORIGIN, AHEAD, 0.05, false)
    weapon.update(3)
    weapon.release()
  }
  weapon.drain()
  return weapon
}

const reloadOf = (arsenal: Arsenal, def: WeaponDef, scenario: (typeof SCENARIOS)[number]): { kind: string; seconds: number; stages: Array<{ stage: string; at: number }> } | null => {
  const weapon = prepare(arsenal, def.id, scenario.ammo)
  if (scenario.ammo === 'empty' && weapon.ammo !== 0) return null
  if (!weapon.reload(scenario.request)) return null
  const phase = weapon.phase
  if (!phase) return null
  const started = weapon.drain()
  weapon.update(phase.end - phase.start + 0.5)
  const events: WeaponEvent[] = [...started, ...weapon.drain()]
  const start = events.find((event) => event.type === 'reload' && event.phase === 'start')
  if (!start || start.type !== 'reload' || start.kind === undefined) return null
  const stages = events.filter((event) => event.type === 'reload_stage').map((event) => ({ stage: (event as { stage: string }).stage, at: (event as { at: number }).at - phase.start }))
  return { kind: start.kind, seconds: Math.round((phase.end - phase.start) * 1e6) / 1e6, stages }
}

/** Plays the reload start of the host (`kind` and the seconds of the phase) on the clips of the model and reads the clip that runs. */
const clipOf = (arsenal: Arsenal, def: WeaponDef, kind: string, seconds: number): ReloadRun['clip'] => {
  const model = buildWeaponModelById(THREE, def.id)
  if (!model) return null
  const action = def.action
  const reloadFamily = action.kind === 'firearm' || action.kind === 'launcher' ? action.family : undefined
  const caseType = action.kind === 'firearm' ? (arsenal.calibers.get(action.caliber)?.caseType ?? 'rifle') : 'rifle'
  const clips = buildToolClips({ parts: model.parts, family: model.parts.family, caseType, reloadFamily })
  const player = createToolClipPlayer({ clips, rig: createModelRig(model) })
  const event: HostEvent = { type: 'reload', weapon: def.id, phase: 'start', kind, duration: seconds }
  const step = toolAnimationStep(event)
  if (!step) return null
  player.apply(step)
  const running = player.running[0]
  if (!running) return null
  const markers = (running.clip.events ?? []).filter((e) => e.type === 'stage' && typeof e.data?.stage === 'string').map((e) => ({ stage: String(e.data?.stage), at: e.t }))
  return { name: running.name, seconds: running.clip.duration, markers }
}

/** Every weapon that has a model, with the reloads the rule plans for it and the clip each one plays. */
export const auditWeapons = (arsenal: Arsenal = createArsenal({ seed: 1, rules: { faults: false } })): WeaponAudit[] => {
  const rows: WeaponAudit[] = []
  for (const def of arsenal.weapons.values()) {
    if (!hasWeaponModel(def.id)) continue
    const model = buildWeaponModelById(THREE, def.id)
    if (!model) continue
    const action = def.action
    const runs: ReloadRun[] = []
    if (action.kind === 'firearm' || action.kind === 'launcher') {
      for (const scenario of SCENARIOS) {
        const plan = reloadOf(arsenal, def, scenario)
        if (!plan) continue
        // the same plan reached by another request is one run (a tube weapon asked `auto` and `one_by_one`)
        if (runs.some((run) => run.kind === plan.kind && run.seconds === plan.seconds && run.scenario !== 'full')) continue
        runs.push({ scenario: scenario.id, ...plan, clip: clipOf(arsenal, def, plan.kind, plan.seconds) })
      }
    }
    const works = handWorkOf(THREE, model, def.id, holdOfModel(THREE, model, 1).right).map((work) => ({ hand: work.hand, anchor: work.id, part: work.part, clips: work.clips }))
    rows.push({ id: def.id, name: def.name ?? def.id, def, works, family: 'family' in action ? action.family : undefined, modelFamily: model.parts.family, caliberCase: action.kind === 'firearm' ? (arsenal.calibers.get(action.caliber)?.caseType ?? '') : '', runs })
  }
  return rows
}
