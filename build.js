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
  const {
    name: rawName,
    desc: rawDesc,
    wrap,
    bookmarkName: rawBookmarkName,
    ...rest
  } = cfg;

  const fallbackName = file.replace(/\.js$/, "");
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : fallbackName;
  const desc = typeof rawDesc === "string" ? rawDesc.trim() : "";
  const bookmarkNameClean =
    typeof rawBookmarkName === "string" && rawBookmarkName.trim() ? rawBookmarkName.trim() : "";
  const bookmarkName = bookmarkNameClean || name;
  const href = toBookmarkletURL(src, wrap !== false);
  const mtime = fs.statSync(full).mtime.toISOString();

  return {
    ...rest,
    name,
    desc,
    href,
    mtime,
    bookmarkName,
    hasBookmarkName: Boolean(bookmarkNameClean),
  };
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

:root[data-theme="dark"],
body[data-theme="dark"] {
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
  align-items: stretch;
  min-height: 100vh;
  padding: 24px 0 32px;
}

.page {
  width: 100%;
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 0 8px;
}

.topbar {
  display: flex;
  justify-content: flex-start;
  padding: 0 30px;
  margin-bottom: 12px;
}


.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--card);
  color: var(--fg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.visually-hidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.theme-toggle:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
}

.theme-toggle:focus-visible {
  box-shadow: var(--shadow-hover);
  transform: translateY(-1px);
  outline: 2px solid var(--accent);
  outline-offset: 3px;
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

div.title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
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

span.bookmark-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--accent);
  background: rgba(37, 99, 235, 0.12);
  padding: 2px 10px;
  border-radius: 999px;
  align-self: flex-start;
  max-width: 100%;
  word-break: break-word;
}

span.bookmark-name.is-fallback {
  color: var(--muted);
  background: rgba(100, 116, 139, 0.12);
  font-weight: 500;
}

html[data-theme="dark"] span.bookmark-name {
  color: #bfdbfe;
  background: rgba(59, 130, 246, 0.22);
}

html[data-theme="dark"] span.bookmark-name.is-fallback {
  color: var(--muted);
  background: rgba(148, 163, 184, 0.22);
}

