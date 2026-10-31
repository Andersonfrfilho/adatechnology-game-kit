/**
 * @adatechnology/game-crowd-three: the three.js drawing of a `game-crowd` crowd. The instances of every agent, body on the ground and civilian (a literal
 * port of the team game's `hordeRender` and `npcRender`), the renderer on the baked variants of `game-characters-three`, the herd drawn with the
 * animals' own rigs, the crowd's sound bank and the crowd test area. three.js is passed in by the host.
 */
export { CROWD_RENDER_DEFAULTS, createCrowdInstances } from './instances'
export type { CrowdFrame, CrowdInstance, CrowdInstanceSink, CrowdInstances, CrowdInstancesOptions, CrowdPoseMap, CrowdRenderNumbers, PlainCorpseSink, VariantSize } from './instances'
export { createCrowdRenderer } from './renderer'
export type { CrowdRenderer, CrowdRendererOptions } from './renderer'
export { createHerdView } from './herd-view'
export type { AnimalDrawer, DrawnAnimal, HerdView, HerdViewOptions } from './herd-view'
export { CROWD_SOUND_BANK, HERD_SOUND_IDS } from './audio/bank'
/** @deprecated import from '@adatechnology/game-crowd-three/testing' */
export { CROWD_AREA_ID, CROWD_EFFECTS, createCrowdTestModule } from './testing'
/** @deprecated import from '@adatechnology/game-crowd-three/testing' */
export type { CrowdBenchSpecies, CrowdEffectMap, CrowdScenarioLike, CrowdTestModule, CrowdTestModuleOptions } from './testing'
/** @deprecated import from '@adatechnology/game-crowd-three/testing' */
export { crowdBenchTextOf } from './testing'
/** @deprecated import from '@adatechnology/game-crowd-three/testing' */
export type { CrowdBenchText } from './testing'
