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

function toBase64(str) {
  return Buffer.from(str, "utf8").toString("base64");
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
  return {
    name,
    desc,
    href,
    mtime,
    src,
    srcB64: toBase64(src),
    descB64: toBase64(desc),
  };
});

// HTML & CSS ------------------------------------------------------------
const css = `
:root {
  --maxw: 900px;
  --bg: #fff;
  --fg: #0f172a;
  --muted: #64748b;
  --accent: #2563eb;
  --accent-soft: color-mix(in oklab, var(--accent) 90%, white);
  --card: #f8fafc;
  --border: #e2e8f0;
  --radius: 14px;
  --shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 20%, transparent),
    0 8px 18px rgba(15, 23, 42, 0.08);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Inter", system-ui, -apple-system, Segoe UI, Roboto, Ubuntu,
    Helvetica, Arial;
  background: var(--bg);
  color: var(--fg);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 40px 12px;
}

main {
  width: 100%;
  max-width: var(--maxw);
}

header.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 18px;
}

header.topbar .titles {
  flex: 1 1 260px;
}

header.topbar h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 36px);
}

header.topbar p.subtitle {
  margin: 6px 0 0;
  color: var(--muted);
}

section.grid {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

article.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: 0.2s;
}

article.card:hover {
  box-shadow: var(--shadow);
}

div.row1 {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
}

div.row1-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 220px;
  min-width: 220px;
}

a.btn-primary {
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

a.btn-primary.dragging {
  opacity: 0.85;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 35%, transparent);
}

span.name {
  font-weight: 600;
  font-size: 16px;
}

span.badge {
  font-size: 12px;
  color: var(--muted);
}

div.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

button.action {
  border: 1px solid var(--border);
  background: #fff;
  color: var(--fg);
  padding: 8px 14px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: 0.2s;
}

button.action:hover {
  border-color: var(--accent);
  color: var(--accent);
}

button.action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

button.action[data-variant="primary"] {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

details {
  border-top: 1px dashed var(--border);
  margin-top: 2px;
  padding-top: 8px;
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
  line-height: 1.5;
}

[data-tooltip] {
  position: relative;
}

[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  top: -34px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--fg);
  color: #fff;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: 0.18s ease;
  translate: 0 6px;
}

[data-tooltip]._show::after {
  opacity: 1;
  translate: 0 0;
}

button.export-btn {
  align-self: flex-start;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--fg);
  padding: 9px 16px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: 0.2s;
}

button.export-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

button.export-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  header.topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  div.row1-left {
    flex: 1 1 auto;
  }

  div.row1 {
    flex-direction: column;
    align-items: flex-start;
  }

  a.btn-primary {
    width: 100%;
    justify-content: center;
  }
}
`.trim();

