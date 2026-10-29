// Bundle entry (IIFE global `VehiclesArea`): the vehicles module of @adatechnology/game-vehicles-three with the fleet of the kit, ready for any room page:
// `VehiclesArea.loadInto(room)` loads it and opens its area (`?area=vehicles`).
// The area lays the eight vehicles of the Frota test, each with its own destruction (glass, doors, hood, bumper, tyres, the tank, the battery, fire, a rollover) and its door, hood and trunk
// clips; the bench sets the quality (full or light mode), paints by seed and palette, shows the damageable boxes by material, the zones by type and the axes of the output frame, and drives
// a car down a lane with the arcade or the semi-simulation driver on the chosen surface. Thirteen scenarios check it.
import { VEHICLES_AREA_ID, createVehiclesTestModule, loadVehiclesTestModule } from '@adatechnology/game-vehicles-three'

export { createVehiclesTestModule, loadVehiclesTestModule }

/** The module with the kit's own fleet; options replace or extend any of it. */
export function createModule(options = {}) {
  return createVehiclesTestModule(options)
}

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it (the room's three.js is learned from the room) and opens the vehicles area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const lang = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = loadVehiclesTestModule(room, { ...options, locale: lang })
  // the area is heavy (hundreds of items, or a whole fleet): the room's loading indicator shows while it is laid, one frame after this returns
  if (room.openAreaAsync) void room.openAreaAsync(VEHICLES_AREA_ID)
  else room.openArea(VEHICLES_AREA_ID)
  return report
}
