# custom_antitamper.py
# ============================================
# ⚠️ PON AQUÍ TU CÓDIGO ANTI-TAMPER PERSONALIZADO
# ============================================

CUSTOM_ANTI_TAMPER = """
-- ===== ANTI-TAMPER PERSONALIZADO =====
-- Este código se inyectará ofuscado y oculto
local function check_integrity()
    local f = debug.getinfo(1, "S").source
    if not f or string.sub(f, 1, 1) ~= "@" then
        print("⚠️ Entorno inválido")
        os.exit(1)
    end
    
    -- Verifica integridad del archivo
    local file = io.open(f:sub(2), "rb")
    if file then
        local content = file:read("*all")
        file:close()
        local hash = 0
        for i = 1, #content do
            hash = (hash + string.byte(content, i)) % 65536
        end
        if hash ~= 48372 then
            print("🔒 Archivo modificado!")
            os.exit(1)
        end
    end
    
    -- Anti-debug
    if debug.getinfo(4) then
        print("🐛 Debugger detectado!")
        os.exit(1)
    end
end

-- Ejecuta protección
check_integrity()
-- ======================================
"""
