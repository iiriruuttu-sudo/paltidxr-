const zlib = require('zlib');
const crypto = require('crypto');

// ============ BASE16 (HEX) ============
const BASE16_CHARS = '0123456789ABCDEF';

function encodeBase16(data) {
    return data.toString('hex').toUpperCase();
}

// ============ BASE32 ============
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    let result = '';
    let value = 0;
    let bitLength = 0;
    
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bitLength += 8;
        
        while (bitLength >= 5) {
            const index = (value >> (bitLength - 5)) & 31;
            result += BASE32_CHARS[index];
            bitLength -= 5;
            value &= (1 << bitLength) - 1;
        }
    }
    
    if (bitLength > 0) {
        const index = (value << (5 - bitLength)) & 31;
        result += BASE32_CHARS[index];
    }
    
    return result;
}

// ============ BASE64 ============
function encodeBase64(data) {
    return Buffer.from(data).toString('base64');
}

// ============ BASE85 ============
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

// ============ BASE91 ============
const BASE91_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';

function encodeBase91(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    let result = '';
    let value = 0;
    let bitLength = 0;
    
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bitLength += 8;
        
        while (bitLength >= 14) {
            const index = (value >> (bitLength - 14)) & 16383;
            bitLength -= 14;
            value &= (1 << bitLength) - 1;
            
            const high = Math.floor(index / 91);
            const low = index % 91;
            result += BASE91_CHARS[high] + BASE91_CHARS[low];
        }
    }
    
    if (bitLength > 0) {
        const index = (value << (14 - bitLength)) & 16383;
        const high = Math.floor(index / 91);
        const low = index % 91;
        result += BASE91_CHARS[high] + BASE91_CHARS[low];
    }
    
    return result;
}

// ============ BASE95 ============
const BASE95_CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

function encodeBase95(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = [];
    let value = 0;
    let count = 0;
    
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        count++;
        
        if (count === 3) {
            for (let j = 3; j >= 0; j--) {
                const remainder = value % 95;
                value = Math.floor(value / 95);
                result.push(BASE95_CHARS[remainder]);
            }
            value = 0;
            count = 0;
        }
    }
    
    if (count > 0) {
        const padding = 3 - count;
        for (let i = 0; i < padding; i++) {
            value = (value << 8) | 0;
        }
        count = 3;
        
        for (let j = 3; j >= 0; j--) {
            const remainder = value % 95;
            value = Math.floor(value / 95);
            result.push(BASE95_CHARS[remainder]);
        }
    }
    
    return result.join('');
}

// ============ BASE58 ============
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    let result = '';
    let value = 0n;
    
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8n) | BigInt(bytes[i]);
    }
    
    while (value > 0n) {
        const remainder = Number(value % 58n);
        result = BASE58_CHARS[remainder] + result;
        value = value / 58n;
    }
    
    return result;
}

// ============ XOR CON VARIABLES NUMÉRICAS ============
function xorEncrypt(data, key) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = Buffer.alloc(bytes.length);
    const keyBytes = Buffer.from(key);
    
    for (let i = 0; i < bytes.length; i++) {
        result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return result;
}

// ============ GENERAR CLAVE NUMÉRICA ============
function generateNumericKey() {
    const length = Math.floor(Math.random() * 20) + 10;
    const key = [];
    for (let i = 0; i < length; i++) {
        key.push(Math.floor(Math.random() * 255) + 1);
    }
    return key.join(',');
}

// ============ GENERAR VARIABLES NUMÉRICAS ALEATORIAS ============
function generateNumericVars() {
    const vars = {};
    const numVars = Math.floor(Math.random() * 30) + 20;
    for (let i = 0; i < numVars; i++) {
        const name = Math.floor(Math.random() * 999999) + 1;
        const value = Math.floor(Math.random() * 999999) + 1;
        vars[name] = value;
    }
    return vars;
}

// ============ ANTI-SINTAXIS (Caracteres confusos) ============
function antiSyntax(str) {
    const replacements = {
        'a': 'α', 'b': 'β', 'c': '¢', 'd': '∂', 'e': 'ε',
        'f': 'ƒ', 'g': 'g', 'h': 'ℎ', 'i': 'ι', 'j': 'ϳ',
        'k': 'κ', 'l': 'ℓ', 'm': 'м', 'n': 'η', 'o': 'σ',
        'p': 'ρ', 'q': 'q', 'r': 'я', 's': 'ѕ', 't': 'τ',
        'u': 'υ', 'v': 'ν', 'w': 'ω', 'x': 'χ', 'y': 'ψ',
        'z': 'ζ', 'A': 'Α', 'B': 'Β', 'C': 'Ϲ', 'D': 'Δ',
        'E': 'Ε', 'F': 'Ϝ', 'G': 'G', 'H': 'Η', 'I': 'Ι',
        'J': 'J', 'K': 'Κ', 'L': 'Λ', 'M': 'Μ', 'N': 'Ν',
        'O': 'Ο', 'P': 'Π', 'Q': 'Q', 'R': 'Ρ', 'S': 'Σ',
        'T': 'Τ', 'U': 'Υ', 'V': 'V', 'W': 'Ω', 'X': 'Χ',
        'Y': 'Ψ', 'Z': 'Ζ',
        '=': '≡', '+': '⊕', '-': '⊖', '*': '⊗', '/': '⊘',
        '(': '⎛', ')': '⎞', '[': '⎡', ']': '⎦', '{': '⎧', '}': '⎫',
        '<': '⟨', '>': '⟩', '|': '⎪', '&': '⅋', '%': '‰'
    };
    
    let result = str;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.split(key).join(value);
    }
    return result;
}

