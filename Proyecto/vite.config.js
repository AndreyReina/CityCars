/** Configuración de compilación: Svelte en frontend, salida dist y proxy de desarrollo hacia la API. */
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
  root: 'frontend',
  plugins: [svelte()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
});
