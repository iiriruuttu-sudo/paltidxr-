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

// ============ SISTEMA BASE85 ============
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

function decodeBase85(str) {
    const bytes = [];
    let value = 0;
    let count = 0;
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const idx = BASE85_CHARS.indexOf(char);
        if (idx === -1) continue;
        
        value = value * 85 + idx;
        count++;
        
        if (count === 5) {
            const byteCount = 4;
            for (let j = byteCount - 1; j >= 0; j--) {
                bytes.push((value >> (8 * j)) & 0xFF);
            }
            value = 0;
            count = 0;
        }
    }
    
    return Buffer.from(bytes);
}

// ============ CIFRADO AUTOMÁTICO ============
function autoEncryptScript(scriptContent, scriptId) {
    try {
        // 1. Comprimir
        const compressed = zlib.deflateSync(scriptContent);
        
        // 2. Generar clave AES-256
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        
        // 3. Cifrar
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(compressed);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // 4. Crear paquete
        const packet = Buffer.concat([iv, encrypted]);
        
        // 5. Codificar a Base85
        const base85 = encodeBase85(packet);
        
        // 6. Ofuscar con números y letras aleatorias
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
        
        // 7. Padding de 20KB
        let padding = '';
        const paddingChars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < 20000; i++) {
            padding += paddingChars[Math.floor(Math.random() * paddingChars.length)];
        }
        
        const position = Math.floor(Math.random() * (20000 - obfuscated.length));
        const finalData = padding.slice(0, position) + obfuscated + padding.slice(position + obfuscated.length);
        
        return {
            encryptedData: finalData,
            key: key.toString('hex'),
            iv: iv.toString('hex'),
            position: position,
            originalSize: scriptContent.length,
            encryptedSize: finalData.length
        };
    } catch (error) {
        console.error('Error autoEncryptScript:', error);
        return null;
    }
}

// ============ GENERAR LOADER OFUSCADO ============
function generateProtectedLoader(scriptId, encryptedData, key, iv, position) {
    return `--[[ PaltidxR Protected v5.0 - Auto Encryption ]]--
--[[ Script ID: ${scriptId} ]]--
--[[ Sistema: AES-256-CBC + ZLIB + Base85 ]]--

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

local function extractData(data, pos)
    return data:sub(pos, pos + 20000)
end

local function bytesToString(bytes)
    local result = ""
    for i = 1, #bytes do
        result = result .. string.char(bytes[i])
    end
    return result
end

local encryptedData = "${encryptedData}"
local key = "${key}"
local iv = "${iv}"
local position = ${position}

local extracted = extractData(encryptedData, position)
local cleaned = cleanData(extracted)
local bytes = decode85(cleaned)
local encoded = bytesToString(bytes)

local success, err = pcall(function()
    local func = loadstring(encoded)
    if func then
        func()
    else
        error("Error al cargar el script")
    end
end)

if not success then
    warn("Error: " .. tostring(err))
end`;
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

// ============ BLOQUEO DE BROWSERS ============
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
        uaLower.includes("brave");

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
    <meta charset="UTF-8">
    <title>Access Denied</title>
    <style>
        body {
            background: #0a0b12;
            font-family: Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e0e0e0;
            padding: 20px;
        }
        .card {
            background: rgba(20, 21, 31, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 24px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            text-align: center;
        }
        .code-box {
            background: rgba(9, 10, 18, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            padding: 16px;
            margin-top: 16px;
            font-family: monospace;
            font-size: 13px;
            color: #a78bfa;
            word-break: break-all;
        }
        .btn-copy {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 8px 20px;
            color: #e0e0e0;
            cursor: pointer;
            margin-top: 12px;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>🔒 Access Denied</h1>
        <p>Este script está protegido con cifrado Base85</p>
        <div class="code-box" id="codeDisplay">${loaderCode}</div>
        <button class="btn-copy" onclick="copyCode()">📋 Copiar</button>
    </div>
    <script>
        function copyCode() {
            navigator.clipboard.writeText(document.getElementById('codeDisplay').innerText);
            alert('Copiado!');
        }
    </script>
</body>
</html>
        `);
    }

    next();
}

// ============ HEADERS ============
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
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ============ ENDPOINT PRINCIPAL - AUTO CIFRADO ============
app.post("/api/scripts", rateLimiter, (req, res) => {
    try {
        const { script, name } = req.body;
        
        if (!script || script.length < 10) {
            return res.status(400).json({ success: false, error: "Script demasiado corto" });
        }
        
        if (script.length > 1000000) {
            return res.status(400).json({ success: false, error: "Script demasiado grande. Máximo 1MB" });
        }
        
        let scriptId = generateUniqueId();
        while (scriptsDB[scriptId + '.lua']) {
            scriptId = generateUniqueId();
        }
        
        const fileName = `${scriptId}.lua`;
        const userScriptName = name || 'unnamed';
        
        // 🔐 AUTO CIFRADO - Siempre se cifra automáticamente
        const encryptedData = autoEncryptScript(script, scriptId);
        
        if (!encryptedData) {
            return res.status(500).json({ success: false, error: "Error al cifrar el script" });
        }
        
        const protectedScript = generateProtectedLoader(
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
            content: protectedScript,
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
            message: "✅ Script cifrado automáticamente con Base85 + AES-256"
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: "Error interno del servidor" });
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
            console.log(`[${new Date().toISOString()}] Script servido: ${scriptId} (${scriptData.name})`);
            res.type("text").send(scriptData.content);
        } else {
            console.log(`[${new Date().toISOString()}] Script no encontrado: ${scriptId}`);
            res.status(404).type("text").send("Script no encontrado");
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
        encryptionAvailable: true,
        autoEncryption: true
    });
});

app.get("/health", (req, res) => {
    scriptsDB = loadScripts();
    const scriptCount = Object.keys(scriptsDB).length;
    
    res.json({ 
        status: "online", 
        service: "PaltidxR API",
        version: "5.0.0",
        scripts: scriptCount,
        paltidxr: true,
        base85: true,
        autoEncryption: true,
        timestamp: new Date().toISOString()
    });
});

// ============ INICIAR SERVIDOR ============
if (!fs.existsSync(path.join(__dirname, "scripts"))) {
    fs.mkdirSync(path.join(__dirname, "scripts"));
}

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🔐 PaltidxR Auto Encryption v5.0`);
    console.log(`========================================`);
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌐 Dominio: https://${DOMAIN}`);
    console.log(`📝 API: https://${DOMAIN}/api/scripts`);
    console.log(`🔒 Auto Encryption: ACTIVADA`);
    console.log(`📦 Formato: Base85 + AES-256 + ZLIB`);
    console.log(`========================================`);
    console.log(`✅ TODOS los scripts se cifran automáticamente`);
    console.log(`========================================`);
});
