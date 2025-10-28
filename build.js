// build.js — BSP Auto Bookmarklet Builder (clean final version)
// Generates dist/index.html with modern UI and no BOM/Shebang issues.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const DIST = path.join(__dirname, "dist");
const OUT = path.join(DIST, "index.html");

// Helpers ---------------------------------------------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function listJs(dir) {
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith(".js") && !f.startsWith("_"))
    : [];
}

function stripJsonComments(input) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      result += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      if (input[i] === "\n") result += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++;
      i++;
      continue;
    }

    result += char;
  }

  return result;
}

function readMeta() {
  const metaFile = path.join(SRC, "_meta.json");
  if (!fs.existsSync(metaFile)) return { order: [], items: {} };
  try {
    const raw = fs.readFileSync(metaFile, "utf8");
    const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const cleaned = stripJsonComments(normalized).trim();
    if (!cleaned) return { order: [], items: {} };
    const meta = JSON.parse(cleaned);
    return {
      order: Array.isArray(meta.order) ? meta.order : [],
      items: typeof meta.items === "object" && meta.items !== null ? meta.items : {},
    };
  } catch {
    return { order: [], items: {} };
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toBookmarkletURL(source, wrap = true) {
  const code = wrap ? `(function(){${source}})();` : source;
  return "javascript:" + encodeURI(code).replace(/#/g, "%23");
}

// Collect ---------------------------------------------------------------
ensureDir(DIST);
const allFiles = listJs(SRC);
const meta = readMeta();
const ordered = [
  ...meta.order.filter(f => allFiles.includes(f)),
  ...allFiles.filter(f => !meta.order.includes(f)),
];

const entries = ordered.map(file => {
  const full = path.join(SRC, file);
  const src = fs.readFileSync(full, "utf8");
  const cfg = meta.items[file] || {};
  const name = cfg.name || file.replace(/\.js$/, "");
  const desc = cfg.desc || "";
  const href = toBookmarkletURL(src, cfg.wrap !== false);
  const mtime = fs.statSync(full).mtime.toISOString();
  return { name, desc, href, mtime };
});

// HTML & CSS ------------------------------------------------------------
const css = `:root {
  color-scheme: light;
  --maxw: 900px;
  --bg: #ffffff;
  --fg: #0f172a;
  --muted: #64748b;
  --accent: #2563eb;
  --accent-fg: #ffffff;
  --card: #f8fafc;
  --border: #e2e8f0;
  --shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  --shadow-hover: 0 12px 32px rgba(37, 99, 235, 0.18);
  --radius: 14px;
  --tooltip-bg: rgba(15, 23, 42, 0.92);
  --tooltip-fg: #f8fafc;
}

html[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0b1220;
  --fg: #e2e8f0;
  --muted: #94a3b8;
  --accent: #3b82f6;
  --accent-fg: #0b1220;
  --card: rgba(15, 23, 42, 0.75);
  --border: rgba(148, 163, 184, 0.26);
  --shadow: 0 12px 32px rgba(8, 15, 35, 0.55);
  --shadow-hover: 0 16px 40px rgba(59, 130, 246, 0.28);
  --tooltip-bg: rgba(226, 232, 240, 0.92);
  --tooltip-fg: #0f172a;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Helvetica, Arial;
  background: var(--bg);
  color: var(--fg);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 48px 16px 64px;
}

.page {
  width: 100%;
  max-width: var(--maxw);
}

.topbar {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 16px;
}

.theme-toggle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--fg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
  outline: none;
}

main {
  background: transparent;
}

h1 {
  text-align: center;
  margin: 0 0 6px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

p.subtitle {
  text-align: center;
  color: var(--muted);
  margin: 0;
}

.toolbar {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.toolbar button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  padding: 10px 16px;
  background: var(--card);
  color: var(--fg);
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.toolbar button:hover,
.toolbar button:focus-visible {
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
  outline: none;
}

section.grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 32px;
}

article.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

article.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

div.row1 {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  flex-wrap: wrap;
}

div.row1-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 240px;
}

a.btn {
  background: var(--accent);
  color: var(--accent-fg);
  text-decoration: none;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 650;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

a.btn:hover,
a.btn:focus-visible {
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
  outline: none;
}

span.name {
  font-weight: 600;
}

span.badge {
  font-size: 13px;
  color: var(--muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.actions button {
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg);
  padding: 8px 12px;
  font-weight: 550;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.actions button:hover,
.actions button:focus-visible {
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
  outline: none;
}

details {
  border-top: 1px dashed var(--border);
  margin-top: 6px;
  padding-top: 6px;
}

summary {
  cursor: pointer;
  color: var(--muted);
  font-size: 13px;
}

div.more {
  font-size: 13px;
  color: var(--muted);
  margin-top: 4px;
}

[data-tip] {
  position: relative;
}

[data-tip]:hover::after,
[data-tip]:focus-visible::after {
  content: attr(data-tip);
  position: absolute;
  left: 50%;
  transform: translate(-50%, -8px);
  bottom: 100%;
  background: var(--tooltip-bg);
  color: var(--tooltip-fg);
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: var(--shadow);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0s !important;
    animation-duration: 0s !important;
  }
}
`;

const cardsHtml = entries
  .map(e => {
    const descContent = e.desc ? escapeHtml(e.desc) : "No description";
    const details = `<details><summary>More info</summary><div class="more">${descContent}</div></details>`;
    return `<article class="card" data-id="${escapeHtml(e.name)}">
      <div class="row1">
        <div class="row1-left">
          <a class="btn" draggable="true" href="${e.href}" data-tip="Drag to bookmarks">🔖 Drag</a>
          <span class="name">${escapeHtml(e.name)}</span>
        </div>
        <span class="badge">Last change: ${new Date(e.mtime).toLocaleDateString("en-GB")}</span>
      </div>
      <div class="actions">
        <button class="copy" type="button" data-code="${encodeURIComponent(e.href)}" data-tip="Copy bookmarklet URL">📋 Copy</button>
      </div>
      ${details}
    </article>`;
  })
  .join("\n");

const script = `<script>(function(){
  const root=document.documentElement;
  const themeBtn=document.getElementById('themeToggle');
  const exportBtn=document.getElementById('exportAll');
  const prefersDark=window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(mode){
    const chosen=mode==='auto'?(prefersDark.matches?'dark':'light'):mode;
    root.setAttribute('data-theme', chosen);
    localStorage.setItem('theme', mode);
  }

  const saved=localStorage.getItem('theme')||'auto';
  applyTheme(saved);

  if(themeBtn){
    themeBtn.addEventListener('click',()=>{
      const current=localStorage.getItem('theme')||'auto';
      const next=current==='auto'?'dark':current==='dark'?'light':'auto';
      applyTheme(next);
      themeBtn.setAttribute('data-tip','Theme: '+next);
      setTimeout(()=>themeBtn.setAttribute('data-tip','Toggle theme'),1200);
    });
  }

  document.querySelectorAll('a.btn').forEach(anchor=>{
    anchor.addEventListener('dragstart',ev=>{
      const url=anchor.getAttribute('href');
      ev.dataTransfer.effectAllowed='copy';
      ev.dataTransfer.setData('text/uri-list',url);
      ev.dataTransfer.setData('text/plain',url);
    });
  });

  function fallbackCopy(text){
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.setAttribute('readonly','');
    ta.style.position='absolute';
    ta.style.left='-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok=false;
    try{ok=document.execCommand('copy');}catch(e){}
    document.body.removeChild(ta);
    return ok;
  }

  function pulse(el,label){
    const prev=el.getAttribute('data-tip')||'';
    el.setAttribute('data-tip',label);
    setTimeout(()=>el.setAttribute('data-tip',prev),1200);
  }

  document.querySelectorAll('button.copy').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const url=decodeURIComponent(btn.getAttribute('data-code'));
      try{
        await navigator.clipboard.writeText(url);
        pulse(btn,'Copied!');
      }catch(err){
        fallbackCopy(url)?pulse(btn,'Copied!'):pulse(btn,'Copy failed');
      }
    });
  });

  if(exportBtn){
    exportBtn.addEventListener('click',async()=>{
      const lines=[...document.querySelectorAll('article.card')].map(card=>{
        const name=card.querySelector('.name').textContent.trim();
        const href=card.querySelector('a.btn').getAttribute('href');
        return '- ['+name+']('+href+')';
      }).join('\n');
      try{
        await navigator.clipboard.writeText(lines);
        pulse(exportBtn,'Exported!');
      }catch(err){
        fallbackCopy(lines)?pulse(exportBtn,'Exported!'):pulse(exportBtn,'Copy failed');
      }
    });
  }
})();</script>`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <title>BSP Auto – Bookmarklets</title>
  <style>${css}</style>
</head>
<body>
  <div class="page">
    <header class="topbar">
      <button id="themeToggle" class="theme-toggle" type="button" data-tip="Toggle theme" aria-label="Toggle theme">🌗</button>
    </header>
    <main>
      <h1>BSP Auto – Bookmarklets</h1>
      <p class="subtitle">Drag buttons to your bookmarks bar or click to run.</p>
      <div class="toolbar">
        <button id="exportAll" type="button" data-tip="Copy list as Markdown">🗒️ Export list</button>
      </div>
      <section class="grid">
        ${cardsHtml}
      </section>
    </main>
  </div>
  ${script}
</body>
</html>`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`✅ Built ${OUT} with ${entries.length} bookmarklet(s).`);
