import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist');
const indexPath = path.join(distRoot, 'index.html');
const html = await readFile(indexPath, 'utf8');
const visibleText = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&rarr;/g, '→')
  .replace(/\s+/g, ' ')
  .trim();

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const count = (pattern) => [...html.matchAll(pattern)].length;
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

assert(count(/<h1(?:\s|>)/g) === 1, 'The page must contain exactly one h1.');
assert(duplicateIds.length === 0, `Duplicate IDs found: ${[...new Set(duplicateIds)].join(', ')}`);

// Section anchors the nav and CTAs link to.
const requiredIds = ['top', 'agents', 'computer', 'governance', 'schedules', 'close'];
for (const id of requiredIds) assert(ids.includes(id), `Missing required section ID: ${id}`);

// In-page hash links must resolve to a real element id. Cross-page/external
// links (the mailto CTA) are excluded — only "#..." fragments are checked.
const internalTargets = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
for (const target of internalTargets) assert(ids.includes(target), `Internal link does not resolve: #${target}`);
assert(!html.includes('href="#"'), 'Placeholder href="#" found in the production output.');

// Locked copy — the contract for this page. A rewrite that drops or alters any
// of these fails the build. Includes the hero line, the product host shown in
// every shot's chrome, the three agent names, and the governance vocabulary the
// shots literally demonstrate.
const requiredCopy = [
  'Any agent.',
  'One governed computer.',
  'lemmacomputer',
  'Claude',
  'Codex',
  'Hermes',
  'governed identity',
  'Managed workspace',
  'Disposable open workspace',
  'Kasm',
  'egress',
  'Egress firewall',
  'Tools & approvals',
  'Trail',
  'the workspace, agent, and current policy',
  'LemmaLabs',
];
for (const text of requiredCopy) assert(visibleText.includes(text), `Required locked copy is missing: ${text}`);

// Honesty contract — no invented metrics/customers. The page is now open source,
// so the footer states its product-of-LemmaLabs lineage rather than a gated
// private-prototype disclosure.
assert(
  visibleText.includes('product of LemmaLabs'),
  'The "product of LemmaLabs" footer lineage must be present.',
);

// Palette guard — no decorative neon brand colours may reach the built CSS.
async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(resolved)));
    else files.push(resolved);
  }
  return files;
}

