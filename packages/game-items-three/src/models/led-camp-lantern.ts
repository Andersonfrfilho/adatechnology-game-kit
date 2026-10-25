import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const ledCampLantern: ItemModelBuilder = ({ M, mesh, cyl, bx, G, metal, plastic }) => {
  const body = plastic(0x3b4a3a)
  return G(
    mesh(cyl(0.055, 0.055, 0.03, 16), body, [0, 0.015, 0]),
    mesh(cyl(0.045, 0.045, 0.12, 16), M(0xfff1c0, 'glass', { emissive: 0xffe08a, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }), [0, 0.09, 0]),
    mesh(cyl(0.05, 0.055, 0.025, 16), body, [0, 0.1625, 0]),
    mesh(bx(0.008, 0.025, 0.008), metal(0x8d9094), [-0.045, 0.1875, 0]),
    mesh(bx(0.008, 0.025, 0.008), metal(0x8d9094), [0.045, 0.1875, 0]),
    mesh(bx(0.098, 0.008, 0.008), metal(0x8d9094), [0, 0.196, 0]),
  )
}
