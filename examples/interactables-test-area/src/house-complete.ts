// The whole house in the furniture room (`?area=house_complete`): every catalogue id of what a house of the kit can hold, taken from the SDK's own lists (the household
// types, the residential furniture of the house plans and the goods the house keeps), each with its name on the floor, to look at, use, pick up, shoot and break one
// by one. The area has no items of its own: every piece is the owning module's, by its catalogue id. An id the room does not have is said in the log and fails the
// scenario, so a piece added to the SDK that does not reach the room breaks the check.
import type { GroundLayout, ModuleArea, ModuleHost, ModuleScenario, TestableItem, TestableModule } from '@adatechnology/game-contracts'
import type { ItemSize, ScenarioContext, SpawnedObject } from '@adatechnology/game-test-room'
import type * as ThreeNamespace from 'three'

import type { Locale } from './house-tables-data.js'
import { PLAN_FURNITURE_WITHOUT_PIECE, houseCatalogue, houseCatalogueIds, layHouseComplete, planCatalogueTypes } from './house-complete-layout.js'
import type { HouseCompleteLayout } from './house-complete-layout.js'

export const HOUSE_COMPLETE_ID = 'house_complete'
/** Type of the log entry that names the catalogue ids the area could not lay. */
export const HOUSE_COMPLETE_MISSING_LOG = 'house_complete_missing'
/** Type of the log entry with what each piece answered (`HouseItemTrial`). */
export const HOUSE_COMPLETE_TRIAL_LOG = 'house_complete_trial'

/** The page's floor for this area is 40 m each way: the lines run 34 m to each side, from z = 36 back. */
const PLAN = { halfX: 34, firstZ: 36 } as const
const SHOT_TOOL = 'pistol_9mm'
const BLOW_ENERGY = 2500
const MAX_BLOWS = 12

export interface HouseCompleteOptions {
  readonly locale?: string
  readonly measure: (itemId: string) => ItemSize | null
  readonly nameOf: (itemId: string) => string
  readonly floorFront: () => number
}

/** What one piece answered to each trial: the aim named it, a door or drawer opened, the hands picked it up, a shot reached it, blows broke it. */
export interface HouseItemTrial {
  readonly item: string
  readonly looked: boolean
  /** null when the piece has nothing to open. */
  readonly used: boolean | null
  readonly picked: boolean
  readonly shot: boolean
  readonly broken: boolean
  /** What a trial threw, if one did (that trial counts as failed). */
  readonly errors: readonly string[]
}

type Room = ScenarioContext['room']
type Step = ScenarioContext['step']
type Triple = [number, number, number]
type Three = typeof ThreeNamespace
/** What a trial works with: the room, its clock and the three.js the room was made with. */
interface Trial {
  readonly room: Room
  readonly step: Step
  readonly THREE: Three
}

const localeOf = (locale: string | undefined): Locale => (locale === 'en' ? 'en' : 'pt-BR')

/** The centre of what is drawn of a piece, and the size of its box. */
function boxOf(THREE: Three, so: SpawnedObject): { centre: Triple; size: Triple } {
  const box = new THREE.Box3().setFromObject(so.root)
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  return { centre: [centre.x, centre.y, centre.z], size: [size.x, size.y, size.z] }
}

/** Aims from in front of the piece (+z, the player's side) at its centre, close enough to reach it. */
function aimAt({ room, THREE }: Trial, so: SpawnedObject): Triple {
  const { centre, size } = boxOf(THREE, so)
  room.look([centre[0], Math.max(centre[1], 0.4) + 0.15, centre[2] + size[2] / 2 + 1.1], centre)
  return centre
}

const isLive = (room: Room, objectId: string): boolean => room.spawned().some((so) => so.objectId === objectId)
const entriesOf = (room: Room, objectId: string): number => room.log.entries({ objectId }).length
const isHurt = (room: Room, objectId: string): boolean => (room.world.state(objectId)?.parts ?? []).some((part) => part.status !== 'intact' || part.hp < part.maxHp || part.holes.length > 0)

