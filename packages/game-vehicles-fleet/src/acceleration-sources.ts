/**
 * Where the acceleration rating (0-10) of each car and SUV comes from: the real 0-100 km/h of the model it is inspired by, placed on the class band of
 * `defaultRangeTable.accelerationByClass` in `game-vehicles-proving` (cars 15.5 s at rating 1 to 4.8 s at 10; suvs 12.7 s to 6.7 s), rounded to the nearest rating.
 * `seconds: null` is "no source" ("sem fonte"): no verified figure for that exact model, so the earlier rating stays. Motorcycles, heavy, military, bicycle, tractor and the pickups and vans are not in this review.
 */
export interface AccelerationSource {
  readonly seconds: number | null
  readonly source: string
}

export const FLEET_ACCELERATION_SOURCES: Readonly<Record<string, AccelerationSource>> = {
  compact_hatch: { seconds: 13.3, source: 'Chevrolet Onix 1.0 naturally aspirated: 13.3 s ethanol / 13.7 s petrol (GM, via https://www.webmotors.com.br/wm1/testes/teste-chevrolet-onix-1-0/ e https://www.fichacompleta.com.br/carros/chevrolet/onix-1-0-2025)' },
  taxi: { seconds: 13.3, source: 'Chevrolet Onix Plus LT 1.0 naturally aspirated: 13.3 s (https://garagem360.com.br/?p=216236)' },
  entry_hatch: { seconds: 15.5, source: 'Renault Kwid 1.0: 15.5 s, Renault figure (https://www.icarros.com.br/noticias/testes-e-comparativos/como-anda-o-renault-kwid-intense,-de-r$-39.990-/23022.html); 14.9 s measured by Quatro Rodas' },
  electric_hatch: { seconds: 12.3, source: 'BYD Dolphin 95 hp: 12.3 s (spec sheets; https://www.motor.es/byd/dolphin/comfort-27792.html); a Colombian test measured 10.9 s (https://www.elcarrocolombiano.com/pruebas/byd-dolphin-primer-carro-electrico-colombia-prueba-test-drive-video/)' },
  midsize_sedan: { seconds: 9.9, source: 'Toyota Corolla GLi 2.0: 9.9 s, Motor Show measurement (https://motorshow.com.br/blog-sobre-rodas-avaliacao-toyota-corolla-gli-e-o-melhor-carro-que-voce-pode-comprar-hoje-com-r-110-mil)' },
  police_sedan: { seconds: 9.0, source: 'Chevrolet Cruze 1.4 turbo: 9.0 s, Motor Show (https://motorshow.com.br/segunda-geracao-coloca-o-chevrolet-cruze-em-patamar-superior); 8.8 s at Autopapo' },
  highway_police_sedan: { seconds: 9.0, source: 'Chevrolet Cruze 1.4 turbo: 9.0 s, Motor Show (https://motorshow.com.br/segunda-geracao-coloca-o-chevrolet-cruze-em-patamar-superior)' },
  beetle: { seconds: 30.9, source: 'Volkswagen Fusca 1300 (1971 on): 30.9 s, spec database (https://www.fichacompleta.com.br/en/carros/volkswagen/fusca-1300-1975); sources range from 24 to 45 s, all above the cars band: rating 1' },
  boxy_hatch: { seconds: 14.7, source: 'Fiat Uno Mille Economy/Celebration (Fire flex, 2009-2013): 14.7 s (https://carro.blog.br/usados/avaliacao-do-fiat-uno-mille-economy-1-0-4p-2013-o-ultimo-ano-do-uno-quadrado.html)' },
  family_hatch: { seconds: 12.3, source: 'Volkswagen Gol G5 1.0 flex on ethanol: 12.3 s, Webmotors (https://www.webmotors.com.br/wm1/?p=675225)' },
  rideshare_hatch: { seconds: 14.5, source: 'Hyundai HB20 1.0 naturally aspirated: 14.5 s ethanol / 15.4 s petrol, Hyundai catalogue (https://www.hyundai.com.br/content/dam/hmb/cars/hb20/2023/catalogos/Catalogo_DIgital_Novo_HB20_Sense%20Plus_2024.pdf)' },
  turbo_hatch: { seconds: 9.9, source: 'Volkswagen Polo 200 TSI: 9.9 s petrol / 9.6 s ethanol (https://autoentusiastas.com.br/2017/09/andando-com-o-novo-polo-com-video/); Motor Show 10.1 / 9.6 s' },
  fastback_sedan: { seconds: 8.2, source: 'Honda Civic 1.5 turbo (10th generation): 8.2 s, maker spec sheets; 8.43 s measured (https://www.headlightmag.com/preview-accelaration-fuel-consumption-honda-civic-el-plus/)' },
  classic_six_sedan: { seconds: 12.2, source: 'Chevrolet Opala Comodoro 4.1 (1990): 12.2 s, spec database (https://www.fichacompleta.com.br/en/carros/comparativo/opala-ss-4-1-1971-vs-opala-comodoro-4-1-1990)' },
  v8_coupe: { seconds: 4.8, source: 'Ford Mustang GT 5.0: 4.8 s, Ford figure (https://media.ford.com/content/fordmedia/feu/en/news/2015/04/27/all-new-mustang-sprints-0-100-km-h-in-under-5-seconds--2-200-ord.html)' },
  compact_suv: { seconds: 10.0, source: 'Volkswagen T-Cross 200 TSI: 10.0 s petrol, VW spec sheet (https://garagem360.com.br/?p=249858)' },
  hybrid_suv: { seconds: 11.8, source: 'Toyota Corolla Cross Hybrid (Brazil): 11.8 s measured by Motor Show (https://motorshow.com.br/avaliacao-corolla-cross-hibrido-2-0-tem-197-cv-e-humilha-o-brasileiro-com-freio-eletronico-teto-e-muito-mais)' },
  midsize_suv: { seconds: null, source: 'no source: Jeep Compass Longitude, only figures for other engines and markets (10.3 s at 130 hp, 9.2 s at 150 hp, 10.7 s at altitude)' },
  large_suv: { seconds: null, source: 'no source: the current Toyota SW4 2.8 has no published 0-100 (the only figure found is the old SW4, 25.5 s)' },
}

