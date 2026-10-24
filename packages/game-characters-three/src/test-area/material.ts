/**
 * The material the parts of a living body carry (`BODY_MATERIAL` of the engine), as a destruction world needs it declared: pass it in the world's material list
 * (`worldOptions.materials` of the test room) before loading the characters area. The body model owns the damage; the world only needs the density and thermal data
 * to raycast, blast and burn a body like any other object. Numbers are those of soft tissue (about 1050 kg/m3).
 */
export const BODY_MATERIAL_DEF = {
  id: 'flesh',
  density: 1050,
  hpPerKg: 15,
  penetration: 1.2,
  ductility: 0.8,
  fracture: 'tear',
  fragmentSize: [0.03, 0.1],
  damageScale: { slash: 1.6 },
  hitDebris: 'drips',
  breakDebris: 'drips',
  thermal: { ignitionC: 260, flameC: 700, fuelFraction: 0.25, burnRate: 0.004, conductivity: 0.5, heatCapacity: 3.5, smoke: 'grey' },
  tags: ['organic', 'body'],
  compressive: 1000,
} as const

/** Puts the body material in a destruction world that does not know it yet (`room.world`); a world that has it is left alone. Call it before `room.loadModule`. */
export const registerBodyMaterial = (world: { readonly materials: Map<string, unknown> }): void => {
  if (!world.materials.has(BODY_MATERIAL_DEF.id)) world.materials.set(BODY_MATERIAL_DEF.id, BODY_MATERIAL_DEF)
}
