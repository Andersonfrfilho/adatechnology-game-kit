// @ts-check
import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import noBareRemove from './tools/eslint/no-bare-remove.mjs'

export default tseslint.config(
  {
    // specs/ guarda o código dos times como referência de porte (artefatos e fontes extraídas), não é código do SDK
    ignores: ['.claude/**', '**/dist/**', '**/node_modules/**', '**/*.mjs', 'specs/**', '**/tests/fixtures/team-golden/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // everything is typed (CLAUDE.md section 10): the any that predate the rule are counted per file in eslint-suppressions.json and may only go down
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },  {
    // lights have one owner (spec 005 D4): every other package asks the LightBudget of game-render-three instead of creating a light
    files: ['packages/*/src/**/*.{ts,tsx}'],
    ignores: ['packages/game-render-three/**', 'packages/game-test-room/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.type='MemberExpression'][callee.property.name=/^(PointLight|SpotLight|RectAreaLight|DirectionalLight|HemisphereLight|AmbientLight)$/]",
          message: 'Do not create a light here: ask the LightBudget of game-render-three (spec 005 D4).',
        },
        {
          selector: "NewExpression[callee.name=/^(PointLight|SpotLight|RectAreaLight|DirectionalLight|HemisphereLight|AmbientLight)$/]",
          message: 'Do not create a light here: ask the LightBudget of game-render-three (spec 005 D4).',
        },
        {
          selector: "AssignmentExpression[left.property.name='castShadow'][left.object.name=/[Ll]ight$/]",
          message: 'Shadow slots are fixed at boot, in the LightBudget (spec 005 D4).',
        },
      ],
    },
  },
  {
    // the one allowlisted file: a scene of its own, off screen, drawn by a renderer of its own (see `renderItemThumbnail`), so its lights reach no material of the game
    files: ['packages/game-items-three/src/thumbnails.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // CLAUDE.md, "Memória": what leaves the scene for good is freed (discardObject3D), not only taken out of it
    files: ['packages/*/src/**/*.{ts,tsx}'],
    plugins: { kit: { rules: { 'no-bare-remove': noBareRemove } } },
    rules: { 'kit/no-bare-remove': 'error' },
  },
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['warn', { max: 1500, skipBlankLines: false, skipComments: false }],
    },
  },
)
