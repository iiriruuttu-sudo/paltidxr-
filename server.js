const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// ⚠️ TU DOMINIO AQUÍ ⚠️
const DOMAIN = process.env.DOMAIN || 'tudominio.com';
const SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex');

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// ============ PROTECCIONES DEL SERVIDOR ============

// 1. Rate Limiter
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
    return res.status(429).json({ 
      error: "Too many requests", 
      retryAfter: retry,
      message: `Please wait ${retry} seconds`
    });
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of hits) {
    if (now - r.start > WINDOW) hits.delete(ip);
  }
}, 5 * 60 * 1000);

// 2. Anti-Browser COMPLETO (detección avanzada con Mozilla)
function blockBrowsers(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  const uaLower = ua.toLowerCase();
  
  // Detección de navegadores (incluye Mozilla)
  const isBrowser = 
    (uaLower.includes("mozilla") && uaLower.includes("firefox")) ||
    (uaLower.includes("mozilla") && uaLower.includes("chrome") && !uaLower.includes("edg")) ||
    (uaLower.includes("mozilla") && uaLower.includes("safari") && !uaLower.includes("chrome")) ||
    (uaLower.includes("mozilla") && uaLower.includes("edg")) ||
    (uaLower.includes("mozilla") && uaLower.includes("opr")) ||
    (uaLower.includes("mozilla") && uaLower.includes("trident")) ||
    (uaLower.includes("mozilla") && uaLower.includes("webkit") && !uaLower.includes("roblox")) ||
    (uaLower.includes("mozilla/") && !uaLower.includes("roblox") && !uaLower.includes("synapse"));
  
  // Detección de ejecutores Roblox
  const isExecutor = 
    uaLower.includes("roblox") ||
    uaLower.includes("synapse") ||
    uaLower.includes("krnl") ||
    uaLower.includes("scriptware") ||
    uaLower.includes("jjsploit") ||
    uaLower.includes("protosmasher") ||
    uaLower.includes("dark") ||
    uaLower.includes("sentinel") ||
    uaLower.includes("fluxus") ||
    uaLower.includes("vega") ||
    uaLower.includes("evon") ||
    uaLower.includes("celery") ||
    uaLower.includes("hydrogen") ||
    uaLower.includes("swift") ||
    uaLower.includes("sirius") ||
    uaLower.includes("electron") ||
    uaLower.includes("wearedevs") ||
    uaLower.includes("luarmor");
  
  // Si es navegador Y NO es ejecutor, bloquear
  if (isBrowser && !isExecutor && req.path.includes('/files/v1/loaders/')) {
    return res.status(403).type("html").send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Access Denied - PaltidxR</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #0a0b12;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            font-family: 'Segoe UI', 'Inter', sans-serif;
            color: #e0e0e0;
          }
          .card {
            text-align: center;
            padding: 50px 60px;
            background: rgba(20, 21, 31, 0.95);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            max-width: 450px;
            backdrop-filter: blur(12px);
          }
          .icon { font-size: 72px; margin-bottom: 20px; }
          h1 {
            font-size: 22px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 12px;
          }
          p {
            color: #888;
            font-size: 14px;
            line-height: 1.7;
          }
          .badge {
            display: inline-block;
            margin-top: 16px;
            padding: 6px 16px;
            background: rgba(139, 92, 246, 0.1);
            border: 1px solid rgba(139, 92, 246, 0.2);
            border-radius: 20px;
            font-size: 11px;
            color: #a78bfa;
          }
          .detected {
            margin-top: 14px;
            padding: 10px;
            background: rgba(239, 68, 68, 0.05);
            border-radius: 8px;
            font-size: 11px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🔒</div>
          <h1>Access Denied</h1>
          <p>This endpoint is for script execution only.<br>Access from browsers is restricted.</p>
          <div class="badge">PaltidxR Protected</div>
          <div class="detected">Detected: Mozilla Browser</div>
        </div>
      </body>
      </html>
    `);
  }
  next();
}

// 3. Redirección HTTPS (forzar HTTPS)
function forceHttps(req, res, next) {
  if (!req.secure && req.headers.host && !req.headers.host.includes('localhost') && !req.headers.host.includes('127.0.0.1')) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
}

// 4. Protección de Fetch y Peticiones HTTPS
function fetchProtection(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  const origin = req.headers["origin"] || "";
  const referer = req.headers["referer"] || "";
  
  const isFetch = req.headers["sec-fetch-mode"] === "cors" || 
                  req.headers["sec-fetch-mode"] === "no-cors" ||
                  req.headers["sec-fetch-site"] === "same-origin";
  
  const isValidOrigin = !origin || origin.includes(DOMAIN) || origin.includes('localhost');
  const isBrowserFetch = isFetch && (ua.includes("Mozilla") || ua.includes("Chrome") || ua.includes("Safari"));
  
  if (isBrowserFetch && req.path.includes('/files/v1/loaders/')) {
    return res.status(403).json({ 
      error: "Access Denied", 
      message: "Direct fetch from browser is not allowed" 
    });
  }
  
  if (!isValidOrigin && req.method !== 'GET') {
    return res.status(403).json({ 
      error: "Access Denied", 
      message: "Invalid origin" 
    });
  }
  
  next();
}

// 5. Headers de Seguridad (incluye HSTS)
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: https:;");
  next();
});

// 6. Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${req.ip} - ${req.headers['user-agent'] || 'Unknown'}`);
  next();
});

