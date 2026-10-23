/** Real-world Brazilian facade colours per style, `[labelKey, hue, saturation, lightness]`. The palette picks its base colour from here. */
export const facadeColors: Record<string, [string, number, number, number][]> = {
  budget: [['canary_yellow', 48, 0.62, 0.72], ['mint_green', 140, 0.32, 0.72], ['baby_blue', 205, 0.45, 0.74], ['salmon', 14, 0.55, 0.72], ['old_rose', 350, 0.3, 0.74], ['terracotta', 15, 0.5, 0.52], ['peach', 28, 0.6, 0.78], ['exposed_cement', 35, 0.04, 0.58], ['flag_green', 135, 0.4, 0.5]],
  mid: [['off_white', 45, 0.2, 0.9], ['greige', 38, 0.12, 0.74], ['sage_green', 100, 0.14, 0.68], ['sand', 40, 0.3, 0.8], ['light_grey', 210, 0.05, 0.82], ['soft_terracotta', 17, 0.38, 0.62], ['greyish_blue', 205, 0.14, 0.7]],
  high: [['white', 40, 0.06, 0.95], ['concrete', 210, 0.03, 0.62], ['graphite', 220, 0.05, 0.28], ['off_white', 45, 0.1, 0.9], ['lead_grey', 215, 0.05, 0.42], ['natural_wood', 28, 0.45, 0.45]],
}
