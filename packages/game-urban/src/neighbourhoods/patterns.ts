import { COMPOSERS } from './composers'
import type { DowntownParams, HistoricParams, IndustrialParams, MilitaryParams, MountainParams, RailwayParams, RuralParams, StiltParams, SuburbParams, WorkingClassParams } from './composers'
import type { NeighbourhoodPattern } from './types'

const suburb: NeighbourhoodPattern<SuburbParams> = {
  id: 'suburb',
  streetWidth: 7,
  walkWidth: 2,
  typologies: ['detached', 'two_storey'],
  pole: 'concrete_arm',
  lightColor: 0xff9a40,
  spacing: 35,
  lit: 0.75,
  compose: 'suburb',
  marker: { height: 10 },
  text: {
    'pt-BR': { label: 'Subúrbio', title: 'SUBÚRBIO', caption: 'casa térrea e sobrado · muro 1,8 m · sódio a cada 35 m', detail: 'Casa térrea e sobrado, muro de 1,8 m. Poste de concreto com sódio laranja.' },
    en: { label: 'Suburb', title: 'SUBURB', caption: 'one-storey and two-storey houses · 1.8 m wall · sodium every 35 m', detail: 'One-storey and two-storey houses behind a 1.8 m wall. Concrete pole with an orange sodium lamp.' },
  },
  params: {
    roadLength: 60,
    walkOffset: 4.5,
    houses: { count: 5, first: -24, pitch: 12, north: { z: -15, typologies: ['two_storey', 'detached'], colors: [0xc8b89a, 0xa8b0a0, 0xd0c0a0, 0xb8a890] }, south: { z: 15, colors: [0xc8b89a, 0xa8b0a0, 0xd0c0a0] }, roofColor: 0x6a3a2a, width: 8, depth: 10 },
    walls: { color: 0xbab2a0, height: 1.8, thickness: 0.2, offset: 5.8, gateColor: 0x3a3a3a, gateWidth: 2.4, gateHeight: 1.6, gateOffset: 3.5, gateInset: 5.7, length: 10 },
    poles: { at: [-26, 9], z: -4.8, transformerFrom: 0 },
    wires: { half: 28, height: 6.9 },
  },
}

const downtown: NeighbourhoodPattern<DowntownParams> = {
  id: 'downtown',
  streetWidth: 14,
  walkWidth: 3,
  typologies: ['city_building'],
  pole: 'led_double',
  lightColor: 0xdfe8ff,
  spacing: 25,
  lit: 1,
  compose: 'downtown',
  marker: { height: 14 },
  text: {
    'pt-BR': { label: 'Centro', title: 'CENTRO', caption: 'avenida 2 × 7 m · LED branco a cada 25 m', detail: 'Prédio residencial e comercial de 4 a 12 andares. Poste metálico duplo, LED branco.' },
    en: { label: 'Downtown', title: 'DOWNTOWN', caption: 'avenue 2 × 7 m · white LED every 25 m', detail: 'Residential and commercial buildings of 4 to 12 floors. Double steel pole, white LED.' },
  },
  params: {
    roadLength: 60,
    roadColor: 0x222428,
    median: { width: 1.6, height: 0.18, color: 0x3a4a2c },
    poles: { from: -26, to: 26 },
    buildings: { perRow: 4, first: -21, pitch: 14, rowOffset: 18, size: 12, north: { minHeight: 12, range: 24, lit: 0.1 }, south: { minHeight: 12, range: 18, lit: 0.08 } },
    walks: { offset: 10, length: 60 },
    car: { dx: -8, dz: -3, ry: 1.57, color: 0x6b6450 },
  },
}

