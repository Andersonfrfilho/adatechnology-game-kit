# @adatechnology/game-physics-jolt

Adaptador de `@adatechnology/game-physics` sobre o Jolt Physics (`jolt-physics` 1.1.1, build `wasm-compat`, single-thread). O wasm vem
embutido no JavaScript: Node, vitest e a página da sala carregam sem configuração de loader e sem `SharedArrayBuffer`.

API, uso e exemplos: `packages/game-physics-jolt/README.md`; testes em `packages/game-physics-jolt/tests/`.

## Quando usar

- Só no boot do jogo ou da sala, para criar o motor e o mundo. Os sistemas do jogo nunca importam este pacote: falam com o contrato
  (`game-physics`).
- Para o desenho do que o adaptador corrige sobre o Jolt (inércia pequena, atrito, rolamento, massa do kit).

## Quem é dono de quê

- **Único pacote que importa `jolt-physics`.** Nenhum outro pacote do kit importa o motor. Regra mantida pela convenção do pacote; o
  `tools/kit-audit` não expressa "importa só este pacote" (ele confere quem desenha peças, não imports).
- **Destrói todo objeto Jolt que cria**: corpos (`RemoveBody`, `DestroyBody`), juntas, ragdolls, veículos, formas (`Release`), e as
  alocações do mundo (`Jolt.destroy`). `world.dispose()` libera o que sobrar; `world.memoryInUse()` mostra o heap (`CLAUDE.md` §8).
- Implementa `PhysicsEngine` e `PhysicsWorld` do contrato; `JoltWorld` é a classe concreta.

## Boot: um mundo e um laço por jogo

```ts
const engine = await createJoltEngine() // async: carrega o wasm uma vez (loadJolt)
const world = engine.createWorld(KIT_WORLD) // síncrono daqui em diante
const loop = createPhysicsLoop(world) // um laço por mundo
// quadros: loop.step(dt); na saída: world.dispose()
```

- `createJoltEngine()` devolve `{ name: 'jolt', jolt, createWorld }`. `loadJolt()` é só o carregamento do wasm.
- Falha ao carregar o wasm é erro de boot: não há volta ao solver próprio em tempo de execução.
- O jogo cria o motor uma vez e entrega o mundo (ou o laço) a cada costura pela opção `physics`
  (`specs/008-motor-fisico-jolt/design/arquitetura.md`, seções 3 e 4).

## O que o adaptador corrige

- **Inércia pequena** (issue do Jolt [#2220](https://github.com/jrouwe/JoltPhysics/issues/2220); texto em
  `docs/jolt-issue-small-inertia.md`). Abaixo de ~1e-6 kg·m² o Jolt troca a inércia pela de uma esfera de 1 m (0,4·m). O adaptador cria
  o corpo com a inércia `INERTIA_SCALE` (1e6) vezes maior e grava o valor certo logo depois (`unscaleInertia`). Vale também em `setShape`.
  Teste: `packages/game-physics-jolt/tests/inertia.test.ts` (cilindro de 4 g, r 5 mm).
- **Atrito por corpo** (decisão B6): cada corpo tem o seu coeficiente, estático enquanto está preso, dinâmico enquanto escorrega
  (`sticking | sliding`, decidido depois de cada passo fixo). Não há callback de JS por contato para atrito. Sensor nunca é tocado.
  Desenho: `specs/008-motor-fisico-jolt/design/atrito-por-corpo.md`.
- **Resistência ao rolamento** (`BodyDesc.rolling`, `setRolling`): um momento `C_rr` × peso × raio contra o giro, só enquanto o corpo toca
  algo. Lata rola até parar; a cápsula dorme.
- **Massa do kit em `setShape`**: corpo dinâmico mantém a massa dada (em `createBody` ou em `setShape`); a inércia nova é escalada para
  essa massa. Sem isso o Jolt usaria volume × 1000 kg/m³.

## Personagem e peças soltas (fase 4)
- Personagem: `CharacterVirtual` do Jolt por `CharacterId` (sem corpo interno: entulho o atravessa); `pushCharacter` soma `impulso / massa` e some com constante de 0,25 s; `dispose` do mundo libera o que sobrar. `setContinuous` = `LinearCast`.
- B2 em produção (T4.3, reaberta): 200/200 cápsulas dormindo a 5 s. A granada como desenhada (C_rr 0,015, sem amortecimento) repousa em 5,4 s de mediana (limite 5) e ficou fora do PR; ver `evidence.md`.

## Cuidados

- `saveState()` e `restoreState()` gravam e leem o estado exato (corpos, velocidades, sono, cache de contato, atrito, rolamento, pares
  ignorados, contagem de passos). Só valem num mundo com os mesmos corpos, juntas e veículos, na mesma ordem.
- Junta com `breakImpulse` é removida pelo adaptador no passo em que quebra; `brokenJoints` lista cada uma uma vez.
- Um mundo ocupa cerca de 19,7 MB do heap fixo de 128 MB: não crie mundo por sistema.

## Ambiente de teste

`packages/game-physics-jolt/tests/`: `inertia.test.ts` (inércia), `friction.test.ts`, `heap.test.ts` (memória em ciclos, `destroy` de
cada objeto), `loop.test.ts`, `ragdoll.test.ts`, `vehicle.test.ts`, `cascade*.test.ts` e `crowd.test.ts`. Gate:
`pnpm --filter @adatechnology/game-physics-jolt test`.
