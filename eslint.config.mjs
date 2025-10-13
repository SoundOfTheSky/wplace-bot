// @ts-check
import skyEslintConfig from '@softsky/configs/eslint.config.mjs'

/** @type {import("typescript-eslint").Config} */
export default [
  ...skyEslintConfig,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 0,
      'import-x/no-unresolved': 0,
      'unicorn/prefer-query-selector': 0,
      'unicorn/explicit-length-check': 0,
    },
  },
]
