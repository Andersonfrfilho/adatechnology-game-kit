/** Decor of the commercial style: sparse, mostly lights and blinds. Read by the residential decor pass. */
export const commercialDecorProfile = {
  light: { ceiling_light: 0.6, track_spot: 0.4 },
  lightAreaPerLight: 9,
  mult: 0.3,
  plantChance: 0.2,
  tablePlantChance: 0,
  hangingPlantChance: 0,
  curtain: 0.5,
  airConditioner: {},
  smallPictureChance: 0.8,
}

/** Decor of the farm style: a plant here and there and curtains on every window (a farmhouse is lived in). */
export const farmDecorProfile = {
  light: { ceiling_light: 0.7, pendant: 0.3 },
  lightAreaPerLight: 12,
  mult: 0.7,
  plantChance: 0.35,
  tablePlantChance: 0.3,
  hangingPlantChance: 0.05,
  curtain: 1,
  airConditioner: {},
  smallPictureChance: 0.7,
}