// ============ COMPRIMIR EN UNA LÍNEA ============
function compressToOneLine(str) {
    return str.replace(/\s+/g, ' ').replace(/\n/g, '').trim();
}

// ============ OFUSCADOR COMPLETO ============
function obfuscateScript(scriptContent, scriptId) {
    try {
        const numericKey = generateNumericKey();
        const numericVars = generateNumericVars();
        
        console.log(`[Obfuscator] ========================================`);
        console.log(`[Obfuscator] Ofuscando: ${scriptId}`);
        console.log(`[Obfuscator] Tamaño original: ${scriptContent.length} bytes`);
        console.log(`[Obfuscator] Clave XOR: ${numericKey}`);
        console.log(`[Obfuscator] Variables numéricas: ${Object.keys(numericVars).length}`);
        console.log(`[Obfuscator] ========================================`);
        
        // ============ CAPA 1: COMPRIMIR ============
        const compressed = zlib.deflateSync(scriptContent);
        console.log(`[Obfuscator] Capa 1 - Comprimido: ${compressed.length} bytes`);
        
        // ============ CAPA 2: XOR CON VARIABLES NUMÉRICAS ============
        const keyBuffer = Buffer.from(numericKey.split(',').map(Number));
        const xorData = xorEncrypt(compressed, keyBuffer);
        console.log(`[Obfuscator] Capa 2 - XOR: ${xorData.length} bytes`);
        
        // ============ CAPA 3: BASE16 (HEX) ============
        const base16 = encodeBase16(xorData);
        console.log(`[Obfuscator] Capa 3 - Base16: ${base16.length} chars`);
        
        // ============ CAPA 4: BASE32 ============
        const base32 = encodeBase32(Buffer.from(base16));
        console.log(`[Obfuscator] Capa 4 - Base32: ${base32.length} chars`);
        
        // ============ CAPA 5: BASE58 ============
        const base58 = encodeBase58(Buffer.from(base32));
        console.log(`[Obfuscator] Capa 5 - Base58: ${base58.length} chars`);
        
        // ============ CAPA 6: BASE64 ============
        const base64 = encodeBase64(Buffer.from(base58));
        console.log(`[Obfuscator] Capa 6 - Base64: ${base64.length} chars`);
        
        // ============ CAPA 7: BASE85 ============
        const base85 = encodeBase85(Buffer.from(base64));
        console.log(`[Obfuscator] Capa 7 - Base85: ${base85.length} chars`);
        
        // ============ CAPA 8: BASE91 ============
        const base91 = encodeBase91(Buffer.from(base85));
        console.log(`[Obfuscator] Capa 8 - Base91: ${base91.length} chars`);
        
        // ============ CAPA 9: BASE95 ============
        const base95 = encodeBase95(Buffer.from(base91));
        console.log(`[Obfuscator] Capa 9 - Base95: ${base95.length} chars`);
        
        // ============ OFUSCAR CON CARACTERES ALEATORIOS ============
        let obfuscated = '';
        for (let i = 0; i < base95.length; i++) {
            const char = base95[i];
            if (i % 2 === 0 && i > 0) {
                obfuscated += Math.floor(Math.random() * 10);
            }
            if (i % 3 === 0 && i > 2) {
                obfuscated += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
            }
            obfuscated += char;
            if (i % 5 === 0) {
                obfuscated += Math.floor(Math.random() * 10);
            }
            if (i % 7 === 0 && i > 5) {
                obfuscated += '!@#$%^&*()_+'[Math.floor(Math.random() * 12)];
            }
        }
        console.log(`[Obfuscator] Ofuscado final: ${obfuscated.length} chars`);
        
        // ============ GENERAR VARIABLES NUMÉRICAS ============
        const varDeclarations = Object.entries(numericVars).map(([name, value]) => 
            `local ${name}=${value}`
        ).join(' ');
        
        // ============ GENERAR LOADER (TODO EN UNA LÍNEA) ============
        let loader = `--[[PaltidxR Protected v8.0]]-- --[[Script ID:${scriptId}]]-- --[[9 CAPAS: ZLIB→XOR→Base16→Base32→Base58→Base64→Base85→Base91→Base95]]-- ${varDeclarations} local B16="0123456789ABCDEF" local B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" local B58="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz" local B64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" local B85="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_\`{|}~" local B91="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_\`{|}~\"" local B95=' !"#$%&\\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_\`abcdefghijklmnopqrstuvwxyz{|}~' local function d16(s) local b={} for i=1,#s,2 do local h=tonumber(s:sub(i,i),16) local l=tonumber(s:sub(i+1,i+1),16) if h and l then b[#b+1]=h*16+l end end local r="" for i=1,#b do r=r..string.char(b[i]) end return r end local function d32(s) local b={} local v=0 local bl=0 for i=1,#s do local c=s:sub(i,i) local idx=B32:find(c,1,true) if idx then v=(v<<5)|(idx-1) bl=bl+5 while bl>=8 do bl=bl-8 b[#b+1]=(v>>bl)&0xFF v=v&((1<<bl)-1) end end end return b end local function d58(s) local v=0 for i=1,#s do local c=s:sub(i,i) local idx=B58:find(c,1,true) if idx then v=v*58+(idx-1) end end local b={} while v>0 do b[#b+1]=v&0xFF v=v>>8 end local r="" for i=#b,1,-1 do r=r..string.char(b[i]) end return r end local function d64(s) local r="" local b=B64 s=s:gsub('=+$','') for i=1,#s,4 do local a=0 local n=0 for j=0,3 do local c=s:sub(i+j,i+j) if c~='' then local idx=b:find(c,1,true) if idx then a=a*64+(idx-1) n=n+1 end end end for j=1,n do local sh=(4-j)*6 r=r..string.char((a>>sh)&0xFF) end end return r end local function d85(s) local b={} local v=0 local c=0 for i=1,#s do local ch=s:sub(i,i) local idx=B85:find(ch,1,true) if idx then v=v*85+(idx-1) c=c+1 if c==5 then for j=3,0,-1 do b[#b+1]=(v>>(8*j))&0xFF end v=0 c=0 end end end return b end local function d91(s) local b={} local v=0 local bl=0 for i=1,#s do local c=s:sub(i,i) local idx=B91:find(c,1,true) if idx then v=(v*91)+(idx-1) bl=bl+1 if bl==2 then for j=1,0,-1 do b[#b+1]=(v>>(8*j))&0xFF end v=0 bl=0 end end end return b end local function d95(s) local b={} local v=0 local c=0 for i=1,#s do local ch=s:sub(i,i) local idx=B95:find(ch,1,true) if idx then v=v*95+(idx-1) c=c+1 if c==4 then for j=2,0,-1 do b[#b+1]=(v>>(8*j))&0xFF end v=0 c=0 end end end return b end local function clean(s) local r="" for i=1,#s do local c=s:sub(i,i) if B95:find(c,1,true) then r=r..c end end return r end local function bts(b) local r="" for i=1,#b do r=r..string.char(b[i]) end return r end local function xd(d,k) local b={} local kl=#k for i=1,#d do local kc=k:sub(((i-1)%kl)+1,((i-1)%kl)+1) b[i]=string.byte(d:sub(i,i))~string.byte(kc) end local r="" for i=1,#b do r=r..string.char(b[i]) end return r end local enc="${obfuscated}" local key="${numericKey}" local cl=clean(enc) local b95=d95(cl) local b91s=bts(b95) local b91b=d91(b91s) local b85s=bts(b91b) local b85b=d85(b85s) local b64s=bts(b85b) local b58d=d64(b64s) local b58s=bts(b58d) local b32d=d58(b58s) local b32s=bts(b32d) local b16d=d32(b32s) local b16s=bts(b16d) local xord=d16(b16s) local kb={} for n in string.gmatch(key,"%d+") do kb[#kb+1]=tonumber(n) end local ks="" for i=1,#kb do ks=ks..string.char(kb[i]) end local comp=xd(xord,ks) local suc,err=pcall(function() local f=loadstring(comp) if f then f() else error("Error") end end) if not suc then warn("Error: "..tostring(err)) end`;
        
        // ============ APLICAR ANTI-SINTAXIS ============
        loader = antiSyntax(loader);
        console.log(`[Obfuscator] Anti-sintaxis aplicado`);
        
        // ============ COMPRIMIR EN UNA LÍNEA ============
        loader = compressToOneLine(loader);
        console.log(`[Obfuscator] Comprimido en 1 línea: ${loader.length} bytes`);
        
        console.log(`[Obfuscator] ========================================`);
        console.log(`[Obfuscator] ✅ Ofuscación completada!`);
        console.log(`[Obfuscator] Capas: ZLIB→XOR→Base16→Base32→Base58→Base64→Base85→Base91→Base95`);
        console.log(`[Obfuscator] ========================================`);
        
        return {
            obfuscatedData: obfuscated,
            loaderCode: loader,
            numericKey: numericKey,
            numericVars: numericVars,
            originalSize: scriptContent.length,
            compressedSize: compressed.length,
            obfuscatedSize: obfuscated.length,
            finalSize: loader.length,
            layers: ['ZLIB', 'XOR', 'Base16', 'Base32', 'Base58', 'Base64', 'Base85', 'Base91', 'Base95']
        };
    } catch (error) {
        console.error('[Obfuscator] Error:', error);
        return null;
    }
}

module.exports = { obfuscateScript };
