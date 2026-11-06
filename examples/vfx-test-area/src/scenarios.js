// Scenarios of the effects area, written against the test room's `ScenarioContext` ({ room, step, expect }). Texts are pt-BR and en.
// `sink()` answers the effects the room lends the module (`host.effects`), `catalog` the ids it plays.

/** @typedef {import('@adatechnology/game-contracts').EffectSink} EffectSink */
/** @typedef {import('@adatechnology/game-test-room').ScenarioContext} ScenarioContext */

/** @type {[number, number, number]} */
const ORIGIN = [0, 0.1, -3]
const BLAST_BUDGET = { particles: 400, lights: 6 }

/**
 * @param {string} locale
 * @param {() => EffectSink | undefined} sink
 * @param {() => { explosions: string[]; recipes: string[] }} catalog
 */
export function buildScenarios(locale, sink, catalog) {
  const en = locale === 'en'
  const T = (/** @type {string} */ pt, /** @type {string} */ e) => (en ? e : pt)
  const sc = (/** @type {string} */ id, /** @type {string} */ name, /** @type {(context: ScenarioContext) => void} */ run) => ({ id: `vfx_${id}`, name, run })
  const stat = (/** @type {string} */ key) => sink()?.stats?.()[key] ?? 0

  return [
    sc('explosions', T('Todas as explosões do Lab', 'Every explosion of the Lab'), ({ step, expect }) => {
      const effects = /** @type {EffectSink} */ (sink())
      expect(effects !== undefined, T('a sala empresta os efeitos', 'the room lends the effects'))
      for (const id of catalog().explosions) {
        const handle = effects.play({ effect: id, point: ORIGIN, seed: 7 })
        step(0.25)
        expect(handle !== null && stat('puffs') + stat('sparks') > 0, T(`${id} desenha fumaça e faíscas`, `${id} draws smoke and sparks`))
        step(8)
      }
    }),
    sc('recipes', T('Todas as receitas da Oficina', 'Every recipe of the Workshop'), ({ step, expect }) => {
      const effects = /** @type {EffectSink} */ (sink())
      for (const id of catalog().recipes) {
        const handle = effects.play({ effect: id, point: ORIGIN, direction: [1, 0.2, 0.3], seed: 11 })
        expect(handle !== null, T(`${id} toca`, `${id} plays`))
        step(0.5)
        if (handle !== null) effects.stop(handle)
      }
      step(4)
    }),
    sc('budget', T('Quatro granadas seguidas respeitam o orçamento de luzes', 'Four grenades in a row stay inside the light budget'), ({ step, expect }) => {
      const effects = /** @type {EffectSink} */ (sink())
      let most = 0
      for (let i = 0; i < 4; i++) {
        effects.play({ effect: 'm67', point: [ORIGIN[0] + i * 1.5, ORIGIN[1], ORIGIN[2]], seed: 20 + i })
        step(0.2)
        most = Math.max(most, stat('blastLights') + stat('fireLights'))
      }
      expect(most > 0 && most <= BLAST_BUDGET.lights, T(`no máximo ${BLAST_BUDGET.lights} luzes (${most})`, `at most ${BLAST_BUDGET.lights} lights (${most})`))
      step(8)
    }),
  ]
}
