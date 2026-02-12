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
    loadMessageCounts,
    toggleCalendar,
    changeMonth
} from './views/matches.js';

import {
    showStandings,
    changeSeason,
    renderTable,
    changeRound,
    toggleSidebarInLeague
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
    goToTeamSelection,
    goBackToUsername,
    filterTeams,
    selectTeam,
    loginWithPhone,
    verifyPhoneCode,
    resendPhoneCode,
    initRecaptcha,
    startPhoneLinking,
    confirmPhoneLinking,
    hasLinkedPhone,
    getAuthProvider,
    getLinkedPhone,
    openRankingModal,
    closeRankingModal,
    enterDemoMode,
    exitDemoMode,
    isInDemoMode
} from './views/auth.js';

import {
    DEVELOPER_UID,
    openModerationPanel,
    closeModerationPanel,
    addModerator,
    removeModerator,
    handleAddModeratorForm,
    addFirstUser,
    removeFirstUser,
    handleAddFirstUserForm,
    loadFirstUsers,
    muteUser,
    unmuteUser,
    banUser,
    unbanUser,
    handleMuteForm,
    handleBanForm,
    loadMutedUsers,
    loadBannedUsers,
    openModPanel,
    closeModPanel,
    handleModMuteForm,
    handleModBanForm,
    loadDemoUsers,
    deleteDemoUser,
    handleCreateDemoUserForm,
    populateDemoTeamSelect
} from './views/moderation.js';

import {
    openSuggestionModal,
    closeSuggestionModal,
    sendSuggestion
} from './views/suggestions.js';

import {
    setFeaturedMatch,
    clearFeaturedMatch,
    loadFeaturedMatch,
    loadFeaturedMatchPicker,
    getFeaturedMatchId
} from './views/featured_match.js';

import {
    showTeamProfile
} from './views/teamProfile.js';

/**
 * Navega a la vista de partidos
 */
const navigateToMatches = () => {
    // Si no estamos en la ruta raíz, navegar allí
    if (window.location.pathname !== '/') {
        navigate('/');
        return;
    }

    // Cambiar vistas
    document.getElementById('view-standings').classList.add('hidden');
    document.getElementById('view-forum').classList.add('hidden');
    document.getElementById('view-match-detail').classList.add('hidden');
    const viewTeam = document.getElementById('view-team');
    if (viewTeam) viewTeam.classList.add('hidden');
    document.getElementById('view-match-list').classList.remove('hidden');
    document.getElementById('date-nav').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden'); // Restore if it was hidden by league view
    document.getElementById('sidebar').classList.add('-translate-x-full'); // Default mobile state
    // Restore right sidebar responsive state (hidden mobile, flex desktop)
    const rightSidebar = document.getElementById('right-sidebar');
    rightSidebar.classList.add('hidden', 'lg:flex');
    rightSidebar.classList.remove('lg:hidden'); // Ensure it's not hidden on desktop
    document.querySelector('main').classList.add('lg:w-auto'); // Restore main width constraint
    document.getElementById('mobile-backdrop').classList.add('hidden');

    // Desactivar filtro EN VIVO si estaba activo
    const toggle = document.getElementById('live-toggle');
    if (toggle && toggle.checked) {
        toggle.checked = false;
        toggleLiveFilter();
    }

    // Resetear color del botón EN VIVO a gris
    const liveBtn = document.getElementById('btn-nav-live');
    if (liveBtn) {
        liveBtn.classList.remove('text-red-500');
        liveBtn.classList.add('text-gray-400');
    }

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
 * Handler para mostrar perfil de equipo desde router
 */
const showTeamProfileHandler = (params) => {
    showTeamProfile(params);
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
 * Selecciona un partido como destacado desde el panel de moderación
 * @param {number} fixtureId - ID del partido
 */
const selectFeaturedMatch = async (fixtureId) => {
    console.log('selectFeaturedMatch called with:', fixtureId);
    try {
        const { getMatches } = await import('./views/matches.js');
        const matches = getMatches();
        console.log('Total matches available:', matches.length);
        const match = matches.find(m => m.fixture.id === fixtureId);
        if (match) {
            console.log('Match found:', match.teams.home.name, 'vs', match.teams.away.name);
            await setFeaturedMatch(fixtureId, match);
        } else {
            console.error('Match not found for fixtureId:', fixtureId);
            alert('No se encontró el partido con ID: ' + fixtureId);
        }
    } catch (error) {
        console.error('Error in selectFeaturedMatch:', error);
        alert('Error: ' + error.message);
    }
};

/**
 * Navega al foro global (Wrapper para manejar estado de navegación)
 */
const navigateToForumWrapper = () => {
    // Si no estamos en la ruta del foro, navegar allí
    if (window.location.pathname !== '/foro') {
        navigate('/foro');
        return;
    }

    // Desactivar filtro EN VIVO si estaba activo
    const toggle = document.getElementById('live-toggle');
    if (toggle && toggle.checked) {
        toggle.checked = false;
        toggleLiveFilter();
    }

    // Renderizar foro
    navigateToForum();

    // Restaurar layout (si venimos de League View)
    document.getElementById('sidebar').classList.remove('hidden');
    const rightSidebar = document.getElementById('right-sidebar');
    rightSidebar.classList.add('hidden', 'lg:flex');
    rightSidebar.classList.remove('lg:hidden');
    document.querySelector('main').classList.add('lg:w-auto');

    // Asegurar estado visual de los botones
    updateMobileNav('btn-nav-forum');
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

        // Desactivar filtro EN VIVO si estaba activo
        const toggle = document.getElementById('live-toggle');
        if (toggle && toggle.checked) {
            toggle.checked = false;
            toggleLiveFilter();
        }

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

        // Reset completo de clases
        btn.classList.remove('text-white', 'text-red-500');
        btn.classList.add('text-gray-400');

        if (id === activeId) {
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-white');
        }
    });
};

