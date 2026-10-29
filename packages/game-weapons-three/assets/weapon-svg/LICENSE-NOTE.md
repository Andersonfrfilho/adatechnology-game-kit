# Licença das miniaturas das armas

O código deste repositório é MIT (`LICENSE` na raiz). **Estes arquivos não são código e têm licença própria**, separada da MIT:

| Pasta | De onde vem | Licença |
| --- | --- | --- |
| `generated/` | projeção do modelo 3D do próprio kit, feita por `tools/weapon-thumbnails` | MIT, como o resto do repositório |
| `commons/` | contorno traçado de um desenho do Wikimedia Commons (o autor e a licença de cada arquivo estão em `CREDITS.md` e `manifest.json`) | **a licença do arquivo original**: Domínio público, CC0, CC BY ou CC BY-SA |

## O que isso exige de quem usa

- Cada arquivo de `commons/` mantém a licença do desenho de que foi traçado. **CC BY-SA continua CC BY-SA**: quem redistribuir o arquivo, ou uma obra derivada dele, mantém a mesma licença e dá o crédito. **CC BY** pede o crédito do autor. Domínio público e CC0 não pedem nada, mas o crédito está em `CREDITS.md` mesmo assim.
- O crédito vale onde a miniatura aparece. O site do kit mostra os arquivos de `commons/` em `weapon-svg/` junto de `CREDITS.md` e `manifest.json`; quem copiar a pasta leva os dois arquivos com ela.
- Misturar as pastas não muda a licença de nenhum arquivo: o código MIT do kit só **carrega** os SVG; ele não os incorpora.
- Os arquivos de `commons/` não são cópia do SVG baixado: o markup original nunca é publicado. O arquivo guarda só dois caminhos traçados do contorno do desenho (`tools/weapon-thumbnails/scripts/commons-import.mjs`), o que é uma obra derivada e por isso segue a licença do original.
- A escolha de cada arquivo, a licença e o link da página no Commons ficam registrados em `commons-sources.json` (fonte do `manifest.json`).

Se um autor pedir a retirada de um desenho, apague o arquivo de `commons/` e a linha de `commons-sources.json` e rode `node tools/weapon-thumbnails/dist/cli.js manifest`: a arma volta à miniatura gerada.
