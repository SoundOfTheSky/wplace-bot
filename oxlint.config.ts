import skyConfig from '@softsky/configs/oxlint.config.js'
import { defineConfig } from 'oxlint'

export default defineConfig({
  extends: [skyConfig],
  rules: {
    'unicorn/no-new-array': 0,
  },
})
