#!/usr/bin/env node
// ============================================================================
// build-paper.mjs — markdown → paper-shell HTML
// ----------------------------------------------------------------------------
// Converts a paper authored as markdown into a self-contained HTML file using
// the "Paper reading shell" stylesheet. Use it to regenerate this paper after
// editing the source markdown, or to start a new paper that uses the same
// reading experience (TOC drawer, audience tags, code blocks, tables, etc.).
//
// USAGE
//   node scripts/build-paper.mjs <source.md> <output.html> [--template path]
//
// EXAMPLES
//   node scripts/build-paper.mjs uploads/the-tunnel-pipeline.md "The Tunnel Pipeline.html"
//   node scripts/build-paper.mjs my-new-paper.md my-new-paper.html
//
// FRONT-MATTER CONVENTIONS (parsed automatically from the source .md)
//   The first H1 (# Title: Subtitle) is split on the first ":" or "—":
//     - left side becomes .paper-title
//     - right side becomes .paper-subtitle
//   The metadata block (lines like `**Author:** …` after the H1) is parsed
//   into a two-column <dl class="meta-grid">. The methodology italic line
//   (*…*) becomes a .methodology-note. The first **Abstract.** paragraph
//   becomes the abstract callout. A "### Reading guide" section becomes
//   the reading-guide-block.
//
// SECTION CONVENTIONS
//   ## §N Title              → <section class="lvl-2" data-num="N">
//   ### §N.M Title           → <div class="lvl-3" data-num="N.M">
//   ### Title (no §)         → <section class="lvl-2 unnumbered">
//   ---                      → section break (closes open lvl-2/lvl-3)
//
// PARAGRAPH CONVENTIONS
//   **Statement.** body…     → <p class="labeled"><span class="p-label">Statement.</span> body…</p>
//   (Recognized labels: Statement, Scope, Weak and strong forms, Grounding,
//    Why it matters structurally, Compressed flagship, Operationalisation,
//    Mechanism, Observable effect, Diagnostic, Storage cost, etc. — any
//    leading **Word(s).** that ends with a period inside the bold gets
//    treated as a label.)
//
// AUDIENCE TAGS
//   To tag a section's audience, place a paragraph like
//      `> [aud: ML researcher | Core]`
//   immediately under the heading. The build will convert it to
//      <div class="aud"><span>ML researcher</span><span>Core</span></div>
//
// HIGHLIGHTS
//   ==key sentence==         → <mark class="key">key sentence</mark>
//   `> [key]` paragraph      → <p class="key-para">…</p>
//
// TABLES
//   Standard markdown pipe tables are converted to <table class="paper-table">.
//   The first column gets .row-ref styling automatically when it contains
//   a leading reference like §4.1.
//   To add verdict glyphs in cells, mark the cell content with a tier prefix:
//      Strong↑     → data-verdict="positive"  (●)
//      Fails↓      → data-verdict="negative"  (▲)
//      Weak◐       → data-verdict="partial"   (◐)
//      Variable○   → data-verdict="neutral"   (○)
//      Inherited⤷  → data-verdict="derived"   (⤷)
//   The marker is stripped from the rendered cell text.
//
// CODE
//   ```json … ```            → <pre data-lang="json">…</pre>
//   `inline`                 → <code>inline</code>
//
// FIGURES
//   ![alt](path)             → <figure class="paper-fig"><div class="fig-frame"><img …></div>
//                                <figcaption><span class="fig-num">Fig N</span>alt</figcaption></figure>
//
// TEMPLATE
//   The output is wrapped in a template HTML file. By default we read the
//   sibling file at scripts/paper-template.html (only the <!-- BODY --> token
//   is replaced; everything else — the stylesheet, TOC drawer, JS — is copied
//   verbatim). You can swap templates with --template <path>.
//
// LIMITATIONS (intentional)
//   - No nested lists.
//   - No reference-style links.
//   - No HTML passthrough beyond the few tags listed above.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.error('usage: node scripts/build-paper.mjs <source.md> <output.html> [--template path]');
  process.exit(1);
}
const [srcPath, outPath, ...rest] = argv;
let templatePath = resolve(__dirname, 'paper-template.html');
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--template') templatePath = resolve(rest[++i]);
}

