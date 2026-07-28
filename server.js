const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'paltidxr-p.onrender.com';

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));
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

// ============ 8 CAPAS DE ENCRIPTACION ============

function layer1_obfuscate(code) {
  let obfuscated = code;
  obfuscated = obfuscated.replace(/--[^\n]*/g, '');
  
  const keywords = ['local', 'function', 'if', 'then', 'else', 'elseif', 'end', 'for', 'while', 'do', 'return', 'break', 'true', 'false', 'nil', 'and', 'or', 'not', 'in', 'repeat', 'until', 'goto'];
  const varMap = {};
  const varRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  const matches = obfuscated.match(varRegex) || [];
  const uniqueVars = [...new Set(matches)];
  
  uniqueVars.forEach((v, i) => {
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
}

function layer2_xor(data) {
  const key = crypto.randomBytes(8).toString('hex');
  let result = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode ^ keyChar);
  }
  return key + '|' + Buffer.from(result).toString('base64');
}

function layer3_reverse(data) {
  return data.split('').reverse().join('');
}

function layer4_base64(data) {
  return Buffer.from(data).toString('base64');
}

function layer5_aes(data) {
  const key = crypto.randomBytes(16).toString('hex');
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'hex'), Buffer.from(key.substring(0, 16), 'hex'));
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return key + ':' + encrypted;
}

function layer6_rotate(data) {
  let rotated = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    rotated += String.fromCharCode(charCode + 3);
  }
  return rotated;
}

function layer7_binary(data) {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += data.charCodeAt(i).toString(2).padStart(8, '0');
  }
  return binary;
}

