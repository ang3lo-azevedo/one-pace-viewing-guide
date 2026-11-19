import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';

// Relative base so the site works on GitHub Pages project sites (/<repo>/)
// regardless of repository name, and under any sub-path.
export default defineConfig({
  base: './',
  plugins: [solid(), tailwindcss()],
  build: {
    target: 'es2020',
  },
});
