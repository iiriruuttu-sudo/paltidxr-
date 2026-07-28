const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'paltidxr-p.onrender.com';

app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));
app.use(express.static(__dirname));

const SCRIPTS_FILE = "scripts.json";

function loadDB() {
  try {
    if (fs.existsSync(SCRIPTS_FILE)) {
      return JSON.parse(fs.readFileSync(SCRIPTS_FILE, "utf-8"));
    }
  } catch (e) { console.error(e); }
  return {};
}

function saveDB(data) {
  try {
    fs.writeFileSync(SCRIPTS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) { console.error(e); return false; }
}

let db = loadDB();

function genId() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < 10; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

// ============ RATE LIMITER ============
const hits = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 100;

function rateLimiter(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "?";
  const now = Date.now();
  const r = hits.get(ip);
  if (!r || now - r.start > WINDOW) {
    hits.set(ip, { count: 1, start: now });
    return next();
  }
  r.count++;
  if (r.count > MAX) {
    const retry = Math.ceil((WINDOW - (now - r.start)) / 1000);
    return res.status(429).json({ error: "Too many requests", retryAfter: retry });
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of hits) {
    if (now - r.start > WINDOW) hits.delete(ip);
  }
}, 5 * 60 * 1000);

// ============ 6 CAPAS DE PROTECCION ============

function obfuscate(c) {
  try {
    let o = c.replace(/--[^\n]*/g, '');
    const k = ['local','function','if','then','else','elseif','end','for','while','do','return','break','true','false','nil','and','or','not','in','repeat','until','goto'];
    const m = {};
    const v = o.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    const u = [...new Set(v)];
    u.forEach(v => {
      if (!k.includes(v) && v.length > 1) {
        m[v] = '_' + crypto.randomBytes(3).toString('hex');
      }
    });
    Object.keys(m).forEach(key => {
      o = o.replace(new RegExp(`\\b${key}\\b`, 'g'), m[key]);
    });
    return o.replace(/\s+/g, ' ');
  } catch (e) { return c; }
}

