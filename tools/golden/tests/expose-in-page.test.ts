import { describe, expect, it } from 'vitest'

import { exposeInPage } from '../bin/expose-in-page.mjs'

const PAGE = [
  '<html><script>/* library */ var THREE = {}</script>',
  '<script>\n(function(){\n"use strict";\nlet R = 1;\nfunction shape(){ return R }\nreturn;\n})();\n</script>',
  '<script type="module">import "x"</script></html>',
].join('\n')

function runExposed(names: readonly string[]): Record<string, unknown> {
  const exposed = exposeInPage(PAGE, names)
  const code = [...exposed.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join(';\n')
  const holder: Record<string, unknown> = {}
  new Function('globalThis', code.replace('return;', ''))(holder)
  return holder.GoldenExposed as Record<string, unknown>
}

describe('exposeInPage', () => {
  it('publishes functions and lets a capture swap a let binding', () => {
    const exposed = runExposed(['shape', 'R']) as { shape: () => number; R: number }
    expect(exposed.shape()).toBe(1)
    exposed.R = 7
    expect(exposed.shape()).toBe(7)
  })

  it('leaves the other scripts untouched', () => {
    const exposed = exposeInPage(PAGE, ['shape'])
    expect(exposed).toContain('var THREE = {}')
    expect(exposed).toContain('<script type="module">import "x"</script>')
  })

  it('refuses a page without an IIFE', () => {
    expect(() => exposeInPage('<script>var a = 1</script>', ['a'])).toThrow('--expose')
  })
})