const distFiles = await filesUnder(distRoot);
const cssFiles = distFiles.filter((file) => file.endsWith('.css'));
const forbiddenColour = /brand-cyan|brand-violet|brand-aqua|brand-blue|4de2d0/i;
for (const file of cssFiles) {
  const css = await readFile(file, 'utf8');
  assert(!forbiddenColour.test(css), `Forbidden neon palette token in ${path.relative(distRoot, file)}`);
}
// Mineral-palette presence: the verdigris accent must survive into built CSS.
const allCss = (await Promise.all(cssFiles.map((f) => readFile(f, 'utf8')))).join('\n');
assert(/#1e6b57|#3da588/i.test(allCss), 'Mineral verdigris token missing from built CSS.');

// Every screenshot the page references under /shots/ must have been emitted to
// dist/ — a de-identified shot that never shipped would 404 in production.
const referencedShots = [...html.matchAll(/\/shots\/([^"'\s]+\.png)/g)].map((m) => m[1]);
assert(referencedShots.length > 0, 'The page references no /shots/*.png images.');
for (const shot of [...new Set(referencedShots)]) {
  const built = distFiles.some((f) => f.replace(/\\/g, '/').endsWith(`/shots/${shot}`));
  assert(built, `Referenced shot was not emitted to dist: shots/${shot}`);
}

// SEO contract — the discoverability surface must survive every rebuild. These
// assert the head metadata (canonical, Open Graph, Twitter, JSON-LD, robots)
// and that the crawler files + share image actually shipped to dist/.
const seoOrigin = 'https://lemmacomputer.github.io';
assert(
  html.includes(`<link rel="canonical" href="${seoOrigin}/"`),
  'Homepage is missing a canonical link to the site root.',
);
assert(/<meta name="description" content="[^"]{80,}"/.test(html), 'Meta description is missing or too short.');
assert(/<meta name="keywords" content="[^"]+"/.test(html), 'Meta keywords are missing.');
assert(/<meta name="robots" content="index, follow/.test(html), 'Homepage must be indexable (robots index, follow).');
assert(/<meta name="theme-color"/.test(html), 'theme-color meta is missing.');

// Open Graph + Twitter — the link-unfurl card.
for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
  assert(html.includes(`property="${prop}"`), `Open Graph tag missing: ${prop}`);
}
assert(
  html.includes(`content="${seoOrigin}/og.jpg"`),
  'og:image must resolve to the absolute /og.jpg URL.',
);
assert(html.includes('<meta property="og:image:width" content="1200"'), 'og:image:width must be 1200.');
assert(html.includes('<meta property="og:image:height" content="630"'), 'og:image:height must be 630.');
assert(
  html.includes('name="twitter:card" content="summary_large_image"'),
  'Twitter summary_large_image card is missing.',
);

// JSON-LD structured data — must be present and parse, and name the product.
const ldMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
assert(ldMatch, 'JSON-LD structured-data block is missing.');
if (ldMatch) {
  let ld;
  try {
    ld = JSON.parse(ldMatch[1]);
  } catch {
    assert(false, 'JSON-LD block is present but does not parse as JSON.');
  }
  if (ld) {
    const graph = Array.isArray(ld['@graph']) ? ld['@graph'] : [ld];
    const types = graph.map((node) => node['@type']);
    assert(types.includes('SoftwareApplication'), 'JSON-LD must include a SoftwareApplication node.');
    assert(types.includes('Organization'), 'JSON-LD must include an Organization node.');
  }
}

// Crawler files + share image emitted to dist/.
const emitted = (rel) => distFiles.some((f) => f.replace(/\\/g, '/').endsWith(`/${rel}`));
assert(emitted('robots.txt'), 'robots.txt was not emitted to dist/.');
assert(emitted('sitemap.xml'), 'sitemap.xml was not emitted to dist/.');
assert(emitted('og.jpg'), 'og.jpg (1200×630 share image) was not emitted to dist/.');

// robots.txt must point at the sitemap and keep /social/ out of the index.
const robotsTxt = await readFile(path.join(distRoot, 'robots.txt'), 'utf8').catch(() => '');
assert(robotsTxt.includes(`Sitemap: ${seoOrigin}/sitemap.xml`), 'robots.txt must reference the sitemap.');
assert(/Disallow:\s*\/social\//.test(robotsTxt), 'robots.txt must disallow /social/.');

// The utility export sheet must never be indexable.
const socialHtml = await readFile(path.join(distRoot, 'social', 'index.html'), 'utf8').catch(() => '');
assert(/<meta name="robots" content="noindex/.test(socialHtml), '/social/ must be noindex.');

const clientScripts = distFiles.filter((file) => file.endsWith('.js'));
let gzipBytes = 0;
for (const script of clientScripts) gzipBytes += gzipSync(await readFile(script)).byteLength;
// Inline scripts count toward the budget; the GSAP + ScrollTrigger CDN tags load
// via external src and are intentionally excluded.
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
for (const script of inlineScripts) gzipBytes += gzipSync(script).byteLength;
assert(gzipBytes < 60 * 1024, `Client JavaScript exceeds the 60 KB gzip budget: ${gzipBytes} bytes.`);

const builtPages = [];
for (const file of distFiles.filter((file) => file.endsWith('.html'))) {
  const details = await stat(file);
  builtPages.push(`${path.relative(distRoot, file)} (${details.size} bytes)`);
}

if (failures.length) {
  console.error('Static QA failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Static QA passed: ${ids.length} unique IDs, ${internalTargets.length} internal anchors, ${[...new Set(referencedShots)].length} shots emitted, ${gzipBytes} gzip bytes of client JavaScript.`,
);
console.log(`Built pages: ${builtPages.join(', ')}`);
