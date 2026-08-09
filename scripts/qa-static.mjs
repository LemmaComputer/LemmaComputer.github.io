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
  'onecomputer.metech.dev',
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
