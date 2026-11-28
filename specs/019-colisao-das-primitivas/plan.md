# 019 — Plano

## Desenho

```
construtor ──api.box/cylinder──▶ game-shapes (esquema) ──generate({ solids: true })──▶ ShapeBatch.solids
                                                                                          │
                              game-interactables-three (mesh.ts): mesh.userData.solids ◀──┘
                                                                                          │
        game-destruction-three ── peça solta: partBoxesOf lê userData.solids ◀────────────┤
                               └─ parte fixa: StaticPartJob.solids → measureStaticPart ◀───┘
```

- **Dono de cada peça (§1):** a lista de primitivas é do `game-shapes` (é ele que assa); a malha é do `game-interactables-three`; quem colide é o
  `game-destruction-three`. Nenhum pacote novo.
- **Contrato entre eles:** `userData.solids` numa `THREE.Mesh`: lista de `{ center, half, rotation, kind, vertexStart, vertexCount, fitted? }` no espaço da
  malha. O `game-destruction-three` não importa o `game-shapes`: lê a forma do dado (validada na borda).
- **Caixa orientada de uma primitiva:** a caixa da geometria no espaço próprio dela, levada pela matriz acumulada do nó. Os eixos são as colunas da matriz;
  matriz com cisalhamento (colunas não ortogonais) cai para a caixa alinhada no espaço do lote, `fitted: true`.
- **Opt-in:** `GenerateOptions.solids` entra na chave de cache; desligado, a saída é a de hoje byte a byte (A5).
- **Parte fixa:** os sólidos entram no `StaticPartJob` e o `measureStaticPart` os devolve depois do teste de parte recolhida; orçamento, cache por versão e
  worker ficam como estão.
- **Peça por faixa (`mv.range`)** e malha que o construtor não fez: caminho atual.

## Riscos

| Risco | Tratamento |
|---|---|
| peça com muitas caixas (a casinha tem ~50) pesa no motor | `mergeFlushBoxes` já junta as que continuam; medir a contagem na sala e registrar no `evidence.md` |
| golden bit a bit de destruição muda | regravar em commit separado, com a prova de que só muda com a regra ligada (como no #575) |
| a malha é editada depois de feita (dente, furo) | os sólidos são do que foi construído; parte quebrada some inteira (parte recolhida devolve lista vazia) |
