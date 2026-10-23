/** How much decor a style gets. */
export interface DecorProfile {
  /** Ceiling light type weights. */
  light: Record<string, number>
  lightAreaPerLight: number
  /** Multiplier for the number of pictures. */
  mult: number
  plantChance: number
  tablePlantChance: number
  hangingPlantChance: number
  /** Chance of a curtain or blinds per window. */
  curtain: number
  /** Chance of a split air conditioner per room type. */
  airConditioner: Record<string, number>
  smallPictureChance: number
}

export const residentialDecorProfiles: Record<string, DecorProfile> = {
  budget: { light: { ceiling_light: 1 }, lightAreaPerLight: 99, mult: 0.5, plantChance: 0.25, tablePlantChance: 0.2, hangingPlantChance: 0, curtain: 0.6, airConditioner: { bedroom: 0.3 }, smallPictureChance: 0.8 },
  mid: { light: { ceiling_light: 0.45, track_spot: 0.35, pendant: 0.2 }, lightAreaPerLight: 10, mult: 1.6, plantChance: 0.6, tablePlantChance: 0.5, hangingPlantChance: 0.15, curtain: 1, airConditioner: { bedroom: 1, living: 0.85, office: 0.7 }, smallPictureChance: 0.4 },
  high: { light: { track_spot: 0.4, ceiling_light: 0.2, pendant: 0.2, chandelier: 0.2 }, lightAreaPerLight: 7, mult: 2.6, plantChance: 0.9, tablePlantChance: 0.8, hangingPlantChance: 0.3, curtain: 1, airConditioner: { bedroom: 1, living: 1, office: 1, dining: 0.8, cinema: 1 }, smallPictureChance: 0.2 },
}
