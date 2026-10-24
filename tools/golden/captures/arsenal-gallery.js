/* global GoldenTool */
// Capture for the Galeria 3D do Arsenal: the barrel heat (as the page shows it, in %) and the ammunition after each Atirar and after Rajada.
// Params: seed. Weapons with no `rpm` in the page have no Rajada button and record only the shots.
(() => {
  const { seed } = globalThis.__GOLDEN_PARAMS
  const WEAPONS = ['Glock 17', 'AK-47', 'Remington 870', 'Browning M2 .50']
  const SHOTS = 5
  const FRAMES_BETWEEN_SHOTS = 40
  const FRAMES_AFTER_BURST = 90
  const recorder = GoldenTool.createEventRecorder()
  const realRandom = Math.random
  // a constant above every fault chance: the page never jams, so the numbers do not depend on its random stream
  Math.random = () => 0.99

  const select = (name) => [...document.querySelectorAll('#list button')].find((button) => button.firstChild.textContent === name).click()
  const press = (id) => document.getElementById(id).click()
  // the page redraws its status line every quarter second; pressing the quality already selected redraws it now
  const readout = () => {
    press('q-usada')
    const text = document.getElementById('wstat').textContent
    return { heatPercent: Number(/Calor (\d+)%/.exec(text)[1]), ammo: Number(document.querySelector('#wstat b').textContent) }
  }

  for (const weapon of WEAPONS) {
    select(weapon)
    recorder.record('selected', { weapon, ...readout() })
    for (let shot = 1; shot <= SHOTS; shot++) {
      press('b-fire')
      GoldenTool.stepFrames(FRAMES_BETWEEN_SHOTS)
      recorder.record('fire', { weapon, shot, ...readout() })
    }
    if (document.getElementById('b-burst').hidden) continue
    press('b-burst')
    GoldenTool.stepFrames(FRAMES_AFTER_BURST)
    recorder.record('burst', { weapon, ...readout() })
  }

  Math.random = realRandom
  return GoldenTool.createGoldenRecord({ name: 'arsenal-gallery-heat', seed, events: recorder.events(), scenes: {} })
})()