/**
 * Activa/desactiva el filtro de partidos en vivo desde mobile
 */
const toggleLiveFromMobile = () => {
    const toggle = document.getElementById('live-toggle');
    const liveBtn = document.getElementById('btn-nav-live');

    // Cerrar sidebar si está abierto
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
        document.getElementById('mobile-backdrop').classList.add('hidden');
    }

    // Si estamos en otra vista (Foro, etc), volver a matches
    if (!document.getElementById('view-match-list').classList.contains('hidden') === false) {
        // Estamos en otra vista, navegar a matches primero
        navigateToMatches();
        // navigateToMatches resetea el toggle, así que lo activamos después
    }

    // Si ya está activo EN VIVO, no hacer nada (o podríamos togglear off?)
    // Como es un tab, clickearlo debería mantenerlo activo.
    if (toggle && toggle.checked) {
        return;
    }

    if (toggle) {
        toggle.checked = true;
        toggleLiveFilter();
    }

    // Apagar todos los botones de navegación
    ['btn-nav-results', 'btn-nav-live', 'btn-nav-leagues', 'btn-nav-forum'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.add('text-gray-400');
        btn.classList.remove('text-white', 'text-red-500');
    });

    // Activar solo el botón EN VIVO en rojo
    if (liveBtn) {
        liveBtn.classList.remove('text-gray-400');
        liveBtn.classList.add('text-red-500');
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

// Phone Linking State
let linkingPhoneNumber = '';

/**
 * Abre el modal de vinculación de teléfono
 */
const openPhoneLinkingModal = () => {
    document.getElementById('profile-modal').classList.add('hidden');
    document.getElementById('phone-linking-modal').classList.remove('hidden');
    document.getElementById('link-phone-error').classList.add('hidden');
    document.getElementById('link-phone-number-input').value = '';
};

/**
 * Cierra el modal de vinculación de teléfono
 */
const closePhoneLinkingModal = () => {
    document.getElementById('phone-linking-modal').classList.add('hidden');
    document.getElementById('link-phone-number-input').value = '';
    linkingPhoneNumber = '';
};

/**
 * Handler para iniciar vinculación de teléfono
 */
const handlePhoneLinking = async () => {
    const countryCode = document.getElementById('link-phone-country-code').value;
    const phoneInput = document.getElementById('link-phone-number-input').value.replace(/\s/g, '');
    const errorDiv = document.getElementById('link-phone-error');

    // Validaciones
    if (!phoneInput) {
        errorDiv.textContent = 'Por favor ingresa tu número de teléfono';
        errorDiv.classList.remove('hidden');
        return;
    }

    linkingPhoneNumber = countryCode + phoneInput;

    try {
        errorDiv.classList.add('hidden');

        // Enviar SMS para vinculación
        await startPhoneLinking(linkingPhoneNumber);

        // Mostrar modal de verificación
        document.getElementById('phone-linking-modal').classList.add('hidden');
        document.getElementById('phone-linking-verification-modal').classList.remove('hidden');

        // Mostrar número en el modal
        document.getElementById('link-phone-display').textContent = linkingPhoneNumber;

    } catch (error) {
        console.error('Error:', error);
        errorDiv.textContent = error.message || 'Error al enviar código. Intenta de nuevo.';
        errorDiv.classList.remove('hidden');
    }
};

/**
 * Handler para verificar código de vinculación de teléfono
 */
const handlePhoneLinkingVerification = async () => {
    const code = document.getElementById('link-sms-code-input').value;
    const errorDiv = document.getElementById('link-verification-error');

    if (!code || code.length !== 6) {
        errorDiv.textContent = 'Por favor ingresa el código de 6 dígitos';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        errorDiv.classList.add('hidden');

        // Verificar código y vincular
        await confirmPhoneLinking(code);

        // Cerrar modal y limpiar
        closePhoneLinkingVerification();

        // Mostrar mensaje de éxito
        alert('¡Teléfono vinculado exitosamente!');

        // Recargar modal de perfil para mostrar el teléfono vinculado
        showProfileModal();

    } catch (error) {
        console.error('Error:', error);

        // Si el número ya está vinculado a otra cuenta, mostrar mensaje especial
        if (error.message && error.message.includes('ya está vinculado')) {
            // Cerrar modal de verificación
            closePhoneLinkingVerification();

            // Volver al modal de perfil con un mensaje de error
            document.getElementById('profile-modal').classList.remove('hidden');

            // Mostrar alerta estética
            alert('⚠️ Este número ya está vinculado a otra cuenta.\n\nNo es posible vincular este número porque ya pertenece a otro usuario.');
        } else {
            errorDiv.textContent = error.message || 'Código incorrecto. Intenta de nuevo.';
            errorDiv.classList.remove('hidden');
        }
    }
};

/**
 * Cierra el modal de verificación de vinculación
 */
const closePhoneLinkingVerification = () => {
    document.getElementById('phone-linking-verification-modal').classList.add('hidden');
    document.getElementById('link-sms-code-input').value = '';
    document.getElementById('link-phone-number-input').value = '';
    linkingPhoneNumber = '';
};

/**
 * Cambia entre tabs del panel de moderación
 * @param {string} tabName - 'team', 'sanctions', 'badges', 'featured', o 'demo'
 */
const switchModTab = (tabName) => {
    // Ocultar todos los contenidos
    const contents = ['team', 'sanctions', 'badges', 'featured', 'demo'];
    contents.forEach(name => {
        const content = document.getElementById(`mod-content-${name}`);
        const tab = document.getElementById(`mod-tab-${name}`);
        if (content) content.classList.add('hidden');
        if (tab) {
            tab.classList.remove('text-white', 'bg-[#1a1a1a]', 'border-orange-500');
            tab.classList.add('text-gray-500', 'border-transparent');
        }
    });

    // Mostrar el tab seleccionado
    const selectedContent = document.getElementById(`mod-content-${tabName}`);
    const selectedTab = document.getElementById(`mod-tab-${tabName}`);
    if (selectedContent) selectedContent.classList.remove('hidden');
    if (selectedTab) {
        selectedTab.classList.remove('text-gray-500', 'border-transparent');
        selectedTab.classList.add('text-white', 'bg-[#1a1a1a]', 'border-orange-500');
    }

    // Lógica específica por tab
    if (tabName === 'featured') {
        loadFeaturedMatchPicker();
    } else if (tabName === 'demo') {
        // Use imported functions directly
        if (typeof loadDemoUsers === 'function') loadDemoUsers();
        if (typeof populateDemoTeamSelect === 'function') populateDemoTeamSelect();
    }
};

/**
 * Inicializa la aplicación
 */
const init = () => {
    // Inicializar autenticación
    initAuth();

    // Inicializar matches (carga calendario y partidos)
    initMatches();

    // Cargar partido destacado en sidebar
    loadFeaturedMatch();

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
        navigateToForum: navigateToForumWrapper,
        openMatchDetail,
        showStandingsById,
        showStandingsByIdAndName,
        showTeamProfile: showTeamProfileHandler
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
    toggleCalendar,
    changeMonth,

    // Match Detail
    openDetail,
    openDetailWithTab,  // Nueva función para abrir con tab específico
    closeDetail,
    switchTab,

    // Featured Match
    selectFeaturedMatch,
    clearFeaturedMatch,
    loadFeaturedMatch,
    loadFeaturedMatchPicker,

    // Standings
    showStandings,
    changeSeason,
    renderTable,
    changeRound,
    toggleSidebarInLeague,

    // Team Profile
    showTeamProfile,

    // Forum
    navigateToForum: navigateToForumWrapper,
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
    handlePhoneLogin,
    handleSMSVerification,
    handleResendSMS,
    closePhoneVerification,

    // Phone Linking (for Google users)
    openPhoneLinkingModal,
    closePhoneLinkingModal,
    handlePhoneLinking,
    handlePhoneLinkingVerification,
    closePhoneLinkingVerification,

    // Demo Mode
    enterDemoMode,
    exitDemoMode,
    isInDemoMode,

    // Team Selection
    goToTeamSelection,
    goBackToUsername,
    filterTeams,
    selectTeam,

    // Debug
    debugTeams: () => {
        alert('Debug disabled to save API usage.');
    },

    // Moderation
    openModerationPanel,
    closeModerationPanel,
    switchModTab,
    handleAddModeratorForm,
    handleMuteForm,
    handleBanForm,
    handleAddFirstUserForm,
    // Ranking
    openRankingModal,
    closeRankingModal,
    loadFirstUsers,

    // New Ranking Modal
    openRankingModal,
    closeRankingModal,

    // Mute/Ban
    muteUser,
    unmuteUser,
    banUser,
    unbanUser,
    handleMuteForm,
    handleBanForm,
    loadMutedUsers,
    loadBannedUsers,
    switchModTab,

    // Mod Panel (Green)
    openModPanel,
    closeModPanel,
    handleModMuteForm,
    handleModMuteForm,
    handleModBanForm,

    // Demo Accounts
    loadDemoUsers,
    deleteDemoUser,
    handleCreateDemoUserForm,
    populateDemoTeamSelect,

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
