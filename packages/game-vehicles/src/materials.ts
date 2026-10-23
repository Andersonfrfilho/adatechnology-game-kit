/** Shared materials, studio environment map, paint colours and text textures. */
import type { Kit } from './types'

export function installMaterials(kit: Kit): void {
  const THREE = kit.THREE
  const I = kit._
  const document = kit.document

  /* ================= materiais ================= */
  const RUST = new THREE.Color('#5e3220')
  /* kit.configure({ palette: { rust } }) changes the rust tone of aged paint */
  const cache: any = {}
  /* studio environment map (canvas cube): without it every very metallic material (chrome, reflector, aluminium) renders almost black.
       Grey-blue sky, a light band on the horizon and a dark floor. It is added automatically to every material with metalness >= 0.6. */
  let envTex: any = null
  function studioEnvironment() {
    if (envTex) return envTex
    const faces = []
    const S = 64
    for (let f = 0; f < 6; f++) {
      const cv = document.createElement('canvas')
      cv.width = cv.height = S
      const x: any = cv.getContext('2d')
      if (f === 2) {
        x.fillStyle = '#7d8a99'
        x.fillRect(0, 0, S, S)
        x.fillStyle = 'rgba(235,240,245,0.55)'
        x.fillRect(S * 0.3, S * 0.3, S * 0.4, S * 0.4)
      } else if (f === 3) {
        x.fillStyle = '#16181a'
        x.fillRect(0, 0, S, S)
      } else {
        const gr = x.createLinearGradient(0, 0, 0, S)
        gr.addColorStop(0, '#7a8796')
        gr.addColorStop(0.42, '#b9c2cb')
        gr.addColorStop(0.5, '#e6eaee')
        gr.addColorStop(0.56, '#5b6066')
        gr.addColorStop(1, '#1a1c1e')
        x.fillStyle = gr
        x.fillRect(0, 0, S, S)
        if (f === 0 || f === 4) {
          x.fillStyle = 'rgba(255,255,255,0.35)'
          x.fillRect(S * 0.15, S * 0.12, S * 0.25, S * 0.22)
        }
      }
      faces.push(cv)
    }
    envTex = new THREE.CubeTexture(faces)
    envTex.needsUpdate = true
    return envTex
  }
  kit.studioEnvironment = studioEnvironment
  function makeMaterial(color: any, o: any) {
    o = o || {}
    const c = color instanceof THREE.Color ? color : new THREE.Color(color)
    const key =
      's' +
      c.getHexString() +
      JSON.stringify(o, function (k, v) {
        return v && v.isColor ? '#' + v.getHexString() : v && v.isTexture ? v.uuid : v
      })
    if (!cache[key]) {
      const o2 = Object.assign({}, o)
      delete o2.noEnv
      const mt = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0, flatShading: false }, o2))
      if (!o.envMap && o.noEnv !== true && mt.metalness >= 0.6) {
        mt.envMap = studioEnvironment()
        if (o.envMapIntensity == null) mt.envMapIntensity = 0.55 + (mt.metalness - 0.6) * 1.6
      }
      cache[key] = mt
    }
    return cache[key]
  }
  function makeFlatMaterial(color: any, o: any) {
    return makeMaterial(color, Object.assign({ flatShading: true, roughness: 0.92 }, o || {}))
  }
  const DOUBLE_SIDE = THREE.DoubleSide
  function toColor(hex: any) {
    return new THREE.Color(hex)
  }
  const MATERIALS = {
    trim: makeMaterial('#17191b', { roughness: 0.7 }),
    rubber: makeMaterial('#111111', { roughness: 0.95, side: DOUBLE_SIDE }),
    chrome: makeMaterial('#b8bcbf', { metalness: 0.9, roughness: 0.28 }),
    steel: makeMaterial('#6c7175', { metalness: 0.7, roughness: 0.45 }),
    glass: makeMaterial('#2a3c44', { roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.4, depthWrite: false, side: DOUBLE_SIDE }),
    tint: makeMaterial('#121a1e', { roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.62, depthWrite: false, side: DOUBLE_SIDE }),
    /* rear glass: darker, so the interior does not look like an open bed seen from behind */
    rearTint: makeMaterial('#0c1114', { roughness: 0.04, metalness: 0.45, transparent: true, opacity: 0.84, depthWrite: false, side: DOUBLE_SIDE }),
    glassDark: makeMaterial('#0c1317', { roughness: 0.06, metalness: 0.75, side: DOUBLE_SIDE }),
    armorGlass: makeMaterial('#1d302d', { roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.6, depthWrite: false, side: DOUBLE_SIDE }),
    glassEdge: makeMaterial('#a9bcc1', { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, side: DOUBLE_SIDE }),
    lens: makeMaterial('#eef3f5', { roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false }),
    lensRed: makeMaterial('#c0281c', { roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.42, depthWrite: false }),
    lensAmber: makeMaterial('#d88a2a', { roughness: 0.04, transparent: true, opacity: 0.4, depthWrite: false }),
    housing: makeMaterial('#111214', { roughness: 0.45, metalness: 0.2 }),
    reflector: makeMaterial('#dfe3e6', { metalness: 0.9, roughness: 0.12, side: DOUBLE_SIDE }),
    reflectorLit: makeMaterial('#e8e2cc', { metalness: 0.6, roughness: 0.18, emissive: toColor('#cfc19a'), emissiveIntensity: 1.6, side: DOUBLE_SIDE }),
    hole: makeMaterial('#040506', { roughness: 1, side: DOUBLE_SIDE }),
    dark: makeMaterial('#0a0b0c', { roughness: 1, side: DOUBLE_SIDE }),
    head: makeMaterial('#efe6c9', { emissive: toColor('#f0dcaa'), emissiveIntensity: 1.7, roughness: 0.2 }),
    led: makeMaterial('#e6f2ff', { emissive: toColor('#cfe6ff'), emissiveIntensity: 1.6, roughness: 0.2 }),
    tail: makeMaterial('#8a1a14', { emissive: toColor('#7a0d08'), emissiveIntensity: 0.8, roughness: 0.25 }),
    amber: makeMaterial('#c8781e', { emissive: toColor('#b0600c'), emissiveIntensity: 0.8, roughness: 0.3 }),
    rev: makeMaterial('#cfcfc8', { emissive: toColor('#5a5a55'), emissiveIntensity: 0.35, roughness: 0.3 }),
    blue: makeMaterial('#1d4f9a', { emissive: toColor('#2f6fe0'), emissiveIntensity: 1.2, roughness: 0.3 }),
    green: makeMaterial('#1d7a3a', { emissive: toColor('#2fbf5a'), emissiveIntensity: 1.0, roughness: 0.3 }),
    broken: makeMaterial('#1b1b1a', { roughness: 0.6 }),
    bulbBroken: makeMaterial('#232220', { roughness: 0.7, metalness: 0.2 }),
    wood: makeMaterial('#6b4a2e', { roughness: 0.9 }),
    leather: makeMaterial('#4a2f20', { roughness: 0.7 }),
    seat: makeMaterial('#1e1f22', { roughness: 0.85 }),
    alu: makeMaterial('#8e959a', { metalness: 0.6, roughness: 0.42, side: DOUBLE_SIDE }),
    carpet: makeMaterial('#141517', { roughness: 1 }),
    plastic: makeMaterial('#1f2023', { roughness: 0.75 }),
    headliner: makeMaterial('#6f6c66', { roughness: 0.95, side: DOUBLE_SIDE }),
    gauge: makeMaterial('#0d1512', { emissive: toColor('#4fbf8a'), emissiveIntensity: 0.35, roughness: 0.4 }),
    screen: makeMaterial('#0b1220', { emissive: toColor('#3d6cb0'), emissiveIntensity: 0.4, roughness: 0.2 }),
    bay: makeMaterial('#2c3033', { roughness: 0.8, metalness: 0.2, emissive: toColor('#0c0e10'), emissiveIntensity: 1, side: DOUBLE_SIDE }),
    hoodLiner: makeMaterial('#1c1d1e', { roughness: 0.95, side: DOUBLE_SIDE }),
    block: makeMaterial('#a3abb0', { metalness: 0.55, roughness: 0.38, emissive: toColor('#1a1d1f'), emissiveIntensity: 1 }),
    cover: makeMaterial('#3c4044', { metalness: 0.4, roughness: 0.35, emissive: toColor('#101213'), emissiveIntensity: 1 }),
    radiator: makeMaterial('#3a3f42', { metalness: 0.5, roughness: 0.55 }),
    yellow: makeMaterial('#e0b81c', { roughness: 0.4 }),
    capBlue: makeMaterial('#2a63c4', { roughness: 0.4 }),
    postRed: makeMaterial('#b3261e', { roughness: 0.4 }),
    postBlack: makeMaterial('#0c0c0c', { roughness: 0.4 }),
    coolant: makeMaterial('#e85fa3', { roughness: 0.15, transparent: true, opacity: 0.5, depthWrite: false }),
    coolantLiq: makeMaterial('#d0307a', { roughness: 0.3, emissive: toColor('#3a0a1e'), emissiveIntensity: 0.4 }),
    washer: makeMaterial('#9fd2ea', { roughness: 0.15, transparent: true, opacity: 0.5, depthWrite: false }),
    hv: makeMaterial('#e4670f', { roughness: 0.5 }),
    hose: makeMaterial('#121212', { roughness: 0.8 }),
  }
  kit.makeMaterial = makeMaterial
  kit.makeFlatMaterial = makeFlatMaterial
  kit.materials = MATERIALS
  function paintColor(hex: any, st: any) {
    const c = new THREE.Color(hex)
    if (st === 'damaged') {
      c.lerp(RUST, 0.22)
      c.multiplyScalar(0.9)
    }
    return c
  }
  kit.paintColor = paintColor
  const texCache: any = {}
  function textTexture(text: any, o: any) {
    o = o || {}
    const key = text + JSON.stringify(o)
    if (texCache[key]) return texCache[key]
    const w = o.w || 512
    const h = o.h || 128
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const x: any = cv.getContext('2d')
    if (o.bg) {
      x.fillStyle = o.bg
      x.fillRect(0, 0, w, h)
    }
    if (o.band) {
      x.fillStyle = o.band
      x.fillRect(0, 0, w, h * 0.24)
      x.fillStyle = '#fff'
      x.font = '600 ' + Math.round(h * 0.15) + "px 'IBM Plex Sans', Arial, sans-serif"
      x.textAlign = 'center'
      x.textBaseline = 'middle'
      x.fillText(kit.t('plate.band'), w / 2, h * 0.125)
    }
    x.fillStyle = o.fg || '#111'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    /* shrink the font until the text fits the width (never clips) */
    let fs = Math.round(h * (o.size || 0.6))
    const fam = (o.weight || '700') + ' '
    const ff = 'px ' + (o.font || "'Saira Condensed', 'Arial Narrow', sans-serif")
    x.font = fam + fs + ff
    while (fs > 6 && x.measureText(text).width > w * 0.94) {
      fs -= 1
      x.font = fam + fs + ff
    }
    x.fillText(text, w / 2, o.band ? h * 0.62 : h / 2 + 2)
    const t = new THREE.CanvasTexture(cv)
    texCache[key] = t
    return t
  }
  kit.textTexture = textTexture

  Object.assign(I, { RUST, cache, studioEnvironment, makeMaterial, makeFlatMaterial, DOUBLE_SIDE, toColor, MATERIALS, paintColor, texCache, textTexture })
}
