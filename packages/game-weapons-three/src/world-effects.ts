import type { Arsenal } from '@adatechnology/game-weapons'
import type { EffectSink, HostEvent, Vec3 } from '@adatechnology/game-contracts'
import worldEffectData from './data/world-effects.json'

/** The effect ids a weapon of a case type shows when it is seen from outside: its muzzle flash and its ejected case (the host's catalogue names them). */
export interface WorldEffectIds {
  readonly muzzle: string
  readonly casing: string
}

export const WORLD_EFFECTS: Readonly<Record<string, WorldEffectIds>> = worldEffectData

export interface WorldEffectsOptions {
  readonly arsenal: Arsenal
  /** The case type of a weapon (`pistol`, `rifle`, `shell`, `big`, `tiny`); default from its caliber. */
  readonly caseTypeOf?: (weapon: string) => string | undefined
  /** The ids by case type; default `WORLD_EFFECTS`. A game adds or changes entries. */
  readonly ids?: Readonly<Record<string, WorldEffectIds>>
}

/** Where the case leaves the weapon: a hand to the right of the muzzle, behind it. */
const PORT_BACK = 0.35
const PORT_RIGHT = 0.04

/**
 * The shooter's flash and ejected case for a shot the viewer sees from outside (a `shot` event that carries `origin`), played through the host's
 * effect sink. The player's own first-person shot has no `origin` and is drawn by the weapon in the hands, so nothing doubles.
 */
export function createWorldEffects(options: WorldEffectsOptions): { handle(event: HostEvent, sink: EffectSink | undefined): number } {
  const ids = options.ids ?? WORLD_EFFECTS
  const caseTypeOf =
    options.caseTypeOf ??
    ((weapon: string): string | undefined => {
      const def = options.arsenal.weapons.get(weapon)
      return def && def.action.kind === 'firearm' ? options.arsenal.calibers.get(def.action.caliber)?.caseType : undefined
    })
  let counter = 0
  return {
    /** Plays what the event asks for and answers how many effects started. */
    handle(event, sink) {
      if (!sink || event.type !== 'shot' || !event.origin) return 0
      const caseType = caseTypeOf(event.weapon) ?? 'rifle'
      const entry = ids[caseType]
      if (!entry) return 0
      const direction: Vec3 = event.direction ?? [0, 0, -1]
      const seed = ++counter
      let started = 0
      for (let shot = 0; shot < Math.max(1, event.rounds ?? 1); shot++) {
        if (sink.play({ effect: entry.muzzle, point: event.origin, direction, seed: seed * 8 + shot }) !== null) started++
      }
      const side: Vec3 = [direction[2], 0, -direction[0]]
      const port: Vec3 = [
        event.origin[0] - direction[0] * PORT_BACK + side[0] * PORT_RIGHT,
        event.origin[1] - direction[1] * PORT_BACK,
        event.origin[2] - direction[2] * PORT_BACK + side[2] * PORT_RIGHT,
      ]
      if (sink.play({ effect: entry.casing, point: port, direction, seed: seed * 8 + 7 }) !== null) started++
      return started
    },
  }
}
