/**
 * Models of the showcase that go over the triangle budget of their class (400 for a small item, 1200 for a large one) as the team drew them, with the count they have.
 * The page set the budget for the game and drew the models for a showcase; the models stay as delivered (the builder is the team's) and a scene at a distance wears the
 * simple shape of the second level of detail (`buildItemLod`), which is inside the budget. A model that changes its count is a drawing that changed: the test flags it.
 */
export const MODEL_BUDGET_DEVIATIONS: Readonly<Record<string, number>> = {
  canned_beans: 744,
  amoxicillin: 596,
  flashlight: 1060,
  portable_radio: 504,
  house_key: 472,
  motorcycle_helmet: 840,
  lpg_cylinder_13kg: 712,
}
