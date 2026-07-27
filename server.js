const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'paltidxr-p.onrender.com';

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));
app.use(express.static(__dirname));

const SCRIPTS_FILE = path.join(__dirname, "scripts.json");

// ============ BASE85+ OFUSCACIÓN (SOLO ESTO SE AGREGA) ============
const BASE85_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';

function encodeBase85(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = [];
    let value = 0;
    let count = 0;
    
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        count++;
        
        if (count === 4) {
            for (let j = 4; j >= 0; j--) {
                const remainder = value % 85;
                value = Math.floor(value / 85);
                result.push(BASE85_CHARS[remainder]);
            }
            value = 0;
            count = 0;
        }
    }
    
    if (count > 0) {
        const padding = 4 - count;
        for (let i = 0; i < padding; i++) {
            value = (value << 8) | 0;
        }
        count = 4;
        
        for (let j = 4; j >= 0; j--) {
            const remainder = value % 85;
            value = Math.floor(value / 85);
            result.push(BASE85_CHARS[remainder]);
        }
    }
    
    return result.join('');
}

function obfuscateScript(scriptContent) {
    try {
        // 1. Comprimir
        const compressed = zlib.deflateSync(scriptContent);
        
        // 2. Codificar a Base85
        const base85 = encodeBase85(compressed);
        
        // 3. Ofuscar con números y letras aleatorias
        let obfuscated = '';
        for (let i = 0; i < base85.length; i++) {
            const char = base85[i];
            if (i % 2 === 0 && i > 0) {
                obfuscated += Math.floor(Math.random() * 10);
            }
            if (i % 3 === 0 && i > 2) {
                const randomChar = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
                obfuscated += randomChar;
            }
            obfuscated += char;
            if (i % 5 === 0) {
                obfuscated += Math.floor(Math.random() * 10);
            }
        }
        
        // 4. Generar loader ofuscado
        const loader = `--[[ PaltidxR Protected ]]--
--[[ Script ID: ${scriptId} ]]--

local B85 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_\`{|}~"

local function decode85(str)
    local bytes = {}
    local value = 0
    local count = 0
    for i = 1, #str do
        local char = str:sub(i, i)
        local idx = B85:find(char, 1, true)
        if idx then
            value = value * 85 + (idx - 1)
            count = count + 1
            if count == 5 then
                for j = 3, 0, -1 do
                    bytes[#bytes + 1] = bit32.band(bit32.rshift(value, 8 * j), 0xFF)
                end
                value = 0
                count = 0
            end
        end
    end
    return bytes
end

local function cleanData(str)
    local cleaned = ""
    for i = 1, #str do
        local char = str:sub(i, i)
        if B85:find(char, 1, true) then
            cleaned = cleaned .. char
        end
    end
    return cleaned
end

local function bytesToString(bytes)
    local result = ""
    for i = 1, #bytes do
        result = result .. string.char(bytes[i])
    end
    return result
end

local encoded = "${obfuscated}"
local cleaned = cleanData(encoded)
local bytes = decode85(cleaned)
local scriptStr = bytesToString(bytes)

local success, err = pcall(function()
    local func = loadstring(scriptStr)
    if func then
        func()
    else
        error("Error al cargar el script")
    end
end)

if not success then
    warn("Error: " .. tostring(err))
end`;

        return {
            obfuscatedData: obfuscated,
            loaderCode: loader,
            originalSize: scriptContent.length
        };
    } catch (error) {
        console.error('Error obfuscateScript:', error);
        return null;
    }
}

