# Evidências — spec 001

## T0.2

**Modelo:** opus (desenho validado por architect/opus em `design/T0.2-contrato-bancada.md`). Branch `work/spec001-t0-2`.

### O que foi feito

- `game-contracts`: `src/bench.ts` novo (`ModuleControl` número/booleano/escolha/ação, `ModuleLayer`, `ModuleMetric` puxado, `BenchChange`,
  `ControlPatch`, `ModuleBench`, `checkBench`). `module.ts`: `HostEvent` ganhou `mode`, `fault`, `clear`, `safety` e `rounds`/`mode` opcionais no
  `shot`; `HostTool` ganhou `mode`, `fault`, `safety`, `heat` opcionais; `ModuleHost.bench?`; `TestableModule.controls?/layers?/metrics?`.
  Tudo exportado no `index.ts`. Módulos atuais continuam compilando.
- `game-test-room`: `src/bench.ts` (store pura, `encodeBenchState`/`decodeBenchState` com entrada hostil), `src/metrics.ts` (fps e ms por
  janela de 0,5 s do `dt` real antes do `timeScale`; draw calls/triângulos de `gl.info.render`; objetos/fragmentos/partículas/decalques de
  `renderer.stats()` + `fluidView.stats()`), `src/bench-panel.ts` (painel `tr-panel tr-bench` entre animações e testes). `room.ts` só liga:
  `detachers` virou `Map` e recarregar um módulo chama o detacher antigo antes do novo `attach`; `checkBench` no `loadModule` (`mod.bench_ok` /
  `mod.bench_fail`); `ModuleHost` por módulo com `bench` (só quando declara algo e passa no check); mudanças iniciais após o `attach`; módulo
  ativo por `openArea` ou último carregado com bancada; `mode` emitido no Q; `rounds` e `mode` no `shot`; `TestRoom.bench()` e
  `TestRoom.metrics()`; opções `metrics` e `bench`. Textos novos em `en` e `pt-BR`.
- `examples/test-room/src/main.js`: passa `bench: { state, onChange }` e mantém `?bench=` com `history.replaceState`.
- Testes: `game-contracts/tests/bench.test.ts`, `game-test-room/tests/bench.test.ts` (inclui UI em happy-dom), `tests/metrics.test.ts`,
  casos novos em `tests/module-host.test.ts` e em `game-weapons-three/tests/weapons-area.test.ts` (o módulo aceita `mode`/`fault`/`clear`/`safety`).
- READMEs dos dois pacotes, skills `game-contracts` e `game-test-room`, changeset `module-bench.md` (minor nos dois pacotes).

### Desvios do desenho

- `checkBench` recebe um tipo nomeado `BenchDeclaration` (mesma forma do parâmetro inline do desenho), exportado.
- `BenchHandle.controls()`/`layers()` não tinham tipo de retorno no desenho: devolvem `BenchControl` (declaração com os patches, `disabled` e
  `value`) e `BenchLayer` (com `on`), exportados em `types.ts`.
- `RoomUi` ganhou também `benchVisible` (interno) para a sala só amostrar a 4 Hz quando o painel tem o que mostrar.
- Declaração de bancada inválida: o relatório falha e a sala **não** empresta `host.bench` (evita store com escolha sem opções).
- Controle desabilitado por `patch({ disabled: true })` recusa `set`/`act` (devolve `false`).
- Q emite `mode` só quando o modo muda (arma de modo único não gera evento).
- `encode` grava todos os controles (menos ações) e camadas em ordem de declaração, não só os que diferem do padrão.

### Gates

| Comando | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-contracts test` | 3 arquivos, 16 testes passaram |
| `pnpm --filter @adatechnology/game-test-room test` | 9 arquivos, 83 testes passaram |
| `pnpm --filter @adatechnology/game-weapons-three test` | 1 arquivo, 5 testes passaram |
| `pnpm lint` | exit 0 |