const md = readFileSync(srcPath, 'utf8');
const tpl = readFileSync(templatePath, 'utf8');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Inline markdown rendering. Order matters: code first (so we don't munge inside).
function inline(s) {
  // Protect inline code spans
  const codeSpans = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codeSpans.push(`<code>${esc(c)}</code>`);
    return `\u0001CODE${codeSpans.length - 1}\u0001`;
  });
  s = esc(s);
  // Restore code
  s = s.replace(/\u0001CODE(\d+)\u0001/g, (_, n) => codeSpans[+n]);
  // Highlights
  s = s.replace(/==([^=]+)==/g, '<mark class="key">$1</mark>');
  // Bold + italic + emphasis
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  // Links [text](href)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

// Slugify for ids
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Strip a leading verdict marker and return [verdict, text]
function parseVerdict(text) {
  const map = { '↑': 'positive', '↓': 'negative', '◐': 'partial', '○': 'neutral', '⤷': 'derived' };
  for (const [marker, verdict] of Object.entries(map)) {
    if (text.includes(marker)) {
      return [verdict, text.replace(marker, '').trim()];
    }
  }
  // Heuristic on legacy strings used in this paper
  const t = text.trim().toLowerCase();
  if (t.startsWith('strong')) return ['positive', text];
  if (t.startsWith('fails')) return ['negative', text];
  if (t.startsWith('weak')) return ['partial', text];
  if (t.startsWith('variable') || t.startsWith('varies') || t === 'partial' || t.startsWith('depends')) return ['neutral', text];
  if (t.startsWith('inherited')) return ['derived', text];
  return [null, text];
}

// ---------------------------------------------------------------------------
// Front-matter parsing
// Walks the top of the file: H1 → metadata lines → italic methodology → series
// → abstract → reading guide. Stops at the first H2 (§).
// ---------------------------------------------------------------------------
function extractFrontmatter(lines) {
  const fm = { title: '', subtitle: '', meta: [], methodology: '', series: '', abstract: '', readingGuide: '' };
  let i = 0;

  // H1
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i] && lines[i].startsWith('# ')) {
    const h1 = lines[i].slice(2).trim();
    const split = h1.match(/^([^:—]+?)[:—]\s*(.+)$/);
    if (split) { fm.title = split[1].trim(); fm.subtitle = split[2].trim(); }
    else fm.title = h1;
    i++;
  }

  // Metadata block: contiguous **Key:** Value lines
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    const m = line.match(/^\*\*([^:*]+):\*\*\s*(.+)$/);
    if (!m) break;
    fm.meta.push({ key: m[1].trim(), value: m[2].trim() });
    i++;
  }

  // Methodology italic
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i] && /^\*[^*].+\*$/.test(lines[i].trim())) {
    fm.methodology = lines[i].trim().replace(/^\*|\*$/g, '');
    i++;
  }

  // Series (also a **Key:** line) - already collected if it appeared earlier; if not, look for it next
  while (i < lines.length && lines[i].trim() === '') i++;
  const seriesM = lines[i] && lines[i].match(/^\*\*Series:\*\*\s*(.+)$/);
  if (seriesM) { fm.series = seriesM[1].trim(); i++; }

  // Abstract
  while (i < lines.length && lines[i].trim() === '') i++;
  const absM = lines[i] && lines[i].match(/^\*\*Abstract\.\*\*\s*(.+)$/);
  if (absM) {
    let buf = [absM[1]];
    i++;
    while (i < lines.length && lines[i].trim() !== '---' && !lines[i].startsWith('#')) {
      buf.push(lines[i]);
      i++;
    }
    fm.abstract = buf.join('\n').trim();
  }

  // Skip --- separator
  while (i < lines.length && (lines[i].trim() === '' || lines[i].trim() === '---')) i++;

  // Reading guide
  if (lines[i] && /^###\s+Reading guide\b/.test(lines[i])) {
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    let buf = [];
    while (i < lines.length && !lines[i].startsWith('## ') && lines[i].trim() !== '---') {
      buf.push(lines[i]); i++;
    }
    fm.readingGuide = buf.join('\n').trim();
  }

  // Skip --- separator
  while (i < lines.length && (lines[i].trim() === '' || lines[i].trim() === '---')) i++;

  return { fm, restLines: lines.slice(i) };
}

