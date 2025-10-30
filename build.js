// build.js — BSP Auto Bookmarklet Builder (clean final version)
// Generates dist/index.html with modern UI and no BOM/Shebang issues.

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

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

function readJsonFile(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8");
    const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const cleaned = stripJsonComments(normalized).trim();
    if (!cleaned) return null;
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function readMeta() {
  const metaFile = path.join(SRC, "_meta.json");
  const meta = readJsonFile(metaFile) || {};
  return {
    version: typeof meta.version === "string" ? meta.version.trim() : "",
    order: Array.isArray(meta.order) ? meta.order : [],
    items: typeof meta.items === "object" && meta.items !== null ? meta.items : {},
  };
}

function resolveVersion(metaVersion = "") {
  const pkg = readJsonFile(path.join(__dirname, "package.json"));
  if (pkg && typeof pkg.version === "string" && pkg.version.trim()) {
    return pkg.version.trim();
  }
  if (metaVersion && metaVersion.trim()) {
    return metaVersion.trim();
  }
  return "0.0.0";
}

function formatTimestamp(date) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatLastChangeAbsolute(isoString) {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }
  return formatTimestamp(parsed);
}

function getLastChangeISO(file) {
  const relative = path.relative(__dirname, file);
  try {
    const output = childProcess
      .execFileSync("git", ["log", "-1", "--format=%cI", relative], {
        cwd: __dirname,
        stdio: ["ignore", "pipe", "ignore"],
      })
      .toString()
      .trim();

    if (output) {
      const parsed = new Date(output);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  } catch {}

  try {
    return fs.statSync(file).mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function latestTimestampISO(candidates) {
  let latest = null;

  for (const iso of candidates) {
    if (typeof iso !== "string" || !iso) continue;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) continue;
    if (!latest || date.getTime() > latest.getTime()) {
      latest = date;
    }
  }

  return latest ? latest.toISOString() : null;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeBookmarkletSource(source, wrap = true) {
  if (typeof source !== "string") {
    const shouldWrap = wrap !== false;
    return {
      code: "",
      wrap: shouldWrap,
      wrapperType: shouldWrap ? "plain" : "none",
    };
  }

  let cleaned = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  const jsPrefixMatch = cleaned.match(/^\s*javascript:\s*/i);
  if (jsPrefixMatch) {
    cleaned = cleaned.slice(jsPrefixMatch[0].length);
  }

  cleaned = cleaned.trim();

  const shouldWrap = wrap !== false;
  let wrapperType = shouldWrap ? "plain" : "none";

  if (shouldWrap) {
    const iifePatterns = [
      { pattern: /^\(function\s*\(\)\s*{([\s\S]*)}\)\(\);?$/i, type: "plain" },
      { pattern: /^\(\s*async\s*function\s*\(\)\s*{([\s\S]*)}\)\(\);?$/i, type: "async" },
      { pattern: /^\(\s*\(\s*\)\s*=>\s*{([\s\S]*)}\)\s*\(\);?$/i, type: "plain" },
      { pattern: /^\(\s*async\s*\(\s*\)\s*=>\s*{([\s\S]*)}\)\s*\(\);?$/i, type: "async" },
    ];

    for (const { pattern, type } of iifePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        cleaned = match[1];
        wrapperType = type;
        break;
      }
    }
  }

  return { code: cleaned, wrap: shouldWrap, wrapperType };
}

function toBookmarkletURL(source, wrap = true) {
  const { code, wrap: shouldWrap, wrapperType } = normalizeBookmarkletSource(source, wrap);
  let finalCode;
  if (shouldWrap) {
    if (wrapperType === "async") {
      finalCode = `(async function(){${code}})();`;
    } else {
      finalCode = `(function(){${code}})();`;
    }
  } else {
    finalCode = code;
  }
  return "javascript:" + encodeURI(finalCode).replace(/#/g, "%23");
}

// Collect ---------------------------------------------------------------
ensureDir(DIST);
const allFiles = listJs(SRC);
const meta = readMeta();
const version = resolveVersion(meta.version);
const versionDisplay = version.startsWith("v") ? version : `v${version}`;
const buildNow = new Date();
const buildTimestamp = formatTimestamp(buildNow);
const metaFilePath = path.join(SRC, "_meta.json");
const metaLastChange = fs.existsSync(metaFilePath) ? getLastChangeISO(metaFilePath) : null;
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
  const scriptMtime = getLastChangeISO(full);
  const combinedMtime = latestTimestampISO([scriptMtime, metaLastChange]);
  const mtime = combinedMtime || scriptMtime;

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
  --maxw: 1000px;
  --bg: #ffffff;
  --fg: #0f172a;
  --muted: #64748b;
  --accent: #2563eb;
  --accent-gradient: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
  --accent-fg: #ffffff;
  --card: rgba(248, 250, 252, 0.65);
  --border: rgba(148, 163, 184, 0.35);
  --shadow: 0 14px 32px rgba(37, 99, 235, 0.18);
  --shadow-hover: 0 18px 50px rgba(59, 130, 246, 0.28);
  --shadow-hover-button: 0 12px 32px rgba(59, 130, 246, 0.28);
  --radius: 18px;
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
  --accent-gradient: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  --accent-fg: #0b1220;
  --card: rgba(15, 23, 42, 0.55);
  --border: rgba(96, 165, 250, 0.32);
  --shadow: 0 14px 32px rgba(37, 99, 235, 0.32);
  --shadow-hover: 0 22px 60px rgba(125, 211, 252, 0.42);
  --shadow-hover-button: 0 12px 32px rgba(125, 211, 252, 0.42);
  --tooltip-bg: rgba(226, 232, 240, 0.92);
  --tooltip-fg: #0f172a;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Lexend', 'Inter', 'Inter Tight', system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Helvetica, Arial;
  background: var(--bg);
  color: var(--fg);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 100vh;
  padding: 24px 0 32px;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: 'Lexend', 'Inter', 'Inter Tight', system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Helvetica, Arial;
}

.page {
  width: 100%;
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  flex: 1 0 auto;
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
  flex: 1 0 auto;
}

h1 {
  text-align: center;
  margin: 0 0 6px;
  font-weight: 700;
  letter-spacing: 0.02em;
  background-image: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

p.subtitle {
  text-align: center;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.24em;
  font-weight: 600;
  font-size: 13px;
  margin: 0;
}

section.grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 80px;
}

.site-footer {
  margin: 0;
  padding: 18px 0 12px;
  text-align: center;
  font-size: 0.92rem;
  color: var(--muted);
  letter-spacing: 0.04em;
  border-top: 1px solid var(--border);
}

.site-footer strong {
  font-weight: 600;
  color: var(--fg);
}

article.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--shadow);
  backdrop-filter: saturate(150%) blur(18px);
  -webkit-backdrop-filter: saturate(150%) blur(18px);
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
  background-image: var(--accent-gradient);
  color: var(--accent-fg);
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 16px;
  font-weight: 650;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  row-gap: 2px;
  background-size: 200% 200%;
  background-position: 0% 50%;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-position 0.3s ease;
}

