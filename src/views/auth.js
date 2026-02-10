/**
 * Authentication Module
 * 
 * Propósito: Manejar autenticación con Google y perfiles de usuario
 * 
 * Exports:
 * - initAuth(): Inicializa el sistema de autenticación
 * - loginWithGoogle(): Inicia sesión con Google
 * - logout(): Cierra sesión
 * - confirmLogout(): Confirma el cierre de sesión
 * - cancelLogout(): Cancela el cierre de sesión
 * - getCurrentUser(): Obtiene el usuario actual
 * - getUserProfile(): Obtiene el perfil del usuario
 * - setUserUsername(): Establece el username del usuario
 * - showProfileModal(): Muestra el modal de perfil
 * - closeProfileModal(): Cierra el modal de perfil
 */

import {
    auth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    PhoneAuthProvider,
    linkWithPhoneNumber,
    linkWithCredential,
    db,
    collection,
    doc,
    getDoc,
    setDoc,
    query,
    where,
    getDocs
} from '../core/firebase.js';

import { getUserRole, DEVELOPER_UID } from './moderation.js';
import { getUserStats, getTopUsers } from './user_stats.js';
import { ARGENTINE_TEAMS } from '../data/teams.js';

// State
let currentUser = null;
let currentUserProfile = null;
let currentUserRole = 'user'; // 'developer', 'moderator', or 'user'
let isRoleLoaded = false;
let roleReadyCallbacks = [];
let selectedTeam = null; // { id, name, logo }

// Phone Auth State
let recaptchaVerifier = null;
let phoneConfirmationResult = null;

/**
 * Obtiene el perfil de un usuario desde Firestore
 * @param {string} uid - UID del usuario
 * @returns {Promise<object|null>} - Perfil del usuario o null
 */
