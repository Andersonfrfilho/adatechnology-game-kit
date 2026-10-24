import { createHash } from 'node:crypto'

import { createEventRecorder, createGoldenRecord } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { cutDeclaration, evaluateSlice } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from '../paths'
import { fromMarker, readSource } from '../read-source'

const BODY_MARKER = '// ===== Corpo arredondado (Guia de estilo)'

/** G-instanced (the source test): the vertex shader chunk of the instanced body as the game builds it, joints substituted; the port must carry it byte for byte. */
export const recordBodyChunkGolden = (): GoldenRecord => {
  const { bodyChunk } = evaluateSlice<{ bodyChunk: string }>(cutDeclaration(fromMarker(readSource(SOURCE_PATHS.game), BODY_MARKER), 'bodyChunk'), ['bodyChunk'])
  const recorder = createEventRecorder()
  recorder.record('glsl', {
    length: bodyChunk.length,
    lines: bodyChunk.split('\n').length,
    sha256: createHash('sha256').update(bodyChunk).digest('hex'),
    jointUniforms: (bodyChunk.match(/vec3\(\s*-?[0-9.]+,/g) ?? []).length,
  })
  return createGoldenRecord({ name: 'game-body-chunk', seed: 1, events: recorder.events() })
}