function tryUse(trial: Trial, so: SpawnedObject): boolean | null {
  const { room, step } = trial
  const leaves = room.leaves(so.objectId)
  if (leaves.length === 0) return null
  // a leaf a blow beside it already tore off is no longer a part of the piece: only one still on it can open
  const attached = new Set((room.world.state(so.objectId)?.parts ?? []).map((part) => part.id))
  const leaf = leaves.find((id) => attached.has(id))
  if (!leaf) return false
  aimAt(trial, so)
  room.useLeaf(so.objectId, leaf)
  step(0.8)
  return room.leafOpening(so.objectId, leaf) > 0.05
}

function tryPick(trial: Trial, so: SpawnedObject): boolean {
  const { room, step } = trial
  aimAt(trial, so)
  if (!room.grab()) return false
  step(0.2)
  // let go of it where it is: the hands only had to take it
  room.grab()
  step(0.3)
  return true
}

function tryShot(trial: Trial, so: SpawnedObject): boolean {
  const { room, step } = trial
  const before = entriesOf(room, so.objectId)
  room.setTool(SHOT_TOOL)
  aimAt(trial, so)
  room.use()
  step(0.35)
  return !isLive(room, so.objectId) || isHurt(room, so.objectId) || entriesOf(room, so.objectId) > before
}

function tryBreak(trial: Trial, so: SpawnedObject): boolean {
  const { room, step, THREE } = trial
  for (let blow = 0; blow < MAX_BLOWS; blow++) {
    if (!isLive(room, so.objectId)) return true
    const parts = room.world.state(so.objectId)?.parts ?? []
    if (parts.some((part) => part.status !== 'intact')) return true
    const { centre } = boxOf(THREE, so)
    room.world.hit(so.objectId, { type: 'blunt', point: [centre[0], centre[1], centre[2] + 0.05], direction: [0, -0.3, -1], energy: BLOW_ENERGY, radius: 0.25, source: 'test' })
    step(0.25)
  }
  return !isLive(room, so.objectId) || (room.world.state(so.objectId)?.parts ?? []).some((part) => part.status !== 'intact')
}

/** Every trial on one piece, in the order a player tries them: look, open, pick up, shoot, break. */
export function trialOf(trial: Trial, so: SpawnedObject): HouseItemTrial {
  const { room, step } = trial
  aimAt(trial, so)
  step(0.05)
  const errors: string[] = []
  // a trial that throws is a failed trial of that piece, said in `errors`: the next pieces are still tried
  const attempt = <T>(run: () => T, failed: T): T => {
    try {
      return run()
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      return failed
    }
  }
  const looked = room.inspect()?.objectId === so.objectId
  const used = attempt<boolean | null>(() => tryUse(trial, so), false)
  const picked = attempt(() => tryPick(trial, so), false)
  const shot = attempt(() => isLive(room, so.objectId) && tryShot(trial, so), false)
  const broken = attempt(() => tryBreak(trial, so), false)
  return { item: so.itemId, looked, used, picked, shot, broken, errors }
}

