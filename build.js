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
const css = `:root{--maxw:900px;--radius:14px;--space:40px;--font:'Inter',system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial;--bg:#ffffff;--fg:#0f172a;--muted:#64748b;--accent:#2563eb;--card:#f8fafc;--border:#e2e8f0;--btn-fg:#ffffff;--btn-shadow:0 10px 22px rgba(37,99,235,.25);--shadow:0 0 0 3px color-mix(in oklab,var(--accent)25%,transparent),0 6px 16px rgba(0,0,0,.06);}html[data-theme="dark"]{--bg:#0f172a;--fg:#e2e8f0;--muted:#94a3b8;--accent:#38bdf8;--card:#1e293b;--border:#334155;--btn-fg:#0f172a;--btn-shadow:0 10px 22px rgba(56,189,248,.35);--shadow:0 0 0 3px color-mix(in oklab,var(--accent)35%,transparent),0 12px 24px rgba(15,23,42,.4);}body{margin:0;font-family:var(--font);background:var(--bg);color:var(--fg);display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:var(--space) 12px;transition:background .3s,color .3s;}main{width:100%;max-width:var(--maxw);}header.topbar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;margin:0 auto 26px;width:100%;max-width:var(--maxw);}header.topbar-inner{display:flex;flex-direction:column;align-items:center;text-align:center;}div.topbar-spacer{width:44px;height:44px;}button.theme-toggle{align-items:center;appearance:none;background:var(--card);border:1px solid color-mix(in oklab,var(--accent)55%,#0000);border-radius:999px;box-shadow:var(--shadow);color:var(--fg);cursor:pointer;display:inline-flex;font-size:20px;height:44px;justify-content:center;transition:transform .2s,box-shadow .3s,background .3s,color .3s;width:44px;}button.theme-toggle:hover{transform:translateY(-1px);}button.theme-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:3px;}button.theme-toggle[aria-pressed=true]{background:var(--accent);color:var(--btn-fg);box-shadow:var(--shadow);}h1{margin:0;font-size:clamp(26px,4vw,36px);}p.subtitle{margin:6px 0 0;color:var(--muted);}section.grid{display:flex;flex-direction:column;gap:14px;}article.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;display:flex;flex-direction:column;gap:6px;transition:.2s;}article.card:hover{box-shadow:var(--shadow);}div.row1{display:flex;align-items:center;gap:12px;justify-content:space-between;}div.row1-left{display:flex;align-items:center;gap:12px;flex:1;}a.btn{background:var(--accent);color:var(--btn-fg);text-decoration:none;padding:8px 14px;border-radius:10px;font-weight:600;transition:box-shadow .2s,transform .2s;}a.btn:hover{transform:translateY(-1px);box-shadow:var(--btn-shadow);}span.name{font-weight:600;}span.badge{font-size:12px;color:var(--muted);}details{border-top:1px dashed var(--border);margin-top:6px;padding-top:6px;}summary{cursor:pointer;color:var(--muted);font-size:13px;}div.more{font-size:13px;color:var(--muted);margin-top:4px;}`;

const html = `<!doctype html><html lang=en data-theme="light"><head><meta charset=utf-8><meta name=viewport content="width=device-width"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"><title>BSP Auto – Bookmarklets</title><style>${css}</style></head><body><main><header class=topbar><button class="theme-toggle" type=button aria-label="Toggle theme" aria-pressed=false>🌗</button><div class=topbar-inner><h1>BSP Auto – Bookmarklets</h1><p class=subtitle>Drag buttons to your bookmarks bar or click to run.</p></div><div class=topbar-spacer aria-hidden=true></div></header><section class=grid>${entries.map(e=>`<article class=card><div class=row1><div class=row1-left><a class=btn href="${e.href}">Drag to bookmarks</a><span class=name>${escapeHtml(e.name)}</span></div><span class=badge>Last change: ${new Date(e.mtime).toLocaleDateString('en-GB')}</span></div><details><summary>More info</summary><div class=more>${escapeHtml(e.desc)||'No description'}</div></details></article>`).join('')}</section></main><script>(()=>{const STORAGE_KEY="bsp-theme";const root=document.documentElement;const btn=document.querySelector(".theme-toggle");if(!btn)return;const prefersDark=window.matchMedia("(prefers-color-scheme: dark)");const setButtonState=value=>{btn.setAttribute("aria-pressed",String(value==="dark"));};const applyTheme=(theme,{persist}={persist:true})=>{const value=theme==="dark"?"dark":"light";root.setAttribute("data-theme",value);setButtonState(value);if(persist)localStorage.setItem(STORAGE_KEY,value);};const stored=localStorage.getItem(STORAGE_KEY);if(stored==="dark"||stored==="light"){applyTheme(stored,{persist:false});}else{applyTheme(prefersDark.matches?"dark":"light",{persist:false});}btn.addEventListener("click",()=>{const next=root.getAttribute("data-theme")==="dark"?"light":"dark";applyTheme(next,{persist:true});});prefersDark.addEventListener("change",event=>{if(localStorage.getItem(STORAGE_KEY))return;applyTheme(event.matches?"dark":"light",{persist:false});});})();</script></body></html>`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`✅ Built ${OUT} with ${entries.length} bookmarklet(s).`);