export const getUserProfile = async (uid) => {
    try {
        const docRef = doc(db, "user_profiles", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Error getting user profile:", error);
        return null;
    }
};

/**
 * Verifica si un username ya está en uso
 * @param {string} username - Username a verificar
 * @returns {Promise<boolean>} - true si está disponible, false si ya existe
 */
const isUsernameAvailable = async (username) => {
    try {
        const q = query(collection(db, "user_profiles"), where("username", "==", username));
        const querySnapshot = await getDocs(q);

        return querySnapshot.empty; // true si no existe (disponible)
    } catch (error) {
        console.error("Error checking username:", error);
        return false;
    }
};

/**
 * Crea o actualiza el perfil de usuario
 * @param {string} uid - UID del usuario
 * @param {string} email - Email del usuario
 * @param {string} username - Username elegido
 * @param {string} photoURL - URL de la foto de perfil
 * @param {object|null} team - Team data { id, name, logo }
 * @returns {Promise<boolean>} - Éxito o fallo
 */
export const setUserUsername = async (uid, email, username, photoURL = '', team = null) => {
    try {
        // Verificar si el username ya existe (solo si no es el mismo usuario actualizando)
        const existingProfile = await getUserProfile(uid);

        // Si es un usuario nuevo o está cambiando su username
        if (!existingProfile || existingProfile.username !== username) {
            const available = await isUsernameAvailable(username);

            if (!available) {
                // Mostrar error inline en vez de alert
                const errorDiv = document.getElementById('username-error');
                if (errorDiv) {
                    errorDiv.textContent = '❌ Este nombre de usuario ya está en uso';
                    errorDiv.classList.remove('hidden');
                }
                return false;
            }
        }

        const profileData = {
            uid: uid,
            email: email,
            username: username,
            photoURL: photoURL,
            createdAt: existingProfile?.createdAt || Date.now()
        };

        // Add team data if provided (or keep existing)
        if (team) {
            profileData.teamId = team.id;
            profileData.teamName = team.name;
            profileData.teamLogo = team.logo;
        } else if (existingProfile?.teamId) {
            profileData.teamId = existingProfile.teamId;
            profileData.teamName = existingProfile.teamName;
            profileData.teamLogo = existingProfile.teamLogo;
        }

        const docRef = doc(db, "user_profiles", uid);
        await setDoc(docRef, profileData);

        // Actualizar el perfil en memoria
        currentUserProfile = profileData;

        return true;
    } catch (error) {
        console.error("Error setting username:", error);
        const errorDiv = document.getElementById('username-error');
        if (errorDiv) {
            errorDiv.textContent = '❌ Error al guardar: ' + error.message;
            errorDiv.classList.remove('hidden');
        }
        return false;
    }
};

/**
 * Actualiza la UI según el estado de autenticación
 * @param {object|null} user - Usuario de Firebase Auth
 * @param {object|null} profile - Perfil del usuario
 */
const updateAuthUI = async (user, profile) => {
    const loginContainer = document.getElementById('auth-login-container');
    const userInfo = document.getElementById('auth-user-info');
    const userAvatar = document.getElementById('auth-user-avatar');
    const suggestionBtn = document.getElementById('suggestion-btn');

    // Forum UI elements
    const forumLoginRequired = document.getElementById('forum-login-required');
    const forumInputContainer = document.getElementById('forum-input-container');
    const matchForumLoginRequired = document.getElementById('match-forum-login-required');
    const matchForumInputContainer = document.getElementById('match-forum-input-container');

    // Muted/Banned containers
    const forumMutedContainer = document.getElementById('forum-muted-container');
    const forumBannedContainer = document.getElementById('forum-banned-container');
    const matchForumMutedContainer = document.getElementById('match-forum-muted-container');
    const matchForumBannedContainer = document.getElementById('match-forum-banned-container');

    // Helper to hide all forum containers
    const hideAllForumContainers = () => {
        if (forumInputContainer) forumInputContainer.classList.add('hidden');
        if (forumMutedContainer) forumMutedContainer.classList.add('hidden');
        if (forumBannedContainer) forumBannedContainer.classList.add('hidden');
        if (matchForumInputContainer) matchForumInputContainer.classList.add('hidden');
        if (matchForumMutedContainer) matchForumMutedContainer.classList.add('hidden');
        if (matchForumBannedContainer) matchForumBannedContainer.classList.add('hidden');
    };

    if (!user) {
        // No autenticado
        if (loginContainer) loginContainer.classList.remove('hidden');
        if (userInfo) userInfo.classList.add('hidden');
        if (suggestionBtn) suggestionBtn.classList.add('hidden');

        // Mostrar login requerido en foros
        if (forumLoginRequired) forumLoginRequired.classList.remove('hidden');
        if (matchForumLoginRequired) matchForumLoginRequired.classList.remove('hidden');
        hideAllForumContainers();
    } else {
        // Autenticado
        if (loginContainer) loginContainer.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (suggestionBtn) suggestionBtn.classList.remove('hidden');

        // Ocultar login requerido
        if (forumLoginRequired) forumLoginRequired.classList.add('hidden');
        if (matchForumLoginRequired) matchForumLoginRequired.classList.add('hidden');

        // Verificar estado de muteo/baneo
        const { isUserBanned, isUserMuted, getMuteTimeRemaining } = await import('./moderation.js');

        const banStatus = await isUserBanned(user.uid);
        const muteStatus = await isUserMuted(user.uid);

        hideAllForumContainers();

        if (banStatus) {
            // Usuario baneado - mostrar mensaje de baneo
            if (forumBannedContainer) forumBannedContainer.classList.remove('hidden');
            if (matchForumBannedContainer) matchForumBannedContainer.classList.remove('hidden');
        } else if (muteStatus) {
            // Usuario muteado - mostrar mensaje con tiempo restante
            const timeRemaining = getMuteTimeRemaining(muteStatus);

            if (forumMutedContainer) {
                forumMutedContainer.classList.remove('hidden');
                const timeEl = document.getElementById('forum-mute-time');
                if (timeEl) timeEl.textContent = `Tiempo restante: ${timeRemaining}`;
            }
            if (matchForumMutedContainer) {
                matchForumMutedContainer.classList.remove('hidden');
                const timeEl = document.getElementById('match-forum-mute-time');
                if (timeEl) timeEl.textContent = `Restante: ${timeRemaining}`;
            }
        } else {
            // Usuario normal - mostrar input
            if (forumInputContainer) forumInputContainer.classList.remove('hidden');
            if (matchForumInputContainer) matchForumInputContainer.classList.remove('hidden');
        }

        if (profile && profile.username) {
            if (userAvatar) {
                userAvatar.innerHTML = profile.photoURL
                    ? `<img src="${profile.photoURL}" class="w-10 h-10 rounded-full border-2 border-white" alt="${profile.username}">`
                    : `<div class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center font-bold text-lg border-2 border-white">${profile.username.charAt(0).toUpperCase()}</div>`;
            }
        }
    }
};

/**
 * Muestra el modal para establecer username
 * @param {object} user - Usuario de Firebase Auth
 */
const showUsernameModal = (user) => {
    const modal = document.getElementById('username-modal');
    if (modal) {
        modal.classList.remove('hidden');

        // Reset to step 1
        document.getElementById('registration-step-1').classList.remove('hidden');
        document.getElementById('registration-step-2').classList.add('hidden');

        // Ensure back button is visible
        const backBtn = document.getElementById('team-selection-back-btn');
        if (backBtn) {
            backBtn.classList.remove('hidden');
            backBtn.style.display = '';
        }

        // Focus en el input
        const input = document.getElementById('username-input');
        if (input) {
            input.value = '';
            input.focus();
        }

        // Limpiar errores previos
        hideUsernameError();
    }
};

/**
 * Muestra SOLO la selección de equipo para usuarios existentes
 * @param {object} user - Usuario de Firebase Auth
 * @param {object} profile - Perfil actual
 */
const showTeamSelectionOnly = (user, profile) => {
    const modal = document.getElementById('username-modal');
    if (modal) {
        modal.classList.remove('hidden');

        // Change title
        const title = modal.querySelector('h3');
        if (title) title.textContent = 'Elige tu equipo';

        // Pre-fill username so validation passes
        const input = document.getElementById('username-input');
        if (input && profile && profile.username) {
            input.value = profile.username;
        }

        // Go directly to step 2
        document.getElementById('registration-step-1').classList.add('hidden');
        document.getElementById('registration-step-2').classList.remove('hidden');

        // Populate team grid
        populateTeamGrid();

        // Hide back button since they already have username
        const backBtn = document.getElementById('team-selection-back-btn');
        if (backBtn) {
            backBtn.classList.add('hidden');
            backBtn.style.display = 'none';
        }
    }
};

/**
 * Muestra un mensaje de error en el modal de username
 * @param {string} message - Mensaje de error a mostrar
 */
const showUsernameError = (message) => {
    const errorDiv = document.getElementById('username-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
};

/**
 * Oculta el mensaje de error en el modal de username
 */
const hideUsernameError = () => {
    const errorDiv = document.getElementById('username-error');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
    }
};

/**
 * Guarda el username y equipo establecidos por el usuario
 */
export const saveUsername = async () => {
    // Limpiar errores previos
    hideUsernameError();

    const input = document.getElementById('username-input');
    const username = input?.value.trim();

    if (!username) {
        showUsernameError('Por favor ingresa un nombre de usuario');
        return;
    }

    if (username.length < 3) {
        showUsernameError('El nombre de usuario debe tener al menos 3 caracteres');
        return;
    }

    if (username.length > 20) {
        showUsernameError('El nombre de usuario no puede tener más de 20 caracteres');
        return;
    }

    // Solo permitir letras, números y guión bajo
    const validUsernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!validUsernameRegex.test(username)) {
        showUsernameError('Solo se permiten letras, números y guión bajo (_)');
        return;
    }

    if (!currentUser) {
        showUsernameError('Error: no hay usuario autenticado');
        return;
    }

    // Developer no necesita equipo
    const isDeveloper = currentUser.uid === DEVELOPER_UID;

    if (!isDeveloper && !selectedTeam) {
        alert('Por favor elegí un equipo de fútbol');
        return;
    }

    const success = await setUserUsername(
        currentUser.uid,
        currentUser.email,
        username,
        currentUser.photoURL || '',
        isDeveloper ? null : selectedTeam
    );

    if (success) {
        // Cerrar modal y resetear
        const modal = document.getElementById('username-modal');
        if (modal) modal.classList.add('hidden');
        selectedTeam = null;

        // Actualizar UI
        updateAuthUI(currentUser, currentUserProfile);
    }
};

