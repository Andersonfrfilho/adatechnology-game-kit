/**
 * @adatechnology/game-floorplan-three/testing: the test area, bench and scenarios, for the test rooms. Not part of the runtime API.
 */
export { createFloorplanTestModule, FLOORPLAN_AREA_ID } from './test-area/module.js'
export { createHouseScenarios, SPECIMEN_AT } from './test-area/scenarios.js'
export type { AreaContext } from './test-area/scenarios.js'
export { DEFAULT_SPECIMENS, buildSpecimenMeshes, specimenSpec } from './test-area/specimens.js'
export type { FloorplanEngineLike, FloorplanTestOptions, SpecimenDef, TemplateGroup } from './test-area/types.js'
