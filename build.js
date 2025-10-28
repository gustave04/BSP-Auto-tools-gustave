#!/usr/bin/env node
/**
 * build.js
 * Liest alle src/*.js, baut Bookmarklets und schreibt eine hübsche dist/index.html
 * Keine externen Abhängigkeiten.
 */

const fs = require("fs");
const path = require("path");

// --- Helpers ---------------------------------------------------------------

const SRC_DIR = path.join(process.cwd(), "src");
const DIST_DIR = path.join(process.cwd(), "dist");
const OUT_FILE = path.join(DIST_DIR, "index.html");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fileMtimeISO(file) {
  try {
    const stat = fs.statSync(file);
    return new Date(stat.mtime).toISOString();
  } catch {
    return null;
  }
}

/**
 * Versuch, aus dem Datei-Header eine Beschreibung zu lesen.
 * Unterstützt:
 *   // @desc: ...        oder  // Description: ...
 *   /* ... *\/  (erste nicht-leere Zeile aus Block-Kommentar)
 */
function extractDescription(source) {
  const firstLines = source.split(/\r?\n/).slice(0, 15).join("\n");

  // 1) @desc / Description
  const m1 = firstLines.match(/^\s*\/\/\s*@?desc(?:ription)?\s*:\s*(.+)$/im);
  if (m1 && m1[1]) return m1[1].trim();

  // 2) erster Blockkommentar
  const m2 = firstLines.match(/\/\*([\s\S]*?)\*\//m);
  if (m2 && m2[1]) {
    const lines = m2[1]
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\*?\s?/, "").trim())
      .filter(Boolean);
    if (lines.length) return lines[0];
  }

  // 3) erste einfache Kommentarzeile
  const m3 = firstLines.match(/^\s*\/\/\s*(.+)$/m);
  if (m3 && m3[1]) return m3[1].trim();

  return "";
}

/**
 * Baut die Bookmarklet-URL. Wir kapseln in ein IIFE und encodieren sicher.
 * (Keine aggressive "Minification", um keine Logik zu brechen.)
 */
function toBookmarkletURL(source) {
  const wrapped = `(function(){\n${source}\n})();`;
  // encodeURI statt encodeURIComponent, damit z. B. (), : usw. lesbarer bleiben
  // und dennoch Leerzeichen/Zeilenumbrüche korrekt escaped werden.
  return "javascript:" + encodeURI(wrapped).replace(/#/g, "%23");
}

function titleFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, "");
  // z.B. "bspAutoFillBookmarklet" -> "bspAutoFillBookmarklet"
  return base;
}

// --- Build: Daten sammeln --------------------------------------------------

ensureDir(DIST_DIR);

const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => f.toLowerCase().endsWith(".js"))
  .sort((a, b) => a.localeCompare(b, "en"));

const entries = files.map((file) => {
  const full = path.join(SRC_DIR, file);
  const code = fs.readFileSync(full, "utf8");
  return {
    file,
    name: titleFromFilename(file),
    desc: extractDescription(code),
    href: toBookmarkletURL(code),
    mtimeISO: fileMtimeISO(full),
  };
});

// --- HTML / CSS / UI -------------------------------------------------------

const lastBuild = new Date().toISOString();

