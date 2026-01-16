/**
 * Main Entry Point
 * 
 * Propósito: Inicializar la aplicación y exportar window.app
 * 
 * Este archivo orquesta todos los módulos y expone las funciones
 * necesarias a través de window.app para compatibilidad con onclick.
 */

// Core imports
import { initRouter, navigate } from './core/router.js';
import { showOnly, hideView } from './core/dom.js';

// View imports
import {
    initMatches,
    loadMatches,
    renderMatches,
    changeDate,
    resetDate,
    renderCalendar,
    toggleLiveFilter,
    loadMessageCounts
} from './views/matches.js';

import {
    showStandings,
    changeSeason,
    renderTable
} from './views/standings.js';

import {
    navigateToForum,
    initForum,
    sendMessage
} from './views/forum.js';

import {
    openDetail,
    closeDetail,
    switchTab
} from './views/matchDetail.js';

/**
 * Navega a la vista de partidos
 */
const navigateToMatches = () => {
    document.getElementById('view-standings').classList.add('hidden');
    document.getElementById('view-forum').classList.add('hidden');
    document.getElementById('view-match-list').classList.remove('hidden');
    document.getElementById('date-nav').classList.remove('hidden');
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('mobile-backdrop').classList.add('hidden');

    updateMobileNav('btn-nav-results');
};

/**
 * Abre/cierra el sidebar mobile
 * @param {string} tabName - Nombre del tab ('leagues', 'results', etc)
 */
const openMobileTab = (tabName) => {
    const sidebar = document.getElementById('sidebar');
    if (tabName === 'leagues') {
        sidebar.classList.remove('-translate-x-full');
        document.getElementById('mobile-backdrop').classList.remove('hidden');
        updateMobileNav('btn-nav-leagues');
    } else {
        sidebar.classList.add('-translate-x-full');
        document.getElementById('mobile-backdrop').classList.add('hidden');
    }
};

/**
 * Actualiza el estado visual de la navegación mobile
 * @param {string} activeId - ID del botón activo
 */
const updateMobileNav = (activeId) => {
    ['btn-nav-results', 'btn-nav-leagues', 'btn-nav-forum'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (id === activeId) {
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-white');
        } else {
            btn.classList.add('text-gray-400');
            btn.classList.remove('text-white');
        }
    });
};

/**
 * Inicializa la aplicación
 */
const init = () => {
    // Inicializar matches (carga calendario y partidos)
    initMatches();

    // Setup del sidebar mobile
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-backdrop');

    const closeMenu = () => {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
    };

    if (backdrop) {
        backdrop.onclick = closeMenu;
    }

    // Setup del toggle de live
    const liveToggle = document.getElementById('live-toggle');
    if (liveToggle) {
        liveToggle.onchange = toggleLiveFilter;
    }

    // Inicializar router
    initRouter({
        navigateToMatches,
        navigateToForum
    });
};

// Exportar todo a window.app para compatibilidad con onclick
window.app = {
    // Matches
    loadMatches,
    renderMatches,
    changeDate,
    resetDate,
    renderCalendar,
    toggleLiveFilter,
    loadMessageCounts,

    // Match Detail
    openDetail,
    closeDetail,
    switchTab,

    // Standings
    showStandings,
    changeSeason,
    renderTable,

    // Forum
    navigateToForum,
    initForum,
    sendMessage,

    // Navigation
    navigateToMatches,
    openMobileTab,
    updateMobileNav,
    navigate,

    // Init
    init
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
