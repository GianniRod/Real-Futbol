/**
 * Router Module - Advanced
 * 
 * Propósito: Manejar navegación con history API y parámetros dinámicos
 * 
 * Exports:
 * - initRouter(config): Inicializa el router con configuración de rutas
 * - navigate(path): Navega a una ruta específica
 * - handleRoute(pathname): Maneja el routing según pathname
 */

import { showOnly, showView, hideView } from './dom.js';

let routeConfig = null;

// Definición de rutas con patrones
const routes = [
    { pattern: '/', handler: 'navigateToMatches' },
    { pattern: '/foro', handler: 'navigateToForum' },
    { pattern: '/partido/:id', handler: 'openMatchDetail' },
    { pattern: '/partido/:id/:tab', handler: 'openMatchDetailWithTab' },
    { pattern: '/liga/:id', handler: 'showStandingsById' },
    { pattern: '/liga/:id/:name', handler: 'showStandingsByIdAndName' },
];

/**
 * Extrae parámetros de una URL según un patrón
 * @param {string} pattern - Patrón de ruta (ej: '/partido/:id')
 * @param {string} pathname - URL real (ej: '/partido/12345')
 * @returns {Object|null} - Objeto con parámetros o null si no coincide
 */
const extractParams = (pattern, pathname) => {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);

    // Si no tienen la misma cantidad de partes, no coincide
    if (patternParts.length !== pathParts.length) {
        return null;
    }

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const pathPart = pathParts[i];

        if (patternPart.startsWith(':')) {
            // Es un parámetro
            const paramName = patternPart.slice(1);
            params[paramName] = decodeURIComponent(pathPart);
        } else if (patternPart !== pathPart) {
            // No coincide
            return null;
        }
    }

    return params;
};

/**
 * Encuentra la ruta que coincide con el pathname
 * @param {string} pathname - URL a evaluar
 * @returns {Object|null} - { route, params } o null
 */
const matchRoute = (pathname) => {
    // Limpiar pathname
    const cleanPath = pathname === '' ? '/' : pathname;

    for (const route of routes) {
        const params = extractParams(route.pattern, cleanPath);
        if (params !== null) {
            return { route, params };
        }
    }

    return null;
};

/**
 * Crea un slug amigable para URLs
 * @param {string} text - Texto a convertir
 * @returns {string} - Slug
 */
export const createSlug = (text) => {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
        .replace(/[^a-z0-9]+/g, '-')      // Reemplazar no alfanuméricos con -
        .replace(/^-+|-+$/g, '');         // Eliminar - al inicio/fin
};

/**
 * Maneja el routing según el pathname y parámetros
 * @param {string} pathname - Ruta actual
 */
export const handleRoute = (pathname) => {
    if (!routeConfig) {
        console.error('Router not initialized');
        return;
    }

    const match = matchRoute(pathname);

    if (!match) {
        // Ruta no encontrada, ir a inicio
        console.warn('Route not found:', pathname);
        routeConfig.navigateToMatches();
        return;
    }

    const { route, params } = match;
    const handlerName = route.handler;
    const handler = routeConfig[handlerName];

    if (typeof handler === 'function') {
        handler(params);
    } else {
        console.error('Handler not found:', handlerName);
        routeConfig.navigateToMatches();
    }
};

/**
 * Navega a una ruta específica
 * @param {string} path - Ruta a navegar
 * @param {boolean} replace - Si es true, reemplaza en lugar de agregar al historial
 */
export const navigate = (path, replace = false) => {
    if (replace) {
        history.replaceState(null, '', path);
    } else {
        history.pushState(null, '', path);
    }
    handleRoute(path);
};

/**
 * Inicializa el router y listeners
 * @param {Object} config - Objeto con funciones handlers
 */
export const initRouter = (config) => {
    routeConfig = config;

    // Listener para botón back/forward del navegador
    window.addEventListener('popstate', () => {
        handleRoute(window.location.pathname);
    });

    // Manejar ruta inicial
    handleRoute(window.location.pathname);
};
