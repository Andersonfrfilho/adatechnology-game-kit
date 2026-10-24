export type WeatherBenchText = {
  readonly group: string
  readonly name: string
  readonly controls: Readonly<Record<'state' | 'transition' | 'time_of_day' | 'auto_schedule' | 'seed', string>>
  readonly hints: Readonly<Record<'transition' | 'time_of_day' | 'auto_schedule' | 'seed', string>>
  readonly options: Readonly<Record<'instant' | 'ten_seconds', string>>
  readonly layers: Readonly<Record<'environment' | 'fog', string>>
  readonly metrics: Readonly<Record<'state' | 'hour' | 'rain' | 'visibility' | 'sight' | 'hearing' | 'wind' | 'heat_index' | 'wetness' | 'strikes' | 'blend' | 'temperature', string>>
  readonly scenarios: Readonly<Record<'storm' | 'blend' | 'determinism' | 'dry_ground', string>>
  /** Names of the states and climates by id; the bench falls back to the id. */
  readonly states: Readonly<Record<string, string>>
}

const EN: WeatherBenchText = {
  group: 'Weather',
  name: 'Weather area',
  controls: { state: 'Weather', transition: 'Transition', time_of_day: 'Time of day', auto_schedule: 'Automatic schedule', seed: 'Seed' },
  hints: {
    transition: 'How long the change to the chosen weather takes, in real seconds.',
    time_of_day: 'Hour of the day (the world restarts the clock there and keeps the weather).',
    auto_schedule: 'On: the climate changes the weather by itself and the clock runs 600 times faster than real time. Off: the weather stays until you change it.',
    seed: 'The same seed gives the same schedule and the same lightning.',
  },
  options: { instant: 'At once', ten_seconds: '10 seconds' },
  layers: { environment: 'Write host environment', fog: 'Fog in the scene' },
  metrics: {
    state: 'Weather',
    hour: 'Hour',
    rain: 'Rain',
    visibility: 'Visibility',
    sight: 'Sight scale',
    hearing: 'Hearing scale',
    wind: 'Wind',
    heat_index: 'Heat index',
    wetness: 'Ground wetness',
    strikes: 'Lightning strikes',
    blend: 'Blend',
    temperature: 'Temperature',
  },
  scenarios: {
    storm: 'A storm sees less and is heard less than a clear day, and strikes lightning',
    blend: 'A change blends over its time and settles in the new weather',
    determinism: 'The same seed gives the same day, another seed another one',
    dry_ground: 'Rain wets the ground and it dries after the rain stops',
  },
  states: {
    clear: 'Clear',
    overcast: 'Overcast',
    light_rain: 'Light rain',
    heavy_rain: 'Heavy rain',
    storm: 'Storm',
    fog: 'Fog',
    windy: 'Windy',
    cyclone: 'Cyclone',
    typhoon: 'Typhoon',
    extreme_heat: 'Extreme heat',
  },
}

const PT_BR: WeatherBenchText = {
  group: 'Clima',
  name: 'Área de clima',
  controls: { state: 'Clima', transition: 'Transição', time_of_day: 'Hora do dia', auto_schedule: 'Sorteio automático', seed: 'Semente' },
  hints: {
    transition: 'Quanto demora a mudança para o clima escolhido, em segundos reais.',
    time_of_day: 'Hora do dia (o mundo reinicia o relógio nela e mantém o clima).',
    auto_schedule: 'Ligado: o clima do lugar muda sozinho e o relógio corre 600 vezes mais rápido que o real. Desligado: o clima fica até você trocar.',
    seed: 'A mesma semente dá o mesmo sorteio e os mesmos raios.',
  },
  options: { instant: 'De uma vez', ten_seconds: '10 segundos' },
  layers: { environment: 'Escrever no ambiente do host', fog: 'Névoa na cena' },
  metrics: {
    state: 'Clima',
    hour: 'Hora',
    rain: 'Chuva',
    visibility: 'Visibilidade',
    sight: 'Escala de visão',
    hearing: 'Escala de audição',
    wind: 'Vento',
    heat_index: 'Índice de calor',
    wetness: 'Chão molhado',
    strikes: 'Raios',
    blend: 'Mistura',
    temperature: 'Temperatura',
  },
  scenarios: {
    storm: 'Tempestade enxerga e é ouvida menos que um dia limpo, e solta raios',
    blend: 'Uma mudança se mistura no tempo dela e assenta no clima novo',
    determinism: 'A mesma semente dá o mesmo dia, outra semente dá outro',
    dry_ground: 'A chuva molha o chão e ele seca depois que a chuva para',
  },
  states: {
    clear: 'Limpo',
    overcast: 'Nublado',
    light_rain: 'Chuva fraca',
    heavy_rain: 'Chuva forte',
    storm: 'Tempestade',
    fog: 'Neblina',
    windy: 'Ventania',
    cyclone: 'Ciclone',
    typhoon: 'Tufão',
    extreme_heat: 'Calor extremo',
  },
}

export const weatherBenchTextOf = (locale: string): WeatherBenchText => (locale === 'en' ? EN : PT_BR)
