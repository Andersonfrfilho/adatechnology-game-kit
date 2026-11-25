/**
 * The hands and the weapon in the room (`planHands` of game-player, the owner's rule of 2026-11-24): a thing picked up in one hand goes in the free hand and the weapon stays in
 * its own; a thing that takes both hands first puts the weapon away in a slot the body wears (`slots`) or drops it on the floor as the world item it is; when the hands let go,
 * what was put away comes back to the hand. The room says what is in each hand and does the moving; this decides and remembers.
 */
import type * as THREE_NS from 'three'
import type { HandPose, HandTargets, ToolHand } from '@adatechnology/game-contracts'
import { drawBackOf, interactionHandsFor, planHands } from '@adatechnology/game-player'
import type { BodyHand, HandsPlan } from '@adatechnology/game-player'
import { weaponHandsOf } from '@adatechnology/game-weapons'
import type { Arsenal } from '@adatechnology/game-weapons'

/** The slots the body wears when the page names none: a holster at the hip, no sling for a long gun. */
export const DEFAULT_BODY_SLOTS: readonly string[] = ['hip']

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
  /** The world object the weapon in hand was picked up as (null: a weapon of the hotbar): kept aside while it is put away, put down with its damage when it drops. */
  readonly carried: { get(): TCarried | null; set(carried: TCarried | null): void; putDown(): void }
  /** Puts an item of the catalogue at the feet. */
  place(item: { readonly itemId: string; readonly name: string }): void
  /** Tells the player and the log what happened: a weapon put away in `slot`, dropped (`fell` false: there was no item to drop), or drawn back. */
  report(event: { readonly type: 'holster' | 'drop' | 'draw'; readonly weapon: string; readonly hand: BodyHand; readonly slot?: string; readonly fell?: boolean }): void
  /** The slots the body wears; default `DEFAULT_BODY_SLOTS`. */
  readonly slots?: readonly string[] | undefined
}

export type HeldHands = {
  /** The interaction starts: a thing of `massKg` and `size` (metres), or a number of hands (a push takes 2). Answers which hand takes it and what happened to the weapons. */
  begin(what: { readonly massKg: number; readonly size?: readonly number[] } | 1 | 2): HandsPlan
  /** The interaction ends: what was put away comes back; what fell stays on the floor. */
  end(): void
  /** The hand the current interaction takes, or null with none going on. */
  readonly hand: BodyHand | 'both' | null
  /** The slots the body wears (`hip`, `back`...). */
  slots: readonly string[]
  /** The hand targets of the weapon with the left hand on the thing it carries (the off-hand carry); null when the left hand is not carrying alone. */
  withCarry(targets: HandTargets | null, carry: HandPose | null): HandTargets | null
  /** Where the left hand holds the thing it carries alone (the last `withCarry`), written into `out`; null when the left hand is not carrying alone. */
  carryAt(out: THREE_NS.Vector3): THREE_NS.Vector3 | null
  /**
   * Draws the carried thing on `layer` (the first-person layer in first person: framed with the arms that hold it, by the lens of the tool in the other hand), and back on the
   * world's when the hands let go.
   */
  drawOn(root: THREE_NS.Object3D, layer: number): void
}