span.drag-hint {
  font-size: 11px;
  font-variant: all-small-caps;
  letter-spacing: 0.16em;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

span.drag-divider {
  align-self: stretch;
  border-left: 1px solid var(--border);
  width: 0;
}

a.btn:hover,
a.btn:focus-visible {
  box-shadow: var(--shadow-hover-button);
  transform: translateY(-1px);
  outline: none;
  background-position: 100% 50%;
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
    const lastChangeAbsolute = formatLastChangeAbsolute(e.mtime);
    const lastChangeLabel =
      lastChangeAbsolute === "Unknown"
        ? "Last change: Unknown"
        : `Last change: ${lastChangeAbsolute}`;
    return `<article class="card" data-id="${escapeHtml(e.name)}" data-bookmark="${escapeHtml(e.bookmarkName || "")}" data-bookmark-fallback="${e.hasBookmarkName ? "false" : "true"}">
      <div class="row1">
        <div class="row1-left">
          <a class="btn" draggable="true" href="${e.href}" data-tip="Drag to bookmarks">${escapeHtml(e.bookmarkName || e.name)}</a>
          <span class="drag-hint">⇢ Drag me</span>
          <span class="drag-divider" aria-hidden="true"></span>
          <div class="title-group">
            <span class="name">${escapeHtml(e.name)}</span>
            ${bookmarkLine}
          </div>
        </div>
        <span class="badge" data-last-change="${escapeHtml(e.mtime)}" data-last-change-absolute="${escapeHtml(lastChangeAbsolute)}">${escapeHtml(lastChangeLabel)}</span>
      </div>
      ${details}
    </article>`;
  })
  .join("\n");