// ============ FIN DE LA OFUSCACIÓN ============

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
    uaLower.includes("trident") ||
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
    uaLower.includes("swift") ||
    uaLower.includes("sirius") ||
    uaLower.includes("paltidxr") ||
    uaLower.includes("electron") ||
    uaLower.includes("wearedevs") ||
    uaLower.includes("luarmor");

  const isUnknown = !ua || ua.length < 5;

  if (isBrowser && !isExecutor && !isUnknown) {
    const loaderCode = `loadstring(game:HttpGet("https://${DOMAIN}/files/v1/loaders/script.lua", true))()`;
    
    return res.status(403).type("html").send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Access Denied - PaltidxR</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0b12;
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e0e0e0;
            padding: 20px;
        }
        .glass-card {
            background: rgba(20, 21, 31, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 24px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            text-align: center;
        }
        .icon { font-size: 72px; margin-bottom: 16px; }
        h1 { font-size: 24px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
        .subtitle { color: #888; font-size: 14px; margin-bottom: 24px; }
        .badge {
            display: inline-block;
            margin-top: 12px;
            padding: 4px 16px;
            background: rgba(139, 92, 246, 0.1);
            border: 1px solid rgba(139, 92, 246, 0.15);
            border-radius: 20px;
            font-size: 11px;
            color: #a78bfa;
        }
        .code-box {
            background: rgba(9, 10, 18, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 16px 20px;
            margin-top: 16px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #a78bfa;
            word-break: break-all;
            text-align: left;
            white-space: pre-wrap;
            line-height: 1.8;
            overflow-wrap: break-word;
        }
        .btn-copy {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 8px 20px;
            color: #e0e0e0;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 12px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .btn-copy:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(139, 92, 246, 0.3);
        }
        .btn-copy.copied {
            background: rgba(52, 211, 153, 0.15);
            border-color: rgba(52, 211, 153, 0.3);
            color: #34d399;
        }
        .footer-link {
            margin-top: 20px;
            font-size: 12px;
            color: #4a4a5a;
        }
        .footer-link a {
            color: #a78bfa;
            text-decoration: none;
        }
        .footer-link a:hover { text-decoration: underline; }
        .toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgba(20, 21, 31, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(52, 211, 153, 0.3);
            border-radius: 12px;
            padding: 12px 24px;
            color: #e0e0e0;
            font-size: 14px;
            z-index: 1000;
            opacity: 0;
            transition: all 0.5s ease;
        }
        .toast.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    </style>
</head>
<body>
    <div class="glass-card">
        <div class="icon">🔒</div>
        <h1>You Are Blocked</h1>
        <p class="subtitle">Your browser has been detected and access is restricted.</p>
        <div class="badge">Browser Detected</div>

        <div class="code-box" id="codeDisplay">${loaderCode}</div>

        <button class="btn-copy" id="copyBtn" onclick="copyCode()">
            <i class="fa-regular fa-copy"></i>
            Copy Code
        </button>

        <div class="footer-link">
            This code has been protected by API hosting protection.<br>
            If you want to protect your code too, go to<br>
            <a href="https://${DOMAIN}" target="_blank">https://${DOMAIN}</a>
        </div>
    </div>

    <div id="toast" class="toast">
        <i class="fa-regular fa-circle-check mr-2" style="color:#34d399;"></i>
        <span id="toastMessage">Copied to clipboard!</span>
    </div>

    <script>
        const codeToCopy = "${loaderCode}";

        function copyCode() {
            navigator.clipboard.writeText(codeToCopy).then(() => {
                const btn = document.getElementById('copyBtn');
                btn.classList.add('copied');
                btn.innerHTML = '<i class="fa-regular fa-check"></i> Copied!';
                showToast('Code copied to clipboard!');
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Code';
                }, 2500);
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = codeToCopy;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('Code copied to clipboard!');
            });
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            const msg = document.getElementById('toastMessage');
            msg.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
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
    
    if (script.length > 1000000) {
      return res.status(400).json({ success: false, error: "Script too large. Maximum 1MB" });
    }
    
    let scriptId = generateUniqueId();
    while (scriptsDB[scriptId + '.lua']) {
      scriptId = generateUniqueId();
    }
    
    const fileName = `${scriptId}.lua`;
    const userScriptName = name || 'unnamed';
    
    // ============ OFUSCAR CON BASE85+ ============
    const obfuscated = obfuscateScript(script);
    
    if (!obfuscated) {
      return res.status(500).json({ success: false, error: "Error al ofuscar el script" });
    }
    
    // Reemplazar el scriptId en el loader
    const loaderCode = obfuscated.loaderCode.replace(/\$\{scriptId\}/g, scriptId);
    
    scriptsDB[fileName] = {
      id: fileName,
      name: userScriptName,
      scriptId: scriptId,
      content: loaderCode,
      created: new Date().toISOString(),
      paltidxr: true,
      obfuscated: true,
      base85: true
    };
    // ============ FIN OFUSCACIÓN ============
    
    saveScripts(scriptsDB);
    
    const url = `https://${DOMAIN}/files/v1/loaders/${fileName}`;
    
    res.json({
      success: true,
      url: url,
      scriptId: scriptId,
      name: userScriptName,
      created: new Date().toISOString(),
      paltidxr: true,
      obfuscated: true,
      message: "Script hosted successfully with Base85+ obfuscation"
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.get("/files/v1/loaders/:scriptId", 
  rateLimiter, 
  blockBrowsers, 
  validateScriptId, 
  (req, res) => {
    const scriptId = req.params.scriptId;
    
    scriptsDB = loadScripts();
    
    if (scriptsDB[scriptId]) {
      const scriptData = scriptsDB[scriptId];
      console.log(`[${new Date().toISOString()}] Script served: ${scriptId} (${scriptData.name})`);
      res.type("text").send(scriptData.content);
    } else {
      console.log(`[${new Date().toISOString()}] Script not found: ${scriptId}`);
      res.status(404).type("text").send("Script not found");
    }
  }
);

app.get("/api/scripts", rateLimiter, (req, res) => {
  scriptsDB = loadScripts();
  const scriptList = Object.keys(scriptsDB).map(key => ({
    id: scriptsDB[key].id,
    scriptId: scriptsDB[key].scriptId,
    name: scriptsDB[key].name,
    created: scriptsDB[key].created,
    paltidxr: scriptsDB[key].paltidxr || false,
    obfuscated: scriptsDB[key].obfuscated || false
  }));
  
  res.json({ 
    scripts: scriptList,
    count: scriptList.length,
    paltidxr: true
  });
});

app.get("/health", (req, res) => {
  scriptsDB = loadScripts();
  const scriptCount = Object.keys(scriptsDB).length;
  
  res.json({ 
    status: "online", 
    service: "PaltidxR API",
    version: "3.0.0",
    scripts: scriptCount,
    paltidxr: true,
    uniqueIds: true,
    base85: true,
    timestamp: new Date().toISOString()
  });
});

if (!fs.existsSync(path.join(__dirname, "scripts"))) {
  fs.mkdirSync(path.join(__dirname, "scripts"));
}

app.listen(PORT, () => {
  console.log(`PaltidxR running on port ${PORT}`);
  console.log(`Domain: https://${DOMAIN}`);
  console.log(`API: https://${DOMAIN}/api/scripts`);
  console.log(`URL: https://${DOMAIN}/files/v1/loaders/{id}.lua`);
  console.log(`Base85+ Obfuscation: ACTIVATED`);
});
