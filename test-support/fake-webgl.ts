// A WebGL2 context that answers what three r160's WebGLRenderer asks with plausible values and draws nothing: the program cache, the shadow pass and the
// program keys run as in a browser, so a test can count the programs a scene links (`linked`) without a GPU. Not for pixels or timings.

type Answer = (...args: unknown[]) => unknown

export interface FakeWebGl {
  /** The canvas and context to pass as `new WebGLRenderer({ canvas, context })`. */
  readonly canvas: HTMLCanvasElement
  readonly context: WebGL2RenderingContext
  /** `linkProgram` calls so far. */
  readonly linked: () => number
}

const CONTEXT_ATTRIBUTES = { alpha: true, antialias: false, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default' }

export function createFakeWebGl(): FakeWebGl {
  const constants = new Map<string, number>()
  let nextConstant = 0x9000
  let links = 0
  const constant = (name: string): number => {
    let value = constants.get(name)
    if (value === undefined) {
      value = nextConstant++
      constants.set(name, value)
    }
    return value
  }
  const canvas = { width: 64, height: 64, style: {}, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as HTMLCanvasElement
  const parameter = (name: unknown): unknown => {
    if (name === constant('VERSION')) return 'WebGL 2.0'
    if (name === constant('SHADING_LANGUAGE_VERSION')) return 'WebGL GLSL ES 3.00'
    if (name === constant('VIEWPORT') || name === constant('SCISSOR_BOX')) return new Int32Array([0, 0, 64, 64])
    return 16
  }
  const answers: Record<string, Answer> = {
    getExtension: () => ({}),
    getSupportedExtensions: () => [],
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    getParameter: parameter,
    getShaderParameter: () => true,
    // no active uniforms or attributes: three asks for none of their locations
    getProgramParameter: (_program, name) => (name === constant('ACTIVE_UNIFORMS') || name === constant('ACTIVE_ATTRIBUTES') ? 0 : true),
    getProgramInfoLog: () => '',
    getShaderInfoLog: () => '',
    getAttribLocation: () => -1,
    getUniformLocation: () => null,
    getContextAttributes: () => CONTEXT_ATTRIBUTES,
    isContextLost: () => false,
    checkFramebufferStatus: () => constant('FRAMEBUFFER_COMPLETE'),
    linkProgram: () => {
      links++
    },
  }
  // three tells WebGL2 apart by the constructor's name
  const globals = globalThis as { WebGL2RenderingContext?: new () => object }
  globals.WebGL2RenderingContext ??= class WebGL2RenderingContext {}
  const target = Object.assign(new globals.WebGL2RenderingContext(), { canvas, drawingBufferWidth: 64, drawingBufferHeight: 64 }) as Record<string, unknown>
  const context = new Proxy(target, {
    get(object, key) {
      if (typeof key === 'symbol') return undefined
      if (key in object) return object[key]
      if (/^[A-Z0-9_]+$/.test(key)) return constant(key)
      const answer = answers[key]
      if (answer) return answer
      if (key.startsWith('create')) return () => ({})
      return () => undefined
    },
  }) as unknown as WebGL2RenderingContext
  return { canvas, context, linked: () => links }
}