function layer8_hex(data) {
  let hex = '';
  for (let i = 0; i < data.length; i++) {
    hex += data.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

// ============ SISTEMAS DE PROTECCION ============

// Sistema 1: Anti-Sintaxis
function antiSyntaxProtection(code) {
  let protectedCode = code;
  protectedCode = protectedCode.replace(/["']/g, '');
  protectedCode = protectedCode.replace(/;/g, '');
  protectedCode = protectedCode.replace(/\(/g, ' [ ');
  protectedCode = protectedCode.replace(/\)/g, ' ] ');
  protectedCode = protectedCode.replace(/\{/g, ' << ');
  protectedCode = protectedCode.replace(/\}/g, ' >> ');
  protectedCode = protectedCode.replace(/\[/g, ' { ');
  protectedCode = protectedCode.replace(/\]/g, ' } ');
  protectedCode = protectedCode.replace(/\./g, ' :: ');
  protectedCode = protectedCode.replace(/,/g, ' , ');
  protectedCode = protectedCode.replace(/=/g, ' == ');
  protectedCode = protectedCode.replace(/\+/g, ' ++ ');
  protectedCode = protectedCode.replace(/-/g, ' -- ');
  protectedCode = protectedCode.replace(/\*/g, ' ** ');
  protectedCode = protectedCode.replace(/\//g, ' // ');
  return protectedCode;
}

// Sistema 2: Anti-HttpGet Detection
function antiHttpGetProtection(code) {
  let protectedCode = code;
  const replacements = {
    'game:HttpGet': 'game:GetAsync',
    'HttpGet': 'HttpRequest',
    'loadstring': 'load',
    'pcall': 'xpcall',
    'spawn': 'delay',
    'wait': 'task.wait',
    'game': 'getfenv()',
    'print': 'warn',
    'error': 'assert'
  };
  
  Object.keys(replacements).forEach(key => {
    const regex = new RegExp(key, 'g');
    protectedCode = protectedCode.replace(regex, replacements[key]);
  });
  
  return protectedCode;
}

// Sistema 3: Ordenamiento y regeneración
function regenerateAndOrder(code) {
  let lines = code.split('\n');
  lines = lines.filter(line => line.trim() !== '');
  
  // Reordenar aleatoriamente
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }
  
  // Agregar código regenerador
  const regenerator = `
local function regenerate()
  local __a = ${Math.random() * 1000}
  local __b = ${Math.random() * 1000}
  local __c = ${Math.random() * 1000}
  return __a + __b + __c
end
regenerate()
`;
  
  lines.push(regenerator);
  return lines.join('\n');
}

// ============ ENCRIPTACION COMPLETA ============

function encryptComplete(script) {
  let encrypted = script;
  
  // Sistema 1: Anti-Sintaxis
  encrypted = antiSyntaxProtection(encrypted);
  
  // Sistema 2: Anti-HttpGet
  encrypted = antiHttpGetProtection(encrypted);
  
  // Sistema 3: Regenerar y ordenar
  encrypted = regenerateAndOrder(encrypted);
  
  // Capa 1: Ofuscacion
  encrypted = layer1_obfuscate(encrypted);
  
  // Capa 2: XOR
  encrypted = layer2_xor(encrypted);
  
  // Capa 3: Reverso
  encrypted = layer3_reverse(encrypted);
  
  // Capa 4: Base64
  encrypted = layer4_base64(encrypted);
  
  // Capa 5: AES
  encrypted = layer5_aes(encrypted);
  
  // Capa 6: Rotacion
  encrypted = layer6_rotate(encrypted);
  
  // Capa 7: Binario
  encrypted = layer7_binary(encrypted);
  
  // Capa 8: Hexadecimal
  encrypted = layer8_hex(encrypted);
  
  return encrypted;
}

// ============ DECRYPTOR COMPLETO ============

function generateDecryptor(scriptId, encryptedData) {
  return `
-- PaltidxR Decryptor v3.0
local function layer8_hex_decrypt(data)
  local result = ""
  for i = 1, #data, 2 do
    result = result .. string.char(tonumber(data:sub(i, i+1), 16))
  end
  return result
end

local function layer7_binary_decrypt(data)
  local result = ""
  for i = 1, #data, 8 do
    local byte = data:sub(i, i+7)
    result = result .. string.char(tonumber(byte, 2))
  end
  return result
end

local function layer6_rotate_decrypt(data)
  local result = ""
  for i = 1, #data do
    result = result .. string.char(string.byte(data, i) - 3)
  end
  return result
end

local function layer5_aes_decrypt(data, key)
  local cipher = require("crypto").createDecipheriv("aes-128-cbc", key, key:sub(1, 16))
  local decrypted = cipher:update(data, "base64", "utf8")
  decrypted = decrypted .. cipher:final("utf8")
  return decrypted
end

local function layer4_base64_decrypt(data)
  return game:HttpDecode(data, "base64")
end

local function layer3_reverse_decrypt(data)
  local result = ""
  for i = #data, 1, -1 do
    result = result .. data:sub(i, i)
  end
  return result
end

local function layer2_xor_decrypt(data, key)
  local parts = {}
  for part in data:gmatch("[^|]+") do
    table.insert(parts, part)
  end
  local encrypted = game:HttpDecode(parts[2], "base64")
  local result = ""
  for i = 1, #encrypted do
    local charCode = string.byte(encrypted, i)
    local keyChar = string.byte(key, ((i-1) % #key) + 1)
    result = result .. string.char(charCode ~ keyChar)
  end
  return result
end

local function layer1_obfuscate_decrypt(data)
  return data
end

local function decryptComplete(encrypted)
  -- Capa 8: Hex
  local layer8 = layer8_hex_decrypt(encrypted)
  
  -- Capa 7: Binario
  local layer7 = layer7_binary_decrypt(layer8)
  
  -- Capa 6: Rotacion
  local layer6 = layer6_rotate_decrypt(layer7)
  
  -- Capa 5: AES
  local key = layer6:sub(1, 16)
  local data = layer6:sub(17)
  local layer5 = layer5_aes_decrypt(data, key)
  
  -- Capa 4: Base64
  local layer4 = layer4_base64_decrypt(layer5)
  
  -- Capa 3: Reverso
  local layer3 = layer3_reverse_decrypt(layer4)
  
  -- Capa 2: XOR
  local xorParts = {}
  for part in layer3:gmatch("[^|]+") do
    table.insert(xorParts, part)
  end
  local layer2 = layer2_xor_decrypt(layer3, xorParts[1])
  
  -- Capa 1: Obfuscate (ejecutar directamente)
  return layer2
end

local scriptId = "${scriptId}"
local encrypted = "${encryptedData}"
local script = decryptComplete(encrypted)

-- Sistema 1: Anti-Sintaxis (revertir)
script = script:gsub(" %[ ", "(")
script = script:gsub(" %] ", ")")
script = script:gsub(" << ", "{")
script = script:gsub(" >> ", "}")
script = script:gsub(" { ", "[")
script = script:gsub(" } ", "]")
script = script:gsub(" :: ", ".")
script = script:gsub(" , ", ",")
script = script:gsub(" == ", "=")
script = script:gsub(" ++ ", "+")
script = script:gsub(" -- ", "-")
script = script:gsub(" \\*\\* ", "*")
script = script:gsub(" // ", "/")

-- Sistema 2: Anti-HttpGet (revertir)
local replacements = {
  ['game:GetAsync'] = 'game:HttpGet',
  ['HttpRequest'] = 'HttpGet',
  ['load'] = 'loadstring',
  ['xpcall'] = 'pcall',
  ['delay'] = 'spawn',
  ['task.wait'] = 'wait',
  ['getfenv()'] = 'game',
  ['warn'] = 'print',
  ['assert'] = 'error'
}
for k, v in pairs(replacements) do
  script = script:gsub(k, v)
end

loadstring(script)()
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

        <div class="footer-link">
            Protected by PaltidxR<br>
            <a href="https://${DOMAIN}" target="_blank">https://${DOMAIN}</a>
        </div>
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
    
    if (script.length > 1000000) {
      return res.status(400).json({ success: false, error: "Script too large. Maximum 1MB" });
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
      protection: "8-layers",
      version: "3.0.0"
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
      protection: "8 layers encrypted",
      version: "3.0.0",
      message: "Script hosted with 8 layers of encryption"
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
      
      const decryptor = generateDecryptor(scriptId, scriptData.content);
      res.type("text").send(decryptor);
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
    protection: scriptsDB[key].protection || "standard"
  }));
  
  res.json({ 
    scripts: scriptList,
    count: scriptList.length,
    paltidxr: true,
    version: "3.0.0"
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
    protection: "8 layers",
    timestamp: new Date().toISOString()
  });
});

if (!fs.existsSync(path.join(__dirname, "scripts"))) {
  fs.mkdirSync(path.join(__dirname, "scripts"));
}

app.listen(PORT, () => {
  console.log(`PaltidxR v3.0 running on port ${PORT}`);
  console.log(`Domain: https://${DOMAIN}`);
  console.log(`API: https://${DOMAIN}/api/scripts`);
  console.log(`URL: https://${DOMAIN}/files/v1/loaders/{id}.lua`);
  console.log(`Protection: 8 layers encryption`);
});