export const createHeldHands = <TCarried extends { readonly weaponId: string }>(host: HeldHandsHost<TCarried>): HeldHands => {
  let plan: HandsPlan | null = null
  const stashed = new Map<string, TCarried>()
  const stash = (weapon: string): TCarried | null => {
    const carried = host.carried.get()
    if (carried?.weaponId !== weapon) return null
    host.carried.set(null)
    return carried
  }
  /** The world object of the weapon falls at the feet: the one picked up, with its damage, or the catalogue's item for a weapon of the hotbar. */
  const drop = (weapon: string): boolean => {
    if (host.carried.get()?.weaponId === weapon) {
      host.carried.putDown()
      return true
    }
    const item = host.catalog.find((entry) => entry.weapon === weapon)
    if (!item) return false
    host.place({ itemId: item.id, name: item.name ?? weapon })
    if (host.loadout.includes(weapon)) host.loadout.splice(host.loadout.indexOf(weapon), 1)
    return true
  }
  let carry: HandPose | null = null
  let drawn: { readonly root: THREE_NS.Object3D; readonly layer: number } | null = null
  const setLayer = (root: THREE_NS.Object3D, layer: number): void => root.traverse((node) => node.layers.set(layer))
  const held: HeldHands = {
    slots: host.slots ?? DEFAULT_BODY_SLOTS,
    get hand() {
      return plan?.hand ?? null
    },
    begin(what) {
      if (plan) held.end()
      const hands = typeof what === 'number' ? what : interactionHandsFor(what)
      const now = host.inHand()
      const weaponOf = (id: string | null) => (id ? { id, ...weaponHandsOf(host.arsenal, id) } : null)
      const next = planHands({ hands, weapons: { R: weaponOf(now.R), L: weaponOf(now.L) }, slots: held.slots })
      // the off hand first: the weapon hand's own put-away clears the off hand with it
      for (const move of [...next.moves].reverse()) {
        if (move.move === 'holster') {
          const carried = stash(move.weapon)
          if (carried !== null) stashed.set(move.weapon, carried)
          host.equip(move.hand, null)
          host.report({ type: 'holster', weapon: move.weapon, hand: move.hand, slot: move.slot ?? '' })
          continue
        }
        const fell = drop(move.weapon)
        host.equip(move.hand, null)
        host.report({ type: 'drop', weapon: move.weapon, hand: move.hand, fell })
      }
      plan = next
      return next
    },
    end() {
      const done = plan
      plan = null
      carry = null
      if (drawn && drawn.layer !== 0) setLayer(drawn.root, 0)
      drawn = null
      if (!done) return
      for (const back of drawBackOf(done)) {
        const carried = stashed.get(back.weapon)
        stashed.delete(back.weapon)
        host.equip(back.hand, back.weapon)
        if (carried !== undefined) host.carried.set(carried)
        host.report({ type: 'draw', weapon: back.weapon, hand: back.hand })
      }
    },
    withCarry(targets, pose) {
      carry = plan?.hand === 'L' ? pose : null
      return carry ? { ...(targets ?? {}), L: carry, gripL: 0.85, elbows: 'body' } : null
    },
    carryAt(out) {
      return carry && plan?.hand === 'L' ? out.set(carry.position[0], carry.position[1], carry.position[2]) : null
    },
    drawOn(root, layer) {
      if (drawn?.root === root && drawn.layer === layer) return
      setLayer(root, layer)
      drawn = { root, layer }
    },
  }
  return held
}

/** Where the left hand holds a thing it carries alone: low and ahead of the left shoulder, the fingers forward and the thumb up, turned with the body (`yaw`, the view down -z at 0). */
export const offHandCarryPose = (shoulder: readonly [number, number, number], yaw: number, hand: ToolHand = 'L'): HandPose => {
  const forward: [number, number, number] = [-Math.sin(yaw), 0, -Math.cos(yaw)]
  const side = hand === 'L' ? -1 : 1
  const outward: [number, number, number] = [Math.cos(yaw) * side, 0, -Math.sin(yaw) * side]
  const position: [number, number, number] = [shoulder[0] + forward[0] * 0.3 - outward[0] * 0.04, shoulder[1] - 0.4, shoulder[2] + forward[2] * 0.3 - outward[2] * 0.04]
  // hand-local x along the fingers (forward), y the back of the hand (outward), z up for a left hand's thumb
  return { position, quaternion: quaternionOfBasis(forward, outward, [0, side === -1 ? 1 : -1, 0]) }
}

const quaternionOfBasis = (x: readonly number[], y: readonly number[], z: readonly number[]): [number, number, number, number] => {
  const [m00, m10, m20] = x as [number, number, number]
  const [m01, m11, m21] = y as [number, number, number]
  const [m02, m12, m22] = z as [number, number, number]
  const trace = m00 + m11 + m22
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
}
