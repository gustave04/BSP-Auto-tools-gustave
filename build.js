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
  return `<a href="${href}" title="${f}">🔗 ${name.replace(/^bspAuto/i, '')}</a>`;

}).join('\n');

if (!links) {
  links = '<p>Keine Tools gefunden. Lege .js-Dateien in <code>src/</code> an.</p>';
}

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BSP Auto Tools</title>
<style>
:root {
  --bg: #0b1020;
  --fg: #e8eefc;
  --card: #141a33;
  --muted: #9fb0d0;
  --accent: #1e40ff;
}

body {
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.wrap {
  max-width: 760px;
  width: 100%;
  text-align: center;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

a {
  display: block;
  padding: 14px 16px;
  text-decoration: none;
  background: var(--card);
  color: var(--fg);
  border-radius: 12px;
  border: 1px solid #1f294d;
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s ease;
}

a:hover {
  background: #1a2142;
  transform: translateY(-2px);
  box-shadow: 0 3px 10px rgba(0,0,0,0.25);
}

footer {
  margin-top: 24px;
  font-size: 13px;
  color: var(--muted);
}
</style>

<div class="wrap">
  <h1>BSP Auto – Bookmarklets</h1>
  <p>Ziehe die gewünschten Links in die Lesezeichenleiste.</p>
  <section class="grid">
    ${links}
  </section>
  <footer>Letztes Update: ${new Date().toLocaleString()}</footer>
</div>`;

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html, 'utf8');
console.log(`✅ Built dist/index.html with ${files.length} tools`);
