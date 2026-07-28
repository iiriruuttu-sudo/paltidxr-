const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'paltidxr-p.onrender.com';

app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));
app.use(express.static(__dirname));

const SCRIPTS_FILE = path.join(__dirname, "scripts.json");

function loadScripts() {
  try {
    if (fs.existsSync(SCRIPTS_FILE)) {
      const data = fs.readFileSync(SCRIPTS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading scripts:", error);
  }
  return {};
}

function saveScripts(scripts) {
  try {
    fs.writeFileSync(SCRIPTS_FILE, JSON.stringify(scripts, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error saving scripts:", error);
    return false;
  }
}

let scriptsDB = loadScripts();

function generateUniqueId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const hits = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 100;

function rateLimiter(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || 
             req.socket.remoteAddress || "?";
  const now = Date.now();
  const r = hits.get(ip);
  
  if (!r || now - r.start > WINDOW) {
    hits.set(ip, { count: 1, start: now });
    return next();
  }
  
  r.count++;
  if (r.count > MAX) {
    const retry = Math.ceil((WINDOW - (now - r.start)) / 1000);
    res.set("Retry-After", String(retry));
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

// CAPA 1: OFUSCACION
function obfuscateScript(code) {
  try {
    let obfuscated = code.replace(/--[^\n]*/g, '');
    
    const keywords = ['local', 'function', 'if', 'then', 'else', 'elseif', 'end', 'for', 'while', 'do', 'return', 'break', 'true', 'false', 'nil', 'and', 'or', 'not', 'in', 'repeat', 'until', 'goto'];
    const varMap = {};
    const varRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    const matches = obfuscated.match(varRegex) || [];
    const uniqueVars = [...new Set(matches)];
    
    uniqueVars.forEach((v) => {
      if (!keywords.includes(v) && v.length > 1) {
        const newName = '_' + crypto.randomBytes(3).toString('hex');
        varMap[v] = newName;
      }
    });
    
    Object.keys(varMap).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      obfuscated = obfuscated.replace(regex, varMap[key]);
    });
    
    obfuscated = obfuscated.replace(/\s+/g, ' ');
    return obfuscated;
  } catch (e) {
    return code;
  }
}

// CAPA 2: XOR ENCRYPTION
function xorEncrypt(data) {
  try {
    const key = crypto.randomBytes(8).toString('hex');
    let result = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return key + '|' + Buffer.from(result).toString('base64');
  } catch (e) {
    return data;
  }
}

// CAPA 3: REVERSO
function reverseString(data) {
  try {
    return data.split('').reverse().join('');
  } catch (e) {
    return data;
  }
}

// CAPA 4: BASE64
function base64Encode(data) {
  try {
    return Buffer.from(data).toString('base64');
  } catch (e) {
    return data;
  }
}

// CAPA 5: ROTACION
function rotateString(data) {
  try {
    let rotated = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i);
      rotated += String.fromCharCode(charCode + 3);
    }
    return rotated;
  } catch (e) {
    return data;
  }
}

// CAPA 6: HEXADECIMAL
function hexEncode(data) {
  try {
    let hex = '';
    for (let i = 0; i < data.length; i++) {
      hex += data.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
  } catch (e) {
    return data;
  }
}

// ============ ENCRIPTACION COMPLETA ============

function encryptComplete(script) {
  try {
    let encrypted = script;
    encrypted = obfuscateScript(encrypted);
    encrypted = xorEncrypt(encrypted);
    encrypted = reverseString(encrypted);
    encrypted = base64Encode(encrypted);
    encrypted = rotateString(encrypted);
    encrypted = hexEncode(encrypted);
    return encrypted;
  } catch (e) {
    return script;
  }
}

// ============ GENERAR DECRYPTOR ============

function generateDecryptor(scriptId, encryptedData) {
  return `
local function h2s(s)
local r=""
for i=1,#s,2 do
r=r..string.char(tonumber(s:sub(i,i+1),16))
end
return r
end
local function r2s(s)
local r=""
for i=1,#s do
r=r..string.char(string.byte(s,i)-3)
end
return r
end
local function b2s(s)
return game:HttpDecode(s,"base64")
end
local function v2s(s)
local r=""
for i=#s,1,-1 do
r=r..s:sub(i,i)
end
return r
end
local function x2s(s,k)
local p={}
for t in s:gmatch("[^|]+") do
table.insert(p,t)
end
local e=b2s(p[2])
local r=""
for i=1,#e do
local c=string.byte(e,i)
local kc=string.byte(k,((i-1)%#k)+1)
r=r..string.char(c~kc)
end
return r
end
local function d(s)
local a=h2s(s)
local b=r2s(a)
local c=b2s(b)
local d=v2s(c)
local p={}
for t in d:gmatch("[^|]+") do
table.insert(p,t)
end
local e=x2s(d,p[1])
return e
end
local s=d("${encryptedData}")
loadstring(s)()
`;
}

function blockBrowsers(req, res, next) {
  if (!req.path.includes('/files/v1/loaders/')) {
    return next();
  }

  const ua = req.headers["user-agent"] || "";
  const uaLower = ua.toLowerCase();

  const isBrowser = 
    uaLower.includes("chrome") ||
    uaLower.includes("firefox") ||
    uaLower.includes("safari") ||
    uaLower.includes("edg") ||
    uaLower.includes("opr") ||
    uaLower.includes("webkit");

  const isExecutor = 
    uaLower.includes("roblox") ||
    uaLower.includes("synapse") ||
    uaLower.includes("krnl") ||
    uaLower.includes("scriptware") ||
    uaLower.includes("jjsploit") ||
    uaLower.includes("protosmasher") ||
    uaLower.includes("fluxus") ||
    uaLower.includes("vega") ||
    uaLower.includes("evon") ||
    uaLower.includes("celery") ||
    uaLower.includes("hydrogen") ||
    uaLower.includes("paltidxr");

  const isUnknown = !ua || ua.length < 5;

  if (isBrowser && !isExecutor && !isUnknown) {
    const loaderCode = `loadstring(game:HttpGet("https://${DOMAIN}/files/v1/loaders/script.lua", true))()`;
    
    return res.status(403).type("html").send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Access Denied</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0b12;font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#e0e0e0;padding:20px}
.glass-card{background:rgba(20,21,31,0.85);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.06);border-radius:24px;padding:40px;max-width:600px;width:100%;text-align:center}
.icon{font-size:72px;margin-bottom:16px}
h1{font-size:24px;font-weight:700;color:#fff;margin-bottom:8px}
.subtitle{color:#888;font-size:14px;margin-bottom:24px}
.badge{display:inline-block;padding:4px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.15);border-radius:20px;font-size:11px;color:#a78bfa}
.code-box{background:rgba(9,10,18,0.9);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px 20px;margin-top:16px;font-family:'Courier New',monospace;font-size:13px;color:#a78bfa;word-break:break-all;text-align:left;white-space:pre-wrap;line-height:1.8;overflow-wrap:break-word}
.btn-copy{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:8px 20px;color:#e0e0e0;font-size:13px;cursor:pointer;transition:all 0.3s ease;margin-top:12px;display:inline-flex;align-items:center;gap:8px}
.btn-copy:hover{background:rgba(255,255,255,0.1);border-color:rgba(139,92,246,0.3)}
.btn-copy.copied{background:rgba(52,211,153,0.15);border-color:rgba(52,211,153,0.3);color:#34d399}
.footer-link{margin-top:20px;font-size:12px;color:#4a4a5a}
.footer-link a{color:#a78bfa;text-decoration:none}
.footer-link a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="glass-card">
<div class="icon">🔒</div>
<h1>Access Denied</h1>
<p class="subtitle">This content is protected</p>
<div class="badge">Protected</div>
<div class="code-box" id="codeDisplay">${loaderCode}</div>
<button class="btn-copy" id="copyBtn" onclick="copyCode()">Copy Code</button>
<div class="footer-link">Protected by PaltidxR<br><a href="https://${DOMAIN}" target="_blank">https://${DOMAIN}</a></div>
</div>
<script>
const codeToCopy = "${loaderCode}";
function copyCode() {
navigator.clipboard.writeText(codeToCopy).then(() => {
const btn = document.getElementById('copyBtn');
btn.classList.add('copied');
btn.innerHTML = 'Copied!';
setTimeout(() => {
btn.classList.remove('copied');
btn.innerHTML = 'Copy Code';
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
btn.innerHTML = 'Copied!';
setTimeout(() => {
btn.classList.remove('copied');
btn.innerHTML = 'Copy Code';
}, 2500);
});
}
</script>
</body>
</html>
    `);
  }

  next();
}

app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

function validateScriptId(req, res, next) {
  const scriptId = req.params.scriptId;
  if (!scriptId || scriptId.length < 3) {
    return res.status(400).json({ error: "Invalid script ID" });
  }
  if (scriptId.includes('..') || scriptId.includes('/') || scriptId.includes('\\')) {
    return res.status(400).json({ error: "Invalid script ID format" });
  }
  next();
}

app.get("/sitemap.xml", (req, res) => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://${DOMAIN}/</loc>
<lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
<changefreq>daily</changefreq>
<priority>1.0</priority>
</url>
</urlset>`;
  res.header('Content-Type', 'application/xml');
  res.send(sitemap);
});

app.get("/robots.txt", (req, res) => {
  const robots = `User-agent: *
Allow: /
Disallow: /files/v1/loaders/
Sitemap: https://${DOMAIN}/sitemap.xml`;
  res.header('Content-Type', 'text/plain');
  res.send(robots);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
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
    
    let scriptId = generateUniqueId();
    while (scriptsDB[scriptId + '.lua']) {
      scriptId = generateUniqueId();
    }
    
    const fileName = `${scriptId}.lua`;
    const userScriptName = name || 'unnamed';
    
    const encrypted = encryptComplete(script);
    
    scriptsDB[fileName] = {
      id: fileName,
      name: userScriptName,
      scriptId: scriptId,
      content: encrypted,
      created: new Date().toISOString(),
      paltidxr: true,
      size: script.length
    };
    
    saveScripts(scriptsDB);
    
    const url = `https://${DOMAIN}/files/v1/loaders/${fileName}`;
    
    res.json({
      success: true,
      url: url,
      scriptId: scriptId,
      name: userScriptName,
      created: new Date().toISOString(),
      paltidxr: true,
      size: script.length,
      message: "Script hosted with 6 layers of encryption"
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error: " + error.message 
    });
  }
});

app.get("/files/v1/loaders/:scriptId", 
  rateLimiter, 
  blockBrowsers, 
  validateScriptId, 
  (req, res) => {
    try {
      const scriptId = req.params.scriptId;
      
      scriptsDB = loadScripts();
      
      if (scriptsDB[scriptId]) {
        const scriptData = scriptsDB[scriptId];
        console.log(`[${new Date().toISOString()}] Script served: ${scriptId} (${scriptData.name}) - Size: ${scriptData.size || 'unknown'}`);
        
        const decryptor = generateDecryptor(scriptId, scriptData.content);
        res.type("text").send(decryptor);
      } else {
        console.log(`[${new Date().toISOString()}] Script not found: ${scriptId}`);
        res.status(404).type("text").send("Script not found");
      }
    } catch (error) {
      console.error('Error serving script:', error);
      res.status(500).type("text").send("Error serving script");
    }
  }
);

app.get("/api/scripts", rateLimiter, (req, res) => {
  try {
    scriptsDB = loadScripts();
    const scriptList = Object.keys(scriptsDB).map(key => ({
      id: scriptsDB[key].id,
      scriptId: scriptsDB[key].scriptId,
      name: scriptsDB[key].name,
      created: scriptsDB[key].created,
      paltidxr: scriptsDB[key].paltidxr || false,
      size: scriptsDB[key].size || 0
    }));
    
    res.json({ 
      scripts: scriptList,
      count: scriptList.length,
      paltidxr: true,
      version: "3.0.0"
    });
  } catch (error) {
    res.status(500).json({ error: "Error loading scripts" });
  }
});

app.get("/health", (req, res) => {
  try {
    scriptsDB = loadScripts();
    const scriptCount = Object.keys(scriptsDB).length;
    
    res.json({ 
      status: "online", 
      service: "PaltidxR API",
      version: "3.0.0",
      scripts: scriptCount,
      paltidxr: true,
      protection: "6 layers",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Health check failed" });
  }
});

if (!fs.existsSync(path.join(__dirname, "scripts"))) {
  fs.mkdirSync(path.join(__dirname, "scripts"));
}

app.listen(PORT, () => {
  console.log(`PaltidxR v3.0 running on port ${PORT}`);
  console.log(`Domain: https://${DOMAIN}`);
  console.log(`API: https://${DOMAIN}/api/scripts`);
  console.log(`URL: https://${DOMAIN}/files/v1/loaders/{id}.lua`);
  console.log(`Protection: 6 layers encryption`);
});
