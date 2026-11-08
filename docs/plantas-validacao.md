# Validação de todas as plantas

Teste de construção de todas as plantas registradas no SDK, junto, como a área de casas da sala de teste carrega os pacotes
(`examples/floorplan-test-area/src/entry.js`): residencial br, comercial br, estrutura, rural e pós-apocalíptico.

Arquivo: `packages/game-floorplan-three/tests/all-plans.test.ts` (sem GPU, roda no CI e no pre-push). Mora no `game-floorplan-three` porque é o
pacote que já tem todos os pacotes de planta, o catálogo de móveis e o `furnitureSpec` como dependência, sem dependência circular.

## O que confere

Percorre `engine.listTemplates()` inteiro (planta nova de qualquer pacote entra sozinha). Para cada planta: o padrão em três seeds, e cada valor de cada
opção que a planta declara (`options`: andares, porão, fundação, quartos, garagem, elevador, material...) e as pontas de `floorRange`, cada um em todos os
estados (`normal`, `fortified`, `abandoned`). Torres (20 a 60 andares) num seed só, na altura mínima; os pacotes delas conferem a altura cheia.

| Item | Como |
|---|---|
| (a) Estrutura | `validateStructure(plan.structure, { doors })` vazio: alvenaria confinada, concreto armado (NBR 6118), caminho de carga |
| (b) Spec de destruição | `validateSpec(toDestructibleSpec(structure, { wallDetail: 'coarse' }))` vazio: nada flutuando, carga até o chão |
| (c) Elementos presentes | o validador aponta onde falta cada um (baldrame, pilar em ponta, canto, encontro, vão e a cada 4 m, cinta, verga, contraverga); o teste confere também a contagem positiva: alvenaria com 4 pilares ou mais, baldrame e cinta (fora de estrutura aporticada), e paredes |
| (d) Material | toda peça da estrutura com material de `MATERIALS` e montagem registrada (`getAssembly`); todo item que a planta põe com modelo (`furnitureSpec` no tamanho do item) e toda parte do modelo com material do SDK de destruição |
| (e) Lajes e telhado apoiados | `slabsOffSupport(spec, undefined, { ledgers: true })` vazio: nenhuma laje ou telhado que só se apoia com o centro fora dos apoios |

Resultado em 2026-11-08: 30 plantas, 228 casos, todos passando.

### Achado: telhado da varanda

O telhado da varanda (`porch_roof_*`, wood_frame_house e log_cabin) se apoia nos postes da frente e é preso na parede da casa por uma junta que não carrega
(`bears: false`, o caibro de encosto). O mundo de destruição segura esse telhado "como projetado" (`heldAsDesigned`). Na construção real o caibro de
encosto carrega metade do telhado, e é isso que `ledgers: true` confere. Pendências do mesmo telhado, para uma correção própria:

- os postes da varanda se apoiam no deck, não na sapata (o poste atravessa o piso e vai até a sapata);
- o telhado da varanda é uma caixa cheia de 0,6 m com a densidade da cobertura: 11 t num telhado de 8,6 x 2,3 m (o real fica abaixo de 1 t);
- declarar o caibro de encosto como apoio de verdade exige que o mundo conte o apoio de mesma profundidade na busca do caminho de carga (`world.ts`,
  `dist[k] < dist[i]`): com a correção só na planta, o telhado fica pendurado no caibro quando os postes caem. Tentado e revertido nesta rodada.

## Itens sem modelo (dívida contada)

93 tipos de item que as plantas põem não têm construtor no renderizador das casas: a casa desenha uma caixa com rótulo (`labeledBox`), sem material e sem
destruição. A lista está em `packages/game-floorplan-three/tests/helpers/unmodelled-items.ts` e só diminui: tipo novo sem modelo falha o teste, e tipo
que ganhou modelo tem que sair da lista. A maior parte é dos pacotes comercial (mercado, farmácia, loja de armas, delegacia, pronto-socorro, escola,
posto, igreja, metalúrgica), rural (fazenda, cabana, barraco, acampamento) e da tenda de triagem. Pela regra do kit (CLAUDE.md §1), cada um vem da
entrega do time (Galeria do Vale Cinzento) antes de ser criado. Alguns já aparecem em outro SDK e podem precisar só da ponte (a conferir): trator (`game-vehicles-fleet`) e cofre (`safe`, `game-items-goods`).
