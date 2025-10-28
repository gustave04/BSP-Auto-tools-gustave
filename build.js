/**
 * build.js — Generates a modern, responsive GitHub Pages site for BSP Auto bookmarklets
 * No external deps. Just `node build.js` (works in GitHub Actions).
 *
 * Features:
 * - Reads /src/*.js bookmarklets and extracts optional metadata from header comments
 *   //@name, //@description, //@icon (emoji or short text), //@category
 * - Wraps code as a bookmarklet, does a tiny minify (strips comments/whitespace)
 * - Outputs dist/index.html with modern UI, dark/light theme + smooth transitions
 * - Accessible focus states, tooltip system, hover glow, copy-to-clipboard
 * - Drag-to-bookmarks button (native anchor) + click-to-run behavior supported
 * - Last build time shown; per-bookmarklet last changed (git or file mtime)
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');

// Ensure dist exists and is clean-ish
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR);

/** Utility: basic JS comment stripper & compactor (very conservative) */
function mini(js) {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, '') // line comments
    .replace(/\n+/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Utility: ensure code is wrapped as an IIFE bookmarklet */
function toBookmarklet(js) {
  const trimmed = js.trim();
  const body = trimmed.startsWith('javascript:') ? trimmed.slice('javascript:'.length) : trimmed;
  const wrapped = /\(function|\(\)=>|^\(.*\)\s*=>/.test(body) || body.startsWith('(()=>') ? body : `(()=>{${body}})()`;
  return 'javascript:' + encodeURI(wrapped);
}

/** Extract metadata from header comments */
function parseMeta(content, filename) {
  const get = (tag, fallback='') => {
    const m = content.match(new RegExp(`^\s*\/\/\s*@${tag}:(.*)$`, 'mi'));
    return m ? m[1].trim() : fallback;
  };
  const name = get('name', path.basename(filename, '.js'));
  const description = get('description', '');
  const icon = get('icon', '🟦');
  const category = get('category', 'General');
  return { name, description, icon, category };
}

/** Read all src files */
function readBookmarklets() {
  if (!fs.existsSync(SRC_DIR)) return [];
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js'));
  return files.map(file => {
    const full = path.join(SRC_DIR, file);
    const raw = fs.readFileSync(full, 'utf8');
    const meta = parseMeta(raw, file);
    const mt = fs.statSync(full).mtime;
    const code = mini(raw);
    const href = toBookmarklet(code);
    return { id: path.basename(file, '.js'), file, href, code, meta, mtime: mt };
  }).sort((a, b) => a.meta.name.localeCompare(b.meta.name));
}

const items = readBookmarklets();
const buildTime = new Date();

/** HTML Template */
const html = `<!doctype html>
<html lang="en" data-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BSP Auto – Bookmarklets</title>
  <meta name="description" content="Drag buttons to your bookmarks bar or click to run. Copy-ready bookmarklets for BSP Auto workflows.">
  <link rel="icon" href="data:image/svg
