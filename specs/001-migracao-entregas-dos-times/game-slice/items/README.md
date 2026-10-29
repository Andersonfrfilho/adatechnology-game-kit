# Fatia do jogo: itens (ZombiAdA)

Estes arquivos são o que do catálogo de itens dos times é **só do ZombiAdA** e por isso não entra no SDK (`game-items`, `game-items-goods`). Eles vão para
**`content/items/`** do repositório **`Andersonfrfilho/zombiada`** (`zombiada/content/items/`). Esta pasta é a origem versionada até lá: **não se edita à mão e não se mexe no repositório `zombiada` a partir daqui**; quem mantém o jogo copia a pasta inteira.

Os ids de item são os do `game-items-goods` (inglês); `teamId` guarda o id do time (português) de onde veio.

| Arquivo | O que tem | Linhas |
|---|---|---|
| `documents.json` | documentos e chaves da história (diário, mapa militar, ordem de evacuação, prontuário, fichas dos presos, registro da mina, fita de rádio, postal, item marcado, código do bunker, chave do teleférico, crachá da represa, chave da Casa D) com nome, categoria, peso, raridade, texto de uso e regiões | 14 |
| `regions.json` | as 10 regiões do Vale Cinzento, as regiões em que cada item aparece (`itemRegions`) e as `specialties` por região (como o time as escreveu) | 10 regiões, 101 itens, 10 especialidades |
| `uses.json` | o texto `uso` de cada item (a frase do time, em português), por id | 257 itens do time + extras do jogo |
| `damage-points.json` | pontos de dano (`damage`) e de crítico (`critical`) dos itens de arma corpo a corpo (A2: não vão para o SDK) | 20 |
| `fixed.json` | itens em posições fixas (`FIXOS`): casa, recipiente e itens, já nos ids do goods | 9 |
| `faction-loot.json` | equipamento de facção (`LOOT`): id, nome, facção, categoria, onde, efeito e raridade | 51 |
| `supply-events.json` | regras dos eventos de suprimento: queda do exército, trem de carga, cronograma de falta de luz e o teto de itens no chão por célula, cada uma com a linha da página do time | 4 |

## Como regenerar

```bash
pnpm --filter @adatechnology/items-catalog-tool build
pnpm --filter @adatechnology/items-catalog-tool catalog          # reescreve o goods e esta pasta
pnpm --filter @adatechnology/items-catalog-tool catalog:check    # falha se algo estiver defasado (inclui esta pasta)
node tools/items-catalog/dist/cli.js --game-out <pasta>          # escreve a fatia em outro lugar (ex.: content/items/ de um clone do jogo)
```

`catalog:check` e o teste `tools/items-catalog/tests/catalog-up-to-date.test.ts` comparam esta pasta com o que as fontes e o `decisions.json` geram agora; para mudar uma escolha, edite o `decisions.json` e regenere.
Com `--game-out <pasta>` o `--check` compara aquela pasta no lugar desta.
