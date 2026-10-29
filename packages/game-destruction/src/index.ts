export type * from './types'
export { createDestruction, SHELTER_DEFAULTS, FRAGMENT_HIT_DEFAULTS, CONFINEMENT_DEFAULTS } from './world'
export { explosivePart, FIRE_PRIME_C } from './chain'
export type { ChainTrigger, ExplosivePartOptions, WorldExplosive } from './chain'
export { MATERIALS, JOINT_DEFAULTS, JOINT_BY_MATERIALS, inferJoints, guessMaterial, partVolume, partMass, partThickness, partCapacity, fragility } from './materials'
export { ASSEMBLIES, registerAssembly, getAssembly, assemblyPart, assemblyDepth } from './assemblies'
export type { AssemblyDef, AssemblyPartOptions } from './assemblies'
export { buildFrame } from './frame'
export type { FrameOptions } from './frame'
export { sizeStructure, sizeRebar } from './size'
export {
  GRAVITY, FLEXURE_DEFAULTS, MASONRY_DEFAULTS, bearingWallThickness, bendGeometry, blastImpulse, crackingMoment, elasticEnergy, impulseEnergy, momentOfEnergy,
  sectionMoments, slendernessFactor, spanMoment, spanOf, steelMoment, tensionSteel,
} from './flexure'
export type { BearingWallOptions, BendGeometry, BendSection, SectionMoments, TensionSteel } from './flexure'
export {
  SOILS, SOIL_DEFAULTS, footingArea, footingSoil, layersBetween, pileCapacity, pileLength, pileStiffness, profileOf, soilAt, solveFoundation, stiffnessCentre,
  subgradeModulus,
} from './soil'
export type { FoundationSolve, SoilSpring } from './soil'
export { vec, quat, quatFromEuler, rotateVec, toLocal, toWorld } from './math'
export { resolveStrings, locales } from './locale'
export type { DestructionStrings, DestructionLocale } from './locale'
export { checkDestructible, checkHit, IMPACT_CONTRACT } from './contracts'
export type { DestructibleImpl, ImpactContract, CheckOptions } from './contracts'
export {
  WIND_DEFAULTS, WIND_TERRAIN, analyzeWind, damperAmplification, damperTuning, exposureOf, gustAt, heightFactor, makeGust, meanHeightFactor, momentNodes, resolveWind, shapeAt, shearNodes,
  solveWallFrame, stepSway, tBeamInertia, tensionCapacity, turbulenceIntensity, windClass, windPressure,
} from './wind'
export type { Gust, ResolvedWind, SwayState, SwaySystem, WallFrameSolution, WindAnalysis, WindCase, WindPartInput } from './wind'
