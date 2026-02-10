/**
 * API Module
 * 
 * Propósito: Centralizar fetches con cache localStorage y TTL inteligente
 * 
 * Exports:
 * - fetchAPI(endpoint): Función principal para fetch con cache
 * - API_BASE: Base URL del proxy API
 */

export const API_BASE = "https://api-proxy.giannirodbol07.workers.dev/api";

/**
 * Determina el TTL de cache según el tipo de endpoint
 * @param {string} endpoint - Endpoint de la API
 * @returns {number} TTL en milisegundos
 */
const getCacheTTL = (endpoint) => {
    // Standings casi no cambian → 30 min
    if (endpoint.includes('/standings')) return 30 * 60 * 1000;
    // Detalle de un partido específico → 5 min
    if (endpoint.includes('/fixtures?id=')) return 5 * 60 * 1000;
    // Listado de partidos del día → 2 min
    if (endpoint.includes('/fixtures?date=')) return 2 * 60 * 1000;
    // Default → 2 min
    return 2 * 60 * 1000;
};

/**
 * Fetch API con sistema de caché localStorage e TTL inteligente
 * @param {string} endpoint - Endpoint relativo (ej: /fixtures?date=2024-01-15)
 * @param {boolean} force - Si es true, ignora la caché y fuerza nueva petición
 * @returns {Promise<Object>} - Datos de la API
 */
export const fetchAPI = async (endpoint, force = false) => {
    const cacheKey = "bw_v3_" + endpoint;
    const cached = localStorage.getItem(cacheKey);

    // Verificar si hay caché válido
    if (cached && !force) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < getCacheTTL(endpoint)) {
            return data;
        }
    }

    // Fetch desde API
    let res = await fetch(`${API_BASE}${endpoint}`);
    let data = await res.json();

    // Verificar errores de API
    if (data.errors && Object.keys(data.errors).length > 0) {
        console.error("API Error:", data.errors);

        // Si falló y tenemos caché (aunque vieja), usarla como fallback
        if (cached) {
            console.warn("Usando caché fallback por error de API");
            return JSON.parse(cached).data;
        }

        throw new Error("API Limit Reached");
    }

    // Guardar en cache
    try {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
        console.warn("Storage full, clearing old cache...");
        try {
            // Limpiar cache antiguo
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('bw_v3_')) {
                    localStorage.removeItem(key);
                }
            });
            // Reintentar guardar
            localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
        } catch (retryErr) {
            console.error("No se pudo liberar espacio, continuando sin caché.", retryErr);
        }
    }

    return data;
};
