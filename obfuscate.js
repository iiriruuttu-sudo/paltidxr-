// ============ OFUSCADOR BASE85+ ============
const zlib = require('zlib');

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

function obfuscateScript(scriptContent, scriptId) {
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
            originalSize: scriptContent.length,
            obfuscatedSize: obfuscated.length
        };
    } catch (error) {
        console.error('Error obfuscateScript:', error);
        return null;
    }
}

// Exportar para usar en server.js
module.exports = { obfuscateScript };
