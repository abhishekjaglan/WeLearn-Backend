import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            parser: typescriptParser,
            globals: {
                ...globals.node, // Node.js globals (e.g., process, console)
                ...globals.es2020 // ES2020 globals
            },
        },
        plugins: {
            '@typescript-eslint': typescriptEslintPlugin,
            prettier: prettierPlugin,
        },
        rules: {
            ...typescriptEslintPlugin.configs.recommended.rules,
            ...prettierConfig.rules,
            'prettier/prettier': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
];