const script = `<script>
(function(){
  function init(){
    const root=document.documentElement;
    const body=document.body;
    const themeBtn=document.getElementById('themeToggle');
    if(!themeBtn){console.warn('theme toggle button not found at init');}
    const prefersDark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):{matches:false};

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

    function formatRelativeLastChangeRuntime(isoString, reference){
      if(!isoString){return null;}
      var last=new Date(isoString);
      if(isNaN(last.getTime())){return null;}
      var now=reference instanceof Date?reference:new Date(reference||Date.now());
      if(isNaN(now.getTime())){now=new Date();}
      var diffMsRaw=now.getTime()-last.getTime();
      var inFuture=diffMsRaw<0;
      var diffMs=Math.abs(diffMsRaw);
      var minuteMs=60*1000;
      var dayMs=24*minuteMs;
      var monthMs=30*dayMs;
      var label='';
      if(diffMs<dayMs){
        var minutes=Math.max(1,Math.round(diffMs/minuteMs));
        label=minutes===1?'1 minute':minutes+' minutes';
      }else{
        var rawDays=Math.floor(diffMs/dayMs);
        var days=rawDays>0?rawDays:1;
        if(days<60){
          label=days===1?'1 day':days+' days';
        }else{
          var start=inFuture?new Date(now.getTime()):new Date(last.getTime());
          var end=inFuture?new Date(last.getTime()):new Date(now.getTime());
          var years=end.getFullYear()-start.getFullYear();
          var months=end.getMonth()-start.getMonth();
          if(end.getDate()<start.getDate()){months-=1;}
          while(months<0){years-=1;months+=12;}
          if(years<0){years=0;}
          var totalMonths=years*12+months;
          if(totalMonths<=0){
            var approxMonths=Math.max(1,Math.round(diffMs/monthMs));
            label=approxMonths===1?'1 month':approxMonths+' months';
          }else if(years===0){
            label=totalMonths===1?'1 month':totalMonths+' months';
          }else{
            var remainingMonths=totalMonths-years*12;
            if(remainingMonths<=0){
              label=years===1?'1 year':years+' years';
            }else{
              var yearLabel=years===1?'1 year':years+' years';
              var monthLabel=remainingMonths===1?'1 month':remainingMonths+' months';
              label=yearLabel+' / '+monthLabel;
            }
          }
        }
      }
      if(!label){label='1 minute';}
      return inFuture?'in '+label:label+' ago';
    }

    function updateLastChangeBadges(){
      var now=new Date();
      document.querySelectorAll('.badge[data-last-change]').forEach(function(el){
        var iso=el.getAttribute('data-last-change');
        var absolute=el.getAttribute('data-last-change-absolute');
        var relative=formatRelativeLastChangeRuntime(iso,now);
        if(relative){
          el.textContent='Last change: '+relative;
        }else if(absolute){
          el.textContent='Last change: '+absolute;
        }else{
          el.textContent='Last change: Unknown';
        }
      });
    }

    updateLastChangeBadges();
    setInterval(updateLastChangeBadges,60*1000);

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
          try{ev.dataTransfer.setData('text/x-moz-url',url+'\\n'+title);}catch(e){}
          try{ev.dataTransfer.setData('text/html','<a href="'+url+'">'+escapeHtmlLite(title)+'</a>');}catch(e){}
        }
      });
    });
  }

  if(document.readyState==='loading'){
    window.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();
</script>`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;700&display=swap" rel="stylesheet">
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
    <main>
      <h1>BSP Auto – Tools</h1>
      <p class="subtitle">- drag buttons to your bookmarks bar -</p>
      <section class="grid">
        ${cardsHtml}
      </section>
    </main>
    <footer class="site-footer">&copy; BSP Auto 2025 · <strong>${versionDisplay}</strong> (${buildTimestamp})</footer>
  </div>
  ${script}
</body>
</html>`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`✅ Built ${OUT} with ${entries.length} bookmarklet(s).`);