const workingClass: NeighbourhoodPattern<WorkingClassParams> = {
  id: 'working_class',
  streetWidth: 6,
  walkWidth: 0,
  typologies: ['slab'],
  pole: 'concrete_arm',
  lightColor: 0xff9a40,
  spacing: 36,
  lit: 0.5,
  compose: 'working_class',
  marker: { height: 10 },
  text: {
    'pt-BR': { label: 'Bairro popular', title: 'BAIRRO POPULAR', caption: "lajes de 1 a 3 · caixa d'água azul · metade das luzes queimadas", detail: 'Casas geminadas de laje, fios emaranhados, metade das luzes queimadas.' },
    en: { label: 'Working-class quarter', title: 'WORKING-CLASS QUARTER', caption: 'slab houses of 1 to 3 floors · blue water tank · half the lamps burnt out', detail: 'Row slab houses, tangled wires, half the lamps burnt out.' },
  },
  params: {
    houses: { count: 10, first: -27, pitch: 6, width: 5.6, depth: 10, north: { z: -9, colors: [0xa0624a, 0x9a6a54, 0x8a5a44] }, south: { z: 9, colors: [0xa0624a, 0x9a6a54, 0xc8c0b0] }, maxFloors: 3 },
    poles: { from: -24, to: 26, z: -3.5, jitter: 8 },
    wires: { count: 4, from: -26, to: 26, z: -3.5, step: 0.15, height: 6.3, heightStep: 0.25, sag: 2, color: 0x1a1a1a },
  },
}

const historicStreet: NeighbourhoodPattern<HistoricParams> = {
  id: 'historic_street',
  streetWidth: 5,
  walkWidth: 0,
  typologies: ['colonial'],
  pole: 'cast_iron',
  lightColor: 0xffc880,
  spacing: 20,
  lit: 0.8,
  compose: 'historic_street',
  marker: { height: 8 },
  text: {
    'pt-BR': { label: 'Rua histórica', title: 'RUA HISTÓRICA', caption: 'casas coloniais coladas · pedra 5 m · ferro fundido a cada 20 m', detail: 'Casas coloniais coladas, rua de pedra, luminária de ferro fundido.' },
    en: { label: 'Historic street', title: 'HISTORIC STREET', caption: 'colonial houses wall to wall · 5 m cobbles · cast iron every 20 m', detail: 'Colonial houses wall to wall, cobbled street, cast-iron lanterns.' },
  },
  params: {
    cobbles: { y: 0.03, length: 60, color: 0x4a4642, from: -28, to: 28, step: 0.9, spread: 4, sizes: [0.8, 0.04, 0.6], colors: [0x5a5650, 0x4e4a46, 0x625e58] },
    rows: { from: -28, to: 26, minWidth: 5, widthSteps: 3, north: { z: -8, colors: [0xd8c8a0, 0xa8c0c0, 0xe0b890, 0xc0a8b8, 0xd0d0c0] }, south: { z: 8, colors: [0xd8c8a0, 0xa8c0c0, 0xe0b890, 0xc0a8b8] } },
    poles: { from: -25, to: 25, step: 20, z: 2.9, sideOffset: 10 },
  },
}

const industrialPort: NeighbourhoodPattern<IndustrialParams> = {
  id: 'industrial_port',
  streetWidth: 40,
  walkWidth: 0,
  typologies: ['hangar'],
  pole: 'flood_tower',
  lightColor: 0xfff0d0,
  spacing: 60,
  lit: 1,
  compose: 'industrial_port',
  marker: { height: 16 },
  text: {
    'pt-BR': { label: 'Industrial e porto', title: 'INDUSTRIAL E PORTO', caption: 'galpão (amostra encurtada) · torre de refletor a cada 60 m', detail: 'Galpões e torres de refletor de 12 m.' },
    en: { label: 'Industrial and port', title: 'INDUSTRIAL AND PORT', caption: 'warehouse (shortened sample) · floodlight tower every 60 m', detail: 'Warehouses and 12 m floodlight towers.' },
  },
  params: {
    yard: { length: 60, color: 0x2a2b2c },
    hangar: { x: 15, z: -6, width: 26, height: 10, depth: 30, color: 0x6a6c68, roofColor: 0x5a5c58, roofRadius: 13, roofY: 10, doorColor: 0x3a3a3a, doorWidth: 6, doorHeight: 5, stripeColor: 0xd8b02a },
    towers: [{ dx: -30, dz: 14, on: true }, { dx: 30, dz: 14, on: false }],
    container: { dx: 20, dz: 14, ry: 0.2, color: 0x8a3a2a },
  },
}