/**
 * Navega del paso 1 (username) al paso 2 (equipo)
 */
export const goToTeamSelection = () => {
    hideUsernameError();
    const input = document.getElementById('username-input');
    const username = input?.value.trim();

    if (!username) {
        showUsernameError('Por favor ingresa un nombre de usuario');
        return;
    }
    if (username.length < 3) {
        showUsernameError('El nombre de usuario debe tener al menos 3 caracteres');
        return;
    }
    if (username.length > 20) {
        showUsernameError('El nombre de usuario no puede tener más de 20 caracteres');
        return;
    }
    const validUsernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!validUsernameRegex.test(username)) {
        showUsernameError('Solo se permiten letras, números y guión bajo (_)');
        return;
    }

    // Show step 2, hide step 1
    document.getElementById('registration-step-1').classList.add('hidden');
    document.getElementById('registration-step-2').classList.remove('hidden');

    // Populate team grid
    populateTeamGrid();
};

/**
 * Vuelve del paso 2 al paso 1
 */
export const goBackToUsername = () => {
    document.getElementById('registration-step-2').classList.add('hidden');
    document.getElementById('registration-step-1').classList.remove('hidden');
};

/**
 * Filtra equipos por búsqueda
 */
export const filterTeams = () => {
    const searchInput = document.getElementById('team-search-input');
    const query = searchInput?.value.trim().toLowerCase() || '';
    populateTeamGrid(query);
};

/**
 * Selecciona un equipo
 */
