export { certify, gateVehicles, statusOf, withResult } from './certificate'
export type { CertifyOptions, GateOptions, SignOff } from './certificate'
export { DEFAULT_DENSITY, subjectFromCard } from './fleet'
export type { VehicleCardData } from './fleet'
export { accelerationRange, brakeRange, defaultRangeTable, dryBrakeRange, expectedAcceleration, inRange, topSpeedRange, turnCircleRange, wetBrakeRange } from './ranges'
export type { RangeTable } from './ranges'
export { runTest, startRun, subjectSpec } from './run'
export type { ProvingRun, RunOptions } from './run'
export { createProvingTests, defaultProvingTests } from './tests'
export type { ProvingTestOptions, ProvingTestRegistry } from './tests'
export type {
  ProvingCertificate,
  ProvingDomain,
  ProvingMemo,
  ProvingProcedure,
  ProvingRange,
  ProvingResult,
  ProvingSubject,
  ProvingTest,
  ProvingTestKind,
  ProvingVerdict,
} from './types'
