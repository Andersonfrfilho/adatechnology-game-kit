import { visualStateOf } from '@adatechnology/game-animals'
import type { AnimalSpecies } from '@adatechnology/game-animals'
import type { ModuleScenario } from '@adatechnology/game-contracts'

import type { AnimalsThree } from '../animals-three'
import type { OutbreakLike } from './types'

/** What a scenario needs of the room: the pass/fail line and time. The test room's `ScenarioContext` has both. */
export type AnimalsContext = { expect(condition: boolean, label: string, data?: Record<string, unknown>): void; step(seconds: number): void }

export type ScenarioDeps = {
  readonly text: Readonly<Record<string, string>>
  species(): readonly AnimalSpecies[]
  ensure(): AnimalsThree
  outbreak(): OutbreakLike | null
  rebuildOutbreak(enabled: boolean): OutbreakLike | null
  skins(): { count: number; meshes: { drawCalls: number; triangles: number }; nodes: number; rich: number }
  clearSkins(): void
}

const SKIN_COUNT = 40

export const createScenarios = (deps: ScenarioDeps): ModuleScenario<AnimalsContext>[] => {
  const scenario = (id: string, run: ModuleScenario<AnimalsContext>['run']): ModuleScenario<AnimalsContext> => ({ id, name: deps.text[id] ?? id, run })
  const rate = () => 0.5
  return [
    scenario('visual_states', ({ expect }) => {
      const animals = deps.ensure()
      for (const species of deps.species()) {
        const rig = animals.build(species)
        animals.setVisualState(rig, 'infected')
        expect(rig.infected && !rig.dead, `${species.id}: infected`)
        animals.setVisualState(rig, 'dead')
        expect(rig.dead && !rig.infected, `${species.id}: dead`)
        animals.setVisualState(rig, 'alive')
        expect(!rig.dead && !rig.infected, `${species.id}: alive again`)
      }
    }),
    scenario('gait_moves_legs', ({ expect }) => {
      const animals = deps.ensure()
      const species = deps.species().find((entry) => entry.body.kind === 'quadruped')
      if (!species) return expect(false, 'no quadruped among the species')
      const rig = animals.build(species)
      animals.animate(rig, { time: 0, delta: 0, clip: 'walk' })
      const before = rig.legs.map((leg) => leg.hip.rotation.x)
      animals.animate(rig, { time: 0.4, delta: 0.4, clip: 'walk' })
      expect(rig.legs.some((leg, index) => leg.hip.rotation.x !== before[index]), `${species.id}: a walk step swings a hip`)
    }),
    scenario('outbreak_rule', ({ expect }) => {
      const turns = deps.species().find((entry) => entry.outcome === 'turns')
      const immune = deps.species().find((entry) => entry.outcome === 'immune')
      const on = deps.rebuildOutbreak(true)
      if (!on || !turns) return expect(false, 'no outbreak rule or no species that turns')
      expect(on.bite(turns.id, rate, 0) !== undefined, `a bite on ${turns.id} starts a fate with the rule on`)
      if (immune) expect(on.bite(immune.id, rate, 0) === undefined, `${immune.id} shrugs the bite off`)
      const off = deps.rebuildOutbreak(false)
      expect(off?.bite(turns.id, rate, 0) === undefined, 'with the rule off a bite does nothing')
      deps.rebuildOutbreak(true)
    }),
    scenario('carcass_lure', ({ expect }) => {
      const outbreak = deps.rebuildOutbreak(true)
      const dies = deps.species().find((entry) => entry.outbreak?.carcass)
      if (!outbreak || !dies) return expect(false, 'no outbreak rule or no species that leaves a carcass')
      const carcass = outbreak.carcass(dies.id, [0, 0, 0], 0)
      expect(carcass !== undefined, `${dies.id} leaves a carcass`)
      if (!carcass) return
      expect(outbreak.lures(carcass, carcass.lureRadiusMetres - 1, 1), 'a zombie inside the radius is drawn')
      expect(!outbreak.lures(carcass, carcass.lureRadiusMetres + 1, 1), 'a zombie outside it is not')
    }),
    scenario('bite_to_turn_timer', ({ expect }) => {
      const outbreak = deps.rebuildOutbreak(true)
      const turns = deps.species().find((entry) => entry.outcome === 'turns')
      if (!outbreak || !turns) return expect(false, 'no outbreak rule or no species that turns')
      const fate = outbreak.bite(turns.id, rate, 0)
      if (!fate) return expect(false, 'the bite took')
      expect(outbreak.stateOf(fate, 0) === 'incubating', 'it incubates at first')
      expect(outbreak.stateOf(fate, fate.dueAt + 1) === 'turned', 'it has turned once the time is up (the bench clock runs it accelerated)')
      expect(visualStateOf(turns.outcome, true) === 'infected', 'and shows the infected look')
    }),
    scenario('skins_40', ({ expect }) => {
      const result = deps.skins()
      expect(result.count === SKIN_COUNT, `${SKIN_COUNT} animals are in the field`, { count: result.count })
      expect(result.meshes.drawCalls <= SKIN_COUNT + 16, 'the skins are about one draw call each', result.meshes)
      expect(result.nodes > 0, 'each skin keeps the nodes the animation moves', { nodes: result.nodes })
      deps.clearSkins()
    }),
  ]
}
