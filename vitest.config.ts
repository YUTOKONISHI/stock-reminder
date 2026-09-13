import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/* vite.config.ts とは分ける。laravel-vite-plugin と wayfinder は
 * ビルド用のプラグインで、テスト実行時には動かす必要がない。 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/resources/js`,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./resources/js/test/setup.ts'],
    include: ['resources/js/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
