import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@marrow/diagnostics': p('./packages/diagnostics/src/index.ts'),
      '@marrow/model': p('./packages/model/src/index.ts'),
      '@marrow/scene': p('./packages/scene/src/index.ts'),
      '@marrow/metrics': p('./packages/metrics/src/index.ts'),
      '@marrow/icons': p('./packages/icons/src/index.ts'),
      '@marrow/schema': p('./packages/schema/src/index.ts'),
      '@marrow/layout': p('./packages/layout/src/index.ts'),
      '@marrow/lint': p('./packages/lint/src/index.ts'),
      '@marrow/render-svg': p('./packages/render-svg/src/index.ts'),
      '@marrow/runtime': p('./packages/runtime/src/index.ts'),
      '@marrow/site': p('./packages/site/src/index.ts'),
      '@marrow/server': p('./packages/server/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts'],
  },
});
