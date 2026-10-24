// Untrusted SVG in, SVG without active content out: no script, no event handler, no foreignObject, no external reference, no stylesheet processing instruction, no DOCTYPE or entity.
// It is a second line: the file is only ever shown through <img> (static mode) and then reduced to a traced outline by commons-import.mjs, so none of its markup is published.
const DROP_ELEMENTS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas', 'animate', 'animateMotion', 'animateTransform', 'set', 'image', 'a']

const PLAIN_ENTITY = /^(amp|lt|gt|quot|apos)$/
const EXTERNAL_URL = /url\(\s*(['"]?)(?!#)[^)]*\)/gi

export function sanitizeSvg(text: string): string {
  let svg = text.replace(/^﻿/, '')
  // Illustrator files name their namespaces with entities declared in the DOCTYPE: substitute the plain ones, then drop the whole DOCTYPE
  const entities = new Map([...svg.matchAll(/<!ENTITY\s+([\w.-]+)\s+"([^"<&]*)"\s*>/g)].map((match) => [match[1], match[2]]))
  svg = svg
    .replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\]\s*)?>/gi, '')
    .replace(/&([\w.-]+);/g, (match: string, name: string) => (PLAIN_ENTITY.test(name) ? match : (entities.get(name) ?? '')))
  svg = svg
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    .replace(/<\?(?!xml\s)[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_match: string, inner: string) => inner.replace(/[<>&]/g, ''))
  for (const name of DROP_ELEMENTS) {
    svg = svg.replace(new RegExp(`<${name}\\b[^>]*?/>`, 'gi'), '').replace(new RegExp(`<${name}\\b[\\s\\S]*?</${name}\\s*>`, 'gi'), '')
  }
  // style sheets: keep the rules, drop anything that can fetch or import
  svg = svg.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_match: string, css: string) => `<style>${css.replace(/@import[^;]*;?/gi, '').replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, 'none')}</style>`)
  svg = svg.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  svg = svg.replace(/\s+(?:xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/gi, (match: string, _all: string, double: string | undefined, single: string | undefined) => ((double ?? single ?? '').trim().startsWith('#') ? match : ''))
  svg = svg.replace(
    /(\s+style\s*=\s*)("([^"]*)"|'([^']*)')/gi,
    (_match: string, lead: string, _all: string, double: string | undefined, single: string | undefined) =>
      `${lead}"${(double ?? single ?? '').replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, 'none').replace(/@import[^;]*;?/gi, '').replace(/"/g, "'")}"`,
  )
  return svg.replace(EXTERNAL_URL, 'none')
}
