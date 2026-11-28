# 021 — Tasks

## Fase 1 — Contrato e régua
> 🤖 Modelo: `opus` (contrato do ponto único e o limite derivado)

- [x] T1.1 `src/kit-energy.ts`: `KIT_RULE`, `kineticEnergyOf`, `fallEnergyOf`, `KitEnergyLedger` (episódio, contador, aviso, sem corte).
- [x] T1.2 Teste da régua contra `energyHeightOf` da spec 008 e do aviso uma vez por episódio.

## Fase 2 — Ligar as regras
> 🤖 Modelo: `sonnet`

- [x] T2.1 `goOverIfBalanced`, `checkUndermined` por `ruleImpulse`; `EDGE_NUDGE` por `ruleSpin`; `topple` por `begin/end`.
- [x] T2.2 `renderer.kitEnergy()`, `RendererOptions.onKitEnergy`, evento `kitEnergy` no `game-kit-defaults`.
- [x] T2.3 Sala: `invariant-log.ts` com `kit_energy` e `broken_floating`; `room.ts` sem crescer.
- [x] T2.4 `tests/kit-energy.test.ts` nos cinco tamanhos, três cenários; `KNOWN` com os três casos achados.
- [ ] T2.5 🧠 Decisão do dono sobre os três casos de `KNOWN` (muda o comportamento visível).
- [ ] T2.6 Mesmo teste sobre o catálogo real em `game-floorplan-three`.
- [ ] T2.7 Ligar as regras que faltam (ver "Fora do escopo" na spec).
