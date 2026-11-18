// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// GitHub Pages serves the site from /<repo>/. Local dev and `npm run share` stay at the root.
const onPages = process.env.GITHUB_ACTIONS === 'true';

// https://astro.build/config
export default defineConfig({
  site: 'https://tekgadgt.github.io',
  base: onPages ? '/infernal_artifacts_planner' : undefined,
  integrations: [react()],
  server: {
    // Lets `npm run share` serve through a Cloudflare quick tunnel.
    allowedHosts: ['.trycloudflare.com'],
  },
});