const scriptLines = [
  '"use strict";',
  '(function() {',
  '  const decodeB64 = function(value) {',
  '    if (!value) return "";',
  '    try {',
  '      return decodeURIComponent(escape(atob(value)));',
  '    } catch (_) {',
  '      return "";',
  '    }',
  '  };',
  '',
  '  const cards = Array.from(document.querySelectorAll("article.card"));',
  '',
  '  const tooltip = function(el, msg) {',
  '    if (!el) return;',
  '    el.setAttribute("data-tooltip", msg);',
  '    el.classList.add("_show");',
  '    clearTimeout(el._tipTimeout);',
  '    el._tipTimeout = window.setTimeout(function() {',
  '      el.classList.remove("_show");',
  '      el.removeAttribute("data-tooltip");',
  '    }, 1800);',
  '  };',
  '',
  '  const copyText = async function(text) {',
  '    if (!text) throw new Error("Nothing to copy");',
  '    if (navigator.clipboard && navigator.clipboard.writeText) {',
  '      try {',
  '        await navigator.clipboard.writeText(text);',
  '        return true;',
  '      } catch (_) {',
  '        // continue to fallback',
  '      }',
  '    }',
  '    const textarea = document.createElement("textarea");',
  '    textarea.value = text;',
  '    textarea.setAttribute("readonly", "");',
  '    textarea.style.position = "fixed";',
  '    textarea.style.opacity = "0";',
  '    textarea.style.pointerEvents = "none";',
  '    textarea.style.inset = "0";',
  '    document.body.appendChild(textarea);',
  '    try {',
  '      textarea.focus({ preventScroll: true });',
  '    } catch (_) {',
  '      textarea.focus();',
  '    }',
  '    textarea.select();',
  '    let ok = false;',
  '    try {',
  '      ok = document.execCommand("copy");',
  '    } catch (_) {',
  '      ok = false;',
  '    }',
  '    document.body.removeChild(textarea);',
  '    if (!ok) throw new Error("Copy failed");',
  '    return true;',
  '  };',
  '',
  '  const runBookmarklet = function(href) {',
  '    if (!href) return;',
  '    window.location.assign(href);',
  '  };',
  '',
  '  const exportBtn = document.querySelector("button[data-action=\\"export-markdown\\"]");',
  '',
  '  const exportMarkdown = async function() {',
  '    if (!cards.length) return;',
  '    const sections = cards.map(function(card) {',
  '      const name = card.dataset.name || "Untitled";',
  '      const href = card.dataset.href || "";',
  '      const desc = decodeB64(card.dataset.descB64);',
  '      const source = decodeB64(card.dataset.srcB64);',
  '      const parts = ["### " + name];',
  '      if (desc) parts.push(desc);',
  '      if (source) {',
  '        parts.push("```javascript");',
  '        parts.push(source);',
  '        parts.push("```");',
  '      }',
  '      if (href) parts.push("[Run bookmarklet](" + href + ")");',
  '      return parts.join("\\n\\n");',
  '    });',
  '    const md = ["# BSP Auto Bookmarklets", sections.join("\\n\\n---\\n\\n")].join("\\n\\n\\n");',
  '    try {',
  '      await copyText(md);',
  '      tooltip(exportBtn, "Markdown copied");',
  '    } catch (_) {',
  '      const blob = new Blob([md], { type: "text/markdown" });',
  '      const url = URL.createObjectURL(blob);',
  '      const a = document.createElement("a");',
  '      a.href = url;',
  '      a.download = "bookmarklets.md";',
  '      document.body.appendChild(a);',
  '      a.click();',
  '      document.body.removeChild(a);',
  '      window.setTimeout(function() {',
  '        URL.revokeObjectURL(url);',
  '      }, 200);',
  '      tooltip(exportBtn, "Markdown downloaded");',
  '    }',
  '  };',
  '',
  '  const handleAction = async function(button) {',
  '    const card = button.closest("article.card");',
  '    if (!card) return;',
  '    const href = card.dataset.href || "";',
  '    const action = button.dataset.action;',
  '    try {',
  '      if (action === "copy") {',
  '        await copyText(href);',
  '        tooltip(button, "Bookmarklet copied");',
  '      } else if (action === "run") {',
  '        runBookmarklet(href);',
  '        tooltip(button, "Executing…");',
  '      }',
  '    } catch (_) {',
  '      tooltip(button, "Action failed");',
  '    }',
  '  };',
  '',
  '  const setupDrag = function(anchor) {',
  '    anchor.addEventListener("dragstart", function(event) {',
  '      const card = anchor.closest("article.card");',
  '      if (!card || !event.dataTransfer) return;',
  '      const href = card.dataset.href || anchor.getAttribute("href") || "";',
  '      const name = card.dataset.name || (anchor.textContent || "Bookmarklet").trim();',
  '      event.dataTransfer.setData("text/uri-list", href);',
  '      event.dataTransfer.setData("text/plain", name + "\\n" + href);',
  '      event.dataTransfer.effectAllowed = "copy";',
  '      anchor.classList.add("dragging");',
  '      tooltip(anchor, "Drag me to your bar");',
  '    });',
  '    anchor.addEventListener("dragend", function() {',
  '      anchor.classList.remove("dragging");',
  '    });',
  '  };',
  '',
  '  cards.forEach(function(card) {',
  '    card.querySelectorAll("button.action").forEach(function(button) {',
  '      button.addEventListener("click", function() {',
  '        handleAction(button);',
  '      });',
  '    });',
  '    const anchor = card.querySelector(\'a[draggable="true"]\');',
  '    if (anchor) setupDrag(anchor);',
  '  });',
  '',
  '  if (exportBtn) {',
  '    exportBtn.addEventListener("click", exportMarkdown);',
  '  }',
  '})();',
];
const script = scriptLines.join("\n");
const scriptSafe = script.replace(/<\/script>/g, "<\\/script>");

const cardsHtml = entries
  .map(e => {
    const description = escapeHtml(e.desc) || "No description";
    const lastEdited = new Date(e.mtime).toLocaleDateString("en-GB");
    return `    <article class="card" data-name="${escapeHtml(e.name)}" data-desc-b64="${escapeHtml(e.descB64)}" data-src-b64="${escapeHtml(e.srcB64)}" data-href="${escapeHtml(e.href)}" data-mtime="${escapeHtml(e.mtime)}">
      <div class="row1">
        <div class="row1-left">
          <a class="btn-primary" href="${e.href}" draggable="true" data-action="drag">Drag to bookmarks</a>
          <span class="name">${escapeHtml(e.name)}</span>
        </div>
        <span class="badge">Last change: ${lastEdited}</span>
      </div>
      <div class="actions">
        <button type="button" class="action" data-action="copy">Copy</button>
        <button type="button" class="action" data-action="run">Run</button>
      </div>
      <details>
        <summary>More info</summary>
        <div class="more">${description}</div>
      </details>
    </article>`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <title>BSP Auto – Bookmarklets</title>
  <style>${css}</style>
</head>
<body>
  <main>
    <header class="topbar">
      <div class="titles">
        <h1>BSP Auto – Bookmarklets</h1>
        <p class="subtitle">Drag buttons to your bookmarks bar or click to run.</p>
      </div>
      <button type="button" class="export-btn" data-action="export-markdown">Export Markdown</button>
    </header>
    <section class="grid">
${cardsHtml}
    </section>
  </main>
  <script>${scriptSafe}</script>
</body>
</html>`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`✅ Built ${OUT} with ${entries.length} bookmarklet(s).`);