// ---------------------------------------------------------------------------
// Body rendering: walks lines after frontmatter and emits HTML
// ---------------------------------------------------------------------------
function renderBody(lines) {
  const out = [];
  let i = 0;
  let openLvl2 = false;
  let openLvl3 = false;
  let figCount = 0;
  let tblCount = 0;

  function closeLvl3() { if (openLvl3) { out.push('</div>'); openLvl3 = false; } }
  function closeLvl2() { closeLvl3(); if (openLvl2) { out.push('</section>'); openLvl2 = false; } }

  // Recognized argumentative labels (extend as needed; any **X.** at start of paragraph also matches generic)
  const KNOWN_LABELS = new Set([
    'Statement', 'Scope', 'Weak and strong forms', 'Grounding', 'Why it matters structurally',
    'Why strong independence matters', 'Why strong reproducibility matters',
    'Compressed flagship', 'Operationalisation', 'Mechanism', 'Observable effect',
    'Storage cost', 'Diagnostic', 'Dual role', 'Connection to the Rich Annotation Object',
    'Condition classification', 'The strong-form specification', 'Case index'
  ]);

  while (i < lines.length) {
    const line = lines[i];

    // --- separator (close current subsection but keep section open)
    if (line.trim() === '---') {
      closeLvl3();
      i++; continue;
    }

    // ## §N Title → lvl-2 section
    let m = line.match(/^##\s+(?:§(\d+(?:\.\d+)*)\s+)?(.+)$/);
    if (m && !line.startsWith('### ')) {
      closeLvl2();
      const num = m[1];
      const title = m[2].trim();
      const id = num ? `s${num.replace(/\./g, '-')}` : slug(title);
      const cls = num ? `lvl-2` : (title.toLowerCase().includes('ai systems summarising') ? `lvl-2 unnumbered ai-note-block` : `lvl-2 unnumbered`);
      const dataNum = num ? ` data-num="${num}"` : '';
      out.push(`<section class="${cls}" id="${id}"${dataNum}>`);
      const numHtml = num ? `<span class="h-num">§${num}</span>` : '';
      out.push(`  <h2 class="h2">${numHtml}<span class="h-text">${inline(title)}</span></h2>`);
      openLvl2 = true; openLvl3 = false;
      i++;
      // Look for an audience tag on the next nonblank line
      let j = i; while (j < lines.length && lines[j].trim() === '') j++;
      const aud = lines[j] && lines[j].match(/^>\s*\[aud:\s*([^\]]+)\]/);
      if (aud) {
        const tags = aud[1].split('|').map(s => s.trim()).filter(Boolean);
        out.push('  <div class="aud">' + tags.map(t => `<span>${esc(t)}</span>`).join('') + '</div>');
        i = j + 1;
      }
      continue;
    }

    // ### §N.M Title → lvl-3 div
    m = line.match(/^###\s+(?:§(\d+(?:\.\d+)*)\s*)?(.*)$/);
    if (m) {
      closeLvl3();
      const num = m[1];
      const title = (m[2] || '').trim();
      const id = num ? `s${num.replace(/\./g, '-')}` : slug(title || `sub-${i}`);
      const cls = num ? 'lvl-3' : (title.toLowerCase().includes('ai systems summarising') ? 'lvl-3 unnumbered ai-note-block' : 'lvl-3 unnumbered');
      const dataNum = num ? ` data-num="${num}"` : '';
      // If we're not inside a section yet, open one (e.g. unnumbered front rails)
      if (!openLvl2) {
        out.push(`<div class="${cls}" id="${id}"${dataNum}>`);
      } else {
        out.push(`<div class="${cls}" id="${id}"${dataNum}>`);
      }
      const numHtml = num ? `<span class="h-num">§${num}</span>` : '';
      out.push(`  <h3 class="h3">${numHtml}<span class="h-text">${inline(title)}</span></h3>`);
      openLvl3 = true;
      i++;
      // Audience tag on next nonblank line?
      let j = i; while (j < lines.length && lines[j].trim() === '') j++;
      const aud = lines[j] && lines[j].match(/^>\s*\[aud:\s*([^\]]+)\]/);
      if (aud) {
        const tags = aud[1].split('|').map(s => s.trim()).filter(Boolean);
        out.push('  <div class="aud">' + tags.map(t => `<span>${esc(t)}</span>`).join('') + '</div>');
        i = j + 1;
      }
      continue;
    }

    // ```lang … ``` code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      i++;
      const buf = [];
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      const langAttr = lang ? ` data-lang="${esc(lang)}"` : '';
      out.push(`<pre${langAttr}>${esc(buf.join('\n'))}</pre>`);
      continue;
    }

    // Pipe table
    if (/^\s*\|/.test(line) && lines[i + 1] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const tableLines = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { tableLines.push(lines[i]); i++; }
      out.push(renderTable(tableLines, ++tblCount));
      continue;
    }

    // Image / figure
    m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (m) {
      const alt = m[1] || '';
      let src = m[2];
      figCount++;
      // Try to base64 encode local images for self-contained HTML
      try {
        const imgPath = resolve(dirname(srcPath), src);
        const imgBuf = readFileSync(imgPath);
        const ext = src.split('.').pop().toLowerCase();
        const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/jpeg';
        src = `data:${mime};base64,${imgBuf.toString('base64')}`;
      } catch (e) {
        // Fall back to original path
      }
      out.push(`<figure class="paper-fig">`);
      out.push(`  <div class="fig-frame"><img src="${src}" alt="${esc(alt)}" loading="lazy"></div>`);
      if (alt) out.push(`  <figcaption><span class="fig-num">Fig ${figCount}</span>${inline(alt)}</figcaption>`);
      out.push(`</figure>`);
      i++; continue;
    }

    // > [key] paragraph
    if (/^>\s*\[key\]\s*/.test(line)) {
      const buf = [line.replace(/^>\s*\[key\]\s*/, '')];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !/^[#>!]|^---|^\|/.test(lines[i]) && !lines[i].startsWith('```')) {
        buf.push(lines[i]); i++;
      }
      out.push(`<p class="key-para">${inline(buf.join(' '))}</p>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++; }
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(`  <li>${inline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>\n${buf.join('\n')}\n</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(`  <li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>\n${buf.join('\n')}\n</ol>`);
      continue;
    }

    // Blank line
    if (line.trim() === '') { i++; continue; }

    // Paragraph (collect lines until blank / structural)
    const buf = [line]; i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^[#>!]|^---|^\|/.test(lines[i]) && !lines[i].startsWith('```')) {
      buf.push(lines[i]); i++;
    }
    const text = buf.join(' ');

    // Detect leading **Label.** for argumentative paragraphs
    const lab = text.match(/^\*\*([^*]+?)\.\*\*\s+(.+)$/);
    if (lab) {
      const label = lab[1].trim();
      const body = lab[2];
      out.push(`<p class="labeled"><span class="p-label">${esc(label)}.</span> ${inline(body)}</p>`);
    } else {
      out.push(`<p>${inline(text)}</p>`);
    }
  }

  closeLvl2();
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Pipe-table rendering
// ---------------------------------------------------------------------------
function renderTable(tableLines, tblCount) {
  const split = row => row.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
  const head = split(tableLines[0]);
  const align = split(tableLines[1]).map(c => /:--+:/.test(c) ? 'center' : (/--+:/.test(c) ? 'right' : 'left'));
  const body = tableLines.slice(2).map(split);

  // Column-letter accents: detect "P (Preservation)" style headers
  const headHtml = head.map((h, idx) => {
    const m = h.match(/^([A-Z])\s*\(([^)]+)\)$/);
    if (m) return `<th>(<span class="col-letter">${esc(m[1])}</span>)${esc(m[2])}</th>`;
    return `<th>${inline(h)}</th>`;
  }).join('');

  const bodyHtml = body.map(row => {
    // Section separator row: a row whose first cell is bold-only and rest are empty
    if (row[0].startsWith('**') && row[0].endsWith('**') && row.slice(1).every(c => c === '')) {
      return `  <tr class="tbl-sep"><td colspan="${head.length}">${esc(row[0].replace(/\*\*/g, ''))}</td></tr>`;
    }
    const cells = row.map((cell, idx) => {
      if (idx === 0) {
        // Detect leading row-ref like §4.1
        const refM = cell.match(/^(§[\d.]+)\s+(.*)$/);
        if (refM) return `<td><span class="row-ref">${esc(refM[1])}</span> ${inline(refM[2])}</td>`;
        return `<td>${inline(cell)}</td>`;
      }
      const [verdict, text] = parseVerdict(cell);
      if (verdict) return `<td class="cell" data-verdict="${verdict}">${inline(text)}</td>`;
      return `<td>${inline(cell)}</td>`;
    }).join('');
    return `  <tr>${cells}</tr>`;
  }).join('\n');

  return `<div class="table-wrap">
<table class="paper-table" id="tbl-${tblCount}">
  <caption><span class="tbl-num">Table ${tblCount}</span></caption>
  <thead><tr>${headHtml}</tr></thead>
  <tbody>
${bodyHtml}
  </tbody>
</table>
</div>`;
}

// ---------------------------------------------------------------------------
// Frontmatter HTML
// ---------------------------------------------------------------------------
function renderFrontmatter(fm) {
  const out = [];
  out.push(`<header class="frontmatter">`);
  out.push(`  <h1 class="paper-title">${inline(fm.title)}</h1>`);
  if (fm.subtitle) out.push(`  <p class="paper-subtitle">${inline(fm.subtitle)}</p>`);

  if (fm.meta.length) {
    out.push(`  <dl class="meta-grid">`);
    for (const { key, value } of fm.meta) {
      const plainValue = value.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // strip markdown links for length check
      const span = (/series|previous papers/i.test(key) || plainValue.length > 50);
      const cls = span ? ' span-all' : '';
      out.push(`    <div class="meta-row${cls}"><dt>${esc(key)}</dt><dd>${inline(value)}</dd></div>`);
    }
    out.push(`  </dl>`);
  }
  if (fm.methodology) {
    out.push(`  <p class="methodology-note">${inline(fm.methodology)}</p>`);
  }
  if (fm.abstract) {
    out.push(`  <div class="abstract" id="abstract">`);
    out.push(`    <div class="abstract-h">Abstract</div>`);
    const absParagraphs = fm.abstract.split(/\n\s*\n/).filter(p => p.trim());
    for (const para of absParagraphs) {
      out.push(`    <p>${inline(para.replace(/\n/g, ' ').trim())}</p>`);
    }
    out.push(`  </div>`);
  }
  out.push(`</header>`);

  if (fm.readingGuide) {
    out.push(`<div class="lvl-3 unnumbered reading-guide-block" id="reading-guide">`);
    out.push(`  <h3 class="h3"><span class="h-text">Reading guide</span></h3>`);
    const rgParas = fm.readingGuide.split(/\n\s*\n/).filter(p => p.trim());
    for (const para of rgParas) {
      out.push(`  <p>${inline(para.replace(/\n/g, ' ').trim())}</p>`);
    }
    out.push(`</div>`);
    out.push(`<hr class="section-rule">`);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// TOC generation (post-process: scan emitted body for h2/h3 with ids)
// ---------------------------------------------------------------------------
function buildToc(bodyHtml) {
  const items = [];
  // Abstract + reading guide as special items
  items.push(`<li><a href="#abstract" class="lvl-2-special"><span class="toc-num">¶</span><span class="toc-text">Abstract</span></a></li>`);
  if (bodyHtml.includes('id="reading-guide"')) {
    items.push(`<li><a href="#reading-guide" class="lvl-3 lvl-2-special"><span class="toc-num">◇</span><span class="toc-text">Reading guide</span></a></li>`);
  }

  const re = /<(section|div) class="(lvl-2|lvl-3)(?:[^"]*)" id="([^"]+)"(?:\s+data-num="([^"]+)")?[^>]*>\s*<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<(?:section|div class="lvl|p[ >]|ul|ol|h[1-6])|$)/g;
  let m;
  while ((m = re.exec(bodyHtml))) {
    const [, , lvl, id, num, head, after] = m;
    if (id === 'reading-guide' || id === 'abstract') continue;
    const textM = head.match(/<span class="h-text">([\s\S]*?)<\/span>/);
    const text = textM ? textM[1].replace(/<[^>]+>/g, '') : '';
    let numStr = num ? `§${num}` : '';
    let extraCls = '';
    // Special icons for known unnumbered sections
    if (id === 'references') { numStr = '⊕'; extraCls = ' lvl-2-special'; }
    if (id === 'terminology-summary') { numStr = '◆'; extraCls = ' lvl-2-special'; }
    if (id.includes('note-for-ai')) { numStr = '◇'; extraCls = ' lvl-2-special'; }
    // Audience tag in next .aud div?
    const audM = after.match(/<div class="aud">([\s\S]*?)<\/div>/);
    let audHtml = '';
    if (audM) {
      const tags = [...audM[1].matchAll(/<span>([^<]+)<\/span>/g)].map(x => x[1]);
      audHtml = tags.length ? '<span class="toc-aud">' + tags.map(t => `<b data-aud="${esc(t)}">${esc(t)}</b>`).join('') + '</span>' : '';
    }
    items.push(`<li><a href="#${id}" class="${lvl}${extraCls}"><span class="toc-num">${numStr}</span><span class="toc-text">${text}${audHtml}</span></a></li>`);
  }
  return items.join('\n');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const lines = md.split('\n');
const { fm, restLines } = extractFrontmatter(lines);
const body = renderBody(restLines);
const front = renderFrontmatter(fm);
const tocItems = buildToc(body);

const fullBody = `${front}\n${body}`;

// The template should contain three tokens we replace:
//   <!-- TITLE --> in <title>
//   <!-- BODY -->
//   <!-- TOC -->
let html = tpl
  .replace(/<!--\s*TITLE\s*-->/g, esc(fm.title) + (fm.subtitle ? ': ' + esc(fm.subtitle) : ''))
  .replace(/<!--\s*BODY\s*-->/g, fullBody)
  .replace(/<!--\s*TOC\s*-->/g, tocItems);

writeFileSync(outPath, html, 'utf8');
console.log(`Built ${outPath} from ${srcPath}`);
console.log(`  ${fm.title}${fm.subtitle ? ' — ' + fm.subtitle : ''}`);
console.log(`  ${fm.meta.length} metadata rows, abstract ${fm.abstract ? 'yes' : 'no'}, reading guide ${fm.readingGuide ? 'yes' : 'no'}`);
