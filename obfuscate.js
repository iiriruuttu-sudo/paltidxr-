const zlib = require('zlib');

const BASE16_CHARS = '0123456789ABCDEF';
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE85_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';
const BASE91_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
const BASE95_CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

function encodeBase16(data) { return data.toString('hex').toUpperCase(); }
function encodeBase64(data) { return Buffer.from(data).toString('base64'); }

function encodeBase32(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    let result = '', value = 0, bitLength = 0;
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

function encodeBase58(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    let result = '', value = 0n;
    for (let i = 0; i < bytes.length; i++) value = (value << 8n) | BigInt(bytes[i]);
    while (value > 0n) {
        const remainder = Number(value % 58n);
        result = BASE58_CHARS[remainder] + result;
        value = value / 58n;
    }
    return result || '1';
}

function encodeBase85(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = [];
    let value = 0, count = 0;
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
        for (let i = 0; i < padding; i++) value = (value << 8) | 0;
        count = 4;
        for (let j = 4; j >= 0; j--) {
            const remainder = value % 85;
            value = Math.floor(value / 85);
            result.push(BASE85_CHARS[remainder]);
        }
    }
    return result.join('');
}

function encodeBase91(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    let result = '', value = 0, bitLength = 0;
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

function encodeBase95(data) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = [];
    let value = 0, count = 0;
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
        for (let i = 0; i < padding; i++) value = (value << 8) | 0;
        count = 3;
        for (let j = 3; j >= 0; j--) {
            const remainder = value % 95;
            value = Math.floor(value / 95);
            result.push(BASE95_CHARS[remainder]);
        }
    }
    return result.join('');
}

function xorEncrypt(data, key) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = Buffer.alloc(bytes.length);
    const keyBytes = Buffer.from(key);
    for (let i = 0; i < bytes.length; i++) {
        result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return result;
}

function generateNumericKey() {
    const length = Math.floor(Math.random() * 20) + 10;
    const key = [];
    for (let i = 0; i < length; i++) key.push(Math.floor(Math.random() * 255) + 1);
    return key.join(',');
}

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

// ============ ANTI-SINTAXIS SOLO SÍMBOLOS DEL TECLADO ============
function antiSyntax(str) {
    // SOLO símbolos que están en el teclado y NO rompen sintaxis de Lua
    // Símbolos seguros: ! @ # $ % ^ & * ( ) - _ = + [ ] { } ; : ' " , . < > / ? ` ~
    const r = {
        'a':'!','b':'@','c':'#','d':'$','e':'%','f':'^','g':'&','h':'*','i':'(',')','j':')',
        'k':'-','l':'_','m':'=','n':'+','o':'[',']','p':']','q':'{','}','r':'}',
        's':';','t':':','u':"'",'v':'"','w':',','x':'.','y':'<','z':'>',
        'A':'!','B':'@','C':'#','D':'$','E':'%','F':'^','G':'&','H':'*','I':'(',')','J':')',
        'K':'-','L':'_','M':'=','N':'+','O':'[',']','P':']','Q':'{','}','R':'}',
        'S':';','T':':','U':"'",'V':'"','W':',','X':'.','Y':'<','Z':'>'
    };
    let result = str;
    for (const [k, v] of Object.entries(r)) {
        result = result.split(k).join(v);
    }
    return result;
}

function compressToOneLine(str) {
    return str.replace(/\s+/g, ' ').replace(/\n/g, '').trim();
}

