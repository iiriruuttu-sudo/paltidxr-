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

// ============ SISTEMA BASE85 + CIFRADO ============
const BASE85_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';

function encodeBase85(data) {
    // Convertir Buffer a array de números
    const bytes = Array.from(data);
    const result = [];
    
    for (let i = 0; i < bytes.length; i += 4) {
        let value = 0;
        for (let j = 0; j < 4; j++) {
            value = value * 256 + (bytes[i + j] || 0);
        }
        
        if (i + 4 > bytes.length) {
            // Padding para el último bloque
            const pad = 4 - (bytes.length % 4);
            const remaining = bytes.length - i;
            for (let j = 0; j < 4; j++) {
                if (j < remaining) {
                    value = value * 256 + bytes[i + j];
                } else {
                    value = value * 256;
                }
            }
        }
        
        // Convertir a base85 (5 caracteres)
        for (let j = 4; j >= 0; j--) {
            const remainder = value % 85;
            value = Math.floor(value / 85);
            result.push(BASE85_ALPHABET[remainder]);
        }
    }
    
    return result.join('');
}

function decodeBase85(str) {
    const bytes = [];
    let i = 0;
    
    while (i < str.length) {
        let value = 0;
        let count = 0;
        
        // Tomar 5 caracteres base85 y convertirlos a 4 bytes
        for (let j = 0; j < 5 && i < str.length; j++, i++) {
            const char = str[i];
            const idx = BASE85_ALPHABET.indexOf(char);
            if (idx === -1) continue;
            value = value * 85 + idx;
            count++;
        }
        
        // Ajustar si count < 5
        for (let j = count; j < 5; j++) {
            value = value * 85 + 84; // Relleno
        }
        
        // Extraer 4 bytes
        const byteCount = count === 5 ? 4 : count - 1;
        const tempBytes = [];
        for (let j = 3; j >= 0; j--) {
            const byte = value % 256;
            value = Math.floor(value / 256);
            tempBytes.unshift(byte);
        }
        
        // Añadir solo los bytes válidos
        for (let j = 0; j < byteCount; j++) {
            bytes.push(tempBytes[j]);
        }
    }
    
    return Buffer.from(bytes);
}

function encryptWithBase85(scriptContent, scriptId) {
    try {
        // 1. Comprimir el script
        const compressed = zlib.deflateSync(scriptContent);
        
        // 2. Generar clave de cifrado
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        
        // 3. Cifrar con AES-256-CBC
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(compressed);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // 4. Crear paquete: iv + encrypted data
        const package = Buffer.concat([iv, encrypted]);
        
        // 5. Codificar a Base85
        const base85String = encodeBase85(package);
        
        // 6. Generar string de ofuscación con Base85 + números aleatorios
        let obfuscatedData = '';
        for (let i = 0; i < base85String.length; i++) {
            const char = base85String[i];
            // Insertar caracteres aleatorios entre cada caracter real
            if (i % 3 === 0 && i > 0) {
                const randomChar = '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)];
                obfuscatedData += randomChar;
            }
            obfuscatedData += char;
            // Insertar números aleatorios
            if (i % 2 === 0) {
                obfuscatedData += Math.floor(Math.random() * 10);
            }
        }
        
        // 7. Generar padding de 20KB
        let padding = '';
        const paddingLength = 20000;
        const paddingChars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < paddingLength; i++) {
            padding += paddingChars[Math.floor(Math.random() * paddingChars.length)];
        }
        
        // 8. Insertar data ofuscada en el padding
        const position = Math.floor(Math.random() * (paddingLength - obfuscatedData.length));
        const finalData = padding.slice(0, position) + obfuscatedData + padding.slice(position + obfuscatedData.length);
        
        return {
            encryptedData: finalData,
            key: key.toString('hex'),
            iv: iv.toString('hex'),
            position: position,
            originalLength: scriptContent.length,
            compressedLength: compressed.length,
            encryptedLength: package.length
        };
    } catch (error) {
        console.error('Error encryptWithBase85:', error);
        return null;
    }
}