export const selectTeam = (teamId) => {
    const team = ARGENTINE_TEAMS.find(t => t.id === teamId);
    if (!team) return;

    selectedTeam = team;

    // Update indicator
    const indicator = document.getElementById('selected-team-indicator');
    const logoEl = document.getElementById('selected-team-logo');
    const nameEl = document.getElementById('selected-team-name');
    if (indicator && logoEl && nameEl) {
        indicator.classList.remove('hidden');
        logoEl.src = team.logo;
        nameEl.textContent = team.name;
    }

    // Update grid highlights
    document.querySelectorAll('#team-grid button').forEach(btn => {
        const id = parseInt(btn.dataset.teamId);
        if (id === teamId) {
            btn.classList.add('border-yellow-500', 'bg-yellow-500/10');
            btn.classList.remove('border-[#333]', 'hover:border-[#555]');
        } else {
            btn.classList.remove('border-yellow-500', 'bg-yellow-500/10');
            btn.classList.add('border-[#333]', 'hover:border-[#555]');
        }
    });
};

/**
 * Popula la grilla de equipos
 */
const populateTeamGrid = (searchQuery = '') => {
    const grid = document.getElementById('team-grid');
    if (!grid) return;

    const filtered = searchQuery
        ? ARGENTINE_TEAMS.filter(t => t.name.toLowerCase().includes(searchQuery))
        : ARGENTINE_TEAMS;

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-4 text-center text-gray-500 text-xs py-4">No se encontraron equipos</div>';
        return;
    }

    grid.innerHTML = filtered.map(team => {
        const isSelected = selectedTeam?.id === team.id;
        const borderClass = isSelected ? 'border-yellow-500 bg-yellow-500/10' : 'border-[#333] hover:border-[#555]';
        return `
            <button data-team-id="${team.id}" onclick="app.selectTeam(${team.id})"
                class="flex flex-col items-center gap-1 p-2 rounded-lg border ${borderClass} bg-[#0a0a0a] transition-all cursor-pointer">
                <img src="${team.logo}" class="w-8 h-8 object-contain" alt="${team.name}" loading="lazy">
                <span class="text-[8px] text-gray-400 text-center leading-tight truncate w-full">${team.name}</span>
            </button>
        `;
    }).join('');
};

/**
 * Inicia sesión con Google
 */
export const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
        prompt: 'select_account'
    });

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Verificar si tiene perfil
        const profile = await getUserProfile(user.uid);

        if (!profile || !profile.username) {
            // Primera vez - mostrar modal para username
            showUsernameModal(user);
        } else {
            // Ya tiene perfil
            currentUserProfile = profile;
            updateAuthUI(user, profile);
        }
    } catch (error) {
        console.error("Error signing in with Google:", error);
        alert('Error al iniciar sesión con Google. Por favor intenta de nuevo.');
    }
};

/**
 * Muestra el modal de confirmación para cerrar sesión
 */
export const logout = async () => {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
};

/**
 * Confirma el cierre de sesión
 */
export const confirmLogout = async () => {
    // Cerrar modal
    const modal = document.getElementById('logout-modal');
    if (modal) modal.classList.add('hidden');

    // Cerrar sesión
    try {
        await signOut(auth);
        currentUser = null;
        currentUserProfile = null;
        updateAuthUI(null, null);
    } catch (error) {
        console.error("Error signing out:", error);
        alert('Error al cerrar sesión');
    }
};

/**
 * Cancela el cierre de sesión
 */
export const cancelLogout = () => {
    const modal = document.getElementById('logout-modal');
    if (modal) modal.classList.add('hidden');
};

/**
 * Obtiene el usuario actual
 * @returns {object|null} - Usuario actual
 */
export const getCurrentUser = () => {
    return currentUser;
};

/**
 * Obtiene el perfil del usuario actual
 * @returns {object|null} - Perfil del usuario actual
 */
export const getCurrentUserProfile = () => {
    return currentUserProfile;
};

/**
 * Inicializa el sistema de autenticación
 */
/**
 * Inicializa el sistema de autenticación
 */
