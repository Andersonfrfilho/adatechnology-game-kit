/** Words and sentences of the vehicles area. The check lines keep the sentences of the Frota test page; `{0}`, `{1}`... are filled in order, `{0:b}` is yes / no (true / false in English), `{0:open}` open / tight, `{0:on}` on / off. */
export type VehiclesText = {
  group: string
  name: string
  items: Record<string, string>
  controls: Record<'quality' | 'paint_by_seed' | 'color_seed' | 'palette' | 'driving' | 'surface', string>
  hints: Record<'quality' | 'paint_by_seed' | 'palette' | 'driving' | 'surface', string>
  options: { quality: Record<string, string>; palette: Record<string, string>; driving: Record<string, string>; surface: Record<string, string> }
  actions: Record<'repaint' | 'drive_lane' | 'clear_lane' | 'honk', string>
  layers: Record<'damageables' | 'zones' | 'axes', string>
  metrics: Record<'vehicles' | 'triangles' | 'draw_calls' | 'size_error_mm' | 'metal' | 'glass' | 'rubber' | 'fuel' | 'speed' | 'lane', string>
  words: { yes: string; no: string; open: string; tight: string; on: string; off: string }
  lane: Record<'crash' | 'end', string>
  scenarios: Record<string, string>
  checks: Record<string, string>
}

const scenarioIds = [
  'vehicles_9mm_windshield',
  'vehicles_shotgun_door',
  'vehicles_ram_front',
  'vehicles_engine_fire',
  'vehicles_fuel_tank',
  'vehicles_unbolt_wheel',
  'vehicles_tear_bumper',
  'vehicles_break_mirror',
  'vehicles_kill_battery',
  'vehicles_rollover',
  'vehicles_melt',
  'vehicles_burnt_wreck',
  'vehicles_drive_arcade',
  'vehicles_drive_semi',
] as const

export const VEHICLE_SCENARIO_IDS: readonly string[] = scenarioIds

/** The ids of the Frota test page, for whoever keeps a report or a link made against it. */
export const PAGE_SCENARIO_ALIASES: Readonly<Record<string, string>> = {
  veiculos_9mm_parabrisa: 'vehicles_9mm_windshield',
  veiculos_espingarda_porta: 'vehicles_shotgun_door',
  veiculos_bater_frente: 'vehicles_ram_front',
  veiculos_fogo_motor: 'vehicles_engine_fire',
  veiculos_tanque: 'vehicles_fuel_tank',
  veiculos_soltar_roda: 'vehicles_unbolt_wheel',
  veiculos_arrancar_parachoque: 'vehicles_tear_bumper',
  veiculos_quebrar_retrovisor: 'vehicles_break_mirror',
  veiculos_matar_bateria: 'vehicles_kill_battery',
  veiculos_capotar: 'vehicles_rollover',
  veiculos_derreter: 'vehicles_melt',
}

export const PAGE_ITEM_ALIASES: Readonly<Record<string, string>> = {
  hatch: 'hatch',
  sedan: 'sedan',
  picape: 'pickup',
  moto: 'sport_bike',
  caminhao: 'box_truck',
  onibus: 'city_bus',
  tanque: 'battle_tank',
  helicoptero: 'attack_helicopter',
}

