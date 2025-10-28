// build.js (sauber, Node 20 kompatibel)
const fs = require('fs');
const path = require('path');

function toBookmarklet(code) {
  const min = code
    .replace(/\/\/[^\n\r]*/g, '')        // einzeilige Kommentare
    .replace(/\/\*[\s\S]*?\*\//g, '')    // Block-Kommentare
    .replace(/\s+/g, ' ')                // Whitespace reduzieren
    .replace(/\s*([{}();,:])\s*/g, '$1') // Spaces um Tokens
    .trim();
  return `javascript:(function(){${min}})();`;
}

const SRC = path.join(__dirname, 'src');
const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter(f => f.endsWith('.js')) : [];

let links = files.map(f => {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  const href = toBookmarklet(code);
  const name = path.basename(f, '.js');
  return `<a href="${href}" title="${f}">BSP: ${name}</a>`;
}).join('\n');

if (!links) {
  links = '<p>Keine Tools gefunden. Lege .js-Dateien in <code>src/</code> an.</p>';
}

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BSP Auto Tools</title>
<style>
:root{--bg:#0b1020;--fg:#e8eefc;--card:#141a33;--muted:#9fb0d0}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:var(--bg);color:var(--fg);display:flex;min-height:100svh;align-items:center;justify-content:center;padding:24px}
.wrap{max-width:760px;width:100%}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:
