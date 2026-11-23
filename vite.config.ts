import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: true,
    rolldownOptions: {
      // Two pages: the app and the pop-out plot window.
      input: {
        main: 'index.html',
        plot: 'plot.html',
      },
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
