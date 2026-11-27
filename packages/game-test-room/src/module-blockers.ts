import type { HostSolid } from '@adatechnology/game-contracts'

export type Blocked = (x: number, z: number, radius: number) => boolean

export interface ModuleBlockers {
  /** The modules' blockers that came with their bodies in the engine's world: the body stops the player, not the veto. */
  readonly bodied: Set<Blocked>
  /** `ModuleHost.addBlocker`: the blocker stops the walking player and keeps carried things out; with `solids` and an engine, the same obstacle is a body of the world. */
  add(blocked: Blocked, solids?: () => readonly HostSolid[]): () => void
}

/** What the host needs of the destruction renderer to hold a module's boxes as fixed bodies. */
export interface SolidsHolder {
  setHostSolids(id: string, source: (() => readonly HostSolid[]) | null): void
}

/** The blockers modules ask the room for (a house's walls, a car): `all` is what stops the player and the carried things, `modules` only the modules' own (what a carried thing stays out of too). */
export function createModuleBlockers(sets: { readonly all: Set<Blocked>; readonly modules: Set<Blocked> }, holder: SolidsHolder, hasEngine: boolean): ModuleBlockers {
  const bodied = new Set<Blocked>()
  let bodies = 0
  return {
    bodied,
    add(blocked, solids) {
      sets.all.add(blocked)
      sets.modules.add(blocked)
      const bodyId = solids && hasEngine ? `module-blocker:${++bodies}` : null
      if (solids && bodyId) {
        bodied.add(blocked)
        holder.setHostSolids(bodyId, solids)
      }
      return () => {
        sets.all.delete(blocked)
        sets.modules.delete(blocked)
        bodied.delete(blocked)
        if (bodyId) holder.setHostSolids(bodyId, null)
      }
    },
  }
}
