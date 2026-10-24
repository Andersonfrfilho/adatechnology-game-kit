// Draws a sanitized SVG with Chromium (as an <img>, which runs no script and loads nothing; the context blocks the network anyway) and reduces it to tones:
// 0 empty (transparent or near white), 1 solid (dark), 2 light.
import { createRequire } from 'node:module'

import { sizedSvg } from './commons-sanitize.mjs'

const require = createRequire(import.meta.url)
const loadPlaywright = () => {
  try {
    return require('playwright-core')
  } catch {
    throw new Error('playwright-core not found: run pnpm install (and `npx playwright-core install chromium` once)')
  }
}

// Chromium's sandbox stays on. Only a root user in a container, where it cannot start, needs WEAPON_THUMBNAILS_NO_SANDBOX=1; the file is drawn as an <img> with the network blocked either way.
const launchArgs = () => (process.env.WEAPON_THUMBNAILS_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])

export const LONG_SIDE = 3200
const EMPTY_ABOVE = 238
const SOLID_BELOW = 110

export async function openRenderer() {
  const { chromium } = loadPlaywright()
  const browser = await chromium.launch({ args: launchArgs() })
  const context = await browser.newContext()
  await context.route('**/*', (route) => (/^(data|blob|about):/.test(route.request().url()) ? route.continue() : route.abort()))
  const page = await context.newPage()
  await page.setContent('<canvas id="c"></canvas>')
  return {
    async tones(cleanSvg) {
      const sized = sizedSvg(cleanSvg, LONG_SIDE)
      if (!sized) return undefined
      const result = await page.evaluate(
        async ({ svg, width, height, emptyAbove, solidBelow }) => {
          const image = new Image()
          image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
          await image.decode()
          const canvas = document.getElementById('c')
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d', { willReadFrequently: true })
          context.clearRect(0, 0, width, height)
          context.drawImage(image, 0, 0, width, height)
          const { data } = context.getImageData(0, 0, width, height)
          const tone = new Uint8Array(width * height)
          for (let index = 0; index < tone.length; index++) {
            const alpha = data[index * 4 + 3] / 255
            const luminance = (0.299 * data[index * 4] + 0.587 * data[index * 4 + 1] + 0.114 * data[index * 4 + 2]) * alpha + 255 * (1 - alpha)
            tone[index] = luminance > emptyAbove ? 0 : luminance < solidBelow ? 1 : 2
          }
          let text = ''
          for (let at = 0; at < tone.length; at += 0x8000) text += String.fromCharCode(...tone.subarray(at, at + 0x8000))
          return btoa(text)
        },
        { svg: sized.svg, width: sized.width, height: sized.height, emptyAbove: EMPTY_ABOVE, solidBelow: SOLID_BELOW },
      )
      return { width: sized.width, height: sized.height, tone: Uint8Array.from(Buffer.from(result, 'base64')) }
    },
    close: () => browser.close(),
  }
}
