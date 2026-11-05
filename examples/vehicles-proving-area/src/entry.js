// Bundle entry (IIFE global `ProvingArea`): the proving ground of @adatechnology/game-vehicles-three, ready for any room page:
// `ProvingArea.loadInto(room)` loads it and opens its area (`?area=vehicles_proving`). The certificates are in `window.__provingCertificates` as they change.
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { fleetCard, fleetGroups, fleetProvingSubject, installFleet } from '@adatechnology/game-vehicles-fleet'
import { PROVING_AREA_ID, createProvingModule } from '@adatechnology/game-vehicles-three'

export { createProvingModule, PROVING_AREA_ID }

const langOf = (options) => options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')

/** Every land vehicle of the kit's fleet (the boats and the aircraft wait for their rooms). */
export const LAND_VEHICLES = Object.entries(fleetGroups).filter(([group]) => group !== 'water' && group !== 'air').flatMap(([, ids]) => ids)

/** The module for the room's locale with the kit's fleet as its content, keeping the certificates on `window.__provingCertificates` (by vehicle id) for a page or a test to read. */
export function createModule(options = {}) {
  const locale = langOf(options)
  const certificates = (globalThis.__provingCertificates ??= {})
  return createProvingModule({
    vehicles: LAND_VEHICLES,
    subject: (id, mass) => fleetProvingSubject(id, mass ? { mass } : {}),
    nameOf: (id) => (locale.startsWith('pt') ? fleetCard(id)?.name : undefined),
    createKit: (THREE) => {
      const kit = createVehicleKit({ THREE, locale })
      // the proving ground shows the sunroof the fleet can draw on two of its cars
      installFleet(kit, { sunroofs: ['fastback_sedan', 'turbo_hatch'] })
      return kit
    },
    ...options,
    locale,
    onCertificate: (c) => {
      certificates[c.vehicle] = c
      options.onCertificate?.(c)
    },
  })
}

/** Loads the proving ground into the room without opening it (the full room page). */
export function loadModule(room, options = {}) {
  return room.loadModule(createModule(options))
}

/** Loads it and opens its area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const report = loadModule(room, options)
  room.openArea(PROVING_AREA_ID)
  return report
}