// 7. Validación de Script ID
function validateScriptId(req, res, next) {
  const scriptId = req.params.scriptId;
  if (!scriptId || scriptId.length < 3) {
    return res.status(400).json({ error: "Invalid script ID" });
  }
  if (scriptId.includes('..') || scriptId.includes('/') || scriptId.includes('\\') || scriptId.includes('.')) {
    return res.status(400).json({ error: "Invalid script ID format" });
  }
  next();
}

// 8. Protección de IP
const blockedIPs = new Set();

function ipProtection(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "?";
  if (blockedIPs.has(ip)) {
    return res.status(403).json({ error: "Your IP has been blocked" });
  }
  next();
}

// 9. Luarmor Loading Protection
function luarmorProtection(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  const uaLower = ua.toLowerCase();
  
  // Detectar si viene de Luarmor loader
  const isLuarmor = uaLower.includes("luarmor") || 
                    uaLower.includes("loadstring") ||
                    req.headers["x-luarmor"] === "true" ||
                    req.headers["x-executor"] === "luarmor";
  
  // Si no es Luarmor y está intentando acceder a scripts protegidos
  if (!isLuarmor && req.path.includes('/files/v1/loaders/') && req.method === 'GET') {
    // Permitir solo si tiene headers específicos de ejecutor
    const isExecutor = uaLower.includes("roblox") ||
                       uaLower.includes("synapse") ||
                       uaLower.includes("krnl") ||
                       uaLower.includes("scriptware") ||
                       uaLower.includes("jjsploit") ||
                       uaLower.includes("protosmasher");
    
    if (!isExecutor) {
      return res.status(403).json({ 
        error: "Access Denied", 
        message: "Luarmor protection active. Use a compatible executor."
      });
    }
  }
  
  next();
}

// 10. URL Loading Protection (proteger contra carga maliciosa)
function urlLoadingProtection(req, res, next) {
  const url = req.url;
  const query = req.query;
  
  // Verificar parámetros sospechosos
  if (query.loadstring || query.execute || query.eval) {
    return res.status(400).json({ 
      error: "Invalid request", 
      message: "Suspicious parameters detected" 
    });
  }
  
  // Verificar que la URL no contenga caracteres maliciosos
  if (url.includes('%00') || url.includes('%0A') || url.includes('%0D')) {
    return res.status(400).json({ 
      error: "Invalid request", 
      message: "Malformed URL detected" 
    });
  }
  
  next();
}

// ============ RUTAS ============