/**
 * Where the figures of the models outside the rating review come from (the physics engine's proving run, T6.2d): not a rating placed on a class band, a band or a ficha figure of their own.
 * The numbers live where they are used (`ranges.ts` of `game-vehicles-proving`, `from-stats.ts` of `game-vehicles-driving`); this is the record that goes with the content.
 */
export const FLEET_PHYSICS_SOURCES: Readonly<Record<string, readonly AccelerationSource[]>> = {
  bicycle: [
    { seconds: 24, source: 'to 20 km/h at the mean acceleration of observed riders, 0.231 m/s^2 over about 26 s at about 120 W: Parkin and Rotheram 2010, Transport Policy 17(5) 335-341 (https://uwe-repository.worktribe.com/output/987466): the slowest edge of the band' },
    { seconds: 7.2, source: 'to 20 km/h from "9 to 14 s to 25 km/h" of an everyday rider, 0.5 to 0.8 m/s^2 (https://myvelo.net/blogs/ebike-blog/wie-schnell-beschleunigt-ein-e-bike-motor-gewicht-realitaet; a shop article, the power not stated): the fastest edge' },
  ],
  battle_tank: [
    { seconds: null, source: 'power 20.05 kW/t: M1 Abrams 17.74 to 20.05 kW/t, 1.12 MW (https://en.wikipedia.org/wiki/M1_Abrams); Leopard 2A6 17.8 kW/t (https://en.wikipedia.org/wiki/Leopard_2). Turn: a tracked vehicle pivots on the spot, "neutral steering" (https://en.wikipedia.org/wiki/Tank_steering_systems): the turn band starts at 0' },
  ],
}