export const initAuth = () => {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            // Usuario autenticado - cargar perfil
            const profile = await getUserProfile(user.uid);
            currentUserProfile = profile;

            // Detectar rol del usuario
            currentUserRole = await getUserRole(user.uid);
            isRoleLoaded = true;

            console.log('Role loaded:', currentUserRole);

            // Ejecutar callbacks pendientes
            roleReadyCallbacks.forEach(callback => callback());
            roleReadyCallbacks = [];

            // Si estamos en el foro, re-renderizar para mostrar botones de moderador
            const forumMessages = document.getElementById('forum-messages');
            const matchForumMessages = document.getElementById('match-forum-messages');
            if (forumMessages && !forumMessages.innerHTML.includes('Cargando')) {
                // Re-renderizar foro si ya está cargado
                if (window.app && window.app.initForum) {
                    const currentContext = forumMessages.closest('#view-forum') ? 'global' : null;
                    if (currentContext) {
                        console.log('Re-rendering forum with updated role');
                        // Forzar re-render sin cambiar el scroll
                        const scrollPos = forumMessages.scrollTop;
                        window.location.hash = window.location.hash; // Trigger re-render
                    }
                }
            }

            // Mostrar/ocultar botón de moderación
            // Mostrar/ocultar botón de moderación (developer)
            const modBtn = document.getElementById('moderation-btn');
            const modBadge = document.getElementById('moderator-badge-btn');

            if (modBtn) {
                if (currentUserRole === 'developer') {
                    modBtn.classList.remove('hidden');
                } else {
                    modBtn.classList.add('hidden');
                }
            }

            if (modBadge) {
                if (currentUserRole === 'moderator') {
                    modBadge.classList.remove('hidden');
                } else {
                    modBadge.classList.add('hidden');
                }
            }
            if (!profile || !profile.username) {
                // No tiene username - mostrar modal
                showUsernameModal(user);
            } else if (!profile.teamId && user.uid !== DEVELOPER_UID) {
                // Tiene username pero no eligió equipo - mostrar modal en step 2
                showTeamSelectionOnly(user, profile);
            } else {
                updateAuthUI(user, profile);
            }
        } else {
            // No autenticado
            currentUserProfile = null;
            currentUserRole = 'user';
            isRoleLoaded = true;

            // Ejecutar callbacks pendientes
            roleReadyCallbacks.forEach(callback => callback());
            roleReadyCallbacks = [];

            // Ocultar botón de moderación
            // Ocultar botones de moderación
            const modBtn = document.getElementById('moderation-btn');
            const modBadge = document.getElementById('moderator-badge-btn');

            if (modBtn) modBtn.classList.add('hidden');
            if (modBadge) modBadge.classList.add('hidden');

            updateAuthUI(null, null);
        }
    });
};

/**
 * Obtiene el rol del usuario actual
 * @returns {string} - 'developer', 'moderator', o 'user'
 */
export const getCurrentUserRole = () => {
    return currentUserRole;
};

/**
 * Ejecuta un callback cuando el rol del usuario esté cargado
 * @param {Function} callback - Función a ejecutar (opcional)
 * @returns {Promise} - Promise que se resuelve cuando el rol está listo
 */
export const whenRoleReady = (callback) => {
    return new Promise((resolve) => {
        if (isRoleLoaded) {
            if (callback) callback();
            resolve();
        } else {
            // Agregar callback a la cola
            roleReadyCallbacks.push(() => {
                if (callback) callback();
                resolve();
            });

            // Timeout de seguridad: si después de 3 segundos no se resolvió, resolver de todos modos
            setTimeout(() => {
                if (!isRoleLoaded) {
                    console.warn('whenRoleReady: timeout, resolving anyway');
                    isRoleLoaded = true;
                    roleReadyCallbacks.forEach(cb => cb());
                    roleReadyCallbacks = [];
                }
            }, 3000);
        }
    });
};

/**
 * Cierra el modal de perfil
 */
export const closeProfileModal = () => {
    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};
/**
 * Inicializa el reCAPTCHA para phone authentication
 * @param {string} containerId - ID del contenedor del reCAPTCHA
 */
export const initRecaptcha = (containerId = 'recaptcha-container') => {
    if (!recaptchaVerifier) {
        try {
            recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
                'size': 'normal',
                'callback': (response) => {
                    console.log('reCAPTCHA resuelto');
                },
                'expired-callback': () => {
                    console.log('reCAPTCHA expirado');
                }
            });

            console.log('reCAPTCHA inicializado');
        } catch (error) {
            console.error('Error al inicializar reCAPTCHA:', error);
            throw error;
        }
    }
    return recaptchaVerifier;
};

/**
 * Normaliza números de teléfono argentinos para formato móvil consistente
 * En Argentina, los móviles deben tener el formato +54 9 XXXX XXXX
 * Esta función agrega el '9' si falta para evitar duplicados
 * @param {string} phoneNumber - Número en formato internacional
 * @returns {string} - Número normalizado
 */
const normalizeArgentinePhone = (phoneNumber) => {
    // Solo normalizar números argentinos
    if (!phoneNumber.startsWith('+54')) {
        return phoneNumber;
    }

    // Quitar espacios y guiones
    let normalized = phoneNumber.replace(/[\s-]/g, '');

    // Formato esperado: +54 9 XXXXXXXXXX (móvil)
    // Si tiene +54 y NO tiene el 9 después, agregarlo

    // Obtener la parte después de +54
    const afterCountryCode = normalized.substring(3);

    // Si ya tiene el 9 al inicio, está bien
    if (afterCountryCode.startsWith('9')) {
        return normalized;
    }

    // Si empieza con 11, 15, o códigos de área (2XX, 3XX), agregar el 9
    // Los móviles argentinos sin el 9 tienen 10 dígitos después de +54
    if (afterCountryCode.length === 10) {
        // Agregar el 9 para formato móvil correcto
        normalized = '+549' + afterCountryCode;
    }

    return normalized;
};

