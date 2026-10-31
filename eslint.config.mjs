// @ts-check
import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

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
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },  {
    // lights have one owner (spec 005 D4): every other package asks the LightBudget instead of creating a light; warn until phase 4
    files: ['packages/*/src/**/*.{ts,tsx}'],
    ignores: ['packages/game-render-three/**', 'packages/game-vfx-three/**'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "NewExpression[callee.type='MemberExpression'][callee.property.name=/^(PointLight|SpotLight|HemisphereLight)$/]",
          message: 'Do not create PointLight/SpotLight/HemisphereLight here: ask the LightBudget of game-render-three (spec 005 D4).',
        },
      ],
    },
  },
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['warn', { max: 1500, skipBlankLines: false, skipComments: false }],
    },
  },
)
