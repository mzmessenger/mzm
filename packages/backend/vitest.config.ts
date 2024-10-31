import { defineConfig, configDefaults } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/dist/**'],
    globalSetup: [path.resolve('./test/globalSetup.ts')],
    setupFiles: [path.resolve('./test/setup.ts')],
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 16,
        minForks: 4
      }
    }
  }
})
