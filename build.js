#!/usr/bin/env node
/**
 * build.js — moderne Bookmarklet-Seite für GitHub Pages
 *
 * Features:
 * - Liest alle src/*.js (Dateien, die NICHT mit '_' beginnen) und baut daraus Bookmarklets
 * - Code wird UNVERÄNDERT übernommen (keine Minifizierung/Ersetzungen) → stabil bei Updates
 * - Optional: Metadatei src/_meta.json, um Namen, Beschreibungen, Reihenfolge und Wrap-Verhalten zu steuern
 * - Schreibt dist/index.html mit moderner, hell/dunkel-freundlicher UI (keine Abhängigkeiten)
 *
 * _meta.json Beispiel (optional):
 * {
 *   "order": ["01_fillBookmarklet.js", "copyBookmarklet.js"],
 *   "items": {
 *     "01_fillBookmarklet.js": {
 *       "name": "fillBookmarklet",         // Anzeigename (statt Dateiname ohne .js)
 *       "desc": "Füllt das BSP-Formular automatisch.",
 *       "wrap": true                        // true = in IIFE wrappen, false = Code direkt ausführen
 *     },
 *     "copyBookmarklet.js": {
 *       "name": "copyBookmarklet",
 *       "desc": "Kopiert Daten in die Zwischenablage.",
 *       "wrap": false
 *     }
 *   }
 * }
 */

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const DIST_DIR = path.join(__dirname, "dist");
const OUT_FILE = path.join(DIST_DIR, "index.html");

// ------------------------ Helpers -----------------------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".js"))
    .filter((f) => !f.startsWith("_")) // Unterstrich-Dateien als Quellcode ignorieren (z. B. _meta.json, _helpers.js)
    .sort((a, b) => a.localeCompare(b, "en"));
}

function readMeta() {
  const metaPath = path.join(SRC_DIR, "_meta.json");
  if (!fs.existsSync(metaPath)) return { order: [], items: {} };
  try {
    const raw = fs.readFileSync(metaPath, "utf8");
    const json = JSON.parse(raw);
    const order = Array.isArray(json.order) ? json.order : [];
    const items = json.items && typeof json.items === "object" ? json.items : {};
    return { order, items };
  } catch (e) {
    console.warn("⚠️  Konnte src/_meta.json nicht lesen/parsen:", e.message);
    return { order: [], items: {} };
  }
}

