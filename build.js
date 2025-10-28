#!/usr/bin/env node
/**
 * build.js — modern bookmarklet landing page (EN)
 * - Reads src/*.js (files NOT starting with '_') and builds bookmarklets
 * - Source code is kept UNCHANGED (no minify)
 * - Optional src/_meta.json controls display name, bookmark name, description, order, wrap
 * - Outputs dist/index.html with a compact, left-to-right layout and dark-mode toggle
 */

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const DIST_DIR = path.join(__dirname, "dist");
const OUT_FILE = path.join(DIST_DIR, "index.html");

// ------------------------ Helpers -----------------------------------------
function ensureDir(dir){ if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); }
function listJsFiles(dir){ if(!fs.existsSync(dir)) return []; return fs.readdirSync(dir).filter(f=>f.toLowerCase().endsWith(".js")).filter(f=>!f.startsWith("_")) .sort((a,b)=>a.localeCompare(b,"en")); }
function readMeta(){ const p=path.join(SRC_DIR,"_meta.json"); if(!fs.existsSync(p)) return {order:[],items:{}}; try{ const j=JSON.parse(fs.readFileSync(p,"utf8")); return {order:Array.isArray(j.order)?j.order:[], items:j.items&&typeof j.items==='object'?j.items:{}}; }catch(e){ console.warn("⚠️ Could not read src/_meta.json:",e.message); return {order:[],items:{}}; }}
function mtimeISO(file){ try{ return new Date(fs.statSync(file).mtime).toISOString(); }catch{ return null; }}
function escapeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"','&quot;').replaceAll("'","&#039;"); }
function toBookmarkletURL(source, wrap=true){ const code = wrap ? `(function(){
${source}
})();` : source; return "javascript:" + encodeURI(code).replace(/#/g,"%23"); }
function defaultNameFromFile(file){ return file.replace(/\.js$/i,"").replace(/^bspAuto/i,""); }

// ------------------------ Collect -----------------------------------------
ensureDir(DIST_DIR);
const allFiles=listJsFiles(SRC_DIR);
const meta=readMeta();
const ordered=[...meta.order.filter(f=>allFiles.includes(f)), ...allFiles.filter(f=>!meta.order.includes(f))];
const entries=ordered.map(file=>{ const full=path.join(SRC_DIR,file); const source=fs.readFileSync(full,"utf8"); const cfg=meta.items[file]||{}; const name=cfg.name||defaultNameFromFile(file); const bookmarkName=cfg.bookmarkName||name; const desc=cfg.desc||""; const wrap=typeof cfg.wrap==="boolean"?cfg.wrap:true; const href=toBookmarkletURL(source,wrap); return {file,name,bookmarkName,desc,href,mtime:mtimeISO(full)}; });

// ------------------------ HTML/CSS -----------------------------------------
const CSS=`
:root{ --bg:#ffffff; --fg:#0f172a; --muted:#64748b; --card:#f8fafc; --border:#e2e8f0; --accent:#2563eb; --accent-contrast:#ffffff; --ring:rgba(37,99,235,.18); --radius:16px; --maxw:680px; }
@media (prefers-color-scheme: dark){ :root{ --bg:#0b0d10; --fg:#e5e7eb; --muted:#9aa3af; --card:#12161b; --border:#1f2937; --accent:#3b82f6; --accent-contrast:#0b0d10; --ring:rgba(59,130,246,.28);} }
*{box-sizing:border-box}
html,body{height:100%}
body{ margin:0; background:var(--bg); color:var(--fg); font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Helvetica,Arial; display:grid; place-items:start center; }
.container{ width:100%; max-width:var(--maxw); padding:32px 20px 48px; }
.header{ text-align:center; margin-bottom:22px; }
h1{ margin:0 0 8px; font-size:clamp(22px,4vw,34px); letter-spacing:-.02em; }
.subtitle{ margin:0 auto; max-width:720px; color:var(--muted); }
.meta{ margin-top:8px; font-size:12px; color:var(--muted); }
.grid{ margin-top:26px; display:grid; grid-template-columns:1fr; gap:12px; }
.card{ background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:12px 14px; display:grid; grid-template-columns:1fr auto; grid-template-rows:auto auto; grid-template-areas:"left badge" "bottom bottom"; row-gap:8px; column-gap:12px; transition:transform .08s ease,box-shadow .08s ease,border-color .08s ease; }
.card:hover{ transform:translateY(-1px); box-shadow:0 8px 28px var(--ring); border-color:transparent; }
.left{ grid-area:left; display:flex; align-items:center; gap:12px; min-width:0; }
.name{ font-weight:700; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.badge{ grid-area:badge; justify-self:end; font-size:11px; color:var(--muted); padding:2px 8px; border:1px solid var(--border); border-radius:999px; }
.btn{ appearance:none; text-decoration:none; cursor:grab; user-select:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:10px 14px; border-radius:12px; background:var(--accent); color:var(--accent-contrast); border:1px solid transparent; font-weight:700; transition:transform .06s ease,box-shadow .06s ease,opacity .06s ease; white-space:nowrap; }
.btn:hover{ transform:translateY(-1px); box-shadow:0 6px 16px var(--ring); }
.btn:active{ transform:none; cursor:grabbing; }
.bottom{ grid-area:bottom; }
details{ border:1px dashed var(--border); border-radius:12px; }
summary{ list-style:none; cursor:pointer; padding:8px 10px; font-weight:700; color:var(--muted); display:flex; align-items:center; gap:8px; }
summary::-webkit-details-marker{ display:none; }
summary::before{ content:"▸"; display:inline-block; transform:translateY(-1px); }
details[open] summary::before{ content:"▾"; }
.more-content{ padding:8px 10px 10px; font-size:13px; color:var(--muted); border-top:1px dashed var(--border); }
.footer{ margin-top:36px; text-align:center; color:var(--muted); font-size:13px; }
.instructions{ margin-top:8px; font-size:13px; color:var(--muted); }
.theme-toggle{ position:fixed; top:14px; left:14px; width:36px; height:36px; border-radius:999px; border:1px solid var(--border); background:var(--card); color:var(--fg); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 16px var(--ring);} .theme-toggle:hover{ transform:translateY(-1px); }
/* explicit theme overrides */
body[data-theme=dark]{ --bg:#0b0d10; --fg:#e5e7eb; --muted:#9aa3af; --card:#12161b; --border:#1f2937; --accent:#3b82f6; --accent-contrast:#0b0d10; --ring:rgba(59,130,246,.28);} 
body[data-theme=light]{ --bg:#ffffff; --fg:#0f172a; --muted:#64748b; --card:#f8fafc; --border:#e2e8f0; --accent:#2563eb; --accent-contrast:#ffffff; --ring:rgba(37,99,235,.18);} 
`;

const now=new Date();
const header=`<!doctype html>
<html lang="en">
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
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode">🌗</button>
    <h1>BSP Auto – Bookmarklets</h1>
    <p class="subtitle">Drag the buttons to your bookmarks bar — or click to run directly on the target page.</p>
    <div class="meta">Last build: ${now.toLocaleString("en-GB",{dateStyle:"short",timeStyle:"medium"})}</div>
    <div class="instructions">Tip: If drag &amp; drop doesn’t work, right‑click a button and choose “Add link to bookmarks”.</div>
  </header>
  <section class="grid">`;

const footer=`
  </section>
  <footer class="footer">© ${new Date().getFullYear()} BSP Auto – GitHub Pages</footer>
</main>
<script>(function(){var key='theme';var btn=document.getElementById('themeToggle');try{var saved=localStorage.getItem(key);if(saved==='light'||saved==='dark'){document.body.dataset.theme=saved}}catch(e){}if(btn){btn.addEventListener('click',function(){var cur=document.body.dataset.theme||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var next=cur==='dark'?'light':'dark';document.body.dataset.theme=next;try{localStorage.setItem(key,next)}catch(e){}})}})();</script>
<script>(function(){var links=document.querySelectorAll('.btn');links.forEach(function(a){function setName(){a.dataset.originalText=a.textContent;var nm=a.dataset.bmname||a.textContent;a.textContent=nm;a.setAttribute('title','Bookmark name: '+nm);}function restore(){if(a.dataset.originalText){a.textContent=a.dataset.originalText;delete a.dataset.originalText;}}a.addEventListener('dragstart',setName);a.addEventListener('dragend',restore);a.addEventListener('contextmenu',function(){setName();setTimeout(restore,1200);});});})();</script>
</body>
</html>`;

const cards = entries.length ? entries.map(e => {
  const updated = e.mtime ? new Date(e.mtime).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "n/a";
  const details = e.desc ? `
      <details class="bottom">
        <summary>More info</summary>
        <div class="more-content">${escapeHtml(e.desc)}</div>
      </details>` : "";
  return `
    <article class=\"card\">
      <div class=\"left\">
        <a class=\"btn\" href=\"${e.href}\" draggable=\"true\" data-bmname=\"${escapeHtml(e.bookmarkName)}\" title=\"Bookmark name: ${escapeHtml(e.bookmarkName)}\">Drag to bookmarks<\/a>
        <span class=\"name\">${escapeHtml(e.name)}<\/span>
      <\/div>
      <span class=\"badge\">Last change: ${escapeHtml(updated)}<\/span>
      ${details}
    <\/article>`;
}).join("\n") : `<article class=\"card\"><div class=\"left\"><span class=\"name\">No tools found<\/span><\/div><\/article>`;

const html = header + "\n" + cards + "\n" + footer;
ensureDir(DIST_DIR);
fs.writeFileSync(OUT_FILE, html, "utf8");
console.log(`✅ Built ${OUT_FILE} with ${entries.length} bookmarklet(s).`);
