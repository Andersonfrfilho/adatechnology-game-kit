const HEAT_STRESS_BANDS: ReadonlyArray<readonly [indexC: number, stress: number]> = [
  [27, 0],
  [32, 1 / 3],
  [41, 2 / 3],
  [54, 1],
]
const NOAA_REGRESSION_FROM_F = 80

const toFahrenheit = (celsius: number): number => (celsius * 9) / 5 + 32
const toCelsius = (fahrenheit: number): number => ((fahrenheit - 32) * 5) / 9

/**
 * NOAA heat index in °C: the Steadman estimate averaged with the temperature, and from 80 °F up the Rothfusz regression with the low-humidity and
 * high-humidity adjustments. Built from + - * / and `sqrt` only, so it is the same on every engine.
 */
export function heatIndexC(temperatureC: number, relativeHumidityPercent: number): number {
  const t = toFahrenheit(temperatureC)
  const r = relativeHumidityPercent
  const steadman = 0.5 * (t + 61 + (t - 68) * 1.2 + r * 0.094)
  const simple = (steadman + t) / 2
  if (simple < NOAA_REGRESSION_FROM_F) return toCelsius(simple)
  let index =
    -42.379 +
    2.04901523 * t +
    10.14333127 * r -
    0.22475541 * t * r -
    0.00683783 * t * t -
    0.05481717 * r * r +
    0.00122874 * t * t * r +
    0.00085282 * t * r * r -
    0.00000199 * t * t * r * r
  if (r < 13 && t >= 80 && t <= 112) index -= ((13 - r) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17)
  else if (r > 85 && t >= 80 && t <= 87) index += ((r - 85) / 10) * ((87 - t) / 5)
  return toCelsius(index)
}

/** 0..1 across the NOAA bands (caution 27, extreme caution 32, danger 41, extreme danger 54 °C), linear between them. */
export function heatStress(heatIndex: number): number {
  const first = HEAT_STRESS_BANDS[0]!
  const last = HEAT_STRESS_BANDS[HEAT_STRESS_BANDS.length - 1]!
  if (heatIndex <= first[0]) return first[1]
  if (heatIndex >= last[0]) return last[1]
  for (let index = 1; index < HEAT_STRESS_BANDS.length; index++) {
    const [upperC, upperStress] = HEAT_STRESS_BANDS[index]!
    const [lowerC, lowerStress] = HEAT_STRESS_BANDS[index - 1]!
    if (heatIndex <= upperC) return lowerStress + ((heatIndex - lowerC) / (upperC - lowerC)) * (upperStress - lowerStress)
  }
  return last[1]
}