function mtimeISO(file) {
  try { return new Date(fs.statSync(file).mtime).toISOString(); } catch { return null; }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Bookmarklet-URL bauen — Code UNVERÄNDERT lassen; nur sicher URL-encoden
// Optional: in IIFE wrappen (Standard = true). Pro Datei via Meta überschreibbar.
function toBookmarkletURL(source, wrap = true) {
  const code = wrap ? `(function(){\n${source}\n})();` : source;
  // encodeURI für bookmarklet: Whitespace/Unicode bleibt weitgehend erhalten.
  // '#' muss explizit escaped werden, sonst bricht die URL in manchen Browsern/Hosts.
  return "javascript:" + encodeURI(code).replace(/#/g, "%23");
}

function defaultNameFromFile(file) {
  const base = file.replace(/\.js$/i, "");
  // Optional: bspAuto-Präfix entfernen (legacy-Verhalten)
  return base.replace(/^bspAuto/i, "");
}

// ------------------------ Build-Daten sammeln ------------------------------
ensureDir(DIST_DIR);

const allFiles = listJsFiles(SRC_DIR);
const meta = readMeta();

// Sortierreihenfolge: zuerst meta.order, dann Rest alphabetisch
const orderedFiles = [
  ...meta.order.filter((f) => allFiles.includes(f)),
  ...allFiles.filter((f) => !meta.order.includes(f)),
];

const entries = orderedFiles.map((file) => {
  const full = path.join(SRC_DIR, file);
  const source = fs.readFileSync(full, "utf8");
  const cfg = meta.items[file] || {};
  const name = cfg.name || defaultNameFromFile(file);
  const desc = cfg.desc || "";
  const wrap = typeof cfg.wrap === "boolean" ? cfg.wrap : true; // Default: true
  const href = toBookmarkletURL(source, wrap);
  return { file, name, desc, href, mtime: mtimeISO(full) };
});

// ------------------------ HTML/CSS -----------------------------------------
const CSS = `
:root{
  --bg:#ffffff; --fg:#0f172a; --muted:#64748b; --card:#f8fafc; --border:#e2e8f0;
  --accent:#2563eb; --accent-contrast:#ffffff; --ring:rgba(37,99,235,.18);
  --radius:16px; --maxw:980px;
}
@media (prefers-color-scheme: dark){
  :root{ --bg:#0b0d10; --fg:#e5e7eb; --muted:#9aa3af; --card:#12161b; --border:#1f2937; --accent:#3b82f6; --accent-contrast:#0b0d10; --ring:rgba(59,130,246,.28); }
}
*{box-sizing:border-box}
html,body{height:100%}
body{ margin:0; background:var(--bg); color:var(--fg); font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial; display:grid; place-items:start center; }
.container{ width:100%; max-width:var(--maxw); padding:32px 20px 48px; }
.header{ text-align:center; margin-bottom:22px; }
h1{ margin:0 0 8px; font-size:clamp(22px,4vw,34px); letter-spacing:-.02em; }
.subtitle{ margin:0 auto; max-width:720px; color:var(--muted); }
.meta{ margin-top:8px; font-size:12px; color:var(--muted); }
.grid{ margin-top:26px; display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
.card{ background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:14px; display:flex; flex-direction:column; gap:10px; transition:transform .08s ease,box-shadow .08s ease,border-color .08s ease; }
.card:hover{ transform:translateY(-1px); box-shadow:0 8px 28px var(--ring); border-color:transparent; }
.name{ display:flex; align-items:center; gap:8px; font-weight:700; font-size:15px; }
.badge{ margin-left:auto; font-size:11px; color:var(--muted); padding:2px 8px; border:1px solid var(--border); border-radius:999px; }
.desc{ font-size:13px; color:var(--muted); min-height:.001px; }
.actions{ display:flex; flex-direction:column; gap:10px; }
.btn{ appearance:none; text-decoration:none; cursor:grab; user-select:none; width:100%; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 16px; border-radius:12px; background:var(--accent); color:var(--accent-contrast); border:1px solid transparent; font-weight:700; transition:transform .06s ease,box-shadow .06s ease,opacity .06s ease; }
.btn:hover{ transform:translateY(-1px); box-shadow:0 6px 16px var(--ring); }
.btn:active{ transform:none; cursor:grabbing; }
.hint{ width:100%; display:inline-flex; align-items:center; justify-content:center; gap:6px; border-radius:12px; padding:12px 16px; border:1px dashed var(--border); color:var(--muted); font-weight:600; text-decoration:none; cursor:default; }
.footer{ margin-top:36px; text-align:center; color:var(--muted); font-size:13px; }
.instructions{ margin-top:8px; font-size:13px; color:var(--muted); }
`;

const now = new Date();
const header = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>BSP Auto – Bookmarklets</title>
<style>${CSS}</style>
</head>
<body>
<main class="container">
  <header class="header">
    <h1>BSP Auto – Bookmarklets</h1>
    <p class="subtitle">Ziehe die gewünschten Buttons in die Lesezeichenleiste – oder klicke sie direkt, wenn du die Zielseite bereits offen hast.</p>
    <div class="meta">Letztes Update: ${now.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium" })}</div>
    <div class="instructions">Tipp: Rechtsklick → „Link zu Favoriten hinzufügen“, wenn Drag &amp; Drop nicht funktioniert.</div>
  </header>
  <section class="grid">`;

const footer = `
  </section>
  <footer class="footer">© ${new Date().getFullYear()} BSP Auto – GitHub Pages</footer>
</main>
</body>
</html>`;

const cards = entries.length
  ? entries
      .map((e) => {
        const updated = e.mtime
          ? new Date(e.mtime).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })
          : "n/a";
        const titleAttr = e.desc ? ` title="${escapeHtml(e.desc)}"` : "";
        return `
    <article class="card"${titleAttr}>
      <div class="name">
        <span>${escapeHtml(e.name)}</span>
        <span class="badge">${escapeHtml(updated)}</span>
      </div>
      ${e.desc ? `<p class="desc">${escapeHtml(e.desc)}</p>` : `<p class="desc"></p>`}
      <div class="actions">
        <a class="btn" href="${e.href}" draggable="true">In Lesezeichenleiste ziehen</a>
        <span class="hint">Datei: <strong>${escapeHtml(e.file)}</strong></span>
      </div>
    </article>`;
      })
      .join("\n")
  : `<article class="card">
      <div class="name"><span>Keine Tools gefunden</span></div>
      <p class="desc">Lege .js-Dateien im Ordner <code>src/</code> an. Optional: <code>src/_meta.json</code> für Namen/Beschreibungen/Sortierung.</p>
      <div class="actions"><span class="hint">Beispiel: <strong>fillBookmarklet.js</strong></span></div>
    </article>`;

const html = header + "\n" + cards + "\n" + footer;

ensureDir(DIST_DIR);
fs.writeFileSync(OUT_FILE, html, "utf8");
console.log(`✅ Built ${OUT_FILE} with ${entries.length} bookmarklet(s).`);