export const TEXT: Record<string, VehiclesText> = {
  en: {
    group: 'Vehicles',
    name: 'Vehicles area',
    items: { hatch: 'Compact hatch', sedan: 'Midsize sedan', pickup: 'Midsize pickup', sport_bike: 'Sport bike', box_truck: 'Box truck', city_bus: 'City bus', battle_tank: 'Battle tank', attack_helicopter: 'Attack helicopter', sedan_burnt: 'Burnt sedan', hatch_burnt: 'Burnt hatch' },
    controls: { quality: 'Quality', paint_by_seed: 'Paint by seed', color_seed: 'Colour seed', palette: 'Palette', driving: 'Driving', surface: 'Surface' },
    hints: {
      quality: 'High: the kit at full detail. Light: fewer segments and no interior (the light mode of the fleet); applies to the vehicles placed from now on',
      paint_by_seed: 'Off: every vehicle keeps its own paint. On: the body colour comes from the seed and the palette',
      palette: 'Auto: the palette of the vehicle group (civil, or military for the army vehicles)',
      driving: 'Arcade: the game car, simple and forgiving. Semi: a rigid body with springs, tyre friction, gears and surfaces',
      surface: 'The ground under the wheels in the semi mode (grip and aquaplaning)',
    },
    options: {
      quality: { high: 'High', lite: 'Light' },
      palette: { auto: 'Auto', civil: 'Civil', military: 'Military' },
      driving: { arcade: 'Arcade', semi: 'Semi-simulation' },
      surface: { dry_asphalt: 'Dry asphalt', wet_asphalt: 'Wet asphalt', dirt: 'Dirt', grass: 'Grass', mud: 'Mud', blood: 'Blood' },
    },
    actions: { repaint: 'Repaint with the seed', drive_lane: 'Drive the lane', clear_lane: 'Remove the lane car', honk: 'Honk the horn' },
    layers: { damageables: 'Damageable boxes by material', zones: 'Zone boxes by type', axes: 'Output frame axes' },
    metrics: { vehicles: 'Vehicles', triangles: 'Triangles', draw_calls: 'Draw calls', size_error_mm: 'Size against DIMS', metal: 'Metal boxes', glass: 'Glass boxes', rubber: 'Rubber boxes', fuel: 'Fuel boxes', speed: 'Lane speed', lane: 'Lane distance' },
    words: { yes: 'true', no: 'false', open: 'open', tight: 'tight', on: 'on', off: 'off' },
    lane: { crash: 'Lane: the car hit the wall at {0} m/s', end: 'Lane: the car stopped {0} m from the wall' },
    scenarios: {
      vehicles_9mm_windshield: 'Vehicles: 9 mm through the windshield',
      vehicles_shotgun_door: 'Vehicles: shotgun on the door',
      vehicles_ram_front: 'Vehicles: ram the front',
      vehicles_engine_fire: 'Vehicles: fire on the engine',
      vehicles_fuel_tank: 'Vehicles: shoot the fuel tank (leaks, ignites, explodes)',
      vehicles_unbolt_wheel: 'Vehicles: unbolt the wheel with the wrench',
      vehicles_tear_bumper: 'Vehicles: tear off the bumper',
      vehicles_break_mirror: 'Vehicles: break the mirror',
      vehicles_kill_battery: 'Vehicles: kill the battery (lights go out)',
      vehicles_rollover: 'Vehicles: roll over',
      vehicles_melt: 'Vehicles: melt (long fire burns the tyres)',
      vehicles_drive_arcade: 'Vehicles: arcade driving down a lane that ends in a wall',
      vehicles_drive_semi: 'Vehicles: semi-simulation braking on dry, wet and mud',
      vehicles_burnt_wreck: 'Vehicles: the burnt sedan comes out of the kit burnt, with the glass gone',
    },
    checks: {
      windshield_holes: 'Windshield: {0} hole(s), went through {1:b} (expected: 1, true)',
      windshield_cracks: 'Windshield cracked: {0} crack(s), state {1} (expected: damaged)',
      door_marks: 'Front left door: {0} hole(s), {1} dent(s), hp {2}/{3} (expected: 2 marks or more)',
      front_crush: 'Front crushed: bumper {0} dent(s), hood {1} (expected: 1 or more each)',
      bumper_off: 'The bumper came off: {0} (expected: bumper_front)',
      engine_burning: 'Engine: burning {0:b}, {1} °C (expected: true, above 250)',
      ignite_lines: 'Ignite lines in the log: {0} (expected: 1 or more)',
      tank_leaking: 'Tank leaking: {0} leak(s), {1} L left (expected: 1 or more, below 55)',
      ignited: 'Ignited: {0} ignite line(s) (expected: 1 or more)',
      exploded: 'Exploded: {0} explosion(s) (expected: 1)',
      wheel_wrench: 'Wrench on the wheel: bolts {0:open}, {1} group(s), {2} detach line(s) (expected: open, 2 or more, 1)',
      loose_parts: 'Loose parts: {0} (expected: bumper_front)',
      mirror_broken: 'Left mirror: {0} (expected: broken)',
      battery_before: 'Before: lights on and it starts (expected: yes)',
      battery_after: 'No battery: lights {0:on}, start {1:b} (expected: off, false)',
      rolled_over: 'Rolled over: {0:b} (expected: true)',
      roof: 'Roof: hp {0}/{1}, {2} dent(s) (expected: below max, 1 or more)',
      tyre_melt: 'Tyre: {0}, melted {1}%, {2} melt line(s) (expected: melted or above 50%)',
      arcade_crash: 'Arcade: the wall is hit at {0} m/s (expected: the crash above 4 m/s, at most {1})',
      arcade_bounce: 'Arcade: the car bounces back at {0} m/s (expected: below 0)',
      arcade_noise: 'Arcade: {0} engine noise(s) and {1} crash noise(s) (expected: 1 or more each)',
      semi_order: 'Semi: braking from 80 km/h takes dry {0} m, wet {1} m, mud {2} m (expected: dry shorter than wet shorter than mud)',
      semi_mud: 'Semi: a 2WD car on mud {0:on} (expected: bogged on, a bog event)',
      wreck_burnt: 'Burnt sedan: burnt flag {0:b} (expected: yes)',
      wreck_glass: 'Burnt sedan: {0} glass zone(s), {1} still above 0 (expected: 1 or more, none above 0)',
    },
  },
  'pt-BR': {
    group: 'Veículos',
    name: 'Área de veículos',
    items: { hatch: 'Hatch compacto', sedan: 'Sedã médio', pickup: 'Picape média', sport_bike: 'Moto esportiva', box_truck: 'Caminhão baú', city_bus: 'Ônibus urbano', battle_tank: 'Tanque de guerra', attack_helicopter: 'Helicóptero de ataque', sedan_burnt: 'Sedã queimado', hatch_burnt: 'Hatch queimado' },
    controls: { quality: 'Qualidade', paint_by_seed: 'Pintar pela semente', color_seed: 'Semente da cor', palette: 'Paleta', driving: 'Direção', surface: 'Piso' },
    hints: {
      quality: 'Alta: o kit com todo o detalhe. Leve: menos segmentos e sem interior (o modo leve da frota); vale para os veículos postos daqui em diante',
      paint_by_seed: 'Desligado: cada veículo mantém a própria pintura. Ligado: a cor da carroceria vem da semente e da paleta',
      palette: 'Auto: a paleta do grupo do veículo (civil, ou militar para os do exército)',
      driving: 'Arcade: o carro do jogo, simples e tolerante. Semi: corpo rígido com molas, atrito do pneu, marchas e pisos',
      surface: 'O chão sob as rodas no modo semi (aderência e aquaplanagem)',
    },
    options: {
      quality: { high: 'Alta', lite: 'Leve' },
      palette: { auto: 'Auto', civil: 'Civil', military: 'Militar' },
      driving: { arcade: 'Arcade', semi: 'Semissimulação' },
      surface: { dry_asphalt: 'Asfalto seco', wet_asphalt: 'Asfalto molhado', dirt: 'Terra', grass: 'Grama', mud: 'Lama', blood: 'Sangue' },
    },
    actions: { repaint: 'Repintar com a semente', drive_lane: 'Percorrer a pista', clear_lane: 'Tirar o carro da pista', honk: 'Buzinar' },
    layers: { damageables: 'Caixas danificáveis por material', zones: 'Caixas das zonas por tipo', axes: 'Eixos do quadro de saída' },
    metrics: { vehicles: 'Veículos', triangles: 'Triângulos', draw_calls: 'Chamadas de desenho', size_error_mm: 'Medida contra DIMS', metal: 'Caixas de metal', glass: 'Caixas de vidro', rubber: 'Caixas de borracha', fuel: 'Caixas de combustível', speed: 'Velocidade na pista', lane: 'Distância na pista' },
    words: { yes: 'sim', no: 'não', open: 'soltos', tight: 'presos', on: 'acesos', off: 'apagados' },
    lane: { crash: 'Pista: o carro bateu no muro a {0} m/s', end: 'Pista: o carro parou a {0} m do muro' },
    scenarios: {
      vehicles_9mm_windshield: 'Veículos: 9 mm atravessa o para-brisa',
      vehicles_shotgun_door: 'Veículos: espingarda na porta',
      vehicles_ram_front: 'Veículos: bater de frente',
      vehicles_engine_fire: 'Veículos: fogo no motor',
      vehicles_fuel_tank: 'Veículos: atirar no tanque (vaza, pega fogo, explode)',
      vehicles_unbolt_wheel: 'Veículos: soltar a roda com a chave inglesa',
      vehicles_tear_bumper: 'Veículos: arrancar o para-choque',
      vehicles_break_mirror: 'Veículos: quebrar o retrovisor',
      vehicles_kill_battery: 'Veículos: matar a bateria (faróis apagam)',
      vehicles_rollover: 'Veículos: capotar',
      vehicles_melt: 'Veículos: derreter (fogo longo queima os pneus)',
      vehicles_drive_arcade: 'Veículos: direção arcade numa pista que acaba num muro',
      vehicles_drive_semi: 'Veículos: frenagem da semissimulação no seco, no molhado e na lama',
      vehicles_burnt_wreck: 'Veículos: o sedã queimado sai do kit queimado, sem os vidros',
    },
    checks: {
      windshield_holes: 'Para-brisa: {0} furo(s), atravessou {1:b} (esperado: 1, sim)',
      windshield_cracks: 'Para-brisa trincou: {0} trinca(s), estado {1} (esperado: damaged)',
      door_marks: 'Porta dianteira esquerda: {0} furo(s), {1} amassado(s), vida {2}/{3} (esperado: 2 marcas ou mais)',
      front_crush: 'Frente amassada: para-choque {0} amassado(s), capô {1} (esperado: 1 ou mais cada)',
      bumper_off: 'O para-choque soltou: {0} (esperado: bumper_front)',
      engine_burning: 'Motor: pegando fogo {0:b}, {1} °C (esperado: sim, acima de 250)',
      ignite_lines: 'Linhas de ignição no log: {0} (esperado: 1 ou mais)',
      tank_leaking: 'Tanque vazando: {0} vazamento(s), {1} L restantes (esperado: 1 ou mais, menos de 55)',
      ignited: 'Pegou fogo: {0} linha(s) de ignição (esperado: 1 ou mais)',
      exploded: 'Explodiu: {0} explosão (esperado: 1)',
      wheel_wrench: 'Chave na roda: parafusos {0:open}, {1} grupo(s), {2} linha(s) de soltura (esperado: soltos, 2 ou mais, 1)',
      loose_parts: 'Peças soltas: {0} (esperado: bumper_front)',
      mirror_broken: 'Retrovisor esquerdo: {0} (esperado: broken)',
      battery_before: 'Antes: faróis acesos e dá partida (esperado: sim)',
      battery_after: 'Sem bateria: faróis {0:on}, partida {1:b} (esperado: apagados, não)',
      rolled_over: 'Capotou: {0:b} (esperado: sim)',
      roof: 'Teto: vida {0}/{1}, {2} amassado(s) (esperado: menos que o máximo, 1 ou mais)',
      tyre_melt: 'Pneu: {0}, derretido {1}%, {2} linha(s) de derretimento (esperado: melted ou mais de 50%)',
      arcade_crash: 'Arcade: bate no muro a {0} m/s (esperado: a batida acima de 4 m/s, no máximo {1})',
      arcade_bounce: 'Arcade: o carro volta a {0} m/s (esperado: abaixo de 0)',
      arcade_noise: 'Arcade: {0} ruído(s) de motor e {1} de batida (esperado: 1 ou mais de cada)',
      semi_order: 'Semi: frear de 80 km/h leva no seco {0} m, no molhado {1} m, na lama {2} m (esperado: seco menor que molhado menor que lama)',
      semi_mud: 'Semi: um carro 2WD na lama {0:on} (esperado: atolado, com evento de atolamento)',
      wreck_burnt: 'Sedã queimado: marca de queimado {0:b} (esperado: sim)',
      wreck_glass: 'Sedã queimado: {0} zona(s) de vidro, {1} ainda acima de 0 (esperado: 1 ou mais, nenhuma acima de 0)',
    },
  },
}

/** Fills a check sentence: `{i}` plain, `{i:b}` yes / no, `{i:open}` open / tight, `{i:on}` on / off. In English the `:b` form prints the value itself (true, false, undefined), as the page does. */
export function fill(text: VehiclesText, locale: string, template: string, ...values: readonly unknown[]): string {
  return template.replace(/\{(\d+)(?::(b|open|on))?\}/g, (_match, index: string, kind?: string) => {
    const value = values[Number(index)]
    if (kind === 'b') return locale === 'en' ? String(value) : value ? text.words.yes : text.words.no
    if (kind === 'open') return value ? text.words.open : text.words.tight
    if (kind === 'on') return value ? text.words.on : text.words.off
    return String(value)
  })
}