span.badge {
  font-size: 13px;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
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
    const details = e.desc
      ? `<details><summary>More info</summary><div class="more">${escapeHtml(e.desc)}</div></details>`
      : "";
    const bookmarkLine = e.bookmarkName
      ? `<span class="bookmark-name${e.hasBookmarkName ? "" : " is-fallback"}">Bookmark: ${escapeHtml(e.bookmarkName)}${e.hasBookmarkName ? "" : " (default)"}</span>`
      : "";
    return `<article class="card" data-id="${escapeHtml(e.name)}" data-bookmark="${escapeHtml(e.bookmarkName || "")}" data-bookmark-fallback="${e.hasBookmarkName ? "false" : "true"}">
      <div class="row1">
        <div class="row1-left">
          <a class="btn" draggable="true" href="${e.href}" data-tip="Drag to bookmarks">${escapeHtml(e.bookmarkName || e.name)}</a>
          <div class="title-group">
            <span class="name">${escapeHtml(e.name)}</span>
            ${bookmarkLine}
          </div>
        </div>
        <span class="badge">Last update: ${new Date(e.mtime).toLocaleDateString("en-GB")}</span>
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
  const body=document.body;
  const themeBtn=document.getElementById('themeToggle');
  const liveRegion=document.getElementById('liveRegion');
  const prefersDark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):{matches:false};
  const PULSE_TIMEOUT=1200;
  const tipTimers=new WeakMap();
  let liveMessageTimer=null;
  let liveResetTimer=null;

  function safeGet(key){
    try{return localStorage.getItem(key);}catch(e){return null;}
  }

  function safeSet(key,value){
    try{localStorage.setItem(key,value);}catch(e){}
  }

  function updateThemeToggle(mode){
    if(!themeBtn) return;
    themeBtn.setAttribute('aria-pressed',mode==='dark'?'true':'false');
    const nextLabel=mode==='dark'?'Switch to light mode':'Switch to dark mode';
    themeBtn.setAttribute('data-tip',nextLabel);
    themeBtn.setAttribute('aria-label',nextLabel);
  }

  function applyTheme(mode,options){
    const chosen=mode==='dark'?'dark':'light';
    root.setAttribute('data-theme',chosen);
    if(body){body.setAttribute('data-theme',chosen);}
    if(!options||options.store!==false){
      safeSet('theme',chosen);
    }
    updateThemeToggle(chosen);
  }

  const saved=safeGet('theme');
  const initial=saved==='dark'||saved==='light'?saved:prefersDark.matches?'dark':'light';
  applyTheme(initial,{store:false});

  if(themeBtn){
    themeBtn.addEventListener('click',()=>{
      const current=root.getAttribute('data-theme')==='dark'?'dark':'light';
      const next=current==='dark'?'light':'dark';
      applyTheme(next);
    });
  }

  function escapeHtmlLite(value){
    return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  document.querySelectorAll('a.btn').forEach(anchor=>{
    anchor.addEventListener('dragstart',ev=>{
      const url=anchor.getAttribute('href');
      const card=anchor.closest('article');
      const rawTitle=card?card.getAttribute('data-bookmark')||'':'';
      const title=(rawTitle||anchor.textContent||'').replace(/[\\r\\n]+/g,' ').trim();
      ev.dataTransfer.effectAllowed='copy';
      ev.dataTransfer.setData('text/uri-list',url);
      ev.dataTransfer.setData('text/plain',url);
      if(title){
        try{ev.dataTransfer.setData('text/x-moz-url',url+'\n'+title);}catch(e){}
        try{ev.dataTransfer.setData('text/html','<a href="'+url+'">'+escapeHtmlLite(title)+'</a>');}catch(e){}
      }
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

  function announceLive(message){
    if(!liveRegion) return;
    liveRegion.textContent='';
    if(liveMessageTimer){clearTimeout(liveMessageTimer);}
    if(liveResetTimer){clearTimeout(liveResetTimer);}
    liveMessageTimer=setTimeout(()=>{
      liveRegion.textContent=message;
      liveMessageTimer=null;
    },50);
    liveResetTimer=setTimeout(()=>{
      liveRegion.textContent='';
      liveResetTimer=null;
    },PULSE_TIMEOUT);
  }

  function pulse(el,label){
    if(!el.hasAttribute('data-tip-default')){
      el.setAttribute('data-tip-default',el.getAttribute('data-tip')||'');
    }
    el.setAttribute('data-tip',label);
    if(tipTimers.has(el)){
      clearTimeout(tipTimers.get(el));
    }
    announceLive(label);
    const timeout=setTimeout(()=>{
      el.setAttribute('data-tip',el.getAttribute('data-tip-default')||'');
      tipTimers.delete(el);
    },PULSE_TIMEOUT);
    tipTimers.set(el,timeout);
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
})();</script>`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <script>(function(){
    try{
      var stored=localStorage.getItem('theme');
      if(stored==='dark'||stored==='light'){
        document.documentElement.setAttribute('data-theme',stored);
      }else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){
        document.documentElement.setAttribute('data-theme','dark');
      }
    }catch(e){}
  })();</script>
  <title>BSP Auto – Bookmarklets</title>
  <style>${css}</style>
</head>
<body>
  <header class="topbar">
    <button id="themeToggle" class="theme-toggle" type="button" data-tip="Toggle theme" aria-label="Toggle theme">🌗</button>
  </header>
  <div class="page">
    <div id="liveRegion" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true"></div>
    <main>
      <h1>BSP Auto – Bookmarklets</h1>
      <p class="subtitle">Drag buttons to your bookmarks bar or click to run.</p>
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
