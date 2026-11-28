# 019 — Tasks

> Execução em 2026-11-27 na sessão `fable`, por ordem direta do dono ("aplica isso logo"): sem troca de modelo por fase (model-economy §2, exceção registrada).

## Fase 1 — game-shapes entrega os sólidos
> 🤖 Modelo: `sonnet`

- [x] **T1.1** ✅ `ShapeSolid`, `ShapeBatch.solids`, `GenerateOptions.solids` (na chave de cache). Aceite: `tsc`, e `generate` sem a opção igual byte a byte (teste).
- [x] **T1.2** ✅ `generate` grava um sólido por primitiva assada: caixa orientada pela matriz do nó, faixa de vértices, `fitted` no cisalhamento. Aceite:
  testes de caixa, caixa girada, cilindro, escala, parte móvel, espelho.

## Fase 2 — a malha carrega os sólidos
> 🤖 Modelo: `haiku`

- [x] **T2.1** ✅ `createMeshApi` gera com `solids: true` e grava `mesh.userData.solids`. Aceite: teste.
- [x] **T2.2** ✅ Guarda de catálogo (A3) em `game-interactables-three/tests`. Aceite: household e props3d inteiros.

## Fase 3 — a física usa os sólidos
> 🤖 Modelo: `sonnet`

- [x] **T3.1** ✅ Peça solta: `partBoxesOf` usa `userData.solids` da malha própria. Aceite: banco de pernas redondas (bloco passa por baixo), casinha.
- [x] **T3.2** ✅ Parte fixa: `StaticPartJob.solids` e `measureStaticPart`. Aceite: os mesmos, fixos; parte recolhida segue sem corpo.
- [x] **T3.3** ✅ Goldens: nenhum precisou regravar (`evidence.md` A4).

## Fase 4 — fechar
> 🤖 Modelo: `sonnet`

- [x] **T4.1** ✅ `hollow-test.mjs` na sala: `KNOWN` vazio ou sobra explicada (A2). `evidence.md` com contagem de caixas por peça.
- [x] **T4.2** ✅ Regra 12 (`specs/regras/12-objetos-quebrados.md`) e READMEs dos três pacotes; changeset.

## Prompt de execução

As fases 1 a 4 foram feitas em 2026-11-27 (`evidence.md`). O que resta é a dívida declarada; para atacá-la:

```text
/oh-my-claudecode:autopilot Continue a spec specs/019-colisao-das-primitivas/ (leia spec.md, plan.md, tasks.md e evidence.md antes de começar).
Objetivo: zerar a lista KNOWN de packages/game-floorplan-three/tests/hollow-catalogue.test.ts fazendo o construtor de móveis do game-floorplan-three
entregar userData.solids (mesmo contrato do mesh api: ShapeSolid do game-shapes), uma peça por vez, tirando-a da lista quando passar.
Modelos: executor model=sonnet · revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (sonnet→opus) e registra em evidence.md.
Cada peça fecha com typecheck + testes do pacote + commit isolado, evidência em evidence.md.
Pare e pergunte antes de: regravar qualquer golden, mudar tools/golden, forma redonda exata no motor (é outra spec).
```