function obfuscateScript(scriptContent, scriptId) {
    try {
        const numericKey = generateNumericKey();
        const numericVars = generateNumericVars();
        
        const compressed = zlib.deflateSync(scriptContent);
        const keyBuffer = Buffer.from(numericKey.split(',').map(Number));
        const xorData = xorEncrypt(compressed, keyBuffer);
        const base16 = encodeBase16(xorData);
        const base32 = encodeBase32(Buffer.from(base16));
        const base58 = encodeBase58(Buffer.from(base32));
        const base64 = encodeBase64(Buffer.from(base58));
        const base85 = encodeBase85(Buffer.from(base64));
        const base91 = encodeBase91(Buffer.from(base85));
        const base95 = encodeBase95(Buffer.from(base91));
        
        let obfuscated = '';
        for (let i = 0; i < base95.length; i++) {
            const char = base95[i];
            if (i % 2 === 0 && i > 0) obfuscated += Math.floor(Math.random() * 10);
            if (i % 3 === 0 && i > 2) obfuscated += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
            obfuscated += char;
            if (i % 5 === 0) obfuscated += Math.floor(Math.random() * 10);
            if (i % 7 === 0 && i > 5) obfuscated += '!@#$%^&*()_+'[Math.floor(Math.random() * 12)];
        }
        
        const varDeclarations = Object.entries(numericVars).map(([name, value]) => `local ${name}=${value}`).join(' ');
        
        let loader = `--[[PaltidxR Protected v8.0]]-- --[[Script ID:${scriptId}]]-- ${varDeclarations} local B16="0123456789ABCDEF" local B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" local B58="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz" local B64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" local B85="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_\`{|}~" local B91="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_\`{|}~\"" local B95=' !"#$%&\\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_\`abcdefghijklmnopqrstuvwxyz{|}~' local function d16(s) local b={} for i=1,#s,2 do local h=tonumber(s:sub(i,i),16) local l=tonumber(s:sub(i+1,i+1),16) if h and l then b[#b+1]=h*16+l end end local r="" for i=1,#b do r=r..string.char(b[i]) end return r end local function d32(s) local b={} local v=0 local bl=0 for i=1,#s do local c=s:sub(i,i) local idx=B32:find(c,1,true) if idx then v=(v<<5)|(idx-1) bl=bl+5 while bl>=8 do bl=bl-8 b[#b+1]=(v>>bl)&0xFF v=v&((1<<bl)-1) end end end return b end local function d58(s) local v=0 for i=1,#s do local c=s:sub(i,i) local idx=B58:find(c,1,true) if idx then v=v*58+(idx-1) end end local b={} while v>0 do b[#b+1]=v&0xFF v=v>>8 end local r="" for i=#b,1,-1 do r=r..string.char(b[i]) end return r end local function d64(s) local r="" local b=B64 s=s:gsub('=+$','') for i=1,#s,4 do local a=0 local n=0 for j=0,3 do local c=s:sub(i+j,i+j) if c~='' then local idx=b:find(c,1,true) if idx then a=a*64+(idx-1) n=n+1 end end end for j=1,n do local sh=(4-j)*6 r=r..string.char((a>>sh)&0xFF) end end return r end local function d85(s) local b={} local v=0 local c=0 for i=1,#s do local ch=s:sub(i,i) local idx=B85:find(ch,1,true) if idx then v=v*85+(idx-1) c=c+1 if c==5 then for j=3,0,-1 do b[#b+1]=(v>>(8*j))&0xFF end v=0 c=0 end end end return b end local function d91(s) local b={} local v=0 local bl=0 for i=1,#s do local c=s:sub(i,i) local idx=B91:find(c,1,true) if idx then v=(v*91)+(idx-1) bl=bl+1 if bl==2 then for j=1,0,-1 do b[#b+1]=(v>>(8*j))&0xFF end v=0 bl=0 end end end return b end local function d95(s) local b={} local v=0 local c=0 for i=1,#s do local ch=s:sub(i,i) local idx=B95:find(ch,1,true) if idx then v=v*95+(idx-1) c=c+1 if c==4 then for j=2,0,-1 do b[#b+1]=(v>>(8*j))&0xFF end v=0 c=0 end end end return b end local function clean(s) local r="" for i=1,#s do local c=s:sub(i,i) if B95:find(c,1,true) then r=r..c end end return r end local function bts(b) local r="" for i=1,#b do r=r..string.char(b[i]) end return r end local function xd(d,k) local b={} local kl=#k for i=1,#d do local kc=k:sub(((i-1)%kl)+1,((i-1)%kl)+1) b[i]=string.byte(d:sub(i,i))~string.byte(kc) end local r="" for i=1,#b do r=r..string.char(b[i]) end return r end local enc="${obfuscated}" local key="${numericKey}" local cl=clean(enc) local b95=d95(cl) local b91s=bts(b95) local b91b=d91(b91s) local b85s=bts(b91b) local b85b=d85(b85s) local b64s=bts(b85b) local b58d=d64(b64s) local b58s=bts(b58d) local b32d=d58(b58s) local b32s=bts(b32d) local b16d=d32(b32s) local b16s=bts(b16d) local xord=d16(b16s) local kb={} for n in string.gmatch(key,"%d+") do kb[#kb+1]=tonumber(n) end local ks="" for i=1,#kb do ks=ks..string.char(kb[i]) end local comp=xd(xord,ks) local suc,err=pcall(function() local f=loadstring(comp) if f then f() else error("Error") end end) if not suc then warn("Error: "..tostring(err)) end`;
        
        loader = antiSyntax(loader);
        loader = compressToOneLine(loader);
        
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