function xorEncrypt(d) {
  try {
    const k = crypto.randomBytes(8).toString('hex');
    let r = '';
    for (let i = 0; i < d.length; i++) {
      r += String.fromCharCode(d.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    }
    return k + '|' + Buffer.from(r).toString('base64');
  } catch (e) { return d; }
}

function reverse(d) { try { return d.split('').reverse().join(''); } catch (e) { return d; } }
function base64(d) { try { return Buffer.from(d).toString('base64'); } catch (e) { return d; } }
function rotate(d) { try { let r = ''; for (let i = 0; i < d.length; i++) r += String.fromCharCode(d.charCodeAt(i) + 3); return r; } catch (e) { return d; } }
function hex(d) { try { let h = ''; for (let i = 0; i < d.length; i++) h += d.charCodeAt(i).toString(16).padStart(2, '0'); return h; } catch (e) { return d; } }

function encrypt(s) {
  try {
    let e = s;
    e = obfuscate(e);
    e = xorEncrypt(e);
    e = reverse(e);
    e = base64(e);
    e = rotate(e);
    e = hex(e);
    return e;
  } catch (e) { return s; }
}

function generateDecryptor(encrypted) {
  return 'local function h(s)local r=""for i=1,#s,2 do r=r..string.char(tonumber(s:sub(i,i+1),16))end return r end local function r(s)local r=""for i=1,#s do r=r..string.char(string.byte(s,i)-3)end return r end local function b(s)return game:HttpDecode(s,"base64")end local function v(s)local r=""for i=#s,1,-1 do r=r..s:sub(i,i)end return r end local function x(s,k)local p={}for t in s:gmatch("[^|]+")do table.insert(p,t)end local e=b(p[2])local r=""for i=1,#e do local c=string.byte(e,i)local kc=string.byte(k,((i-1)%#k)+1)r=r..string.char(c~kc)end return r end local function d(s)local a=h(s)local b=r(a)local c=b(b)local d=v(c)local p={}for t in d:gmatch("[^|]+")do table.insert(p,t)end local e=x(d,p[1])return e end local s=d("' + encrypted + '")loadstring(s)()';
}

// ============ BLOQUEAR BROWSERS ============

function blockBrowsers(req, res, next) {
  if (!req.path.includes('/loaders/')) return next();
  const ua = req.headers["user-agent"] || "";
  const uaLower = ua.toLowerCase();
  const isBrowser = uaLower.includes("chrome") || uaLower.includes("firefox") || uaLower.includes("safari") || uaLower.includes("edg") || uaLower.includes("opr") || uaLower.includes("webkit");
  const isExecutor = uaLower.includes("roblox") || uaLower.includes("synapse") || uaLower.includes("krnl") || uaLower.includes("scriptware") || uaLower.includes("jjsploit") || uaLower.includes("fluxus") || uaLower.includes("hydrogen") || uaLower.includes("vega") || uaLower.includes("evon");
  if (isBrowser && !isExecutor) {
    const loaderCode = `loadstring(game:HttpGet("https://${DOMAIN}/files/v1/loaders/script.lua", true))()`;
    return res.status(403).type("html").send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Access Denied - PaltidxR</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0b12;font-family:'Segoe UI',Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#e0e0e0;padding:20px}
.card{background:rgba(20,21,31,0.85);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.06);border-radius:24px;padding:40px;max-width:600px;width:100%;text-align:center}
.icon{font-size:72px;margin-bottom:16px}
h1{font-size:28px;font-weight:700;background:linear-gradient(135deg,#a78bfa,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
.subtitle{color:#888;font-size:14px;margin-bottom:24px}
.badge{display:inline-block;padding:4px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.15);border-radius:20px;font-size:11px;color:#a78bfa;margin-bottom:16px}
.code-box{background:rgba(9,10,18,0.9);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px 20px;font-family:'Courier New',monospace;font-size:13px;color:#a78bfa;word-break:break-all;text-align:left;white-space:pre-wrap;line-height:1.8;overflow-wrap:break-word;cursor:pointer;transition:border-color 0.3s}
.code-box:hover{border-color:rgba(139,92,246,0.3)}
.btn-copy{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:8px 20px;color:#e0e0e0;font-size:13px;cursor:pointer;transition:all 0.3s;margin-top:12px;display:inline-flex;align-items:center;gap:8px}
.btn-copy:hover{background:rgba(255,255,255,0.1);border-color:rgba(139,92,246,0.3)}
.btn-copy.copied{background:rgba(52,211,153,0.15);border-color:rgba(52,211,153,0.3);color:#34d399}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:#4a4a5a}
.footer a{color:#a78bfa;text-decoration:none}
.footer a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="card">
<div class="icon">🔒</div>
<h1>Access Denied</h1>
<p class="subtitle">This script is protected and cannot be accessed through a browser</p>
<div class="badge">🔐 Protected</div>
<div class="code-box" id="codeDisplay">${loaderCode}</div>
<button class="btn-copy" id="copyBtn" onclick="copyCode()">📋 Copy Code</button>
<div class="footer">Protected by <a href="https://${DOMAIN}" target="_blank">PaltidxR</a> v3.0</div>
</div>
<script>
const codeToCopy = "${loaderCode}";
function copyCode() {
navigator.clipboard.writeText(codeToCopy).then(() => {
const btn = document.getElementById('copyBtn');
btn.classList.add('copied');
btn.textContent = '✅ Copied!';
setTimeout(() => {
btn.classList.remove('copied');
btn.textContent = '📋 Copy Code';
}, 2500);
}).catch(() => {
const textarea = document.createElement('textarea');
textarea.value = codeToCopy;
document.body.appendChild(textarea);
textarea.select();
document.execCommand('copy');
document.body.removeChild(textarea);
const btn = document.getElementById('copyBtn');
btn.classList.add('copied');
btn.textContent = '✅ Copied!';
setTimeout(() => {
btn.classList.remove('copied');
btn.textContent = '📋 Copy Code';
}, 2500);
});
}
document.getElementById('codeDisplay').addEventListener('click', copyCode);
</script>
</body>
</html>`);
  }
  next();
}

// ============ MIDDLEWARE ============

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  next();
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

function validateScriptId(req, res, next) {
  const id = req.params.id;
  if (!id || id.length < 3) {
    return res.status(400).json({ error: "Invalid script ID" });
  }
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    return res.status(400).json({ error: "Invalid script ID format" });
  }
  next();
}

// ============ RUTAS ============

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/sitemap.xml", (req, res) => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://${DOMAIN}/</loc>
<lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
<changefreq>daily</changefreq>
<priority>1.0</priority>
</url>
<url>
<loc>https://${DOMAIN}/health</loc>
<lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.5</priority>
</url>
</urlset>`;
  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
});

app.get("/robots.txt", (req, res) => {
  const robots = `User-agent: *
Allow: /
Disallow: /files/v1/loaders/
Disallow: /api/

Sitemap: https://${DOMAIN}/sitemap.xml`;
  res.header('Content-Type', 'text/plain');
  res.send(robots);
});

app.post("/api/scripts", rateLimiter, (req, res) => {
  try {
    const { script, name } = req.body;
    if (!script || script.length < 10) {
      return res.status(400).json({ success: false, error: "Script too short or empty" });
    }
    if (script.length > 5000000) {
      return res.status(400).json({ success: false, error: "Script too large. Maximum 5MB" });
    }
    let id = genId();
    while (db[id + '.lua']) id = genId();
    const fn = id + '.lua';
    const encrypted = encrypt(script);
    db[fn] = {
      id: fn,
      name: name || 'unnamed',
      scriptId: id,
      content: encrypted,
      created: new Date().toISOString(),
      paltidxr: true,
      size: script.length
    };
    saveDB(db);
    res.json({
      success: true,
      url: `https://${DOMAIN}/files/v1/loaders/${fn}`,
      scriptId: id,
      name: name || 'unnamed',
      created: new Date().toISOString(),
      paltidxr: true,
      size: script.length,
      protection: "6 layers",
      message: "Script hosted with 6 layers of encryption"
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/files/v1/loaders/:id", rateLimiter, blockBrowsers, validateScriptId, (req, res) => {
  try {
    const id = req.params.id;
    db = loadDB();
    if (db[id]) {
      console.log(`[${new Date().toISOString()}] Script served: ${id} (${db[id].name})`);
      const decryptor = generateDecryptor(db[id].content);
      res.type("text").send(decryptor);
    } else {
      res.status(404).send("Script not found");
    }
  } catch (e) {
    console.error(e);
    res.status(500).send("Error serving script");
  }
});

app.get("/api/scripts", rateLimiter, (req, res) => {
  try {
    db = loadDB();
    const list = Object.keys(db).map(k => ({
      id: db[k].id,
      scriptId: db[k].scriptId,
      name: db[k].name,
      created: db[k].created,
      paltidxr: db[k].paltidxr || false,
      size: db[k].size || 0
    }));
    res.json({
      scripts: list,
      count: list.length,
      paltidxr: true,
      version: "3.0.0"
    });
  } catch (e) {
    res.status(500).json({ error: "Error loading scripts" });
  }
});

app.get("/health", (req, res) => {
  try {
    db = loadDB();
    res.json({
      status: "online",
      service: "PaltidxR API",
      version: "3.0.0",
      scripts: Object.keys(db).length,
      paltidxr: true,
      protection: "6 layers",
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ status: "error", message: "Health check failed" });
  }
});

// ============ INICIAR SERVIDOR ============

if (!fs.existsSync(__dirname + "/scripts")) {
  fs.mkdirSync(__dirname + "/scripts");
}

app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║   PALTIDXR v3.0 - RUNNING          ║`);
  console.log(`╠═══════════════════════════════════════╣`);
  console.log(`║  Port: ${PORT.toString().padEnd(34)}║`);
  console.log(`║  Domain: https://${DOMAIN}${' '.repeat(34 - DOMAIN.length - 10)}║`);
  console.log(`║  API: /api/scripts                  ║`);
  console.log(`║  Loader: /files/v1/loaders/{id}    ║`);
  console.log(`║  Protection: 6 layers              ║`);
  console.log(`╚═══════════════════════════════════════╝\n`);
});
