import type * as THREE from 'three'

/** A fake `document` whose canvases record the fills made on their 2D context. */
export interface FakeCtx {
  fillStyle: string
  fills: Array<{ style: string; x: number; y: number; w: number; h: number }>
  fillRect(x: number, y: number, w: number, h: number): void
}

export function fakeDocument(): { createElement(tag: 'canvas'): HTMLCanvasElement } {
  return {
    createElement() {
      const ctx: FakeCtx = {
        fillStyle: '',
        fills: [],
        fillRect(x, y, w, h) {
          this.fills.push({ style: this.fillStyle, x, y, w, h })
        },
      }
      return { width: 0, height: 0, getContext: () => ctx, ctx } as unknown as HTMLCanvasElement // only what the screen calls
    },
  }
}

/** The recording context of a canvas `fakeDocument` made. */
export const fakeCtxOf = (canvas: HTMLCanvasElement): FakeCtx => (canvas as unknown as { ctx: FakeCtx }).ctx

/** The part of a shader program `onBeforeCompile` patches (what these tests hand it). */
export type ShaderStub = { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader?: string; hostRan?: boolean }

/** Runs a material's `onBeforeCompile` on a stub program, as the renderer would before compiling it (no renderer is needed by the patches). */
export const compileStub = (material: THREE.Material, shader: ShaderStub): void =>
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer)
