---
'@adatechnology/game-floorplan-structure': minor
'@adatechnology/game-floorplan-three': minor
---

Lado da casa das redes do bairro (spec 011, T2.8c): `engine.generate(id, { street: 'network' })` marca a entrada `serviceEntrance.street: 'network'` (ausente = `'own'`, todas as outras plantas iguais, goldens sem diff), põe o poste do padrão de 6 m no lote com o ramal ancorado a 5,7 m (sem quintal, o eletroduto sobe a fachada como pontalete até a mesma altura) e declara em `utilities.connections` os cinco pontos de ligação (energia com `installedKva`, telecom 0,6 m abaixo, saída da caixa de inspeção com `invert`, buzinote na divisa da frente, cavalete do hidrômetro). `connectionsInWorld` passa esses pontos para o mundo como `UtilityConnection`. No `-three`, uma casa em `'network'` nunca desenha os postes vizinhos nem a rede entre eles; com interativos o padrão é um objeto só (`service_entrance`). **Em `'network'`, `ElectricalInfo.pole` é o poste do padrão, não o da concessionária.**
