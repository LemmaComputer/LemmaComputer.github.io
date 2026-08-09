import { defineConfig } from 'astro/config';

// Org root site (LemmaComputer/LemmaComputer.github.io) → served at the domain
// root, so no `base`. Asset hrefs still route through import.meta.env.BASE_URL
// (which is '/') so a later custom domain needs no code change.
export default defineConfig({
  site: 'https://lemmacomputer.github.io',
  output: 'static',
  build: {
    format: 'directory',
  },
});