/**
 * Inicia sesión con número de teléfono
 * @param {string} phoneNumber - Número de teléfono en formato internacional (ej: +54911XXXXXXXX)
 * @returns {Promise<object>} - Confirmation result para verificación
 */
export const loginWithPhone = async (phoneNumber) => {
    try {
        // Validar formato básico
        if (!phoneNumber.startsWith('+')) {
            throw new Error('El número debe empezar con código de país (ej: +54)');
        }

        // Normalizar número argentino
        const normalizedNumber = normalizeArgentinePhone(phoneNumber);
        console.log('Enviando SMS a:', normalizedNumber);

        // App Check maneja la verificación automáticamente
        // Solo necesitamos un reCAPTCHA invisible para la API
        if (!recaptchaVerifier) {
            recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible'
            });
        }

        // Enviar SMS
        const confirmationResult = await signInWithPhoneNumber(auth, normalizedNumber, recaptchaVerifier);
        phoneConfirmationResult = confirmationResult;

        console.log('SMS enviado exitosamente');
        return confirmationResult;
    } catch (error) {
        console.error('Error detallado:', error);
        console.error('Code:', error.code);

        // Reset reCAPTCHA en error
        if (recaptchaVerifier) {
            try {
                recaptchaVerifier.clear();
            } catch (e) { /* ignore */ }
            recaptchaVerifier = null;
        }

        // Mensajes de error específicos
        if (error.code === 'auth/invalid-phone-number') {
            throw new Error('Número inválido. Verifica el formato (+54...)');
        } else if (error.code === 'auth/quota-exceeded' || error.code === 'auth/too-many-requests') {
            throw new Error('Demasiados intentos. Espera unas horas antes de intentar de nuevo.');
        } else if (error.code === 'auth/captcha-check-failed') {
            throw new Error('Error de verificación. Por favor intenta de nuevo.');
        }

        throw error;
    }
};

/**
 * Verifica el código SMS y completa la autenticación
 * @param {string} code - Código de 6 dígitos
 * @returns {Promise<object>} - User credentials
 */
export const verifyPhoneCode = async (code) => {
    try {
        if (!phoneConfirmationResult) {
            throw new Error('No hay confirmación pendiente');
        }

        // Verificar código
        const result = await phoneConfirmationResult.confirm(code);
        const user = result.user;

        console.log('Phone auth exitosa:', user.uid);

        // Crear/actualizar perfil como con Google
        const profile = await getUserProfile(user.uid);

        if (!profile || !profile.username) {
            // Mostrar modal de username
            showUsernameModal(user);
        } else {
            currentUserProfile = profile;
            updateAuthUI(user, profile);
        }

        // Reset state
        phoneConfirmationResult = null;
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
        }

        return result;
    } catch (error) {
        console.error('Error al verificar código:', error);
        throw error;
    }
};

/**
 * Reenvía el código SMS
 * @param {string} phoneNumber - Número de teléfono
 * @returns {Promise<object>} - Nuevo confirmation result
 */
export const resendPhoneCode = async (phoneNumber) => {
    // Reset reCAPTCHA para reenvío
    if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        recaptchaVerifier = null;
    }

    return await loginWithPhone(phoneNumber);
};

// Phone Linking State
let phoneLinkingConfirmationResult = null;

/**
 * Obtiene el proveedor de autenticación del usuario actual
 * @returns {string} - 'google.com', 'phone', o 'unknown'
 */
export const getAuthProvider = () => {
    if (!currentUser) return 'unknown';

    const providers = currentUser.providerData;
    if (!providers || providers.length === 0) return 'unknown';

    // Buscar el proveedor principal
    for (const provider of providers) {
        if (provider.providerId === 'google.com') return 'google.com';
        if (provider.providerId === 'phone') return 'phone';
    }

    return providers[0]?.providerId || 'unknown';
};

/**
 * Verifica si el usuario tiene un teléfono vinculado
 * @returns {boolean}
 */
export const hasLinkedPhone = () => {
    if (!currentUser) return false;

    const providers = currentUser.providerData;
    if (!providers) return false;

    return providers.some(p => p.providerId === 'phone');
};

/**
 * Obtiene el número de teléfono vinculado si existe
 * @returns {string|null}
 */
export const getLinkedPhone = () => {
    if (!currentUser) return null;

    const phoneProvider = currentUser.providerData?.find(p => p.providerId === 'phone');
    return phoneProvider?.phoneNumber || null;
};

/**
 * Inicia el proceso de vinculación de teléfono para usuarios de Google
 * @param {string} phoneNumber - Número de teléfono en formato internacional
 * @returns {Promise<object>} - Confirmation result
 */
