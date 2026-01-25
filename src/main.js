/**
 * Main Entry Point
 * 
 * Propósito: Inicializar la aplicación y exportar window.app
 * 
 * Este archivo orquesta todos los módulos y expone las funciones
 * necesarias a través de window.app para compatibilidad con onclick.
 */

// Core imports
import { initRouter, navigate, createSlug } from './core/router.js';
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
    sendMessage,
    deleteMessage,
    startReply,
    cancelReply
} from './views/forum.js';

import {
    openDetail,
    closeDetail,
    switchTab
} from './views/matchDetail.js';

import {
    initAuth,
    loginWithGoogle,
    logout,
    confirmLogout,
    cancelLogout,
    saveUsername,
    getCurrentUser,
    getCurrentUserProfile,
    getCurrentUserRole,
    showProfileModal,
    closeProfileModal,
    loginWithPhone,
    verifyPhoneCode,
    resendPhoneCode,
    initRecaptcha
} from './views/auth.js';

import {
    DEVELOPER_UID,
    openModerationPanel,
    closeModerationPanel,
    addModerator,
    removeModerator,
    handleAddModeratorForm
} from './views/moderation.js';

import {
    openSuggestionModal,
    closeSuggestionModal,
    sendSuggestion
} from './views/suggestions.js';

/**
 * Navega a la vista de partidos
 */
const navigateToMatches = () => {
    // PRIMERO: Forzar URL a '/' SIEMPRE
    window.history.pushState(null, '', '/');

    // SEGUNDO: Cambiar vistas
    document.getElementById('view-standings').classList.add('hidden');
    document.getElementById('view-forum').classList.add('hidden');
    document.getElementById('view-match-detail').classList.add('hidden');
    document.getElementById('view-match-list').classList.remove('hidden');
    document.getElementById('date-nav').classList.remove('hidden');
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('mobile-backdrop').classList.add('hidden');

    updateMobileNav('btn-nav-results');
};

/**
 * Handler para mostrar standings desde router (con params)
 */
const showStandingsById = (params) => {
    showStandings(params);
};

/**
 * Handler para mostrar standings desde router (con params y name)
 */
const showStandingsByIdAndName = (params) => {
    showStandings(params);
};

/**
 * Handler para abrir match detail desde router
 */
const openMatchDetail = (params) => {
    openDetail(params);
};

/**
 * Abre match detail con un tab específico sin modificar URL
 * @param {number} id - ID del partido
 * @param {string} tab - Tab a abrir
 */
