const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Si no hay DOMAIN, usa el de Render automáticamente
const DOMAIN = process.env.DOMAIN || 'paltidxr.onrender.com';

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// ============ PROTECCIONES ============

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

// 2. Anti-Browser
function blockBrowsers(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  const uaLower = ua.toLowerCase();
  
  const isBrowser = 
    (uaLower.includes("mozilla") && uaLower.includes("firefox")) ||
    (uaLower.includes("mozilla") && uaLower.includes("chrome") && !uaLower.includes("edg")) ||
    (uaLower.includes("mozilla") && uaLower.includes("safari") && !uaLower.includes("chrome")) ||
    (uaLower.includes("mozilla") && uaLower.includes("edg")) ||
    (uaLower.includes("mozilla") && uaLower.includes("opr")) ||
    (uaLower.includes("mozilla") && uaLower.includes("trident")) ||
    (uaLower.includes("mozilla") && uaLower.includes("webkit") && !uaLower.includes("roblox")) ||
    (uaLower.includes("mozilla/") && !uaLower.includes("roblox") && !uaLower.includes("synapse"));
  
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
            font-family: 'Segoe UI', sans-serif;
            color: #e0e0e0;
          }
          .card {
            text-align: center;
            padding: 50px 60px;
            background: rgba(20, 21, 31, 0.95);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            max-width: 450px;
          }
          .icon { font-size: 72px; margin-bottom: 20px; }
          h1 { font-size: 22px; font-weight: 600; color: #ffffff; margin-bottom: 12px; }
          p { color: #888; font-size: 14px; line-height: 1.7; }
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

// 3. Fetch Protection
function fetchProtection(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  const origin = req.headers["origin"] || "";
  
  const isFetch = req.headers["sec-fetch-mode"] === "cors" || 
                  req.headers["sec-fetch-mode"] === "no-cors";
  
  const isValidOrigin = !origin || origin.includes(DOMAIN) || origin.includes('localhost');
  const isBrowserFetch = isFetch && (ua.includes("Mozilla") || ua.includes("Chrome") || ua.includes("Safari"));
  
  if (isBrowserFetch && req.path.includes('/files/v1/loaders/')) {
    return res.status(403).json({ 
      error: "Access Denied", 
      message: "Direct fetch from browser is not allowed" 
    });
  }
  
  if (!isValidOrigin && req.method !== 'GET') {
    return res.status(403).json({ error: "Access Denied", message: "Invalid origin" });
  }
  
  next();
}

// 4. Headers de Seguridad
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// 5. Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// 6. Validación de Script ID
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

// 7. Luarmor Protection
function luarmorProtection(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  const uaLower = ua.toLowerCase();
  
  const isLuarmor = uaLower.includes("luarmor") || 
                    uaLower.includes("loadstring") ||
                    req.headers["x-luarmor"] === "true";
  
  if (!isLuarmor && req.path.includes('/files/v1/loaders/') && req.method === 'GET') {
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

// 8. URL Loading Protection
function urlLoadingProtection(req, res, next) {
  const url = req.url;
  const query = req.query;
  
  if (query.loadstring || query.execute || query.eval) {
    return res.status(400).json({ 
      error: "Invalid request", 
      message: "Suspicious parameters detected" 
    });
  }
  
  if (url.includes('%00') || url.includes('%0A') || url.includes('%0D')) {
    return res.status(400).json({ 
      error: "Invalid request", 
      message: "Malformed URL detected" 
    });
  }
  
  next();
}

// ============ RUTAS ============

// Servir index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Crear Script
app.post("/api/scripts", rateLimiter, luarmorProtection, (req, res) => {
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
    
    const protectedScript = `--[[ PaltidxR Protected ]]--\n--[[ Luarmor Active ]]--\n${script}`;
    
    fs.writeFileSync(filePath, protectedScript, "utf-8");
    
    res.json({
      success: true,
      url: `https://${DOMAIN}/files/v1/loaders/${fileName}`,
      name: scriptName,
      id: scriptName,
      created: new Date().toISOString(),
      message: "Script hosted successfully"
    });
    
  } catch (error) {
    console.error('Create script error:', error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
});

// Obtener Script
app.get("/files/v1/loaders/:scriptId", 
  rateLimiter, 
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
        console.log(`[${new Date().toISOString()}] Script served: ${scriptId}`);
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

// Listar scripts
app.get("/api/scripts", rateLimiter, (req, res) => {
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
      fetchProtection: true,
      luarmor: true,
      urlLoadingProtection: true
    },
    timestamp: new Date().toISOString()
  });
});

// ============ INICIALIZACIÓN ============

if (!fs.existsSync(path.join(__dirname, "scripts"))) {
  fs.mkdirSync(path.join(__dirname, "scripts"));
}

app.listen(PORT, () => {
  console.log(`PaltidxR running on port ${PORT}`);
  console.log(`Domain: https://${DOMAIN}`);
  console.log(`API: https://${DOMAIN}/api/scripts`);
  console.log(`Protected URL: https://${DOMAIN}/files/v1/loaders/{scriptId}`);
  console.log(`Luarmor Protection: ACTIVE`);
  console.log(`Anti-Browser: ACTIVE`);
  console.log(`Fetch Protection: ACTIVE`);
});
