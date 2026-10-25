import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createSeededRandom } from '@adatechnology/golden-tool'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ASH, FOG_NEAR, FOG_ZONE_NEAR, HEADLIGHTS, LIGHTNING, MIST, RAIN_CURTAIN, RAIN_CURTAIN_FRAGMENT, RAIN_CURTAIN_VERTEX, SKY_DAY, SKY_NIGHT, ZONE_FOG_DEFAULTS, ZONE_LIGHT, createRainCurtain, rainCurtainPositions } from '../src'

type Fixture = {
  seed: number
  cuts: Record<string, string>
  rain: { count: number; floats: number; positionsSha256: string; head: number[]; tail: number[]; vertexShader: string; fragmentShader: string; transparent: boolean; depthWrite: boolean; frustumCulled: boolean; uniforms: string[] }
  lines: { sky: string[]; zone: string; palette: string[]; fog: string }
}
const fixture = JSON.parse(readFileSync(new URL('../../../tools/golden/fixtures/weather/game-rain-curtain.json', import.meta.url), 'utf8')) as Fixture
const short = (value: number): string => String(value).replace(/^0\./, '.')
const hex = (value: number): string => `0x${value.toString(16).padStart(6, '0')}`

describe("the game's rain curtain (jogo.js, cut by tools/golden/bin/record-weather-visual.mjs)", () => {
  it('draws the same 14 000 points under the same seed, bit for bit', () => {
    const positions = rainCurtainPositions(createSeededRandom(fixture.seed))
    expect(positions.length).toBe(fixture.rain.floats)
    expect(RAIN_CURTAIN.count).toBe(fixture.rain.count)
    expect(Array.from(positions.slice(0, 12))).toEqual(fixture.rain.head)
    expect(Array.from(positions.slice(-6))).toEqual(fixture.rain.tail)
    expect(createHash('sha256').update(Buffer.from(positions.buffer)).digest('hex')).toBe(fixture.rain.positionsSha256)
  })

  it('has the shaders of the page, character for character', () => {
    expect(RAIN_CURTAIN_VERTEX).toBe(fixture.rain.vertexShader)
    expect(RAIN_CURTAIN_FRAGMENT).toBe(fixture.rain.fragmentShader)
  })

  it('builds the same points object: transparent, no depth write, never culled, the page uniforms', () => {
    const curtain = createRainCurtain(THREE, { random: createSeededRandom(fixture.seed) })
    const material = curtain.object.material as THREE.ShaderMaterial
    expect(material.transparent).toBe(fixture.rain.transparent)
    expect(material.depthWrite).toBe(fixture.rain.depthWrite)
    expect(curtain.object.frustumCulled).toBe(fixture.rain.frustumCulled)
    expect(Object.keys(material.uniforms).sort()).toEqual([...fixture.rain.uniforms].sort())
    expect((curtain.object.geometry.getAttribute('position') as THREE.BufferAttribute).count).toBe(fixture.rain.count)
    curtain.dispose()
  })

  it("keeps the page's numbers: the box, the fall, the point size", () => {
    expect(RAIN_CURTAIN.width).toBe(70)
    expect(RAIN_CURTAIN.height).toBe(25)
    expect(RAIN_CURTAIN.speed).toBe(13)
    expect(RAIN_CURTAIN.pointSize).toBe(1.6)
    expect(fixture.rain.vertexShader).toContain('uTime*13.')
    expect(fixture.rain.vertexShader).toContain('gl_PointSize = 1.6')
  })
})

describe("the game's sky, fog and zone fog (skyUpdate), as the lines the page has", () => {
  const sky = fixture.lines.sky.join('\n')
  it('uses the page colours for the night and the day sky', () => {
    expect(fixture.lines.palette.join('\n')).toContain(`new THREE.Color(${hex(SKY_NIGHT)})`)
    expect(fixture.lines.palette.join('\n')).toContain(`new THREE.Color(${hex(SKY_DAY)})`)
  })
  it('dims the sky by 0.8 in rain (the heavy rain skyScale) and lights the zone by 0.35 + 0.65 s', () => {
    expect(sky).toContain('if (rainOn) sky.multiplyScalar(0.8)')
    expect(sky).toContain(`multiplyScalar(${ZONE_LIGHT.base} + s * ${ZONE_LIGHT.sun})`)
  })
  it('has the fog far of 140 in rain and 220 dry, the near of 25 and 4 in the zone', () => {
    expect(sky).toContain('lerp(rainOn ? 140 : 220, ZONA_NEBLINA.longe, ZONA_NEBLINA.peso)')
    expect(sky).toContain(`scene.fog.near = lerp(${FOG_NEAR}, ${FOG_ZONE_NEAR}, ZONA_NEBLINA.peso)`)
    expect(fixture.lines.fog).toContain(`${FOG_NEAR}, 200`)
  })
  it('has the zone fog colour and far of the page', () => {
    expect(fixture.lines.zone).toContain(`cor: new THREE.Color(${hex(ZONE_FOG_DEFAULTS.color)})`)
    expect(fixture.lines.zone).toContain(`longe: ${ZONE_FOG_DEFAULTS.far}`)
  })
})

describe('the numbers of the Workshop pages the renderer repeats', () => {
  it('has the lightning, mist, ash and headlight values of oficina-vfx', () => {
    const source = readFileSync(new URL('../../../specs/001-migracao-entregas-dos-times/sources/efeitos__oficina-vfx.js', import.meta.url), 'utf8')
    expect(source).toContain(`hemi.intensity=.6+I*${LIGHTNING.light}`)
    expect(source).toContain('scene.background.setRGB(.043+I*.25,.063+I*.27,.094+I*.32)')
    expect(source).toContain('S.white=Math.max(S.white,I*.12)')
    expect(source).toContain(`new THREE.SpotLight(${hex(HEADLIGHTS.spot.color)},0,${HEADLIGHTS.spot.distance},.33,.5,1.6)`)
    expect(source).toContain(`new THREE.ConeGeometry(${HEADLIGHTS.cone.radius},${HEADLIGHTS.cone.length},${HEADLIGHTS.cone.segments},1,true)`)
    expect(source).toContain('emit(\'lit\',streak,600,dt')
    expect(source).toContain('c0:0xcfdcf0,a:.9')
    expect(source).toContain("emit('fog',norP,5,dt")
    expect(source).toContain(`c0:${hex(MIST.color)},a:${short(MIST.alpha)}`)
    expect(source).toContain(`c0:${hex(ASH.color)},a:${short(ASH.alpha)}`)
  })
})
