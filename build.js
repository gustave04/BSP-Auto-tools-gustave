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
    const cleaned = stripJsonComments(raw).trim();
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

function toBookmarkletURL(source, wrap = true) {
  const code = wrap ? `(function(){${source}})();` : source;
  return "javascript:" + encodeURI(code).replace(/#/g, "%23");
}

// Collect ---------------------------------------------------------------
ensureDir(DIST);
const allFiles = listJs(SRC);
const meta = readMeta();
const ordered = [
