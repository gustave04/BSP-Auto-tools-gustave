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
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='18' fill='%230b5cff'/%3E%3Ctext x='50' y='62' font-size='54' text-anchor='middle' fill='white' font-family='Inter,ui-sans-serif,system-ui'%3EB%3C/text%3E%3C/svg%3E"/>
  <style>
    /* --- Design Tokens --------------------------------------------------- */
    :root {
      --bg: #ffffff;
      --fg: #0b1220;
      --muted: #6b7280;
      --card: #f8fafc;
      --ring: #2563eb;
      --glow: 0 12px 40px rgba(37, 99, 235, .25);
      --shadow: 0 8px 24px rgba(2, 8, 23, .08);
      --border: 1px solid rgba(2, 8, 23, .08);
      --btn: #0b5cff;
      --btn-fg: #fff;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0b1220;
        --fg: #e5e7eb;
        --muted: #a7b3c5;
        --card: #0f172a;
        --ring: #60a5fa;
        --glow: 0 12px 40px rgba(96, 165, 250, .25);
        --shadow: 0 8px 28px rgba(0, 0, 0, .35);
        --border: 1px solid rgba(255, 255, 255, .08);
        --btn: #3b82f6;
        --btn-fg: #0b1220;
      }
    }
    html[data-theme="light"] { color-scheme: light; }
    html[data-theme="dark"]  { color-scheme: dark; }

    /* Smooth theme transition (respect reduced motion) */
    @media (prefers-reduced-motion: no-preference) {
      html.is-transitioning, html.is-transitioning * {
        transition: background-color .35s ease, color .35s ease, border-color .35s ease, box-shadow .35s ease;
      }
    }

    /* --- Base ------------------------------------------------------------- */
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0; background: var(--bg); color: var(--fg);
      font: 400 clamp(15px, 1.1vw + .6rem, 18px)/1.55 Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Apple Color Emoji, Noto Color Emoji;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
      letter-spacing: .2px;
    }
    a { color: inherit; text-decoration: none; }

    .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 16px 80px; }

    header {
      display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start;
      padding: 8px 0 24px; position: sticky; top: 0; backdrop-filter: saturate(120%) blur(6px);
      background: color-mix(in oklab, var(--bg) 80%, transparent); z-index: 10;
      border-bottom: var(--border);
    }
    .title { font-weight: 800; letter-spacing: .2px; }
    .title .kicker { display:block; font-weight:600; color:var(--muted); font-size: .92rem; }

    .meta { color: var(--muted); font-size: .92rem; display: flex; gap: 12px; align-items: center; }
    .pill { padding: 6px 10px; border-radius: 999px; background: var(--card); border: var(--border); }

    .toolbar { display:flex; gap:8px; align-items:center; }
    .btn-icon {
      display: inline-flex; align-items: center; gap: 8px; border-radius: 12px; border: var(--border);
      padding: 10px 12px; background: var(--card); cursor: pointer; box-shadow: var(--shadow);
    }
    .btn-icon:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }

    /* Grid of cards */
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }

    .card { position: relative; border-radius: 16px; border: var(--border); background: var(--card); box-shadow: var(--shadow);
      padding: 16px; display: grid; gap: 12px; align-content: start; min-height: 132px;
      transition: transform .2s ease, box-shadow .2s ease, outline-color .2s ease;
    }
    .card:hover { transform: translateY(-2px); box-shadow: var(--glow); }
    .card h3 { margin: 0; font-size: 1.05rem; letter-spacing: .2px; display:flex; align-items:center; gap:10px; }

    .card .badges { display:flex; gap:8px; align-items:center; color:var(--muted); font-size:.9rem; }

    .actions { display:flex; gap: 8px; flex-wrap: wrap; }

    .bm {
      display:inline-flex; align-items:center; gap:10px; border-radius: 12px; padding: 10px 14px; font-weight: 650;
      background: var(--btn); color: var(--btn-fg); box-shadow: var(--shadow); border: none; cursor: grab; user-select:none;
    }
    .bm:active { cursor: grabbing; }
    .bm:hover { filter: brightness(1.03); box-shadow: var(--glow); }
    .bm svg { width: 18px; height: 18px; }

    .sec { display:inline-flex; align-items:center; gap:10px; border-radius:12px; padding:10px 12px; background:transparent; border: var(--border); }
    .sec:hover { box-shadow: var(--shadow); }

    .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .92rem; }

    details { border-top: var(--border); padding-top: 10px; }
    details > summary { cursor: pointer; list-style: none; display:inline-flex; align-items:center; gap:8px; }
    details > summary::-webkit-details-marker { display:none; }

    /* Tooltip (attribute-based) */
    [data-tip] { position: relative; }
    [data-tip]:hover::after, [data-tip]:focus-visible::after {
      content: attr(data-tip); position: absolute; left: 50%; transform: translate(-50%, -6px);
      bottom: 100%; background: var(--fg); color: var(--bg); padding: 6px 10px; border-radius: 10px; white-space: nowrap; font-size: .85rem;
      box-shadow: var(--shadow); pointer-events: none;
    }

    /* Footer */
    footer { color: var(--muted); margin-top: 28px; font-size:.92rem; display:flex; justify-content: space-between; flex-wrap:wrap; gap:8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <div class="title" style="font-size: clamp(24px, 1.5vw + 1rem, 36px);">BSP Auto – Bookmarklets<span class="kicker">Drag to your bookmarks bar · or click to run</span></div>
        <div class="meta" aria-live="polite">
          <span class="pill">Last build: ${buildTime.toLocaleDateString('de-DE')}</span>
          <span>Theme: <strong id="themeLabel">auto</strong></span>
        </div>
      </div>
      <div class="toolbar">
        <button id="themeToggle" class="btn-icon" data-tip="Toggle dark / light">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm7.07 2.93a1 1 0 0 1 0 1.41l-1.42 1.42a1 1 0 1 1-1.41-1.42l1.41-1.41a1 1 0 0 1 1.42 0ZM21 13a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2h-2ZM6.34 6.34a1 1 0 0 1 1.41 0l1.42 1.42A1 1 0 0 1 7.76 9.17L6.34 7.76a1 1 0 0 1 0-1.42ZM4 11a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2h2Zm11.24 5.24a1 1 0 1 1 1.41 1.41l-1.41 1.41a1 1 0 1 1-1.42-1.41l1.42-1.41ZM11 18a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0v-2Z"/></svg>
          <span>Theme</span>
        </button>
        <button id="copyAll" class="btn-icon" data-tip="Copy list as Markdown">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>
          <span>Export</span>
        </button>
      </div>
    </header>

    <main class="grid" id="grid">
      ${items.map(item => {
        const { name, description, icon, category } = item.meta;
        const date = new Date(item.mtime).toLocaleDateString('de-DE');
        return `
        <article class="card" data-id="${item.id}">
          <h3><span aria-hidden="true">${icon}</span> ${escapeHtml(name)}</h3>
          <div class="badges">
            <span class="pill">${escapeHtml(category)}</span>
            <span>Last change: ${date}</span>
          </div>
          <div class="actions">
            <a class="bm" draggable="true" href="${item.href}" data-code="${encodeURIComponent(item.href)}" data-tip="Drag to bookmarks bar">
              ${linkSvg()}<span>Drag to bookmarks</span>
            </a>
            <button class="sec copy" data-code-raw="${encodeURIComponent(item.href)}" data-tip="Copy bookmarklet URL">
              ${copySvg()}<span>Copy</span>
            </button>
            <button class="sec run" data-run="${encodeURIComponent(item.href)}" data-tip="Run now (unsafe pages may block)">
              ${playSvg()}<span>Run</span>
            </button>
          </div>
          ${description ? `<details><summary>${infoSvg()}<span>More info</span></summary><p style="margin:.6rem 0 0">${escapeHtml(description)}</p></details>` : ''}
        </article>`;
      }).join('')}
    </main>

    <footer>
      <span>© ${new Date().getFullYear()} BSP Auto · Built on ${buildTime.toLocaleString('de-DE')}</span>
      <span>Tip: If you don\'t see a bookmarks bar, press <span class="code">Ctrl/Cmd+Shift+B</span>.</span>
    </footer>
  </div>

<script>
(function() {
  const doc = document.documentElement;
  const label = document.getElementById('themeLabel');

  function setTheme(mode) {
    // mode: 'light'|'dark'|'auto'
    localStorage.setItem('theme', mode);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const target = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;
    doc.classList.add('is-transitioning');
    requestAnimationFrame(() => {
      doc.setAttribute('data-theme', target);
      label.textContent = mode;
      setTimeout(() => doc.classList.remove('is-transitioning'), 350);
    });
  }

  // Init theme
  const saved = localStorage.getItem('theme') || 'auto';
  setTheme(saved);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = localStorage.getItem('theme') || 'auto';
    const next = current === 'auto' ? 'dark' : current === 'dark' ? 'light' : 'auto';
    setTheme(next);
  });

  // Copy single
  for (const btn of document.querySelectorAll('.copy')) {
    btn.addEventListener('click', async () => {
      const url = decodeURIComponent(btn.getAttribute('data-code-raw'));
      try {
        await navigator.clipboard.writeText(url);
        pulse(btn, 'Copied!');
      } catch (e) {
        fallbackCopy(url) ? pulse(btn, 'Copied!') : pulse(btn, 'Copy failed');
      }
    });
  }

  // Run now
  for (const btn of document.querySelectorAll('.run')) {
    btn.addEventListener('click', () => {
      const url = decodeURIComponent(btn.getAttribute('data-run'));
      location.href = url; // triggers bookmarklet
    });
  }

  // Export list as Markdown
  document.getElementById('copyAll').addEventListener('click', async (e) => {
    const lines = [...document.querySelectorAll('.card')].map(card => {
      const name = card.querySelector('h3').innerText.trim();
      const a = card.querySelector('a.bm');
      const url = a.getAttribute('href');
      return \`- [\${name}](\${url})\`;
    }).join('
');
    try { await navigator.clipboard.writeText(lines); pulse(e.currentTarget, 'Exported!'); }
    catch(err){ fallbackCopy(lines) ? pulse(e.currentTarget, 'Exported!') : pulse(e.currentTarget, 'Copy failed'); }
  });

  // Improve drag data for some browsers
  for (const a of document.querySelectorAll('a.bm')) {
    a.addEventListener('dragstart', (ev) => {
      const url = a.getAttribute('href');
      ev.dataTransfer.setData('text/uri-list', url);
      ev.dataTransfer.setData('text/plain', url);
      ev.dataTransfer.effectAllowed = 'copy';
    });
  }

  function pulse(el, text) {
    const old = el.getAttribute('data-tip');
    el.setAttribute('data-tip', text);
    el.classList.add('pulse');
    setTimeout(() => { el.setAttribute('data-tip', old || ''); el.classList.remove('pulse'); }, 1100);
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { return document.execCommand('copy'); } finally { ta.remove(); }
  }
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html, 'utf8');
console.log(`Built ${items.length} bookmarklet(s) → dist/index.html`);

// ---------- Helpers for template substitutions ----------
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function linkSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.59 13.41a1 1 0 0 1 0-1.41l3-3a3 3 0 0 1 4.24 4.24l-2.12 2.12a3 3 0 1 1-4.24-4.24l.7-.7a1 1 0 1 1 1.41 1.41l-.7.7a1 1 0 1 0 1.41 1.41l2.12-2.12a1 1 0 1 0-1.41-1.41l-3 3a1 1 0 0 1-1.41 0Z"/></svg>`;
}
function copySvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>`;
}
function playSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7L8 5Z"/></svg>`;
}
function infoSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/></svg>`;
}
