# 019 — Tasks

> Execução em 2026-11-27 na sessão `fable`, por ordem direta do dono ("aplica isso logo"): sem troca de modelo por fase (model-economy §2, exceção registrada).

## Fase 1 — game-shapes entrega os sólidos
> 🤖 Modelo: `sonnet`

- [ ] **T1.1** `ShapeSolid`, `ShapeBatch.solids`, `GenerateOptions.solids` (na chave de cache). Aceite: `tsc`, e `generate` sem a opção igual byte a byte (teste).
- [ ] **T1.2** `generate` grava um sólido por primitiva assada: caixa orientada pela matriz do nó, faixa de vértices, `fitted` no cisalhamento. Aceite:
  testes de caixa, caixa girada, cilindro, escala, parte móvel, espelho.

## Fase 2 — a malha carrega os sólidos
> 🤖 Modelo: `haiku`

- [ ] **T2.1** `createMeshApi` gera com `solids: true` e grava `mesh.userData.solids`. Aceite: teste.
- [ ] **T2.2** Guarda de catálogo (A3) em `game-interactables-three/tests`. Aceite: household e props3d inteiros.

## Fase 3 — a física usa os sólidos
> 🤖 Modelo: `sonnet`

- [ ] **T3.1** Peça solta: `partBoxesOf` usa `userData.solids` da malha própria. Aceite: banco de pernas redondas (bloco passa por baixo), casinha.
- [ ] **T3.2** Parte fixa: `StaticPartJob.solids` e `measureStaticPart`. Aceite: os mesmos, fixos; parte recolhida segue sem corpo.
- [ ] **T3.3** Goldens: provar a causa e regravar em commit separado.

## Fase 4 — fechar
> 🤖 Modelo: `sonnet`

- [ ] **T4.1** `hollow-test.mjs` na sala: `KNOWN` vazio ou sobra explicada (A2). `evidence.md` com contagem de caixas por peça.
- [ ] **T4.2** Regra 12 (`specs/regras/12-objetos-quebrados.md`) e READMEs dos três pacotes; changeset.
