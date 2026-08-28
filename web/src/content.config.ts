import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

// Resolve the content folder to an absolute URL anchored on this config file
// (repo `docs/`, outside the Astro project root). An absolute base gives every
// file one canonical id (a relative base can be tracked under two normalized
// paths). This alone does NOT fully stop the spurious "Duplicate id" warning –
// the incremental content cache (`.astro/collections/`) can still re-add an
// edited file after `dev`/`build` interleave. The reliable fix is the
// `prebuild` script (package.json) clearing `.astro` AND `node_modules/.astro`
// – the latter holds the content-layer render cache (data-store.json), keyed
// on file content only, so rehype-plugin changes in astro.config would
// otherwise serve stale HTML. CI (fresh checkout, no cache) is unaffected either way.
const docsBase = new URL('../../docs', import.meta.url);

// Read the upgrade-planning docs in place from the repo's docs/ folder
// (single source of truth: the same .md that render on GitLab/GitHub). No
// frontmatter required.
const docs = defineCollection({
  loader: glob({ pattern: '*.md', base: docsBase }),
});

export const collections = { docs };