const CSS = `
:root{
  --bg: #ffffff;
  --fg: #111111;
  --muted: #6b7280;
  --card: #f8f9fb;
  --accent: #2563eb;
  --accent-contrast: #ffffff;
  --ring: rgba(37, 99, 235, 0.25);
  --border: #e5e7eb;
  --maxw: 980px;
  --radius: 16px;
}

@media (prefers-color-scheme: dark){
  :root{
    --bg: #0b0d10;
    --fg: #e5e7eb;
    --muted: #9aa3af;
    --card: #12161b;
    --accent: #3b82f6;
    --accent-contrast: #0b0d10;
    --ring: rgba(59, 130, 246, 0.35);
    --border: #1f2937;
  }
}

* { box-sizing: border-box; }
html, body { height: 100%; }
body{
  margin:0;
  font: 16px/1.55 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
  background: var(--bg);
  color: var(--fg);
  display: grid;
  place-items: start center;
}

.container{
  width: 100%;
  max-width: var(--maxw);
  padding: 32px 20px 48px;
}

.header{
  text-align: center;
  margin-bottom: 24px;
}

h1{
  font-size: clamp(22px, 4vw, 34px);
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.subtitle{
  margin: 0 auto;
  max-width: 720px;
  color: var(--muted);
}

.meta{
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
}

.grid{
  margin-top: 28px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.card{
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform .08s ease, box-shadow .08s ease, border-color .08s ease;
}

.card:hover{
  transform: translateY(-1px);
  box-shadow: 0 6px 24px var(--ring);
  border-color: transparent;
}

.card .name{
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.badge{
  font-size: 11px;
  color: var(--muted);
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
}

.actions{
  display: flex;
  gap: 8px;
}

.btn{
  appearance: none;
  text-decoration: none;
  cursor: grab; /* fürs Draggen in die Lesezeichenleiste */
  user-select: none;
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--accent);
  color: var(--accent-contrast);
  border: 1px solid transparent;
  font-weight: 600;
  transition: transform .06s ease, box-shadow .06s ease, background .06s ease, opacity .06s ease;
  will-change: transform;
}

.btn:hover{ transform: translateY(-1px); box-shadow: 0 6px 16px var(--ring); }
.btn:active{ transform: translateY(0); cursor: grabbing; }

.tooltip{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  padding: 10px 12px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--muted);
  font-weight: 600;
  text-decoration: none;
  flex: 1;
  cursor: default;
}

.desc{
  font-size: 13px;
  color: var(--muted);
  min-height: 0.001px; /* vermeidet Layout-Jumps */
}

.footer{
  margin-top: 36px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.instructions{
  margin-top: 10px;
  font-size: 13px;
  color: var(--muted);
}
`;

const HTML_HEAD = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>BSP Auto – Bookmarklets</title>
<meta name="color-scheme" content="light dark" />
<style>${CSS}</style>
</head>
<body>
<main class="container">
  <header class="header">
    <h1>BSP Auto – Bookmarklets</h1>
    <p class="subtitle">Ziehe die gewünschten Buttons in die Lesezeichenleiste – oder klicke sie direkt, wenn du die Seite passend geöffnet hast.</p>
    <div class="meta">Letzter Build: ${new Date(lastBuild).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium" })}</div>
    <div class="instructions">Tipp: Rechtsklick → „Link zu Favoriten hinzufügen“, wenn Drag &amp; Drop nicht geht.</div>
  </header>
  <section class="grid">
`;

const HTML_FOOT = `
  </section>
  <footer class="footer">
    © ${new Date().getFullYear()} BSP Auto – GitHub Pages
  </footer>
</main>
</body>
</html>`;

// Karten rendern (ohne den JS-Code anzuzeigen)
const gridItems = entries
  .map((e) => {
    const updated =
      e.mtimeISO
        ? new Date(e.mtimeISO).toLocaleString("de-DE", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "n/a";

    // Wenn e.desc existiert: Tooltip im title + sichtbarer Text unterhalb
    const titleAttr = e.desc ? ` title="${escapeHtml(e.desc)}"` : "";

    return `
    <article class="card"${titleAttr}>
      <div class="name">
        <span>${escapeHtml(e.name)}</span>
        <span class="badge">${escapeHtml(updated)}</span>
      </div>
      ${e.desc ? `<p class="desc">${escapeHtml(e.desc)}</p>` : `<p class="desc"></p>`}
      <div class="actions">
        <a class="btn" href="${e.href}" draggable="true">Zu Lesezeichenleiste ziehen</a>
        <span class="tooltip">Name: <strong>${escapeHtml(e.name)}</strong></span>
      </div>
    </article>`;
  })
  .join("\n");

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const html = HTML_HEAD + gridItems + HTML_FOOT;

fs.writeFileSync(OUT_FILE, html, "utf8");

console.log(`✔ Built ${OUT_FILE} with ${entries.length} bookmarklet(s). Last build: ${lastBuild}`);
