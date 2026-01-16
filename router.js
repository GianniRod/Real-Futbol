/**
 * Router Module
 * 
 * Propósito: Manejar navegación con history API
 * 
 * Exports:
 * - initRouter(): Inicializa el router y listeners
 * - navigate(path): Navega a una ruta específica
 * - handleRoute(pathname): Maneja el routing según pathname
 */

import { showOnly, showView, hideView } from './dom.js';

let routeHandlers = null;

/**
 * Maneja el routing según el pathname
 * @param {string} pathname - Ruta actual (ej: '/', '/foro', '/tabla')
 */
export const handleRoute = (pathname) => {
    // Limpiar pathname
    const path = pathname === '' ? '/' : pathname;

    if (!routeHandlers) {
        console.error('Route handlers not initialized');
        return;
    }

    // Ejecutar handler según ruta
    switch (path) {
        case '/':
        case '/index.html':
            routeHandlers.navigateToMatches();
            break;
        case '/foro':
            routeHandlers.navigateToForum();
            break;
        case '/tabla':
            // Solo mostrar tabla si hay una liga seleccionada
            showOnly('view-standings');
            hideView('date-nav');
            break;
        default:
            // Por defecto, mostrar matches
            routeHandlers.navigateToMatches();
    }
};

/**
 * Navega a una ruta específica
 * @param {string} path - Ruta a navegar
 */
export const navigate = (path) => {
    history.pushState(null, '', path);
    handleRoute(path);
};

/**
 * Inicializa el router y listeners
 * @param {Object} handlers - Objeto con funciones navigateToMatches y navigateToForum
 */
export const initRouter = (handlers) => {
    routeHandlers = handlers;

    // Listener para botón back/forward del navegador
    window.addEventListener('popstate', () => {
        handleRoute(window.location.pathname);
    });

    // Manejar ruta inicial
    handleRoute(window.location.pathname);
};
