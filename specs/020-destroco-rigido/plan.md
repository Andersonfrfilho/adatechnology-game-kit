# 020 — Plano

## Desenho

```
fratura → FragmentSystem.spawn
            ├─ pequeno → física leve (como antes)
            └─ grande  → o.rigid.add(malha, meias-medidas, massa, velocidades) → PieceBody { debris: true }, camada 'rubble'
                         FragmentSystem só acompanha: dorme quando o corpo dorme, acorda quando o corpo acorda, remove o corpo quando a malha sai
```

- **Por que pelo sistema de peças e não direto no mundo físico:** é ele que põe o chão sob o que cai (ladrilhos de terreno sob demanda), mantém os sólidos
  fixos, lança na explosão e respeita `maxAwakePieces`. Um corpo solto direto no motor cairia pelo terreno ainda não assentado.
- **Por que `debris: true` no `PieceBody`:** não é objeto do mundo de destruição. `renderer.pieces()` e `piece()` não o devolvem; `hardLanding` e `slam` não
  batem com ele em nada.
- **Por que camada nova:** na camada `debris` o pedaço empurrava peça solta e personagem. Medido antes de trocar: `destruction-pieces-never-rise` subiu de
  menos de 0,5 m para 1,2 m e `broken-catalogue-spin` acusou as quatro piscinas (5 m/s). Com `rubble` as duas voltam a passar sem mexer em limite.
- **Nunca instanciado:** os grandes são poucos; cada um é desenhado pela própria malha, que o corpo move. A interpolação entre passos é a das peças.

## Arquivos

- `game-physics/src/contract.ts`: camada `rubble`, pares `static`×`rubble` e `rubble`×`rubble`.
- `game-physics-jolt/src/constants.ts`: a roda não enxerga `rubble`.
- `game-destruction-three/src/fragments.ts`: porta `RigidDebris`, `Live.rigid`, `follow`, `wakeRigid`, `release`.
- `game-destruction-three/src/engine-pieces.ts`: camada por tipo, `throughStatics`, `meetStaticsAgain`.
- `game-destruction-three/src/renderer.ts`: a porta ligada ao `pieceSys`; `pieces()`/`piece()` sem destroço.
