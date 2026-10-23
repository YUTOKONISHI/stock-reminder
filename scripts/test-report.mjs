// Vitest と Pest が出した JUnit XML を読み、1枚の HTML にまとめる。
// 使い方: node scripts/test-report.mjs <出力先> <ラベル>=<XML> [<ラベル>=<XML> ...]
//
// XML は両ツールが機械的に出すもので形が決まっているため、パーサを入れずに正規表現で読む。

import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const [output, ...sources] = process.argv.slice(2);

if (!output || sources.length === 0) {
  console.error('usage: node scripts/test-report.mjs <output.html> <label>=<junit.xml> ...');
  process.exit(1);
}

function unescape(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

function escape(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attributes(source) {
  const result = {};

  for (const [, key, value] of source.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    result[key] = unescape(value);
  }

  return result;
}

/* Pest は「`describe` → it 名前 with data set "dataset "値""」と出す。
 * Vitest は describe と it を「 > 」でつなぐので、Pest の「 → 」に揃える。 */
function displayName(name) {
  return name
    .replace(/ with data set "dataset "(.*)""$/, ' › $1')
    .replace(/(^|→ )it /g, '$1')
    .replace(/`([^`]+)` → /g, '$1 → ')
    .replace(/ > /g, ' → ');
}

function readCases(xml) {
  const cases = [];
  const pattern = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;

  for (const [, head, body = ''] of xml.matchAll(pattern)) {
    const attrs = attributes(head);
    const failure = body.match(/<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/);
    const file = attrs.file ? attrs.file.split('::')[0] : attrs.classname;

    let status = 'passed';

    if (failure) {
      status = 'failed';
    } else if (/<skipped\b/.test(body)) {
      status = 'skipped';
    }

    cases.push({
      file,
      name: displayName(attrs.name ?? ''),
      time: Number(attrs.time ?? 0),
      status,
      message: failure ? unescape(failure[3] ?? attributes(failure[2]).message ?? '').trim() : '',
    });
  }

  return cases;
}

function groupByFile(cases) {
  const groups = new Map();

  for (const testCase of cases) {
    if (!groups.has(testCase.file)) {
      groups.set(testCase.file, []);
    }

    groups.get(testCase.file).push(testCase);
  }

  return [...groups.entries()].map(([file, items]) => ({
    file,
    items,
    failed: items.filter((item) => item.status === 'failed').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    time: items.reduce((sum, item) => sum + item.time, 0),
  }));
}

function seconds(value) {
  return value < 1 ? `${Math.round(value * 1000)}ms` : `${value.toFixed(2)}s`;
}

function renderFile(group) {
  const passed = group.items.length - group.failed - group.skipped;
  const badge = group.failed > 0 ? 'failed' : 'passed';
  const rows = group.items
    .map(
      (item) => `
        <li class="case ${item.status}">
          <span class="dot"></span>
          <span class="name">${escape(item.name)}</span>
          <span class="time">${seconds(item.time)}</span>
          ${item.message ? `<pre>${escape(item.message)}</pre>` : ''}
        </li>`,
    )
    .join('');

  return `
    <details class="file ${badge}"${group.failed > 0 ? ' open' : ''}>
      <summary>
        <span class="dot"></span>
        <span class="path">${escape(group.file)}</span>
        <span class="count">${passed}/${group.items.length}</span>
        <span class="time">${seconds(group.time)}</span>
      </summary>
      <ul>${rows}</ul>
    </details>`;
}

function renderSection(label, cases) {
  const groups = groupByFile(cases);
  const failed = cases.filter((item) => item.status === 'failed').length;
  const skipped = cases.filter((item) => item.status === 'skipped').length;

  return `
    <section>
      <h2>
        ${escape(label)}
        <span class="summary ${failed > 0 ? 'failed' : 'passed'}">
          ${cases.length - failed - skipped} 通過 / ${failed} 失敗${skipped > 0 ? ` / ${skipped} 保留` : ''}
          ・${groups.length} ファイル
        </span>
      </h2>
      ${groups.map(renderFile).join('')}
    </section>`;
}

const sections = sources.map((source) => {
  const [label, path] = source.split('=');

  return { label, cases: readCases(readFileSync(path, 'utf8')) };
});

const total = sections.reduce((sum, section) => sum + section.cases.length, 0);
const totalFailed = sections.reduce(
  (sum, section) => sum + section.cases.filter((item) => item.status === 'failed').length,
  0,
);
const title = `${sections.map((section) => section.label).join(' / ')}のテスト結果`;
const generatedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
  :root {
    --bg: #14161a; --panel: #1c1f24; --line: #2a2e35; --text: #d7dae0; --muted: #8a909b;
    --pass: #5fb87a; --fail: #e0645c; --skip: #c9a24a;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 13px/1.5 ui-sans-serif, system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }
  header { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
  h1 { font-size: 18px; margin: 0; }
  .meta { color: var(--muted); }
  .total.failed { color: var(--fail); } .total.passed { color: var(--pass); }
  label { margin-left: auto; color: var(--muted); cursor: pointer; user-select: none; }
  h2 { font-size: 14px; margin: 24px 0 8px; display: flex; gap: 12px; align-items: baseline; }
  h2 .summary { font-weight: normal; color: var(--muted); }
  h2 .summary.failed { color: var(--fail); }
  details.file { border-bottom: 1px solid var(--line); }
  details.file:first-of-type { border-top: 1px solid var(--line); }
  summary { display: flex; align-items: center; gap: 8px; padding: 5px 8px; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary:hover { background: var(--panel); }
  .path { flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .count, .time { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 12px; }
  .time { width: 56px; text-align: right; }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--pass); }
  .failed > summary .dot, .case.failed .dot { background: var(--fail); }
  .case.skipped .dot { background: var(--skip); }
  ul { list-style: none; margin: 0; padding: 0 0 6px 23px; }
  .case { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 2px 8px; border-radius: 4px; }
  .case:hover { background: var(--panel); }
  .case .name { flex: 1; }
  .case.failed .name { color: var(--fail); }
  pre { flex-basis: 100%; margin: 4px 0 6px 15px; padding: 8px 10px; background: var(--panel);
    border-left: 2px solid var(--fail); overflow-x: auto; font-size: 12px; color: var(--text); }
  body.only-failed .case.passed, body.only-failed .case.skipped,
  body.only-failed details.file.passed { display: none; }
</style>
</head>
<body>
<main>
  <header>
    <h1>${escape(title)}</h1>
    <span class="total ${totalFailed > 0 ? 'failed' : 'passed'}">${total - totalFailed} / ${total} 通過</span>
    <span class="meta">${escape(generatedAt)}</span>
    <label><input type="checkbox" id="only-failed"> 失敗のみ</label>
  </header>
  ${sections.map((section) => renderSection(section.label, section.cases)).join('')}
</main>
<script>
  document.getElementById('only-failed').addEventListener('change', (event) => {
    document.body.classList.toggle('only-failed', event.target.checked);
  });
</script>
</body>
</html>
`;

writeFileSync(output, html);
console.log(`Written to: ${output}（${total} 件中 ${totalFailed} 件失敗）`);
