import type { WeatherLayerId } from '../renderer'

/** The names of the visual layers in the bench; any other locale falls back to English. */
export type WeatherVisualText = { readonly layers: Readonly<Record<Exclude<WeatherLayerId, 'fog'>, string>> }

const TEXTS: Readonly<Record<string, WeatherVisualText>> = {
  en: { layers: { far_rain: 'Rain curtain', near_rain: 'Near rain and splashes', mist: 'Mist and ash', sky: 'Sky', lightning: 'Lightning', headlights: 'Headlights', haze: 'Heat haze' } },
  'pt-BR': { layers: { far_rain: 'Cortina de chuva', near_rain: 'Chuva perto e respingos', mist: 'Névoa e cinza', sky: 'Céu', lightning: 'Relâmpago', headlights: 'Faróis', haze: 'Névoa de calor' } },
}

export const weatherVisualTextOf = (locale: string): WeatherVisualText => TEXTS[locale] ?? TEXTS[locale.split('-')[0] ?? 'en'] ?? TEXTS.en!
