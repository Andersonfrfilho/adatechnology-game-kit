// The world host of the kit (`@adatechnology/game-kit-defaults/world`, spec 011): what every game would wire the same way, apart from the preset's data.
export { createObjectRegistry } from './objects'
export type { ObjectRegistry, ObjectRegistryEvent, ObjectRegistryListener } from './objects'
export { createReportPort } from './reports'
export type { ReportListener, ReportPort, WorldReport } from './reports'