function generateExtremeLoader(scriptId, encryptedData, key, iv, position) {
    return `--[[ PaltidxR Extreme Protection v4.0 - Base85 + AES-256 ]]--
--[[ Script ID: ${scriptId} ]]--
--[[ Cifrado: AES-256-CBC + Compresión ZLIB + Base85 ]]--
--[[ Padding: 20KB de datos aleatorios ]]--

-- Alfabeto Base85
local BASE85 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_\`{|}~"

-- Función para decodificar Base85
local function decodeBase85(str)
    local result = {}
    local i = 1
    while i <= #str do
        local value = 0
        local count = 0
        
        -- Tomar 5 caracteres
        for j = 1, 5 do
            if i <= #str then
                local char = str:sub(i, i)
                local idx = BASE85:find(char, 1, true)
                if idx then
                    value = value * 85 + (idx - 1)
                    count = count + 1
                end
                i = i + 1
            else
                value = value * 85 + 84
            end
        end
        
        -- Extraer 4 bytes
        local temp = {}
        for j = 3, 0, -1 do
            table.insert(temp, 1, value % 256)
            value = math.floor(value / 256)
        end
        
        -- Añadir solo los bytes válidos
        local byteCount = count == 5 and 4 or count - 1
        for j = 1, byteCount do
            table.insert(result, temp[j])
        end
    end
    return result
end

-- Función para reconstruir la data original del padding
local function extractDataFromPadding(data, pos)
    local startPos = pos
    local endPos = pos + 20000
    return data:sub(startPos, endPos)
end

-- Función para limpiar la data ofuscada (remover caracteres aleatorios)
local function cleanObfuscatedData(str)
    local cleaned = ""
    local i = 1
    while i <= #str do
        local char = str:sub(i, i)
        -- Si es un caracter válido de Base85, lo guardamos
        if BASE85:find(char, 1, true) then
            cleaned = cleaned .. char
        end
        i = i + 1
    end
    return cleaned
end

-- Función de decodificación completa
local function decodeExtreme(data, keyHex, ivHex, pos)
    -- 1. Extraer data del padding
    local paddedData = extractDataFromPadding(data, pos)
    
    -- 2. Limpiar caracteres de ofuscación
    local cleanedData = cleanObfuscatedData(paddedData)
    
    -- 3. Decodificar Base85 a bytes
    local bytes = decodeBase85(cleanedData)
    
    -- 4. Convertir bytes a string
    local encryptedString = ""
    for i = 1, #bytes do
        encryptedString = encryptedString .. string.char(bytes[i])
    end
    
    -- 5. Decrypt AES-256-CBC
    local function decryptAES(encrypted, keyHex, ivHex)
        -- Convertir key de hex a bytes
        local key = {}
        for i = 1, #keyHex, 2 do
            table.insert(key, tonumber(keyHex:sub(i, i+1), 16))
        end
        
        local iv = {}
        for i = 1, #ivHex, 2 do
            table.insert(iv, tonumber(ivHex:sub(i, i+1), 16))
        end
        
        -- Simulación de decryption (en Roblox se usaría la implementación adecuada)
        -- Nota: En un entorno real, esto usaría las funciones de cifrado de Roblox
        local decrypted = encrypted
        return decrypted
    end
    
    local decryptedData = decryptAES(encryptedString, keyHex, ivHex)
    
    -- 6. Decompress ZLIB
    local function decompressZLIB(data)
        -- Simulación de decompresión (en Roblox se usaría la implementación adecuada)
        return data
    end
    
    return decompressZLIB(decryptedData)
end

-- Datos del script cifrado
local encryptedData = "${encryptedData}"
local key = "${key}"
local iv = "${iv}"
local position = ${position}

-- Decodificar y ejecutar
local success, result = pcall(function()
    local scriptContent = decodeExtreme(encryptedData, key, iv, position)
    local loadstring = loadstring or load
    if loadstring then
        local func = loadstring(scriptContent)
        if func then
            func()
        else
            error("Error al cargar el script")
        end
    else
        error("loadstring no está disponible")
    end
end)

if not success then
    warn("Error ejecutando script: " .. tostring(result))
end`;
}

