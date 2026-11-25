/**
 * The hands and the weapon in the room (`planHands` of game-player, the owner's rules of 2026-11-24 and 2026-11-25): a thing picked up in one hand goes in the free hand and the
 * weapon stays in its own; a thing that takes both hands, or a two-handed weapon, first puts the weapon away in a slot the body wears (`slots`), swings a long gun onto its sling,
 * or tosses it to the floor as the world item it is. Each move is seen (`planTakeSequence`): the weapon goes off the hand, then the hand reaches the thing, closes on it and lifts it.
 * When the hands let go, what was holstered comes back to the hand; a gun on its sling hangs there until `drawBack` (the H key). The room says what is in each hand and does the
 * moving; this decides, keeps the time and remembers.
 */
import type * as THREE_NS from 'three'
import type { HandPose, HandTargets, HostEvent } from '@adatechnology/game-contracts'
import { SLING_SLOT, createTakeTimeline, drawBackOf, gripOfItem, interactionHandsFor, planDrawSequence, planHands, planTakeSequence } from '@adatechnology/game-player'
import type { BodyHand, HandsMove, HandsPlan, HandsTiming, ItemGrip, Pose, TakeProgress, TakeTimeline } from '@adatechnology/game-player'
import { weaponHandsOf } from '@adatechnology/game-weapons'
import type { Arsenal } from '@adatechnology/game-weapons'

import { takeMotionOf } from './take-motion'
import type { TakePhase } from './take-motion'

/** The slots the body wears when the page names none: a holster at the hip and the long gun's own sling. */
export const DEFAULT_BODY_SLOTS: readonly string[] = ['hip', 'sling']

/** What the room is told, for the player, the log and the modules that draw weapons on the body. `toss` is the start of a `drop`, seen; `drop` is the weapon on the floor. */
export type HeldHandsReport = {
  readonly type: 'holster' | 'sling' | 'toss' | 'drop' | 'draw'
  readonly weapon: string
  readonly hand: BodyHand
  readonly slot?: string
  /** `drop`: false when there was no item to drop. */
  readonly fell?: boolean
  /** The weapon hand on its grip as the weapon leaves it, and how long the move takes. */
  readonly from?: HandPose
  readonly seconds?: number
}

/** The `holster` event a report is for a module that draws the weapons on the body, or null (`drop`: the world item is on the floor now). */
export const holsterEventOf = (report: HeldHandsReport): HostEvent | null => {
  if (report.type === 'drop') return null
  const on = report.type !== 'draw'
  const slot = report.type === 'toss' ? 'ground' : (report.slot ?? '')
  return { type: 'holster', weapon: report.weapon, slot, on, ...(report.from ? { from: report.from } : {}), ...(report.seconds === undefined ? {} : { seconds: report.seconds }) }
}

/** A long gun carries its own sling: wherever the body has places for weapons, it hangs on it; a body with none (`[]`) drops everything. */
export const withSling = (slots: readonly string[]): readonly string[] => (slots.length > 0 && !slots.includes(SLING_SLOT) ? [...slots, SLING_SLOT] : slots)

export type HeldHandsHost<TCarried extends { readonly weaponId: string }> = {
  readonly arsenal: Pick<Arsenal, 'weapons' | 'rules'>
  /** The hotbar: a weapon dropped leaves it (it is on the floor now), and comes back when it is picked up. */
  readonly loadout: string[]
  /** The items of the room: the one whose `weapon` is the dropped weapon falls at the feet. */
  readonly catalog: readonly { readonly id: string; readonly name?: string; readonly weapon?: string }[]
  /** What each hand holds now (`L` null with nothing in the left hand). */
  inHand(): { readonly R: string; readonly L: string | null }
  /** Puts `weapon` in `hand`; null leaves the hand bare. */
  equip(hand: BodyHand, weapon: string | null): void
  /** Where a hand holds the weapon in it now (the module's hand targets), for the move to start from the hand. */
  handPose?(hand: BodyHand): HandPose | null
  /** The world object the weapon in hand was picked up as (null: a weapon of the hotbar): kept aside while it is put away, put down with its damage when it drops. */
  readonly carried: { get(): TCarried | null; set(carried: TCarried | null): void; putDown(): void }
  /** Puts an item of the catalogue at the feet. */
  place(item: { readonly itemId: string; readonly name: string }): void
  report(event: HeldHandsReport): void
  /** The slots the body wears; default `DEFAULT_BODY_SLOTS`. */
  readonly slots?: readonly string[] | undefined
  /** Seconds of each move; default `HANDS_TIMING` of game-player. */
  readonly timing?: HandsTiming
  /** True with no body whose hands could be seen (no shoulders): every move then happens at once. */
  instant?(): boolean
}

