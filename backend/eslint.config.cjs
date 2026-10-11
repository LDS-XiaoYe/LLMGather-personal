const tseslint = require('typescript-eslint');
module.exports = [
  { ignores: ['dist/**', 'node_modules/**'] },
  // Existing code is parsed/typechecked without imposing unrelated style rewrites.
  { files: ['src/**/*.ts'], languageOptions: { parser: tseslint.parser } },
  ...tseslint.configs.recommended.map(config => ({ ...config, files: [
    'src/workflows/runtime/**/*.ts', 'src/knowledge/retrieval/**/*.ts', 'src/database/migrations/p0-infrastructure.ts',
  ], rules: { ...config.rules, '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } })),
];