const railwayVillage: NeighbourhoodPattern<RailwayParams> = {
  id: 'railway_village',
  streetWidth: 6,
  walkWidth: 0,
  typologies: ['company_house'],
  pole: 'concrete_arm',
  lightColor: 0xff9a40,
  spacing: 35,
  lit: 0.7,
  compose: 'railway_village',
  marker: { height: 8 },
  text: {
    'pt-BR': { label: 'Vila ferroviária', title: 'VILA FERROVIÁRIA', caption: 'casas da companhia, todas iguais · poste residencial a cada 35 m', detail: 'Casas da companhia em fila, todas iguais.' },
    en: { label: 'Railway village', title: 'RAILWAY VILLAGE', caption: 'company houses, all alike · residential pole every 35 m', detail: 'Company houses in a row, all alike.' },
  },
  params: {
    houses: { count: 6, first: -25, pitch: 10, north: { z: -12, colors: [0xd8d0c0, 0xd0c8b4] }, south: { z: 12, color: 0xd8d0c0 } },
    poles: { at: [-26, 9], z: -4, transformerFrom: 0 },
    wires: { half: 26, height: 6.9 },
  },
}

const mountainResort: NeighbourhoodPattern<MountainParams> = {
  id: 'mountain_resort',
  streetWidth: 6,
  walkWidth: 0,
  typologies: ['chalet'],
  pole: 'cast_iron',
  lightColor: 0xffc880,
  spacing: 20,
  lit: 0.7,
  compose: 'mountain_resort',
  marker: { height: 10 },
  text: {
    'pt-BR': { label: 'Serra', title: 'SERRA · RUA DAS POUSADAS', caption: 'chalé de madeira e pedra · telhado 45° · ferro fundido a cada 20 m', detail: 'Rua das Pousadas: chalés de madeira e pedra com telhado íngreme e luminária de ferro fundido. Na Encosta, sem iluminação.' },
    en: { label: 'Mountain', title: 'MOUNTAIN · INN STREET', caption: 'wood and stone chalets · 45° roof · cast iron every 20 m', detail: 'Inn Street: wood and stone chalets with a steep roof and cast-iron lanterns. Up the slope there is no lighting.' },
  },
  params: {
    road: { y: 0.02, length: 60, color: 0x2a2a28 },
    chalets: { count: 5, first: -24, pitch: 12, northZ: -12, southZ: 12, southShift: 6, northColors: [0x6b4a30, 0x5a3e28, 0x7a5a3a], southColors: [0x6b4a30, 0x5a3e28] },
    poles: { from: -25, to: 25, step: 20, z: 2.6, sideOffset: 10 },
    pines: { count: 10, first: -28, span: 56, rowZ: 22, minScale: 1.4, scaleRange: 1 },
  },
}

const stiltVillage: NeighbourhoodPattern<StiltParams> = {
  id: 'stilt_village',
  streetWidth: 2,
  walkWidth: 0,
  typologies: ['stilt'],
  pole: '',
  lightColor: 0xffb060,
  spacing: 0,
  lit: 1,
  compose: 'stilt_village',
  marker: { height: 7 },
  text: {
    'pt-BR': { label: 'Palafitas', title: 'PALAFITAS', caption: 'madeira sobre estacas · sem luz pública · lampião', detail: 'Vila dos Pescadores: sem iluminação pública, só lampião.' },
    en: { label: 'Stilt village', title: 'STILT VILLAGE', caption: 'timber on piles · no public lighting · lanterns', detail: 'Fishermen\'s village: no public lighting, only lanterns.' },
  },
  params: {
    water: { y: 0.04, z: -2, length: 60, depth: 30, color: 0x22343e, roughness: 0.25, metalness: 0.3 },
    bank: { z: 14, length: 60, depth: 8, color: 0x4a4436 },
    boardwalk: { y: 1.3, length: 56, width: 2, color: 0x5a4630, pilesFrom: -26, pilesTo: 26, pilesStep: 4 },
    houses: { count: 5, first: -22, pitch: 11, z: -7, colors: [0x6a5a46, 0x5a6a6a, 0x7a5a46], lantern: { dx: 1.5, y: 3.2, dz: -3.4, lit: 0xffc070, unlit: 0x3a3a3a } },
    lamp: { dx: -11, y: 3, dz: -3, color: 0xffb060, intensity: 0.9, distance: 10 },
    boat: { dx: 14, dz: 6, color: 0x5a3a2a },
  },
}