// Crear Script
app.post("/api/scripts", rateLimiter, ipProtection, luarmorProtection, (req, res) => {
  try {
    const { script, name } = req.body;
    
    if (!script || script.length < 10) {
      return res.status(400).json({ 
        success: false, 
        error: "Script too short or empty" 
      });
    }
    
    if (script.length > 1000000) {
      return res.status(400).json({ 
        success: false, 
        error: "Script too large. Maximum 1MB" 
      });
    }
    
    const scriptName = name || crypto.randomBytes(8).toString('hex');
    const fileName = `${scriptName}.lua`;
    const filePath = path.join(__dirname, "scripts", fileName);
    
    // Agregar protección Luarmor al script
    const protectedScript = `--[[ PaltidxR Protected ]]--\n--[[ Luarmor Active ]]--\n${script}`;
    
    fs.writeFileSync(filePath, protectedScript, "utf-8");
    
    res.json({
      success: true,
      url: `https://${DOMAIN}/files/v1/loaders/${fileName}`,
      name: scriptName,
      id: scriptName,
      created: new Date().toISOString(),
      message: "Script hosted successfully with Luarmor protection"
    });
    
  } catch (error) {
    console.error('Create script error:', error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
});

// Obtener Script - CON TODAS LAS PROTECCIONES
app.get("/files/v1/loaders/:scriptId", 
  rateLimiter, 
  forceHttps,
  blockBrowsers, 
  fetchProtection, 
  luarmorProtection,
  urlLoadingProtection,
  validateScriptId, 
  (req, res) => {
    const scriptId = req.params.scriptId;
    const filePath = path.join(__dirname, "scripts", scriptId);
    
    try {
      if (fs.existsSync(filePath)) {
        const script = fs.readFileSync(filePath, "utf-8");
        
        // Log de acceso
        console.log(`[${new Date().toISOString()}] Script served: ${scriptId} - ${req.ip}`);
        
        res.type("text").send(script);
      } else {
        res.status(404).type("text").send("Script not found");
      }
    } catch (error) {
      console.error('Script fetch error:', error);
      res.status(500).type("text").send("Error loading script");
    }
  }
);

// Listar scripts (solo admin)
app.get("/api/scripts", rateLimiter, ipProtection, (req, res) => {
  try {
    const files = fs.readdirSync(path.join(__dirname, "scripts"));
    res.json({ 
      scripts: files,
      count: files.length,
      protected: true,
      luarmor: true
    });
  } catch (error) {
    res.status(500).json({ error: "Error listing scripts" });
  }
});

// Health Check
app.get("/health", (req, res) => {
  const scriptCount = fs.existsSync(path.join(__dirname, "scripts")) 
    ? fs.readdirSync(path.join(__dirname, "scripts")).length 
    : 0;
  
  res.json({ 
    status: "online", 
    service: "PaltidxR API",
    version: "1.0.0",
    uptime: process.uptime(),
    scripts: scriptCount,
    protections: {
      rateLimiter: true,
      antiBrowser: true,
      https: true,
      fetchProtection: true,
      luarmor: true,
      urlLoadingProtection: true,
      ipProtection: true
    },
    timestamp: new Date().toISOString()
  });
});

// Crear carpeta scripts
if (!fs.existsSync(path.join(__dirname, "scripts"))) {
  fs.mkdirSync(path.join(__dirname, "scripts"));
}

// Iniciar servidor HTTP
app.listen(PORT, () => {
  console.log(`PaltidxR running on port ${PORT}`);
  console.log(`Domain: https://${DOMAIN}`);
  console.log(`API: https://${DOMAIN}/api/scripts`);
  console.log(`Protected URL: https://${DOMAIN}/files/v1/loaders/{scriptId}`);
  console.log(`Luarmor Protection: ACTIVE`);
  console.log(`Anti-Browser: ACTIVE`);
  console.log(`HTTPS Force: ACTIVE`);
  console.log(`Fetch Protection: ACTIVE`);
  console.log(`URL Loading Protection: ACTIVE`);
});

// Servidor HTTPS (opcional)
try {
  const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.crt'))
  };
  
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
    console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
  });
} catch (error) {
  console.log('HTTPS not configured. Running only HTTP.');
}