function scenariosOf(locale: Locale, layout: () => HouseCompleteLayout, three: () => Three | null): Array<ModuleScenario<ScenarioContext>> {
  const T = (pt: string, en: string): string => (locale === 'en' ? en : pt)
  return [
    {
      id: 'house_complete_catalogue',
      name: T('Casa completa: todo item de casa do SDK está na sala, com etiqueta', 'Whole house: every house item of the SDK is in the room, labelled'),
      run: ({ room, step, expect }) => {
        const spawned = room.openArea(HOUSE_COMPLETE_ID)
        step(1)
        const laid = new Set(spawned.map((so) => so.itemId))
        const absent = houseCatalogueIds().filter((id) => !laid.has(id))
        expect(absent.length === 0 && layout().missing.length === 0, T(`Itens do catálogo na sala: ${laid.size}; faltando: ${absent.length}`, `Catalogue items in the room: ${laid.size}; missing: ${absent.length}`), { absent, missing: layout().missing })
        const labels = (layout().ground.zones ?? []).filter((zone) => zone.label).length
        expect(labels >= layout().onFloor.size, T(`${labels} etiquetas no chão para ${layout().onFloor.size} peças`, `${labels} signs on the floor for ${layout().onFloor.size} pieces`))
        // a declared type that left the catalogue (or started to draw) is a stale declaration
        const declared = Object.keys(PLAN_FURNITURE_WITHOUT_PIECE)
        const stale = declared.filter((type) => !planCatalogueTypes().includes(type))
        expect(stale.length === 0, T(`Sem peça solta no SDK (declarados): ${declared.join(', ')}`, `No loose piece in the SDK (declared): ${declared.join(', ')}`), { declared: PLAN_FURNITURE_WITHOUT_PIECE, stale })
      },
    },
    {
      id: 'house_complete_trials',
      name: T('Casa completa: cada peça é vista, abre (se abre), é pega (se é leve), leva tiro e quebra', 'Whole house: each piece is seen, opens (if it opens), is picked up (if light), takes a shot and breaks'),
      run: ({ room, step, expect }) => {
        const spawned = room.openArea(HOUSE_COMPLETE_ID)
        step(1)
        const THREE = three()
        if (!THREE) {
          expect(false, T('A sala emprestou o three.js', 'The room lent its three.js'))
          return
        }
        const floor = layout().onFloor
        const trials = spawned.filter((so) => floor.has(so.itemId) || layout().onWall.has(so.itemId)).map((so) => {
          const trial = trialOf({ room, step, THREE }, so)
          room.log.add({ channel: 'action', type: HOUSE_COMPLETE_TRIAL_LOG, text: `${trial.item}: ${JSON.stringify(trial)}`, itemId: trial.item, data: { ...trial } })
          return trial
        })
        const failed = (key: 'looked' | 'shot' | 'broken'): string[] => trials.filter((trial) => !trial[key]).map((trial) => trial.item)
        const stuck = trials.filter((trial) => trial.used === false).map((trial) => trial.item)
        expect(failed('looked').length === 0, T(`Vistos pela mira: ${trials.length - failed('looked').length} de ${trials.length}`, `Seen by the aim: ${trials.length - failed('looked').length} of ${trials.length}`), { failed: failed('looked') })
        expect(stuck.length === 0, T(`Portas e gavetas que abriram: ${trials.filter((trial) => trial.used).length}; que não abriram: ${stuck.length}`, `Doors and drawers that opened: ${trials.filter((trial) => trial.used).length}; that did not: ${stuck.length}`), { stuck })
        expect(failed('shot').length === 0, T(`Levaram o tiro: ${trials.length - failed('shot').length} de ${trials.length}`, `Took the shot: ${trials.length - failed('shot').length} of ${trials.length}`), { failed: failed('shot') })
        expect(failed('broken').length === 0, T(`Quebraram: ${trials.length - failed('broken').length} de ${trials.length}`, `Broke: ${trials.length - failed('broken').length} of ${trials.length}`), { failed: failed('broken') })
        expect(true, T(`Pegos com a mão: ${trials.filter((trial) => trial.picked).length} de ${trials.length}`, `Picked up by hand: ${trials.filter((trial) => trial.picked).length} of ${trials.length}`), { picked: trials.filter((trial) => trial.picked).map((trial) => trial.item) })
      },
    },
  ]
}

/** The area module for `room.loadModule`: the layout is made the first time the area opens, when every other module is in the room, and kept. */
export function createHouseCompleteArea(options: HouseCompleteOptions): TestableModule<ScenarioContext> {
  const locale = localeOf(options.locale)
  const name = locale === 'en' ? 'Whole house (every item)' : 'Casa completa (todos os itens)'
  let made: HouseCompleteLayout | null = null
  let host: ModuleHost | null = null
  let THREE: Three | null = null
  const layout = (): HouseCompleteLayout => {
    if (made) return made
    made = layHouseComplete({ measure: options.measure, nameOf: options.nameOf, locale, plan: { ...PLAN, floorFront: options.floorFront() }, catalogue: houseCatalogue() })
    if (made.missing.length > 0) host?.log(`${name}: ${made.missing.join(', ')}`, { missing: made.missing }, HOUSE_COMPLETE_MISSING_LOG)
    return made
  }
  return {
    id: HOUSE_COMPLETE_ID,
    name,
    group: name,
    items: (): TestableItem[] => [],
    area: (): ModuleArea => layout().area,
    get ground(): GroundLayout {
      return layout().ground
    },
    attach: (lent) => {
      host = lent
      THREE = lent.THREE as Three
      return () => {
        host = null
        THREE = null
      }
    },
    scenarios: () => scenariosOf(locale, layout, () => THREE),
  }
}
