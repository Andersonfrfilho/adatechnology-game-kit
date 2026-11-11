# @adatechnology/game-shapes

Renderer-agnostic 3D shape generator: a JSON shape schema (primitives, extrusions, lathes, cheap booleans, transforms, groups, named parts, materials by id, LOD rules, instancing hints) in, typed-array buffers per material out. Pure, deterministic by seed, worker friendly and cacheable; the generators are bit-exact ports of three.js r160.

API completa: `packages/game-shapes/README.md`.

## Regra de ouro: igual ao three, bit a bit
Os geradores são portes linha a linha do three r160 e o assado usa a aritmética do three na mesma ordem. Os testes comparam cada array com o do
three (`Object.is` por elemento). Ao migrar um pacote, os goldens de cena dele **não mudam nem um byte**; o que não bater exatamente fica no
caminho antigo e entra na lista do T9 (§7.3). Não arredonde, não "melhore" a geometria.

## Quando usar e quando não usar
- Use para toda geometria nova e para migrar os acumuladores e kits dos pacotes `-three` (ordem no T9 §7.2).
- Não ponha conteúdo de jogo aqui: o motor só sabe de formas; o móvel, o item e a casa ficam nos seus pacotes, que geram o esquema.
- Ainda não tem: `TubeGeometry` (curvas Catmull-Rom), `ShapeGeometry`, poliedros, cápsula, extrusão com curvas. Falta uma primitiva: acrescente
  aqui com teste de igualdade contra o three.

## Como usar
```ts
import { generate, buildPrimitive, registerGenerator, validateShape } from '@adatechnology/game-shapes'

const out = generate({ version: 1, root: { kind: 'group', children: [
  { kind: 'box', size: [1, 0.05, 0.6], material: 'wood', color: 0x7a5434, position: [0, 0.75, 0] },
  { kind: 'group', part: 'drawer', position: [0, 0.6, 0.25], children: [{ kind: 'box', size: [0.4, 0.12, 0.5], material: 'wood' }] },
] } }, { seed: 3 })
out.levels[0].batches   // um por (peça, material): positions, normals, uvs, colors, indices, ranges, bounds
out.parts               // pivô de cada peça
buildPrimitive({ kind: 'cylinder', radialSegments: 12 }) // uma primitiva sozinha = os arrays do three
```
- `heading` + `position` é o giro de um item no chão (matriz de rotação em y, como `makeRotationY`), `rotationOrder: 'YXZ'` é o das primitivas do
  props3d.
- Peças: a transformação do nó com `part` é o pivô, relativo à raiz; os filhos são assados no espaço da peça. Nos níveis de LOD a peça é assada
  em repouso.
- Cache: `shapeKey(schema, options)` (64 bits) e o cache de modelos de primitiva por parâmetros (`templateCacheStats`). Resultado em cache é
  só leitura: `cloneBuffers` antes de deformar.
- Worker: `createShapePool({ size, spawn, cache })` com `generate`/`generateMany` (chave em voo compartilhada, arrays transferidos, sem `spawn`
  gera na própria thread); no script do worker, `installShapeWorker(self, { generators })` de `@adatechnology/game-shapes/worker`. Gerador
  `custom` é função: registre dos dois lados. `createShapeCache({ maxEntries, maxBytes })` é o LRU por chave.
- `transferablesOf(buffers)` lista os `ArrayBuffer` para `postMessage`.

## Arquivos
- `src/primitives/three-generators.ts`, `extrude.ts`, `earcut.ts` (cópia do three): os portes; `difference.ts`: o booleano barato.
- `src/math.ts`: compose, euler, normal matrix como o three. `src/generate.ts`: o assado, peças, faixas, pontos, LOD, instâncias.
- `src/schema.ts` + `schema/shape.schema.json`: JSON Schema e validador. `tests/three-parity.test.ts`: a prova bit a bit.
- `src/cache.ts`, `src/pool.ts`, `src/worker.ts`: cache e workers; `tests/pool.test.ts` compara o worker_threads byte a byte.
