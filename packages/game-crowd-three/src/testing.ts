/**
 * @adatechnology/game-crowd-three/testing: the test area, bench and scenarios, for the test rooms. Not part of the runtime API.
 */
export { CROWD_AREA_ID, CROWD_EFFECTS, createCrowdTestModule } from './bench/module'
export type { CrowdBenchSpecies, CrowdEffectMap, CrowdScenarioLike, CrowdTestModule, CrowdTestModuleOptions } from './bench/module'
export { crowdBenchTextOf } from './bench/locale'
export type { CrowdBenchText } from './bench/locale'
export { BUILTIN_SCENES, CHAIN_LINE, DENSE_WALL } from './bench/scenes'
export type { CrowdBenchScene, CrowdScenePlace, CrowdSceneProps } from './bench/scenes'
