/* global GoldenTool */
// Capture for the Galeria do Vale Cinzento: the silhouettes the page draws from far away (house types and a city building).
// Needs the recorder flag --expose rng,R,root,sobrado,laje,colonial,chalet,companyHouse,stilt,farmhouse,house,building (the page keeps them inside an IIFE).
// Each case runs with a fresh root group and the page's own seeded generator rng(7); the scene hash is the root's.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const page = globalThis.GoldenExposed
  const recorder = GoldenTool.createEventRecorder()
  const CASES = [
    ['sobrado', () => page.sobrado(0, 0, 8, 9, 0xc8bca8, 0x5a3a2a, 0)],
    ['sobrado_rotated', () => page.sobrado(3, -2, 7, 8, 0xb0a48c, undefined, 0.6)],
    ['laje_1', () => page.laje(0, 0, 7, 8, 1, 0xa8a49c)],
    ['laje_2', () => page.laje(0, 0, 7, 8, 2, 0xa8a49c)],
    ['laje_3', () => page.laje(0, 0, 7, 8, 3, 0xa8a49c)],
    ['colonial', () => page.colonial(0, 0, 7, 0xd0c4a8, false)],
    ['colonial_door', () => page.colonial(0, 0, 9, 0xd0c4a8, true)],
    ['chalet', () => page.chalet(0, 0, undefined, 0)],
    ['chalet_rotated', () => page.chalet(2, 5, 0x7a5a3a, 1.2)],
    ['company_house', () => page.companyHouse(0, 0, undefined)],
    ['stilt', () => page.stilt(0, 0, undefined)],
    ['farmhouse', () => page.farmhouse(0, 0)],
    ['house', () => page.house(0, 0, 7, 8, 0xc8b898, 0x5a3a2a, 0)],
    ['house_boarded', () => page.house(0, 0, 7, 8, 0xc8b898, 0x5a3a2a, 0, { boarded: true })],
    ['building', () => page.building(0, 0, 12, 14, 20, 0x8a8a86, {})],
    ['building_shop', () => page.building(0, 0, 12, 14, 20, 0x8a8a86, { shop: 1, lit: 0.2 })],
  ]
  const scenes = {}
  for (const [label, build] of CASES) {
    page.root = new globalThis.THREE.Group()
    page.R = page.rng(7)
    build()
    scenes[label] = page.root
    recorder.record('silhouette', { label })
  }
  return GoldenTool.createGoldenRecord({ name: 'gallery-silhouettes', seed, events: recorder.events(), scenes })
})()
