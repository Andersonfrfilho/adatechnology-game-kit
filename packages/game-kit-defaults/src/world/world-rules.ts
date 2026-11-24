/**
 * The rules of the world that read the objects a host keeps (what it spawned, what it holds): fires and stains burning, the litres of a container
 * weighing on its piece. The host runs them at the places of the step where they run today and does not know what they read; the lists they need are
 * the host's (`design-host.md` §2: until `world.objects` carries them the rules stay with the room).
 */
export type WorldRules = {
  /** Once per step, after `world.update` of the first repetition and before the fluids: fire zones and burning stains. */
  readonly fire?: (dt: number) => void
  /** Once per step, after the fluids and before the physics step: litres of the containers to the world and to the pieces' mass, and whatever a host counts per step. */
  readonly beforePhysics?: () => void
}

export type KitWorldRules = {
  /** Adds rules, run in the order they came; returns the way to take them out. */
  use(rules: WorldRules): () => void
  fire(dt: number): void
  beforePhysics(): void
}

export function createWorldRules(): KitWorldRules {
  const used = new Set<WorldRules>()
  return {
    use(rules) {
      used.add(rules)
      return () => used.delete(rules)
    },
    fire(dt) {
      for (const rules of used) rules.fire?.(dt)
    },
    beforePhysics() {
      for (const rules of used) rules.beforePhysics?.()
    },
  }
}
