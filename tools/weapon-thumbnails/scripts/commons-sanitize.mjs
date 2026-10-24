// Untrusted SVG in, SVG without active content out: no script, no event handler, no foreignObject, no external reference, no stylesheet processing instruction, no DOCTYPE or entity.
// It is a second line: the file is only ever shown through <img> (static mode) and then reduced to a traced outline by commons-import.mjs, so none of its markup is published.
const DROP_ELEMENTS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas', 'animate', 'animateMotion', 'animateTransform', 'set', 'image', 'a']

export function sanitizeSvg(text) {
  let svg = text.replace(/^﻿/, '')
  // Illustrator files name their namespaces with entities declared in the DOCTYPE: substitute the plain ones, then drop the whole DOCTYPE
  const entities = new Map([...svg.matchAll(/<!ENTITY\s+([\w.-]+)\s+"([^"<&]*)"\s*>/g)].map((match) => [match[1], match[2]]))
  svg = svg.replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\]\s*)?>/gi, '').replace(/&([\w.-]+);/g, (match, name) => (/^(amp|lt|gt|quot|apos)$/.test(name) ? match : (entities.get(name) ?? '')))
  svg = svg.replace(/<!ENTITY[\s\S]*?>/gi, '').replace(/<\?(?!xml\s)[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, inner) => inner.replace(/[<>&]/g, ''))
  for (const name of DROP_ELEMENTS) {
    svg = svg.replace(new RegExp(`<${name}\\b[^>]*?/>`, 'gi'), '').replace(new RegExp(`<${name}\\b[\\s\\S]*?</${name}\\s*>`, 'gi'), '')
  }
  // style sheets: keep the rules, drop anything that can fetch or import
  svg = svg.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_, css) => `<style>${css.replace(/@import[^;]*;?/gi, '').replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, 'none')}</style>`)
  svg = svg.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  svg = svg.replace(/\s+(?:xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/gi, (match, _all, double, single) => ((double ?? single ?? '').trim().startsWith('#') ? match : ''))
  svg = svg.replace(/(\s+style\s*=\s*)("([^"]*)"|'([^']*)')/gi, (match, lead, _all, double, single) => `${lead}"${(double ?? single ?? '').replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, 'none').replace(/@import[^;]*;?/gi, '').replace(/"/g, "'")}"`)
  svg = svg.replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, 'none')
  return svg
}

const attribute = (tag, name) => new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(2).find((value) => value !== undefined)

/** The sanitized text with a root `viewBox` (from width/height when missing) and a `width`/`height` of `longSide` pixels on the long side, ready to be drawn. Undefined when it is not an SVG. */
export function sizedSvg(clean, longSide) {
  const root = /<svg\b[^>]*>/i.exec(clean)
  if (!root) return undefined
  let viewBox = attribute(root[0], 'viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    const width = parseFloat(attribute(root[0], 'width') ?? '')
    const height = parseFloat(attribute(root[0], 'height') ?? '')
    if (!(width > 0) || !(height > 0)) return undefined
    viewBox = [0, 0, width, height]
  }
  if (!(viewBox[2] > 0) || !(viewBox[3] > 0)) return undefined
  const scale = longSide / Math.max(viewBox[2], viewBox[3])
  const width = Math.max(1, Math.round(viewBox[2] * scale))
  const height = Math.max(1, Math.round(viewBox[3] * scale))
  const stripped = root[0].replace(/\s(?:width|height|viewBox|preserveAspectRatio)\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/<svg\b/i, '')
  const open = `<svg xmlns="http://www.w3.org/2000/svg"${/xmlns:xlink/.test(stripped) ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ''} width="${width}" height="${height}" viewBox="${viewBox.join(' ')}"${stripped.replace(/\sxmlns(?::xlink)?\s*=\s*("[^"]*"|'[^']*')/gi, '')}`
  return { svg: clean.replace(root[0], open), width, height }
}