const openDetailWithTab = (id, tab) => {
    // Navegar a la URL limpia sin tab
    navigate(`/partido/${id}`);
    // Abrir con el tab específico (lo maneja openDetail internamente)
    openDetail({ id, tab });
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
    ['btn-nav-results', 'btn-nav-live', 'btn-nav-leagues', 'btn-nav-forum'].forEach(id => {
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
 * Activa/desactiva el filtro de partidos en vivo desde mobile
 */
const toggleLiveFromMobile = () => {
    const toggle = document.getElementById('live-toggle');
    const liveBtn = document.getElementById('btn-nav-live');

    if (toggle) {
        toggle.checked = !toggle.checked;
        toggleLiveFilter();
    }

    // Actualizar estado visual del botón
    if (liveBtn) {
        if (toggle && toggle.checked) {
            liveBtn.classList.remove('text-gray-400');
            liveBtn.classList.add('text-red-500');
        } else {
            liveBtn.classList.remove('text-red-500');
            liveBtn.classList.add('text-gray-400');
        }
    }
};

// Phone Auth State
let currentPhoneNumber = '';
let resendTimer = null;
let resendCountdown = 40;

/**
 * Handler para iniciar login con teléfono
 */
const handlePhoneLogin = async () => {
    const countryCode = document.getElementById('phone-country-code').value;
    const phoneInput = document.getElementById('phone-number-input').value.replace(/\s/g, '');
    const errorDiv = document.getElementById('phone-login-error');

    // Validaciones
    if (!phoneInput) {
        errorDiv.textContent = 'Por favor ingresa tu número de teléfono';
        errorDiv.classList.remove('hidden');
        return;
    }

    currentPhoneNumber = countryCode + phoneInput;

    try {
        errorDiv.classList.add('hidden');

        // Enviar SMS
        await loginWithPhone(currentPhoneNumber);

        // Mostrar modal de verificación
        document.getElementById('phone-login-modal').classList.add('hidden');
        document.getElementById('phone-verification-modal').classList.remove('hidden');

        // Mostrar número en el modal
        document.getElementById('phone-display').textContent = currentPhoneNumber;

        // Iniciar timer de reenvío
        startResendTimer();

    } catch (error) {
        console.error('Error:', error);
        errorDiv.textContent = error.message || 'Error al enviar código. Intenta de nuevo.';
        errorDiv.classList.remove('hidden');
    }
};

/**
 * Handler para verificar código SMS
 */
const handleSMSVerification = async () => {
    const code = document.getElementById('sms-code-input').value;
    const errorDiv = document.getElementById('phone-verification-error');

    if (!code || code.length !== 6) {
        errorDiv.textContent = 'Por favor ingresa el código de 6 dígitos';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        errorDiv.classList.add('hidden');

        // Verificar código
        await verifyPhoneCode(code);

        // Cerrar modal y limpiar
        closePhoneVerification();

    } catch (error) {
        console.error('Error:', error);
        errorDiv.textContent = 'Código incorrecto. Intenta de nuevo.';
        errorDiv.classList.remove('hidden');
    }
};

/**
 * Handler para reenviar código SMS
 */
const handleResendSMS = async () => {
    const errorDiv = document.getElementById('phone-verification-error');

    try {
        errorDiv.classList.add('hidden');

        // Reenviar SMS
        await resendPhoneCode(currentPhoneNumber);

        // Reiniciar timer
        startResendTimer();

    } catch (error) {
        console.error('Error:', error);
        errorDiv.textContent = 'Error al reenviar código. Intenta de nuevo.';
        errorDiv.classList.remove('hidden');
    }
};

/**
 * Inicia el timer de reenvío (40 segundos)
 */
const startResendTimer = () => {
    const btn = document.getElementById('resend-sms-btn');
    const countdownEl = document.getElementById('resend-countdown');

    // Deshabilitar botón
    btn.disabled = true;
    btn.classList.add('text-gray-500');
    btn.classList.remove('text-white', 'hover:bg-[#111]');

    // Reset countdown
    resendCountdown = 40;
    countdownEl.textContent = resendCountdown;

    // Limpiar timer anterior si existe
    if (resendTimer) {
        clearInterval(resendTimer);
    }

    // Iniciar timer
    resendTimer = setInterval(() => {
        resendCountdown--;
        countdownEl.textContent = resendCountdown;

        if (resendCountdown <= 0) {
            clearInterval(resendTimer);
            resendTimer = null;

            // Habilitar botón
            btn.disabled = false;
            btn.classList.remove('text-gray-500');
            btn.classList.add('text-white', 'hover:bg-[#111]');
            document.getElementById('resend-text').innerHTML = 'Reenviar Código';
        }
    }, 1000);
};

/**
 * Cierra el modal de verificación y limpia estado
 */
const closePhoneVerification = () => {
    document.getElementById('phone-verification-modal').classList.add('hidden');
    document.getElementById('sms-code-input').value = '';
    document.getElementById('phone-number-input').value = '';
    currentPhoneNumber = '';

    // Limpiar timer
    if (resendTimer) {
        clearInterval(resendTimer);
        resendTimer = null;
    }

    // Reset resend button
    const btn = document.getElementById('resend-sms-btn');
    btn.disabled = true;
    document.getElementById('resend-countdown').textContent = '40';
    document.getElementById('resend-text').innerHTML = 'Reenviar en <span id="resend-countdown">40</span>s';
};

/**
 * Inicializa la aplicación
 */
const init = () => {
    // Inicializar autenticación
    initAuth();

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

    // Inicializar router con todos los handlers
    initRouter({
        navigateToMatches,
        navigateToForum,
        openMatchDetail,
        showStandingsById,
        showStandingsByIdAndName
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
    openDetailWithTab,  // Nueva función para abrir con tab específico
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
    deleteMessage,
    startReply,
    cancelReply,

    // Authentication
    loginWithGoogle,
    logout,
    confirmLogout,
    cancelLogout,
    saveUsername,
    getCurrentUser,
    getCurrentUserProfile,
    getCurrentUserRole,
    showProfileModal,
    closeProfileModal,

    // Phone Authentication
    initPhoneRecaptcha,
    handlePhoneLogin,
    handleSMSVerification,
    handleResendSMS,
    closePhoneVerification,

    // Moderation
    openModerationPanel,
    closeModerationPanel,
    addModerator,
    removeModerator,
    handleAddModeratorForm,

    // Suggestions
    openSuggestionModal,
    closeSuggestionModal,
    sendSuggestion,

    // Navigation
    navigateToMatches,
    openMobileTab,
    updateMobileNav,
    toggleLiveFromMobile,
    navigate,
    createSlug,

    // Init
    init
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/**
 * Inicializa el reCAPTCHA cuando se abre el modal de phone login
 */
const initPhoneRecaptcha = () => {
    setTimeout(() => {
        try {
            initRecaptcha();
            console.log('reCAPTCHA inicializado al abrir modal');
        } catch (error) {
            console.error('Error al inicializar reCAPTCHA:', error);
        }
    }, 500);
};
