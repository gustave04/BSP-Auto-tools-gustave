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
const css = `:root{--maxw:900px;--bg:#fff;--fg:#0f172a;--muted:#64748b;--accent:#2563eb;--card:#f8fafc;--border:#e2e8f0;--radius:14px}body{margin:0;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:40px 12px}main{width:100%;max-width:var(--maxw);}h1{text-align:center;margin:0 0 6px;}p.subtitle{text-align:center;color:var(--muted);}section.grid{display:flex;flex-direction:column;gap:14px;margin-top:26px;}article.card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;display:flex;flex-direction:column;gap:6px;transition:.2s;}article.card:hover{box-shadow:0 0 0 3px color-mix(in oklab,var(--accent)25%,transparent),0 6px 16px rgba(0,0,0,.06);}div.row1{display:flex;align-items:center;gap:12px;justify-content:space-between;}div.row1-left{display:flex;align-items:center;gap:12px;flex:1;}a.btn{background:var(--accent);color:#fff;text-decoration:none;padding:8px 14px;border-radius:10px;font-weight:600;}span.name{font-weight:600;}span.badge{font-size:12px;color:var(--muted);}details{border-top:1px dashed var(--border);margin-top:6px;padding-top:6px;}summary{cursor:pointer;color:var(--muted);font-size:13px;}div.more{font-size:13px;color:var(--muted);margin-top:4px;}`;

const html = `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"><title>BSP Auto – Bookmarklets</title><style>${css}</style></head><body><main><h1>BSP Auto – Bookmarklets</h1><p class=subtitle>Drag buttons to your bookmarks bar or click to run.</p><section class=grid>${entries.map(e=>`<article class=card><div class=row1><div class=row1-left><a class=btn href="${e.href}">Drag to bookmarks</a><span class=name>${escapeHtml(e.name)}</span></div><span class=badge>Last change: ${new Date(e.mtime).toLocaleDateString('en-GB')}</span></div><details><summary>More info</summary><div class=more>${escapeHtml(e.desc)||'No description'}</div></details></article>`).join('')}</section></main></body></html>`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`✅ Built ${OUT} with ${entries.length} bookmarklet(s).`);