export const startPhoneLinking = async (phoneNumber) => {
    try {
        if (!currentUser) {
            throw new Error('No hay usuario autenticado');
        }

        // Verificar que sea un usuario de Google
        if (getAuthProvider() !== 'google.com') {
            throw new Error('Solo usuarios de Google pueden vincular un teléfono');
        }

        // Verificar formato
        if (!phoneNumber.startsWith('+')) {
            throw new Error('El número debe empezar con código de país (ej: +54)');
        }

        // Normalizar número argentino
        const normalizedNumber = normalizeArgentinePhone(phoneNumber);
        console.log('Vinculando teléfono:', normalizedNumber);

        // Inicializar reCAPTCHA para linking
        if (!recaptchaVerifier) {
            recaptchaVerifier = new RecaptchaVerifier(auth, 'link-recaptcha-container', {
                'size': 'invisible'
            });
        }

        // Enviar SMS usando linkWithPhoneNumber
        const confirmationResult = await linkWithPhoneNumber(currentUser, normalizedNumber, recaptchaVerifier);
        phoneLinkingConfirmationResult = confirmationResult;

        console.log('SMS de vinculación enviado');
        return confirmationResult;
    } catch (error) {
        console.error('Error al iniciar vinculación:', error);

        // Reset reCAPTCHA en error
        if (recaptchaVerifier) {
            try {
                recaptchaVerifier.clear();
            } catch (e) { /* ignore */ }
            recaptchaVerifier = null;
        }

        // Mensajes de error específicos
        if (error.code === 'auth/provider-already-linked') {
            throw new Error('Ya tienes un número de teléfono vinculado a esta cuenta.');
        } else if (error.code === 'auth/credential-already-in-use') {
            throw new Error('Este número ya está vinculado a otra cuenta.');
        } else if (error.code === 'auth/invalid-phone-number') {
            throw new Error('Número inválido. Verifica el formato.');
        } else if (error.code === 'auth/captcha-check-failed') {
            throw new Error('Error de verificación. Por favor intenta de nuevo.');
        }

        throw error;
    }
};

/**
 * Confirma la vinculación del teléfono con el código SMS
 * @param {string} code - Código de 6 dígitos
 * @returns {Promise<object>} - User con teléfono vinculado
 */
export const confirmPhoneLinking = async (code) => {
    try {
        if (!phoneLinkingConfirmationResult) {
            throw new Error('No hay vinculación pendiente');
        }

        // Verificar código
        const result = await phoneLinkingConfirmationResult.confirm(code);

        console.log('Teléfono vinculado exitosamente');

        // Reset state
        phoneLinkingConfirmationResult = null;
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
        }

        return result;
    } catch (error) {
        console.error('Error al confirmar vinculación:', error);

        if (error.code === 'auth/invalid-verification-code') {
            throw new Error('Código incorrecto. Verifica e intenta de nuevo.');
        } else if (error.code === 'auth/code-expired') {
            throw new Error('El código ha expirado. Solicita uno nuevo.');
        }

        throw error;
    }
};

/**
 * Muestra el modal de perfil actualizando el estado de vinculación telefónica
 */
