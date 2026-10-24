import type { CharacterKit, CharacterPack, CharacterSpec, DamageCharacter, GaitProfile } from '@adatechnology/game-characters'
import type { Vec3 } from '@adatechnology/game-contracts'

import type { CharacterSoundOptions } from '../audio/sound'
import type { BloodLook, BloodSink, FilmSink } from '../wounds/fluids-bridge'

/** One undead type as the area needs it: the content pack's own record has all of these fields. */
export type UndeadCard = {
  readonly id: string
  readonly name: Readonly<Record<string, string>>
  readonly eye: { readonly color: string }
  readonly gait: Readonly<Record<string, number | boolean>>
}

/** A profession of the people pack (look, accessories, what it holds). */
export type ProfessionCard = {
  readonly id: string
  readonly name: Readonly<Record<string, string>>
  readonly female?: boolean
  readonly look: {
    readonly skin: string
    readonly hair: { readonly style: string; readonly color: string }
    readonly hat?: { readonly kind: string; readonly color: string }
    readonly face?: readonly string[]
    readonly top: { readonly color: string; readonly sleeve: string; readonly plaid?: string }
    readonly pants: { readonly color: string }
    readonly shoes: string
  }
  readonly accessories: readonly { readonly id: string; readonly color?: string }[]
  readonly hand?: string
  readonly leftHand?: string
}

/** The part of the undead engine the area uses (`createUndead(kit)` has all of it). */
export type UndeadLike = {
  create(spec: Pick<CharacterSpec, 'seed'> & Partial<CharacterSpec>, options?: { readonly type?: string }): DamageCharacter
  turn(person: DamageCharacter, options?: { readonly type?: string }): DamageCharacter
  traitsOf(character: DamageCharacter): { readonly type: string; readonly age?: string; readonly speeds: Readonly<Record<string, number>> } | undefined
  speedFor(traits: { readonly type: string; readonly speeds: Readonly<Record<string, number>> }, context: { readonly moment: string; readonly limp?: boolean; readonly crawling?: boolean }): number
  onDeath?(character: DamageCharacter): readonly { readonly kind: string }[]
  infect?(wound: 'bite' | 'scratch' | 'laceration' | undefined, random: () => number): { advance(seconds: number): unknown; readonly reanimated: boolean } | undefined
}

export type CharactersTestOptions = {
  /** `en` or `pt-BR` (default). */
  readonly locale?: string
  /** Builds the kit the area uses; called again when the bench changes the penetration model or the death rule. Default `createCharacters` with `packs`. */
  readonly createKit?: (options: { readonly penetration: 'physical' | 'team-game'; readonly deathRule: 'vitality-or-head' | 'head-only' }) => CharacterKit
  /** Packs for the default kit (people, uniformed, undead). */
  readonly packs?: readonly CharacterPack[]
  readonly undeadTypes?: readonly UndeadCard[]
  readonly createUndead?: (kit: CharacterKit) => UndeadLike
  readonly professions?: readonly ProfessionCard[]
  /** Where the blood of the wounds goes (the room's fluid world: `room.fluids`). Without it the wounds draw no blood on the ground. */
  readonly fluids?: BloodSink
  /** The running film of the liquids (the room's `room.film`): wounds throw drops of blood into it, in the colours `bloodOf` gives. Without it only the fluid world gets blood. */
  readonly film?: FilmSink
  /** The sounds of the bodies on the room's engine (`host.audio`): wounds, cuts and the voices of the bench. `false` leaves the area silent. */
  readonly sound?: false | CharacterSoundOptions
  /** The blood of a body by its infection age (`bloodLookOfAge` over the content's ages). Bodies without an age, and games without this option, bleed the liquid's own colours. */
  readonly bloodOf?: (age: string) => BloodLook | undefined
  /** Seed of the draws of the area (default 1). */
  readonly seed?: number
  /** Crowd types to bake for the instanced field, by undead id (default walker and runner). */
  readonly crowdTypes?: readonly string[]
  /** Triangles a baked body may have at each level of detail (default 2500, 800, 250, the Bancada de Hordas budget). Given explicitly, every level is a hard check. */
  readonly triangleBudget?: readonly number[]
}

export type { Vec3, GaitProfile }