/** Every move at once: a room with no body has no hands to see moving. */
export const INSTANT_HANDS: HandsTiming = { stow: 0, sling: 0, drop: 0, reach: 0, close: 0, lift: 0, draw: 0 }

/** A thing to take: where it lies now and its box; `taken` makes it held, once the fingers closed on it. */
export type TakeRequest = {
  readonly item: () => Pose | null
  readonly size: readonly [number, number, number]
  readonly taken: () => void
}

export type CarryParams = {
  readonly shoulder: (hand: BodyHand) => readonly number[] | null
  readonly yaw: number
  /** The targets of the weapon in hand, kept for the other hand: asked only while a thing is taken or held. */
  readonly tool: () => HandTargets | null
  readonly turn?: { readonly yaw: number; readonly tilt: number }
}

export type HeldHands = {
  /** The interaction starts: a thing of `massKg` and `size` (metres), or a number of hands (a push takes 2). With `take`, the hand goes on to take the thing once the weapons are off it. */
  begin(what: { readonly massKg: number; readonly size?: readonly number[] } | 1 | 2, take?: TakeRequest): HandsPlan
  /** The interaction ends (or a take is called off): what was holstered comes back; a slung gun stays on its sling, what fell stays on the floor. */
  end(): void
  /** Moves the steps on by the frame's `dt`. */
  update(dt: number): void
  /** Brings the weapons on the body back to the hands (the H key), all of them, those already on their way included. False with none there or with the hands taken. */
  drawBack(): boolean
  /** A take going on: the hands are on their way to the thing. */
  readonly busy: boolean
  /** The weapons on the body now (holstered or slung). */
  readonly away: readonly string[]
  /** The hand the current interaction takes, or null with none going on. */
  readonly hand: BodyHand | 'both' | null
  /** The slots the body wears (`hip`, `sling`, `back`...). */
  slots: readonly string[]
  /** The hands on the thing being taken or carried (null with none), and where the thing goes (`item`). Call once a frame before reading `targets` and `item`. */
  carry(params: CarryParams): HandTargets | null
  /** The targets the last `carry` gave. */
  readonly targets: HandTargets | null
  /** Where the middle of the thing held goes and its turn, from the last `carry`; null while it is not in the hands. */
  readonly item: Pose | null
  /** Draws the carried thing on `layer` (the first-person layer in first person: framed with the arms that hold it), and back on the world's when the hands let go. */
  drawOn(root: THREE_NS.Object3D, layer: number): void
}

type Taking = { readonly request: TakeRequest; readonly grip: ItemGrip; held: boolean; from: Pose | null }

