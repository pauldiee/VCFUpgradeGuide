#!/usr/bin/env node
// Builds the site (if not already built) and renders it to a single
// customer-handoff PDF: a cover page followed by every doc in NAV order,
// each printed by headless Chromium so it picks up the site's own styling
// and the print rules in src/styles/site.css. Local/on-demand only — the
// GitLab Pages CI runner is a bare shell executor with no Chromium, so this
// deliberately isn't wired into .gitlab-ci.yml.
//
// Usage: npm run pdf   (from web/)

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(WEB_ROOT, 'dist');
const OUT_DIR = path.join(WEB_ROOT, 'dist-pdf');
const PORT = 4319;
const BASE_URL = `http://localhost:${PORT}`;

// nav.ts is TypeScript; Node can't import it directly, so read + eval the
// NAV array's source instead of standing up a build step just for this.
async function loadNav() {
  const src = await (await import('node:fs/promises')).readFile(
    path.join(WEB_ROOT, 'src/nav.ts'),
    'utf8'
  );
  const match = src.match(/export const NAV: NavItem\[\] = (\[[\s\S]*?\n\]);/);
  if (!match) throw new Error('Could not locate NAV array in src/nav.ts');
  // eslint-disable-next-line no-eval -- trusted, repo-local source file
  return (0, eval)(match[1]);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const nav = await loadNav();

  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.log('No dist/ build found, running `npm run build` first...');
    await run('npm', ['run', 'build'], { cwd: WEB_ROOT, env: { ...process.env, SITE_URL: BASE_URL, SITE_BASE: '' } });
  }

  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Serving dist/ on ${BASE_URL} ...`);
  const server = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    cwd: WEB_ROOT,
    shell: true,
    stdio: 'pipe',
  });
  server.stdout?.on('data', () => {});
  server.stderr?.on('data', () => {});

  try {
    await waitForServer(BASE_URL);

    const browser = await chromium.launch();
    const page = await browser.newPage();

    const merged = await PDFDocument.create();

    // Cover page: kept minimal (title + generation date), no ITQ logo asset
    // wired in here to avoid a second network/asset round-trip for a one-off
    // script — visually distinct enough as the PDF's first page regardless.
    const coverHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; height: 100vh;
             display: flex; flex-direction: column; justify-content: center;
             align-items: flex-start; padding: 0 4rem; }
      h1 { font-size: 2.4rem; margin: 0 0 0.5rem; }
      p { font-size: 1.1rem; color: #444; }
      .bar { width: 64px; height: 6px; background: #ff6a13; margin-bottom: 1.5rem; }
    </style></head><body>
      <div class="bar"></div>
      <h1>VCF Upgrade Guide</h1>
      <p>ITQ Consulting Services</p>
      <p>Generated ${new Date().toISOString().slice(0, 10)}</p>
    </body></html>`;
    await page.setContent(coverHtml);
    const coverPdf = await page.pdf({ format: 'A4', printBackground: true });
    const coverDoc = await PDFDocument.load(coverPdf);
    for (const p of await merged.copyPages(coverDoc, coverDoc.getPageIndices())) merged.addPage(p);

    for (const item of nav) {
      const url = `${BASE_URL}/docs/${item.slug}/`;
      console.log(`Rendering ${item.label} (${url}) ...`);
      await page.goto(url, { waitUntil: 'networkidle' });
      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
      });
      const docPdf = await PDFDocument.load(pdfBytes);
      for (const p of await merged.copyPages(docPdf, docPdf.getPageIndices())) merged.addPage(p);
    }

    await browser.close();

    const outPath = path.join(OUT_DIR, 'vcf-upgrade-guide.pdf');
    await writeFile(outPath, await merged.save());
    console.log(`\nWrote ${outPath}`);
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
