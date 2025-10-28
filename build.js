#!/usr/bin/env node
/**
 * build.js – hübsches Bookmarklet-Listing für GitHub Pages
 * - Liest src/*.js, minifiziert sie sanft und baut javascript:… Bookmarklets
 * - Zeigt eine moderne, light/dark-freundliche UI mit Karten/Buttons
 * - Nutzt optionale Beschreibungen aus Kopf-Kommentaren
 * - Schreibt dist/index.html (keine Abhängigkeiten)
 */

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const DIST_DIR = path.join(__dirname, "dist");
const OUT_FILE = path.join(DIST_DIR, "index.html");

// ------------------------ Utilities ----------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".js"))
    .sort((a, b) => a.localeCompare(b, "en"));
}

// Minimaler “Minifier”: Kommentare/Whitespace reduzieren, ohne Logik zu verändern
function minify(code) {
  return code
    .replace(/\/\/[^\n\r]*/g, "") // Einzeilige Kommentare
    .replace(/\/\*[\s\S]*?\*\//g, "") // Block-Kommentare
    .replace(/\s+/g, " ") // Whitespace reduzieren
    .replace(/\s*([{}();,:])\s*/g, "$1") // Spaces um Tokens
    .trim();
}

function toBookmarkletURL(code) {
  const min = minify(code);
  const wrapped = `(function(){${min}})();`;
  // encodeURI, aber '#' zusätzlich escapen (bricht sonst in URLs)
  return "javascript:" + encodeURI(wrapped).replace(/#/g, "%23");
}

function extractDescription(source) {
  // Nur die ersten Zeilen scannen
  const firstChunk = source.split(/\r?\n/).slice(0, 15).join("\n");

  // @desc / Description
  const m1 = firstChunk.match(/^\s*\/\/\s*@?desc(?:ription)?\s*:\s*(.+)$/im);
  if (m1?.[1]) return m1[1].trim();

  // Blockkommentar
  const m2 = firstChunk.match(/\/\*([\s\S]*?)\*\//m);
  if (m2?.[1]) {
    const line = m2[1]
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\*?\s?/, "").trim())
      .find((l) => l.length);
    if (line) return line;
  }

  // Erste einfache Kommentarzeile
  const m3 = firstChunk.match(/^\s*\/\/\s*(.+)$/m);
  if (m3?.[1]) return m3[1].trim();

  return "";
}

function niceName(file) {
  const base = file.replace(/\.js$/i, "");
  // bspAuto-Präfix entfernen (wie in deiner alten build.js)
  return base.replace(/^bspAuto/i, "");
}

function fileMtimeISO(file) {
  try {
    return new Date(fs.statSync(file).mtime).toISOString();
  } catch {
    return null;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ------------------------ Collect entries ----------------------------------

ensureDir(DIST_DIR);

const files = readFiles(SRC_DIR);

const entries = files.map((fname) => {
  const full = path.join(SRC_DIR, fname);
  const code = fs.readFileSync(full, "utf8");
  return {
    file: fname,
    name: niceName(fname),
    desc: extractDescription(code),
    href: toBookmarkletURL(code),
    mtime: fileMtimeISO(full),
  };
});

// ------------------------ HTML/CSS -----------------------------------------

const CSS = `
:root{
  --bg: #ffffff;
  --fg: #0f172a;
  --muted: #64748b;
  --card: #f8fafc;
  --border: #e2e8f0;
  --accent: #2563eb;
  --accent-contrast: #ffffff;
  --ring: rgba(37,99,235,.18);
  --radius: 16px;
  --maxw: 980px;
}

@media (prefers-color-scheme: dark){
  :root{
    --bg: #0b0d10;
    --fg: #e5e7eb;
    --muted: #9aa3af;
    --card: #12161b;
    --border: #1f2937;
    --accent: #3b82f6;
    --accent-contrast: #0b0d10;
    --ring: rgba(59,130,246,.28);
  }
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  background:var(--bg);
  color:var(--fg);
  font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji";
  display:grid;
  place-items:start center;
}

.container{
  width:100%;
  max-width:var(--maxw);
  padding:32px 20px 48px;
}

.header{ text-align:center; margin-bottom:22px; }
h1{ margin:0 0 8px; font-size:clamp(22px,4vw,34px); letter-spacing:-.02em; }
.subtitle{ margin:0 auto; max-width:720px; color:var(--muted); }
.meta{ margin-top:8px; font-size:12px; color:var(--muted); }

.grid{
  margin-top:26px;
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(240px,1fr));
  gap:14px;
}

.card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:14px;
  display:flex;
  flex-direction:column;
  gap:10px;
  transition:transform .08s ease,box-shadow .08s ease,border-color .08s ease;
}

.card:hover{
  transform:translateY(-1px);
  box-shadow:0 8px 28px var(--ring);
  border-color:transparent;
}

.name{
  display:flex;
  align-items:center;
  gap:8px;
  font-weight:700;
  font-size:15px;
}

.badge{
  margin-left:auto;
  font-size:11px;
  color:var(--muted);
  padding:2px 8px;
  border:1px solid var(--border);
  border-radius:999px;
}

.desc{
  font-size:13px;
  color:var(--muted);
  min-height:.001px;
}

.actions{
  display:flex;
  gap:8px;
}

.btn{
  appearance:none;
  text-decoration:none;
  cursor:grab;            /* für Drag&Drop in die Lesezeichenleiste */
  user-select:none;
  flex:1;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:10px 12px;
  border-radius:12px;
  background:var(--accent);
  color:var(--accent-contrast);
  border:1px solid transparent;
  font-weight:700;
  transition:transform .06s ease,box-shadow .06s ease,opacity .06s ease;
}

.btn:hover{ transform:translateY(-1px); box-shadow:0 6px 16px var(--ring); }
.btn:active{ transform:none; cursor:grabbing; }

.hint{
  flex:1;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  border-radius:12px;
  padding:10px 12px;
  border:1px dashed var(--border);
  color:var(--muted);
  font-weight:600;
  text-decoration:none;
  cursor:default;
}

.footer{ margin-top:36px; text-align:center; color:var(--muted); font-size:13px; }
.instructions{ margin-top:8px; font-size:13px; color:var(--muted); }
`;

const lastBuild = new Date();
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
    <div class="meta">Letztes Update: ${lastBuild.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium" })}</div>
    <div class="instructions">Tipp: Rechtsklick → „Link zu Favoriten hinzufügen“, wenn Drag &amp; Drop nicht funktioniert.</div>
  </header>
  <section class="grid">`;

const footer = `
  </section>
  <footer class="footer">© ${new Date().getFullYear()} BSP Auto – GitHub Pages</footer>
</main>
</body>
</html>`;

// Karten erzeugen (nur Name + optional Beschreibung; JS-Code wird NICHT angezeigt)
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
        <span class="hint">Name: <strong>${escapeHtml(e.name)}</strong></span>
      </div>
    </article>`;
      })
      .join("\n")
  : `<article class="card">
      <div class="name"><span>Keine Tools gefunden</span></div>
      <p class="desc">Lege .js-Dateien im Ordner <code>src/</code> an. Die Seite wird automatisch aktualisiert.</p>
      <div class="actions"><span class="hint">Tipp: Benenne sie z. B. <strong>fillBookmarklet.js</strong></span></div>
    </article>`;

const html = header + "\n" + cards + "\n" + footer;

fs.writeFileSync(OUT_FILE, html, "utf8");
console.log(`✅ Built ${OUT_FILE} with ${entries.length} bookmarklet(s).`);