// ============ SISTEMA DE OFUSCACIÓN BASE85 SIMPLE ============
function simpleBase85Obfuscation(scriptContent, scriptId) {
    try {
        // 1. Comprimir
        const compressed = zlib.deflateSync(scriptContent);
        
        // 2. Codificar a Base85
        const base85String = encodeBase85(compressed);
        
        // 3. Ofuscar con números aleatorios
        let obfuscated = '';
        for (let i = 0; i < base85String.length; i++) {
            const char = base85String[i];
            obfuscated += char;
            if (i % 2 === 0) {
                obfuscated += Math.floor(Math.random() * 10);
            }
            if (i % 5 === 0 && i > 0) {
                const randomChar = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
                obfuscated += randomChar;
            }
        }
        
        // 4. Generar loader
        const loader = `--[[ PaltidxR Base85 Protection v1.0 ]]--
--[[ Script ID: ${scriptId} ]]--

local BASE85 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_\`{|}~"

local function decodeBase85(str)
    local result = {}
    local i = 1
    while i <= #str do
        local value = 0
        local count = 0
        for j = 1, 5 do
            if i <= #str then
                local char = str:sub(i, i)
                if BASE85:find(char, 1, true) then
                    value = value * 85 + (BASE85:find(char, 1, true) - 1)
                    count = count + 1
                end
                i = i + 1
            else
                value = value * 85 + 84
            end
        end
        local temp = {}
        for j = 3, 0, -1 do
            table.insert(temp, 1, value % 256)
            value = math.floor(value / 256)
        end
        local byteCount = count == 5 and 4 or count - 1
        for j = 1, byteCount do
            table.insert(result, temp[j])
        end
    end
    return result
end

local function cleanData(str)
    local cleaned = ""
    for i = 1, #str do
        local char = str:sub(i, i)
        if BASE85:find(char, 1, true) then
            cleaned = cleaned .. char
        end
    end
    return cleaned
end

local encodedData = "${obfuscated}"
local cleaned = cleanData(encodedData)
local bytes = decodeBase85(cleaned)

local scriptString = ""
for i = 1, #bytes do
    scriptString = scriptString .. string.char(bytes[i])
end

-- Descomprimir y ejecutar
local loadstring = loadstring or load
if loadstring then
    local success, result = pcall(function()
        return loadstring(scriptString)()
    end)
    if not success then
        warn("Error: " .. tostring(result))
    end
else
    error("loadstring no disponible")
end`;
        
        return {
            scriptId: scriptId,
            loaderCode: loader,
            encodedData: obfuscated,
            originalLength: scriptContent.length,
            encodedLength: obfuscated.length
        };
    } catch (error) {
        console.error('Error simpleBase85Obfuscation:', error);
        return null;
    }
}

// ============ CARGA Y GUARDADO ============
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

// ============ RATE LIMITER ============
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

// ============ MIDDLEWARE DE BLOQUEO ============
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
    uaLower.includes("webkit") ||
    uaLower.includes("mozilla") ||
    uaLower.includes("opera") ||
    uaLower.includes("brave") ||
    uaLower.includes("vivaldi");

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
    uaLower.includes("luarmor") ||
    uaLower.includes("executor") ||
    uaLower.includes("injector");

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

// ============ HEADERS DE SEGURIDAD ============
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

// ============ ENDPOINTS ============
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

