# Comparação da vegetação: site, artefato e SDK

Gerado por `packages/game-vegetation/scripts/compare-viveiro.mjs`. Três versões do motor `GameVegetation` geram as mesmas plantas (8 espécies do Viveiro, sementes 1 a 5, LOD 0):

- **site**: o bundle da página `site/pages/vegetacao/viveiro.html` (`sources/vegetacao__viveiro.js`, script 0);
- **artefato**: o bundle do artefato `Bs3p84TFhG1A9YfdXSGZaQ`, mais novo (geometria das peças de madeira: `radius`, `length`, `axis`, `base`);
- **SDK**: `dist/index.global.js` deste pacote, depois do merge V8.

Resultado: o SDK é igual ao artefato em 40 de 40 plantas (peças, triângulos e geometria); o site é igual ao artefato em 40 de 40 plantas se não se contar a geometria das peças. A diferença entre o site e o artefato é só a geometria das peças de madeira.

| espécie | semente | peças | triângulos | peças de madeira com geometria (site / artefato / SDK) | SDK = artefato | site = artefato sem a geometria |
| --- | ---: | ---: | ---: | --- | :---: | :---: |
| mango_tree | 1 | 46 | 3826 | 0 / 7 / 7 | sim | sim |
| mango_tree | 2 | 46 | 3822 | 0 / 7 / 7 | sim | sim |
| mango_tree | 3 | 46 | 3826 | 0 / 7 / 7 | sim | sim |
| mango_tree | 4 | 46 | 3822 | 0 / 7 / 7 | sim | sim |
| mango_tree | 5 | 46 | 3718 | 0 / 7 / 7 | sim | sim |
| coconut_palm | 1 | 11 | 3152 | 0 / 1 / 1 | sim | sim |
| coconut_palm | 2 | 11 | 3152 | 0 / 1 / 1 | sim | sim |
| coconut_palm | 3 | 11 | 3152 | 0 / 1 / 1 | sim | sim |
| coconut_palm | 4 | 11 | 3152 | 0 / 1 / 1 | sim | sim |
| coconut_palm | 5 | 11 | 3152 | 0 / 1 / 1 | sim | sim |
| araucaria | 1 | 3 | 4775 | 0 / 1 / 1 | sim | sim |
| araucaria | 2 | 3 | 4775 | 0 / 1 / 1 | sim | sim |
| araucaria | 3 | 3 | 4775 | 0 / 1 / 1 | sim | sim |
| araucaria | 4 | 3 | 4775 | 0 / 1 / 1 | sim | sim |
| araucaria | 5 | 3 | 4775 | 0 / 1 / 1 | sim | sim |
| mandacaru | 1 | 13 | 1844 | 0 / 13 / 13 | sim | sim |
| mandacaru | 2 | 15 | 2096 | 0 / 15 / 15 | sim | sim |
| mandacaru | 3 | 15 | 2148 | 0 / 15 / 15 | sim | sim |
| mandacaru | 4 | 15 | 2096 | 0 / 15 / 15 | sim | sim |
| mandacaru | 5 | 15 | 2096 | 0 / 15 / 15 | sim | sim |
| prickly_pear | 1 | 20 | 872 | 0 / 13 / 13 | sim | sim |
| prickly_pear | 2 | 32 | 1452 | 0 / 25 / 25 | sim | sim |
| prickly_pear | 3 | 19 | 756 | 0 / 12 / 12 | sim | sim |
| prickly_pear | 4 | 32 | 1452 | 0 / 25 / 25 | sim | sim |
| prickly_pear | 5 | 26 | 1104 | 0 / 19 / 19 | sim | sim |
| crown_cactus | 1 | 4 | 906 | 0 / 3 / 3 | sim | sim |
| crown_cactus | 2 | 4 | 906 | 0 / 3 / 3 | sim | sim |
| crown_cactus | 3 | 4 | 906 | 0 / 3 / 3 | sim | sim |
| crown_cactus | 4 | 4 | 906 | 0 / 3 / 3 | sim | sim |
| crown_cactus | 5 | 4 | 906 | 0 / 3 / 3 | sim | sim |
| banana_with_bunch | 1 | 5 | 1517 | 0 / 1 / 1 | sim | sim |
| banana_with_bunch | 2 | 5 | 1517 | 0 / 1 / 1 | sim | sim |
| banana_with_bunch | 3 | 5 | 1517 | 0 / 1 / 1 | sim | sim |
| banana_with_bunch | 4 | 5 | 1517 | 0 / 1 / 1 | sim | sim |
| banana_with_bunch | 5 | 5 | 1517 | 0 / 1 / 1 | sim | sim |
| potted_fern | 1 | 3 | 804 | 0 / 0 / 0 | sim | sim |
| potted_fern | 2 | 3 | 804 | 0 / 0 / 0 | sim | sim |
| potted_fern | 3 | 3 | 804 | 0 / 0 / 0 | sim | sim |
| potted_fern | 4 | 3 | 804 | 0 / 0 / 0 | sim | sim |
| potted_fern | 5 | 3 | 804 | 0 / 0 / 0 | sim | sim |
