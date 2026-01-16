/**
 * API Module
 * 
 * Propósito: Centralizar fetches con cache localStorage y TTL
 * 
 * Exports:
 * - fetchAPI(endpoint): Función principal para fetch con cache
 * - API_BASE: Base URL del proxy API
 */

export const API_BASE = "https://api-proxy.giannirodbol07.workers.dev/api";

const CACHE_TIME = 10 * 60 * 1000; // 10 minutos

/**
 * Fetch API con sistema de caché localStorage
 * @param {string} endpoint - Endpoint relativo (ej: /fixtures?date=2024-01-15)
 * @returns {Promise<Object>} - Datos de la API
 */
export const fetchAPI = async (endpoint) => {
    const cacheKey = "bw_v3_" + endpoint;
    const cached = localStorage.getItem(cacheKey);

    // Verificar si hay caché válido
    if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TIME) {
            return data;
        }
    }

    // Fetch desde API
    let res = await fetch(`${API_BASE}${endpoint}`);
    let data = await res.json();

    // Verificar errores de API
    if (data.errors && Object.keys(data.errors).length > 0) {
        console.error("API Error:", data.errors);
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
