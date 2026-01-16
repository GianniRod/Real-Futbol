/**
 * DOM Helpers
 * 
 * Propósito: Funciones auxiliares para manipulación de vistas
 * 
 * Exports:
 * - showOnly(viewId): Muestra solo la vista especificada
 * - hideAllViews(): Oculta todas las vistas principales
 * - showView(viewId): Muestra una vista específica
 * - hideView(viewId): Oculta una vista específica
 */

const VIEW_IDS = [
    'view-match-list',
    'view-forum',
    'view-standings',
    'view-match-detail'
];

/**
 * Oculta todas las vistas principales
 */
export const hideAllViews = () => {
    VIEW_IDS.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
        }
    });
};

/**
 * Muestra una vista específica
 * @param {string} viewId - ID del elemento a mostrar
 */
export const showView = (viewId) => {
    const element = document.getElementById(viewId);
    if (element) {
        element.classList.remove('hidden');
    }
};

/**
 * Oculta una vista específica
 * @param {string} viewId - ID del elemento a ocultar
 */
export const hideView = (viewId) => {
    const element = document.getElementById(viewId);
    if (element) {
        element.classList.add('hidden');
    }
};

/**
 * Muestra solo la vista indicada, ocultando el resto
 * @param {string} viewId - ID de la vista a mostrar
 */
export const showOnly = (viewId) => {
    hideAllViews();
    showView(viewId);
};