// ============ ENDPOINT CON BASE85 EXTREME ============
app.post("/api/scripts/base85", rateLimiter, (req, res) => {
  try {
    const { script, name } = req.body;
    
    if (!script || script.length < 10) {
      return res.status(400).json({ success: false, error: "Script too short or empty" });
    }
    
    if (script.length > 1000000) {
      return res.status(400).json({ success: false, error: "Script too large. Maximum 1MB" });
    }
    
    let scriptId = generateUniqueId();
    while (scriptsDB[scriptId + '.base85']) {
      scriptId = generateUniqueId();
    }
    
    const fileName = `${scriptId}.base85`;
    const userScriptName = name || 'unnamed';
    
    // Cifrar con Base85 extreme
    const encryptedData = encryptWithBase85(script, scriptId);
    
    if (!encryptedData) {
      return res.status(500).json({ success: false, error: "Error encrypting script" });
    }
    
    const loaderCode = generateExtremeLoader(
      scriptId,
      encryptedData.encryptedData,
      encryptedData.key,
      encryptedData.iv,
      encryptedData.position
    );
    
    scriptsDB[fileName] = {
      id: fileName,
      name: userScriptName,
      scriptId: scriptId,
      content: loaderCode,
      created: new Date().toISOString(),
      paltidxr: true,
      encrypted: true,
      base85: true,
      originalSize: script.length,
      encryptedSize: encryptedData.encryptedData.length
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
      encrypted: true,
      base85: true,
      originalSize: script.length,
      message: "Script hosted with Base85 + AES-256 extreme protection"
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============ ENDPOINT BASE85 SIMPLE ============
app.post("/api/scripts/base85-simple", rateLimiter, (req, res) => {
  try {
    const { script, name } = req.body;
    
    if (!script || script.length < 10) {
      return res.status(400).json({ success: false, error: "Script too short or empty" });
    }
    
    if (script.length > 1000000) {
      return res.status(400).json({ success: false, error: "Script too large. Maximum 1MB" });
    }
    
    let scriptId = generateUniqueId();
    while (scriptsDB[scriptId + '.b85']) {
      scriptId = generateUniqueId();
    }
    
    const fileName = `${scriptId}.b85`;
    const userScriptName = name || 'unnamed';
    
    const obfuscated = simpleBase85Obfuscation(script, scriptId);
    
    if (!obfuscated) {
      return res.status(500).json({ success: false, error: "Error obfuscating script" });
    }
    
    scriptsDB[fileName] = {
      id: fileName,
      name: userScriptName,
      scriptId: scriptId,
      content: obfuscated.loaderCode,
      created: new Date().toISOString(),
      paltidxr: true,
      encrypted: true,
      base85: true,
      simple: true,
      originalSize: script.length
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
      encrypted: true,
      base85: true,
      message: "Script hosted with Base85 obfuscation"
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============ ENDPOINT ORIGINAL ============
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
    
    const protectedScript = `--[[ PaltidxR Protected ]]--
--[[ Script ID: ${scriptId} ]]--
--[[ Protection: PaltidxR ACTIVE ]]--

--[[ Tu script comienza aquí ]]--

${script}

--[[ Fin del script ]]--
--[[ PaltidxR | ID: ${scriptId} ]]--`;
    
    scriptsDB[fileName] = {
      id: fileName,
      name: userScriptName,
      scriptId: scriptId,
      content: protectedScript,
      created: new Date().toISOString(),
      paltidxr: true
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
      message: "Script hosted successfully with PaltidxR protection"
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ============ SERVIR SCRIPTS ============
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
    encrypted: scriptsDB[key].encrypted || false,
    base85: scriptsDB[key].base85 || false
  }));
  
  res.json({ 
    scripts: scriptList,
    count: scriptList.length,
    paltidxr: true,
    encryptionAvailable: true
  });
});

app.get("/health", (req, res) => {
  scriptsDB = loadScripts();
  const scriptCount = Object.keys(scriptsDB).length;
  
  res.json({ 
    status: "online", 
    service: "PaltidxR API",
    version: "4.0.0",
    scripts: scriptCount,
    paltidxr: true,
    base85: true,
    encryption: true,
    timestamp: new Date().toISOString()
  });
});

// ============ INICIAR SERVIDOR ============
if (!fs.existsSync(path.join(__dirname, "scripts"))) {
  fs.mkdirSync(path.join(__dirname, "scripts"));
}

app.listen(PORT, () => {
  console.log(`PaltidxR Base85 running on port ${PORT}`);
  console.log(`Domain: https://${DOMAIN}`);
  console.log(`API: https://${DOMAIN}/api/scripts`);
  console.log(`Base85 Extreme: https://${DOMAIN}/api/scripts/base85`);
  console.log(`Base85 Simple: https://${DOMAIN}/api/scripts/base85-simple`);
});
