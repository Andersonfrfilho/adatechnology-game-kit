/**
 * @adatechnology/game-crowd: any crowd as a struct of arrays, pure and seeded. A literal port of the team game's horde (`jogo.js` G 66714-67430):
 * relevance bands with hysteresis, perception by sight, hearing and smell, the sliced flow field, the spatial hash and separation, six attack slots,
 * chain alerts, doors, piles against walls, the special moves as type traits, corpses, the blood trail, the population and migration.
 * The pack (types, ages, outfits) is data: `game-characters-undead` gives the undead one.
 */
export { CROWD_DEFAULTS, createCrowd } from './crowd'
export type { Corpse, Crowd, CrowdBand, CrowdNumbers, CrowdOptions, CrowdPlugin, CrowdUpdateContext, CrowdView, MigrationOptions, PlayerCrowdLike } from './crowd'
export { DOOR_DEFAULTS, createDoors } from './doors'
export type { Door, DoorEventMap, DoorEventName, DoorNumbers, Doors } from './doors'
export { CELL, createNavGrid } from './grid'
export type { NavGrid, NavGridOptions } from './grid'
export { createRng } from './rng'
export { AGENT_FIELDS, createStore } from './store'
export type { CrowdStore } from './store'
export { MISSING, STATE } from './types'
export type * from './types'
export { CIVILIAN_DEFAULTS, createCivilians } from './behaviours/civilians'
export type { Civilian, CivilianBuilding, CivilianEventMap, CivilianEventName, CivilianNumbers, CivilianOptions, CivilianSpec, CivilianState, Civilians } from './behaviours/civilians'
export { HERD_DEFAULTS, HERD_ROLES, createHerd } from './behaviours/herd'
export type { Herd, HerdAnimal, HerdAnimalSpec, HerdEventMap, HerdEventName, HerdNumbers, HerdOptions, HerdRole } from './behaviours/herd'
export { carrionCenter, createFlock } from './behaviours/flock'
export type { Flock, FlockBird, FlockMode, FlockOptions } from './behaviours/flock'
export { bindInfection } from './behaviours/infection'
export type { InfectionBinding, InfectionBindingOptions, InfectionModelLike } from './behaviours/infection'
