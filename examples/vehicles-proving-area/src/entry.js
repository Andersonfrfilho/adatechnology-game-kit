// Bundle entry (IIFE global `ProvingArea`): the proving ground of @adatechnology/game-vehicles-three, ready for any room page:
// `ProvingArea.loadInto(room)` loads it and opens its area (`?area=vehicles_proving`). The certificates are in `window.__provingCertificates` as they change.
import { rng } from '@adatechnology/game-interactables'
import { createGoodsItems, GOODS_CONTAINERS, goodsText } from '@adatechnology/game-items-goods'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { fleetCard, fleetGroups, fleetProvingSubject, installFleet } from '@adatechnology/game-vehicles-fleet'
import { PROVING_AREA_ID, createProvingModule } from '@adatechnology/game-vehicles-three'

export { createProvingModule, PROVING_AREA_ID }

const langOf = (options) => options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')

/** Every land vehicle of the kit's fleet (the boats and the aircraft wait for their rooms). */
export const LAND_VEHICLES = Object.entries(fleetGroups).filter(([group]) => group !== 'water' && group !== 'air').flatMap(([, ids]) => ids)

/**
 * What the glovebox and the trunk of a car hold, from the items team's `car_trunk` container ("Porta-luvas e porta-malas": 0 to 3 things, a map, a torch,
 * a first aid kit, the jack, the key): the small ones in the glovebox, the jack and the kit in the trunk. The same vehicle always holds the same.
 */
const GLOVEBOX_FINDS = ['road_map', 'flashlight', 'car_key']
const TRUNK_FINDS = ['car_jack', 'first_aid_kit']
export function createCarStock(catalog = createGoodsItems()) {
  const container = GOODS_CONTAINERS.find((c) => c.id === 'car_trunk')
  const [min, max] = container?.count ?? [0, 3]
  return (compartment, vehicle) => {
    const random = rng(`${vehicle}:car_trunk`)
    const count = min + Math.floor(random() * (max - min + 1))
    const pool = [...GLOVEBOX_FINDS, ...TRUNK_FINDS].filter((id) => catalog.has(id))
    const picked = []
    for (let i = 0; i < count && pool.length; i++) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
    const here = compartment === 'glovebox' ? GLOVEBOX_FINDS : TRUNK_FINDS
    return picked.filter((id) => here.includes(id)).map((id) => ({ itemId: id, count: 1, unitKg: catalog.get(id).weight }))
  }
}

/** The module for the room's locale with the kit's fleet as its content, keeping the certificates on `window.__provingCertificates` (by vehicle id) for a page or a test to read. */
export function createModule(options = {}) {
  const locale = langOf(options)
  const certificates = (globalThis.__provingCertificates ??= {})
  return createProvingModule({
    vehicles: LAND_VEHICLES,
    subject: (id, mass) => fleetProvingSubject(id, mass ? { mass } : {}),
    nameOf: (id) => (locale.startsWith('pt') ? fleetCard(id)?.name : undefined),
    stock: createCarStock(),
    itemName: (id) => goodsText(`item.${id}`, locale),
    createKit: (THREE) => {
      const kit = createVehicleKit({ THREE, locale })
      // the proving ground shows the sunroof the fleet can draw on two of its cars
      installFleet(kit, { sunroofs: ['fastback_sedan', 'turbo_hatch'] })
      return kit
    },
    ...options,
    locale,
    onCertificate: (/** @type {{ vehicle: string | number; }} */ c) => {
      certificates[c.vehicle] = c
      options.onCertificate?.(c)
    },
  })
}

/** Loads the proving ground into the room without opening it (the full room page). */
export function loadModule(room, options = {}) {
  return room.loadModule(createModule(options))
}

/**
 * Loads it and opens its area. Returns the room's module report.
 * @param {{ openArea: (arg0: string) => void; }} room
 */
export function loadInto(room, options = {}) {
  const report = loadModule(room, options)
  room.openArea(PROVING_AREA_ID)
  return report
}