export const showProfileModal = async () => {
    const modal = document.getElementById('profile-modal');
    if (!modal || !currentUser || !currentUserProfile) return;

    // Mostrar modal
    modal.classList.remove('hidden');

    // Cargar datos del usuario
    const profileAvatar = document.getElementById('profile-avatar');
    const profileUsername = document.getElementById('profile-username');
    const profileTeamLogo = document.getElementById('profile-team-logo');
    const profileTeamName = document.getElementById('profile-team-name');
    const profileTeamContainer = document.getElementById('profile-team-container');

    const profileCommentCount = document.getElementById('profile-comment-count');
    const profileRanking = document.getElementById('profile-ranking');
    const linkPhoneSection = document.getElementById('link-phone-section');
    const linkedPhoneSection = document.getElementById('linked-phone-section');
    const linkedPhoneNumber = document.getElementById('linked-phone-number');

    if (profileAvatar) {
        profileAvatar.innerHTML = currentUserProfile.photoURL
            ? `<img src="${currentUserProfile.photoURL}" class="w-20 h-20 rounded-full border-4 border-white" alt="${currentUserProfile.username}">`
            : `<div class="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center font-bold text-3xl border-4 border-white">${currentUserProfile.username.charAt(0).toUpperCase()}</div>`;
    }

    if (profileUsername) {
        profileUsername.textContent = currentUserProfile.username;
    }

    // Equipo y opción de cambio
    if (profileTeamContainer) {
        if (currentUserProfile.teamLogo) {
            if (profileTeamLogo) {
                profileTeamLogo.src = currentUserProfile.teamLogo;
                profileTeamLogo.classList.remove('hidden');
            }
            if (profileTeamName) profileTeamName.textContent = currentUserProfile.teamName || 'Equipo';
        } else {
            if (profileTeamLogo) profileTeamLogo.classList.add('hidden');
            if (profileTeamName) profileTeamName.textContent = 'Seleccionar Equipo';
        }

        // Read-only view
        profileTeamContainer.onclick = null;
    }

    // Mostrar/ocultar sección de vincular teléfono según el proveedor
    const provider = getAuthProvider();
    const hasPhone = hasLinkedPhone();

    if (linkPhoneSection) {
        // Mostrar solo si es usuario de Google y no tiene teléfono vinculado
        if (provider === 'google.com' && !hasPhone) {
            linkPhoneSection.classList.remove('hidden');
        } else {
            linkPhoneSection.classList.add('hidden');
        }
    }

    if (linkedPhoneSection) {
        // Mostrar si tiene teléfono vinculado
        if (hasPhone) {
            linkedPhoneSection.classList.remove('hidden');
            if (linkedPhoneNumber) {
                linkedPhoneNumber.textContent = getLinkedPhone() || 'Teléfono vinculado';
            }
        } else {
            linkedPhoneSection.classList.add('hidden');
        }
    }

    // Cargar estadísticas
    if (profileCommentCount) profileCommentCount.textContent = '...';
    if (profileRanking) profileRanking.textContent = '...';

    try {
        const stats = await getUserStats(currentUser.uid);
        if (profileCommentCount) {
            profileCommentCount.textContent = stats.commentCount;
        }
        if (profileRanking) {
            if (stats.commentCount === 0) {
                profileRanking.textContent = "ESCRIBE PARA APARECER EN EL RANKING";
                profileRanking.classList.add('text-[10px]', 'leading-tight');
                profileRanking.classList.remove('text-3xl');
            } else {
                profileRanking.textContent = `#${stats.ranking}`;
                profileRanking.classList.remove('text-[10px]', 'leading-tight');
                profileRanking.classList.add('text-3xl');
            }

            // Hacer clickeable el container del ranking
            const rankingContainer = profileRanking.parentElement;
            if (rankingContainer) {
                rankingContainer.onclick = () => app.openRankingModal();
                rankingContainer.classList.add('cursor-pointer', 'hover:bg-[#1a1a1a]', 'transition-colors');
            }
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
        if (profileCommentCount) profileCommentCount.textContent = '0';
        if (profileRanking) {
            profileRanking.textContent = "ESCRIBE PARA APARECER EN EL RANKING";
            profileRanking.classList.add('text-[10px]', 'leading-tight');
            profileRanking.classList.remove('text-3xl');
        }
    }
};

/**
 * Abre el modal de ranking con el top 20
 */
export const openRankingModal = async () => {
    // Cerrar perfil si está abierto
    closeProfileModal();

    const modal = document.getElementById('ranking-modal');
    if (modal) {
        modal.classList.remove('hidden');

        const listContainer = document.getElementById('ranking-list');
        if (listContainer) {
            listContainer.innerHTML = '<div class="text-center text-gray-500 py-8">Cargando ranking...</div>';

            try {
                const topUsers = await getTopUsers(20);

                if (topUsers.length === 0) {
                    listContainer.innerHTML = '<div class="text-center text-gray-500 py-8">Aún no hay usuarios en el ranking</div>';
                    return;
                }

                let html = '';
                topUsers.forEach((user, index) => {
                    const isCurrentUser = currentUser && user.uid === currentUser.uid;
                    const highlightClass = isCurrentUser ? 'bg-orange-500/10 border-orange-500/50' : 'bg-[#1a1a1a] border-[#222]';
                    const textClass = isCurrentUser ? 'text-orange-500' : 'text-white';

                    html += `
                        <div class="flex items-center gap-3 p-3 rounded border ${highlightClass} mb-2">
                            <div class="font-mono font-bold text-lg w-8 text-center text-gray-500">#${user.rank}</div>
                            
                            <!-- Team Logo -->
                            <div class="shrink-0 w-8 h-8 flex items-center justify-center bg-[#0a0a0a] rounded-full border border-[#333] overflow-hidden">
                                ${user.teamLogo ? `<img src="${user.teamLogo}" class="w-6 h-6 object-contain">` : '<span class="text-xs">⚽</span>'}
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="font-bold text-sm truncate ${textClass}">${user.username}</div>
                            </div>
                            <div class="text-white font-bold text-lg font-mono">
                                ${user.commentCount}
                            </div>
                        </div>
                    `;
                });

                listContainer.innerHTML = html;
            } catch (error) {
                console.error('Error loading ranking:', error);
                listContainer.innerHTML = '<div class="text-center text-red-500 py-8">Error al cargar el ranking</div>';
            }
        }
    }
};

/**
 * Cierra el modal de ranking
 */
export const closeRankingModal = () => {
    const modal = document.getElementById('ranking-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    // Reabrir perfil
    if (currentUser) {
        showProfileModal();
    }
};

export { currentUser, currentUserProfile, currentUserRole };
