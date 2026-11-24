---
'@adatechnology/game-urban': minor
'@adatechnology/game-urban-three': minor
---

Postes de verdade à noite, tudo opcional (quem não liga as opções desenha igual a antes):

- `game-urban`: o poste falhando (`flicker: true`) põe o mesmo `flickerPhase` (`flickerPhaseOf(x, z)`) na lente e na luz. As peças sem falha não mudam.
- `game-urban-three`, `physicalLights: true` (com `lights`): a luz do poste recebe `physicalIntensityOf(part)` e o holofote `physicalIntensityOf(part, feixe)`. Os números do time foram afinados no r128 sem luz fisicamente correta; o fator faz o chão no pé do poste (ou onde o feixe bate) ficar tão claro quanto na página. Sem a opção, as fontes mantêm os números da página.
- `game-urban-three`, `flickerLenses: true`: o poste falhando pisca a cabeça junto com a luz. A fase é arredondada para 4 grupos, com um material de lente por cor e grupo, e as duas seguem `flickerLevel` (`LAMP_FLICKER`). Assim a cabeça pisca mesmo sem luz real. Sem a opção, a lente fica acesa e a luz segue a fórmula da página (`sin(23t + x)`...), nos dois caminhos.
- Exporta `physicalIntensityOf`, `flickerLevel`, `flickerGroupOf`, `flickerGroupPhase` e `LAMP_FLICKER`.