const military: NeighbourhoodPattern<MilitaryParams> = {
  id: 'military',
  streetWidth: 40,
  walkWidth: 0,
  typologies: ['tent'],
  pole: '',
  lightColor: 0xe6eeff,
  spacing: 40,
  lit: 1,
  compose: 'military',
  marker: { height: 12, dz: -14 },
  text: {
    'pt-BR': { label: 'Militar', title: 'MILITAR', caption: 'torre de vigia e tripé · holofote branco · luz vermelha · a cada 40 m', detail: 'Base, bloqueio e penitenciária: torres com holofote branco e luz vermelha de emergência no perímetro.' },
    en: { label: 'Military', title: 'MILITARY', caption: 'watch tower and tripod · white searchlight · red lamp · every 40 m', detail: 'Base, roadblock and penitentiary: towers with a white searchlight and a red emergency lamp on the perimeter.' },
  },
  params: {
    yard: { length: 60, color: 0x3a3a30 },
    fence: { from: -28, to: 28, step: 4, z: -12, height: 3, color: 0x6a6c6e, wireColor: 0x9a9a9a },
    towers: { dx: [-20, 20], dz: -14 },
    alarm: { dz: -10, color: 0xff2a1a, intensity: 1.2, distance: 16, y: 3, lampDz: -11.7, lampY: 2.6 },
    sandbags: { dz: -6, length: 10, rows: 3 },
    tents: { count: 3, first: -14, pitch: 14, dz: 8, width: 6, depth: 8 },
  },
}

const rural: NeighbourhoodPattern<RuralParams> = {
  id: 'rural',
  streetWidth: 6,
  walkWidth: 0,
  typologies: ['farmhouse'],
  pole: 'wood_crossarm',
  lightColor: 0xffd27a,
  spacing: 0,
  lit: 1,
  compose: 'rural',
  marker: { height: 7 },
  text: {
    'pt-BR': { label: 'Rural', title: 'RURAL', caption: 'casa sede com varanda · poste de madeira só no cruzamento', detail: 'Casa sede com varanda. Luz só em cruzamentos e sedes.' },
    en: { label: 'Rural', title: 'RURAL', caption: 'farmhouse with a veranda · wooden pole only at the junction', detail: 'Farmhouse with a veranda. Light only at junctions and farmhouses.' },
  },
  params: {
    road: { length: 60, color: 0x4a3a2a },
    field: { y: 0.01, dz: 15, length: 60, depth: 22, color: 0x3a4a2a },
    farmhouse: { dx: -10, dz: -14 },
    pole: { dx: 6, dz: -4 },
    fence: { dz: -4, half: 28, height: 1.2, color: 0x5a4630 },
    trees: { count: 8, first: 8, span: 20, dz: -16, spread: 10, minScale: 1, scaleRange: 0.5 },
    crops: { rows: 6, perRow: 20, first: -26, pitch: 2.7, dz: 8, rowPitch: 2.2, width: 0.4, minHeight: 0.6, heightRange: 0.3, color: 0x4a5a2a },
  },
}

/** The ten patterns of the Galeria's sample sheet, in the order the page builds them. */
export const DEFAULT_PATTERNS: readonly NeighbourhoodPattern<any>[] = [downtown, suburb, workingClass, historicStreet, industrialPort, railwayVillage, mountainResort, stiltVillage, military, rural]

/** Where the sample sheet puts each pattern: a 3 x 3 grid 80 by 56 m apart, and the military cell off to the east. */
export const SAMPLE_CELLS: Readonly<Record<string, { x: number; z: number }>> = {
  downtown: { x: -80, z: -56 },
  suburb: { x: 0, z: -56 },
  working_class: { x: 80, z: -56 },
  historic_street: { x: -80, z: 0 },
  industrial_port: { x: 0, z: 0 },
  railway_village: { x: 80, z: 0 },
  mountain_resort: { x: -80, z: 56 },
  stilt_village: { x: 0, z: 56 },
  rural: { x: 80, z: 56 },
  military: { x: 160, z: 0 },
}

export { COMPOSERS }
