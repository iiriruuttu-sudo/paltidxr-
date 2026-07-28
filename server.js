const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { obfuscateScript } = require('./obfuscate.js');

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
        uaLower.includes("mozilla");

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
        const scriptId = req.params.scriptId || 'script.lua';
        const loaderCode = `loadstring(game:HttpGet("https://${DOMAIN}/files/v1/loaders/${scriptId}", true))()`;
        
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
            font-family: 'Segoe UI', Arial, sans-serif;
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
            cursor: pointer;
        }
        .btn-copy {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 10px 24px;
            color: #e0e0e0;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 16px;
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
        <h1>Access Denied</h1>
        <p class="subtitle">Tu navegador ha sido detectado y el acceso está restringido.</p>
        <div class="badge">🔐 9 Capas de Ofuscación</div>
        <div class="code-box" id="codeDisplay">${loaderCode}</div>
        <button class="btn-copy" id="copyBtn" onclick="copyCode()">📋 Copiar Código</button>
        <div class="footer-link">
            Protegido con PaltidxR v8.0<br>
            <a href="https://${DOMAIN}" target="_blank">https://${DOMAIN}</a>
        </div>
    </div>
    <div id="toast" class="toast"><span id="toastMessage">✅ Copiado!</span></div>
    <script>
        const codeToCopy = \`${loaderCode}\`;
        function copyCode() {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(codeToCopy).then(() => {
                    showToast('✅ Código copiado!');
                    const btn = document.getElementById('copyBtn');
                    btn.classList.add('copied');
                    btn.innerHTML = '✅ ¡Copiado!';
                    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '📋 Copiar Código'; }, 2500);
                }).catch(() => { fallbackCopy(); });
            } else { fallbackCopy(); }
        }
        function fallbackCopy() {
            const ta = document.createElement('textarea');
            ta.value = codeToCopy;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                showToast('✅ Código copiado!');
                const btn = document.getElementById('copyBtn');
                btn.classList.add('copied');
                btn.innerHTML = '✅ ¡Copiado!';
                setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '📋 Copiar Código'; }, 2500);
            } catch(e) { showToast('❌ Error al copiar'); }
            document.body.removeChild(ta);
        }
        function showToast(msg) {
            const t = document.getElementById('toast');
            document.getElementById('toastMessage').textContent = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3000);
        }
        document.getElementById('codeDisplay').addEventListener('click', copyCode);
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

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/scripts", rateLimiter, (req, res) => {
    try {
        const { script, name } = req.body;
        
        if (!script || script.length < 10) {
            return res.status(400).json({ success: false, error: "Script demasiado corto" });
        }
        
        if (script.length > 1000000) {
            return res.status(400).json({ success: false, error: "Script demasiado grande" });
        }
        
        let scriptId = generateUniqueId();
        while (scriptsDB[scriptId + '.lua']) {
            scriptId = generateUniqueId();
        }
        
        const fileName = `${scriptId}.lua`;
        const userScriptName = name || 'unnamed';
        
        const obfuscated = obfuscateScript(script, scriptId);
        
        if (!obfuscated) {
            return res.status(500).json({ success: false, error: "Error al ofuscar" });
        }
        
        scriptsDB[fileName] = {
            id: fileName,
            name: userScriptName,
            scriptId: scriptId,
            content: obfuscated.loaderCode,
            created: new Date().toISOString(),
            paltidxr: true,
            obfuscated: true,
            layers: obfuscated.layers
        };
        
        saveScripts(scriptsDB);
        
        const url = `https://${DOMAIN}/files/v1/loaders/${fileName}`;
        
        res.json({
            success: true,
            url: url,
            scriptId: scriptId,
            name: userScriptName,
            created: new Date().toISOString(),
            layers: obfuscated.layers,
            originalSize: obfuscated.originalSize,
            finalSize: obfuscated.finalSize,
            message: "Script ofuscado con 9 capas"
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: "Error interno" });
    }
});

app.get("/files/v1/loaders/:scriptId", 
    rateLimiter, 
    blockBrowsers, 
    (req, res) => {
        const scriptId = req.params.scriptId;
        scriptsDB = loadScripts();
        
        if (scriptsDB[scriptId]) {
            const scriptData = scriptsDB[scriptId];
            console.log(`[${new Date().toISOString()}] Script servido: ${scriptId}`);
            res.type("text").send(scriptData.content);
        } else {
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
        obfuscated: scriptsDB[key].obfuscated || false
    }));
    
    res.json({ 
        scripts: scriptList,
        count: scriptList.length
    });
});

app.get("/health", (req, res) => {
    scriptsDB = loadScripts();
    const scriptCount = Object.keys(scriptsDB).length;
    
    res.json({ 
        status: "online", 
        service: "PaltidxR API",
        version: "8.0.0",
        scripts: scriptCount,
        layers: 9,
        encryption: "ZLIB→XOR→Base16→Base32→Base58→Base64→Base85→Base91→Base95"
    });
});

if (!fs.existsSync(path.join(__dirname, "scripts"))) {
    fs.mkdirSync(path.join(__dirname, "scripts"));
}

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🔐 PaltidxR 9-Capas Obfuscator v8.0`);
    console.log(`========================================`);
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌐 Dominio: https://${DOMAIN}`);
    console.log(`🔄 Capas: ZLIB→XOR→Base16→Base32→Base58→Base64→Base85→Base91→Base95`);
    console.log(`🔢 Variables Numéricas: SI`);
    console.log(`🔀 Anti-Sintaxis: SI`);
    console.log(`📏 1 Línea: SI`);
    console.log(`========================================`);
});
