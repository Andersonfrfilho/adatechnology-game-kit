import { describe, expect, it } from 'vitest'

import { sanitizeSvg } from '../src/sanitize'

const wrap = (inner: string, header = ''): string => `${header}<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">${inner}</svg>`

const HOSTILE: Record<string, { svg: string; forbidden: RegExp }> = {
  'onload on the root': { svg: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>', forbidden: /onload|alert/i },
  'onclick on a path': { svg: wrap('<path d="M0 0h1v1z" onclick="alert(1)"/>'), forbidden: /onclick|alert/i },
  script: { svg: wrap('<script>alert(1)</script><path d="M0 0h1v1z"/>'), forbidden: /<script|alert/i },
  foreignObject: { svg: wrap('<foreignObject width="10" height="10"><body xmlns="http://www.w3.org/1999/xhtml"><iframe src="https://evil.test"></iframe></body></foreignObject>'), forbidden: /foreignObject|iframe|evil\.test/i },
  'xlink:href to an external file': { svg: wrap('<use xlink:href="https://evil.test/x.svg#a"/>'), forbidden: /href|evil\.test/i },
  'href to an external image': { svg: wrap('<image href="https://evil.test/p.png" width="1" height="1"/>'), forbidden: /<image|evil\.test/i },
  'style @import': { svg: wrap('<style>@import url("https://evil.test/a.css"); path{fill:red}</style><path d="M0 0h1v1z"/>'), forbidden: /@import|evil\.test/i },
  'style url() in a property': { svg: wrap('<path d="M0 0h1v1z" style="fill:url(https://evil.test/p)"/>'), forbidden: /evil\.test/i },
  'DOCTYPE with an entity': { svg: wrap('<path d="M0 0h1v1z"/>&xxe;', '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'), forbidden: /DOCTYPE|ENTITY|etc\/passwd|&xxe;/i },
  'entity that hides a script': { svg: wrap('&payload;', '<!DOCTYPE svg [<!ENTITY payload "<script>alert(1)</script>">]>'), forbidden: /<script|alert|DOCTYPE|ENTITY/i },
  'a href javascript:': { svg: wrap('<a href="javascript:alert(1)"><path d="M0 0h1v1z"/></a>'), forbidden: /javascript:|alert|<a\b/i },
  'animate that sets an href': { svg: wrap('<a><animate attributeName="href" values="javascript:alert(1)"/><path d="M0 0h1v1z"/></a>'), forbidden: /javascript:|alert|<animate/i },
  'stylesheet processing instruction': { svg: wrap('<path d="M0 0h1v1z"/>', '<?xml-stylesheet href="https://evil.test/a.css"?>'), forbidden: /xml-stylesheet|evil\.test/i },
}

describe('sanitizeSvg', () => {
  for (const [name, { svg, forbidden }] of Object.entries(HOSTILE)) {
    it(`removes ${name}`, () => {
      expect(sanitizeSvg(svg)).not.toMatch(forbidden)
    })
  }

  it('keeps the drawing and the internal references', () => {
    const clean = sanitizeSvg(wrap('<defs><path id="a" d="M0 0h1v1z"/></defs><use href="#a" fill="url(#g)"/>'))
    expect(clean).toContain('d="M0 0h1v1z"')
    expect(clean).toContain('href="#a"')
    expect(clean).toContain('url(#g)')
  })
})