export const createHeldHands = <TCarried extends { readonly weaponId: string }>(host: HeldHandsHost<TCarried>): HeldHands => {
  let plan: HandsPlan | null = null
  let timeline: TakeTimeline | null = null
  let progress: TakeProgress | null = null
  let taking: Taking | null = null
  let targets: HandTargets | null = null
  let item: Pose | null = null
  /** Weapons off the hands and where: kept to bring them back. */
  const away = new Map<string, HandsMove>()
  const stashed = new Map<string, TCarried>()
  let drawn: { readonly root: THREE_NS.Object3D; readonly layer: number } | null = null
  const setLayer = (root: THREE_NS.Object3D, layer: number): void => root.traverse((node) => node.layers.set(layer))
  const timingNow = (): HandsTiming | undefined => (host.instant?.() ? INSTANT_HANDS : host.timing)
  const stash = (weapon: string): void => {
    const carried = host.carried.get()
    if (carried?.weaponId !== weapon) return
    host.carried.set(null)
    stashed.set(weapon, carried)
  }
  /** The world object of the weapon falls at the feet: the one picked up, with its damage, or the catalogue's item for a weapon of the hotbar. */
  const drop = (weapon: string): boolean => {
    if (host.carried.get()?.weaponId === weapon) {
      host.carried.putDown()
      return true
    }
    const entry = host.catalog.find((candidate) => candidate.weapon === weapon)
    if (!entry) return false
    host.place({ itemId: entry.id, name: entry.name ?? weapon })
    if (host.loadout.includes(weapon)) host.loadout.splice(host.loadout.indexOf(weapon), 1)
    return true
  }
  /** A weapon leaves the hand: seen from where the hand holds it. */
  const leave = (move: HandsMove, seconds: number): void => {
    const from = host.handPose?.(move.hand) ?? null
    if (move.move === 'drop') {
      host.equip(move.hand, null)
      host.report({ type: 'toss', weapon: move.weapon, hand: move.hand, seconds, ...(from ? { from } : {}) })
      return
    }
    stash(move.weapon)
    host.equip(move.hand, null)
    away.set(move.weapon, move)
    host.report({ type: move.move, weapon: move.weapon, hand: move.hand, slot: move.slot ?? '', seconds, ...(from ? { from } : {}) })
  }
  const arrive = (move: HandsMove): void => {
    away.delete(move.weapon)
    host.equip(move.hand, move.weapon)
    const carried = stashed.get(move.weapon)
    stashed.delete(move.weapon)
    if (carried !== undefined) host.carried.set(carried)
  }
  /** What each step does as it begins and ends. */
  const advance = (dt: number): void => {
    if (!timeline) return
    const now = timeline.advance(dt)
    for (const step of now.started) {
      const seconds = Math.max(0, step.end - step.start)
      if (!step.move) continue
      if (step.kind === 'draw') host.report({ type: 'draw', weapon: step.move.weapon, hand: step.move.hand, slot: step.move.slot ?? '', seconds })
      else leave(step.move, seconds)
    }
    for (const step of now.ended) {
      if (step.kind === 'drop' && step.move) host.report({ type: 'drop', weapon: step.move.weapon, hand: step.move.hand, fell: drop(step.move.weapon) })
      if (step.kind === 'draw' && step.move) arrive(step.move)
      if (step.kind === 'close' && taking && !taking.held) {
        taking.held = true
        taking.from = taking.request.item()
        taking.request.taken()
      }
    }
    progress = now
    if (now.done) timeline = null
  }
  const startDraw = (moves: readonly HandsMove[]): void => {
    if (moves.length === 0) return
    timeline = createTakeTimeline(planDrawSequence(moves, timingNow()))
    advance(0)
  }
  /** Weapons still on their way back when something else starts: in hand at once. */
  const finishDraws = (): void => {
    if (!timeline) return
    for (const step of timeline.sequence.steps) if (step.kind === 'draw' && step.move && away.has(step.move.weapon)) arrive(step.move)
    timeline = null
  }
  const phaseOf = (): { phase: TakePhase; progress: number } | null => {
    if (!taking) return null
    const step = timeline ? progress?.step : null
    if (!taking.held) return step?.kind === 'reach' || step?.kind === 'close' ? { phase: step.kind, progress: progress?.progress ?? 0 } : null
    return step?.kind === 'lift' ? { phase: 'lift', progress: progress?.progress ?? 0 } : { phase: 'hold', progress: 1 }
  }
  const held: HeldHands = {
    slots: withSling(host.slots ?? DEFAULT_BODY_SLOTS),
    get hand() {
      return plan?.hand ?? null
    },
    get busy() {
      return taking !== null && !taking.held
    },
    get away() {
      return [...away.keys()]
    },
    get targets() {
      return targets
    },
    get item() {
      return item
    },
    begin(what, take) {
      if (plan) held.end()
      finishDraws()
      const hands = typeof what === 'number' ? what : interactionHandsFor(what)
      const now = host.inHand()
      const weaponOf = (id: string | null) => (id ? { id, ...weaponHandsOf(host.arsenal, id) } : null)
      // a slot already holding a weapon takes no other
      const free = held.slots.filter((slot) => ![...away.values()].some((move) => move.slot === slot))
      const next = planHands({ hands, weapons: { R: weaponOf(now.R), L: weaponOf(now.L) }, slots: free })
      plan = next
      taking = take ? { request: take, grip: gripOfItem(take.size, next.hand === 'L' ? 'L' : 'R'), held: false, from: null } : null
      const timing = timingNow()
      timeline = createTakeTimeline(planTakeSequence(next, { ...(timing ? { timing } : {}), take: take !== undefined }))
      progress = null
      advance(0)
      return next
    },
    end() {
      const done = plan
      plan = null
      taking = null
      targets = null
      item = null
      timeline = null
      if (drawn && drawn.layer !== 0) setLayer(drawn.root, 0)
      drawn = null
      if (!done) return
      // the holstered weapons come back, seen; the slung ones hang until H, the dropped ones lie on the floor
      const back = drawBackOf(done).flatMap((entry) => {
        const move = away.get(entry.weapon)
        return move && move.hand === entry.hand ? [move] : []
      })
      startDraw(back)
    },
    update(dt) {
      advance(dt)
    },
    drawBack() {
      if (plan || away.size === 0) return false
      startDraw([...away.values()])
      return true
    },
    carry(params) {
      targets = null
      item = null
      const phase = phaseOf()
      const hand = plan?.hand
      if (!phase || !taking || !hand) return null
      const lying = taking.held ? taking.from : taking.request.item()
      const motion = takeMotionOf({ hand, phase: phase.phase, progress: phase.progress, shoulder: params.shoulder, yaw: params.yaw, size: taking.request.size, item: lying, tool: params.tool(), ...(params.turn ? { turn: params.turn } : {}) }, taking.grip)
      targets = motion?.targets ?? null
      item = motion?.item ?? null
      return targets
    },
    drawOn(root, layer) {
      if (drawn?.root === root && drawn.layer === layer) return
      setLayer(root, layer)
      drawn = { root, layer }
    },
  }
  return held
}
