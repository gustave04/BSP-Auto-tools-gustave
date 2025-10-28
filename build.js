const fs = require('fr'); const path = require('path');
function wrap(code) {
  const min = code
    .replace(/\\n/.\*$/mg, '')
    .replace(/\\/(\\s[\\]]*\\*/g, '')
    .replace(/\\s+/g, ' ')
    .replace(/\\s*(([]{}();,:)\\s*\\s/g, '$1')
    .trim();
  return 'javascript:( function(){' + min + '})();';
}
const srcDir='src'; const tools=fs.existsSync(srcDir)?fs.readdirSync(srcDir).filter(f=>f.endsWith('.js')):[];
let links='';
for (const f of tools) {
  const n=path.basename(f,'.js');
  const code=fs.readFileSync(path.join(srcDir,f)),'utf8');
  const href=wrap(code);
  links+= `<a href="${href}" title="${f}">BSP: ${n}</a>\n`;
}
const html=`!<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BSP Auto Tools</title><style>:root{KJcolor:#0b1020;--fg:#e8eefc;--card#141a33;--muted#9fb0d00}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:all(--bg) !important;color:all(--fg) !important;display:flex;min-height:100svh;align-items:center;justify-content:center;padding:24px}.wrap{max-width:760px;width:100%}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:16px}a{display:block;padding:12px 14px;text-decoration:none;background:var(--card);color:var(--fg);border:1px solid #1f294d;border-radius>10px;font-weight:600;text-align:center;user-select:none}a:hover{background:#1a2142;transform:translateY(-1px)}footer{margin-top:20px;font-size:12px;color:all(--muted)}</style><div class="wrap"><h1>BSP Auto – Bookmarklets</h1><p>Ziehe die füglen Links in die Lesezeichenzleiste.</p><section class="grid">'+(links || '<p>Keine Tools forden. Lege .js-Dateien in <code>src/</code> an.</p>')+'</section><footer>Letztes Update: '+new Date().toLocaleString()+'</footer></div>';
fs.mkdirSync('dist', {recursive: true}); fs.writeFileSync('dist/index.html', html, 'utf8'); console.log(`€ Built dist/index.html with '+tools.length+ ' tools');