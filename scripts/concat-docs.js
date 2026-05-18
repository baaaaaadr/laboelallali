#!/usr/bin/env node
/**
 * Concatenates all AI context files into docs/FULL_CONTEXT.md.
 * Usage: npm run docs:concat
 *
 * Output is a single markdown file you can paste into any external AI
 * (ChatGPT, Gemini, etc.) to give it full project context in one shot.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'docs', 'FULL_CONTEXT.md');

// Fixed files always included first (project-level rules)
const FIXED_FILES = [
  { label: 'SPEC — Product Vision & Boundaries', file: 'SPEC.md' },
  { label: 'DESIGN — Visual System & CSS Variables', file: 'DESIGN.md' },
  { label: 'AGENTS — Tech Stack & Coding Rules', file: 'AGENTS.md' },
];

// Auto-discover all page docs
const pagesDir = path.join(ROOT, 'docs', 'pages');
const pageDocs = fs.readdirSync(pagesDir)
  .filter(f => f.endsWith('.md') && f !== 'FULL_CONTEXT.md')
  .sort()
  .map(f => ({
    label: `PAGE: /${f.replace('.md', '')}`,
    file: path.join('docs', 'pages', f),
  }));

const allFiles = [...FIXED_FILES, ...pageDocs];

// ── Build output ──────────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];
const lines = [];

lines.push(`# Labo El Allali — Full AI Context`);
lines.push(`> Generated ${today} via \`npm run docs:concat\``);
lines.push(`> ${allFiles.length} files included: ${FIXED_FILES.length} project-level + ${pageDocs.length} page docs\n`);
lines.push(`This file is the complete AI context for the Labo El Allali PWA (Next.js + Firebase + TypeScript).`);
lines.push(`Paste the contents below into your AI assistant before asking any project-related question.\n`);
lines.push('---');

let included = 0;
let skipped = 0;

for (const { label, file } of allFiles) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠  Skipped (not found): ${file}`);
    skipped++;
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8').trim();
  lines.push(`\n${'─'.repeat(80)}`);
  lines.push(`## ${label}`);
  lines.push(`> Source: \`${file}\`\n`);
  lines.push(content);
  lines.push('');
  included++;
}

lines.push('\n---');
lines.push(`_End of context — ${included} files, generated ${today}_`);

// ── Write output ──────────────────────────────────────────────────────────────

fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8');

const sizeKb = Math.round(fs.statSync(OUTPUT).size / 1024);
console.log(`\n✅  docs/FULL_CONTEXT.md written (${sizeKb} KB, ${included} files)`);
if (skipped > 0) console.log(`   ⚠  ${skipped} file(s) skipped (not found)`);
console.log(`\n   → Copy the file contents and paste into your AI.\n`);
