import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { RoomAvatar, RoomFirstPersonState, TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../../src'
import { TRIGGER_FINGER } from '../../src/fx/viewmodel'
import { buildWeaponModelById } from '../../src/models'
import { auditWeapons } from './weapon-audit'
import type { WeaponAudit } from './weapon-audit'

/** One cell of the checklist: ✓ (true), ✗ (false) or not applicable (null), with what was measured. */
export interface Check {
  ok: boolean | null
  note: string
}

export interface WeaponChecks {
  id: string
  name: string
  modelFamily: string
  /** Both hands in view and on or near the weapon. */
  support: Check
  /** The right index on the trigger part, pulling on a shot. */
  trigger: Check
  /** Tactical reload: the clip lasts the rule's seconds and its steps go in order. */
  tactical: Check
  /** Empty reload: the clip, the steps and the hand that works the action. */
  empty: Check
  /** Seconds of the rule against the clip. */
  time: Check
  /** The weapon stays in front of a wall near the eye. */
  contact: Check
  /** The cues of the reload clips have recipes and come in order. */
  sound: Check
  /** The seconds shown in the checklist. */
  seconds: { tactical: number | null; empty: number | null }
}

const stubRenderer = (): THREE.WebGLRenderer => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const WALL_DISTANCE = 0.5
const NEAR = 0.12

/** The hand work each family needs in an empty reload (the hand and the anchor kinds that may do it); null: nothing to work. */
const EMPTY_WORK: Record<string, string[] | null> = {
  pistol: ['slide_rear', 'thumb_release'],
  rifle: ['rear_top', 'side_right'],
  p90: ['rear_top'],
  boltmag: ['top_handle'],
  bolt: ['top_handle', 'loading_port'],
  pump: ['loading_port'],
  lever: ['loading_port'],
  semi12: ['loading_port'],
  semiint: null,
  belt: ['cover_top'],
  revolver: ['cylinder_side'],
  break: null,
  rocket: null,
  flame: null,
}

const sleep = (room: TestRoom, frames: number): void => {
  for (let i = 0; i < frames; i++) room.update(1 / 60)
}

const reloadChecks = (row: WeaponAudit): Pick<WeaponChecks, 'tactical' | 'empty' | 'time' | 'sound' | 'seconds'> => {
  const none: Check = { ok: null, note: 'sem recarga na regra' }
  if (row.runs.length === 0) return { tactical: none, empty: none, time: none, sound: none, seconds: { tactical: null, empty: null } }
  const tactical = row.runs.find((run) => run.scenario === 'tactical')
  const empty = row.runs.find((run) => run.scenario === 'empty')
  const clipOk = (run: typeof tactical): string[] => {
    const problems: string[] = []
    if (!run?.clip) return ['sem clipe']
    if (Math.abs(run.clip.seconds - run.seconds) > 0.05) problems.push(`clipe ${run.clip.seconds}s != regra ${run.seconds}s`)
    if (run.stages.length > 0) {
      const same = run.clip.markers.length === run.stages.length && run.stages.every((entry, index) => run.clip!.markers[index]?.stage === entry.stage && Math.abs(run.clip!.markers[index]!.at - entry.at) <= 0.05)
      if (!same) problems.push('passos do clipe diferentes dos da regra')
    }
    return problems
  }
  const cell = (run: typeof tactical, label: string): Check => {
    if (!run) return { ok: null, note: `sem recarga ${label}` }
    const problems = clipOk(run)
    return { ok: problems.length === 0, note: problems.length === 0 ? `${run.clip!.name}, ${run.kind}` : problems.join('; ') }
  }
  const tacticalCell = cell(tactical, 'tática')
  const emptyCell = cell(empty, 'vazia')
  // the empty reload works the action: the hand that does it has to be in the data for the clip that plays
  const needs = EMPTY_WORK[row.modelFamily]
  if (empty && emptyCell.ok && empty.kind === 'empty' && needs) {
    const clipName = empty.clip!.name
    // a tube is loaded round by round (the `feed` clip, one visit of the hand to the port each) and its empty clip is the action worked after the last
    const names = ['pump', 'lever', 'semi12'].includes(row.modelFamily) ? [clipName, 'feed'] : [clipName]
    const works = row.works.filter((work) => needs.includes(work.anchor) && names.some((name) => work.clips.includes(name)))
    if (works.length === 0) {
      emptyCell.ok = false
      emptyCell.note = `nenhuma mão trabalha a ação no clipe ${clipName}`
    } else emptyCell.note += `; ${works.map((work) => `${work.hand} ${work.anchor}`).join(', ')}`
  }
  const timeProblems = row.runs.flatMap((run) => (run.clip && Math.abs(run.clip.seconds - run.seconds) <= 0.05 ? [] : [`${run.scenario}`]))
  const timeCell: Check = { ok: timeProblems.length === 0, note: row.runs.map((run) => `${run.scenario} ${run.seconds}s`).join(', ') }
  const soundProblems: string[] = []
  for (const run of row.runs) {
    const byFeed = run.kind === 'one_by_one' && ['pump', 'lever', 'semi12'].includes(row.modelFamily)
    const cues = run.clip?.cues ?? []
    if (cues.length === 0 && !byFeed) soundProblems.push(`${run.scenario}: sem cues`)
    const ordered = cues.every((cue, index) => index === 0 || cue.at >= cues[index - 1]!.at)
    if (!ordered) soundProblems.push(`${run.scenario}: cues fora de ordem`)
    if (cues.some((cue) => cue.at > run.seconds + 1e-6)) soundProblems.push(`${run.scenario}: cue depois do fim`)
  }
  const soundCell: Check = { ok: soundProblems.length === 0, note: soundProblems.length === 0 ? row.runs.map((run) => `${run.scenario} ${run.clip?.cues.length ?? 0}`).join(', ') : soundProblems.join('; ') }
  return { tactical: tacticalCell, empty: emptyCell, time: timeCell, sound: soundCell, seconds: { tactical: tactical?.seconds ?? null, empty: empty?.seconds ?? null } }
}

/** Runs every check on every weapon with a model: the hands and the trigger finger and the wall in the room with the weapon in the hands, the reload and the sound from the clips the audit plays. */
export const checkWeapons = (): WeaponChecks[] => {
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const audit = auditWeapons(arsenal)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  const module = createWeaponsTestModule({ locale: 'en', sound: false, arsenal })
  if (room.loadModule(module).problems.length > 0) throw new Error('the weapons module did not load')
  let state: RoomFirstPersonState | null = null
  const current = (): RoomFirstPersonState | null => state
  const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, firstPerson: { root: new THREE.Group(), update: (_dt, next) => void (state = { ...next }) }, strike: () => null }
  room.setAvatar(avatar)
  room.look([0, 1.7, 5], [0, 1.2, -11])
  const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 0.1), new THREE.MeshStandardMaterial())
  const eye = (): THREE.Vector3 => state!.camera.getWorldPosition(new THREE.Vector3())
  const forward = (): THREE.Vector3 => new THREE.Vector3(0, 0, -1).applyQuaternion(state!.camera.getWorldQuaternion(new THREE.Quaternion()))

  const results: WeaponChecks[] = []
  for (const row of audit) {
    const reload = reloadChecks(row)
    const checks: WeaponChecks = {
      id: row.id,
      name: row.name,
      modelFamily: row.modelFamily,
      support: { ok: null, note: '' },
      trigger: { ok: null, note: '' },
      contact: { ok: null, note: '' },
      ...reload,
    }
    room.setTool(row.id)
    sleep(room, 40)
    const held = room.scene.getObjectByName('weapon-viewmodel')
    const targets = current()?.targets ?? null
    if (!held || !targets) {
      checks.support = { ok: false, note: 'sem alvos de mão' }
      checks.trigger = { ok: false, note: 'sem arma na mão' }
      checks.contact = { ok: false, note: 'sem arma na mão' }
      results.push(checks)
      continue
    }

    // the hands: both there, in front of the eye, in view, and on or near the weapon
    const camera = state!.camera as THREE.PerspectiveCamera
    camera.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(held)
    const problems: string[] = []
    const distances: string[] = []
    for (const side of ['R', 'L'] as const) {
      const target = targets[side]
      if (!target) {
        problems.push(`mão ${side} ausente`)
        continue
      }
      const at = new THREE.Vector3(...target.position)
      const projected = at.clone().project(camera)
      if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) problems.push(`mão ${side} fora da vista (${projected.x.toFixed(2)}, ${projected.y.toFixed(2)}, ${projected.z.toFixed(2)})`)
      const away = box.distanceToPoint(at)
      distances.push(`${side} ${(away * 100).toFixed(0)} cm`)
      if (away > NEAR) problems.push(`mão ${side} a ${(away * 100).toFixed(0)} cm da arma`)
    }
    checks.support = { ok: problems.length === 0, note: problems.length === 0 ? distances.join(', ') : problems.join('; ') }

    // the weapon against a wall half a metre from the eye
    const from = eye()
    const ahead = forward()
    wall.position.copy(from).addScaledVector(ahead, WALL_DISTANCE + 0.05)
    wall.lookAt(from)
    room.scene.add(wall)
    sleep(room, 90)
    wall.updateMatrixWorld(true)
    const stuck = new THREE.Box3().setFromObject(held)
    let farthest = 0
    for (const x of [stuck.min.x, stuck.max.x]) for (const y of [stuck.min.y, stuck.max.y]) for (const z of [stuck.min.z, stuck.max.z]) farthest = Math.max(farthest, new THREE.Vector3(x, y, z).sub(from).dot(ahead))
    const inFront = farthest <= WALL_DISTANCE + 0.005
    checks.contact = { ok: inFront, note: inFront ? `alcance ${farthest.toFixed(2)} m com a parede a ${WALL_DISTANCE} m` : `atravessa: alcance ${farthest.toFixed(2)} m com a parede a ${WALL_DISTANCE} m` }
    room.scene.remove(wall)
    sleep(room, 90)

    // the trigger finger
    const model = buildWeaponModelById(THREE, row.id)
    const finger = (): number | undefined => state!.targets?.fingers?.index
    if (model?.parts.trigger) {
      const rest = finger()
      // a minigun spins up and a flamethrower burns while the trigger is held
      room.use(row.def.action.kind === 'flame' || row.id === 'm134' ? 1 : undefined)
      let highest = 0
      for (let i = 0; i < 40; i++) {
        room.update(1 / 60)
        highest = Math.max(highest, finger() ?? 0)
      }
      sleep(room, 60 * 4)
      const back = finger()
      const ok = rest !== undefined && Math.abs(rest - TRIGGER_FINGER.safe) < 0.05 && highest > TRIGGER_FINGER.ready && back !== undefined && Math.abs(back - TRIGGER_FINGER.safe) < 0.05
      checks.trigger = { ok, note: `repouso ${rest?.toFixed(2)}, tiro ${highest.toFixed(2)}, depois ${back?.toFixed(2)}` }
    } else {
      const none = finger() === undefined
      checks.trigger = { ok: none ? null : false, note: none ? 'sem peça de gatilho no modelo: empunhadura normal' : 'dedo estendido numa arma sem gatilho' }
    }
    results.push(checks)
  }
  return results
}
