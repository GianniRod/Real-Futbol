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
import { getUserStats } from './user_stats.js';

// State
let currentUser = null;
let currentUserProfile = null;
let currentUserRole = 'user'; // 'developer', 'moderator', or 'user'
let isRoleLoaded = false;
let roleReadyCallbacks = [];

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
 * @returns {Promise<boolean>} - Éxito o fallo
 */
export const setUserUsername = async (uid, email, username, photoURL = '') => {
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

        const docRef = doc(db, "user_profiles", uid);
        await setDoc(docRef, {
            uid: uid,
            email: email,
            username: username,
            photoURL: photoURL,
            createdAt: existingProfile?.createdAt || Date.now()
        });

        // Actualizar el perfil en memoria
        currentUserProfile = {
            uid,
            email,
            username,
            photoURL,
            createdAt: existingProfile?.createdAt || Date.now()
        };

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
const updateAuthUI = (user, profile) => {
    const loginContainer = document.getElementById('auth-login-container');
    const userInfo = document.getElementById('auth-user-info');
    const userAvatar = document.getElementById('auth-user-avatar');
    const suggestionBtn = document.getElementById('suggestion-btn');

    // Forum UI elements
    const forumLoginRequired = document.getElementById('forum-login-required');
    const forumInputContainer = document.getElementById('forum-input-container');
    const matchForumLoginRequired = document.getElementById('match-forum-login-required');
    const matchForumInputContainer = document.getElementById('match-forum-input-container');

    if (!user) {
        // No autenticado
        if (loginContainer) loginContainer.classList.remove('hidden');
        if (userInfo) userInfo.classList.add('hidden');
        if (suggestionBtn) suggestionBtn.classList.add('hidden');

        // Mostrar login requerido en foros
        if (forumLoginRequired) forumLoginRequired.classList.remove('hidden');
        if (forumInputContainer) forumInputContainer.classList.add('hidden');
        if (matchForumLoginRequired) matchForumLoginRequired.classList.remove('hidden');
        if (matchForumInputContainer) matchForumInputContainer.classList.add('hidden');
    } else {
        // Autenticado
        if (loginContainer) loginContainer.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (suggestionBtn) suggestionBtn.classList.remove('hidden');

        // Mostrar inputs de foros
        if (forumLoginRequired) forumLoginRequired.classList.add('hidden');
        if (forumInputContainer) forumInputContainer.classList.remove('hidden');
        if (matchForumLoginRequired) matchForumLoginRequired.classList.add('hidden');
        if (matchForumInputContainer) matchForumInputContainer.classList.remove('hidden');

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
 * Guarda el username establecido por el usuario
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

    if (!currentUser) {
        showUsernameError('Error: no hay usuario autenticado');
        return;
    }

    const success = await setUserUsername(
        currentUser.uid,
        currentUser.email,
        username,
        currentUser.photoURL || ''
    );

    if (success) {
        // Cerrar modal
        const modal = document.getElementById('username-modal');
        if (modal) modal.classList.add('hidden');

        // Actualizar UI
        updateAuthUI(currentUser, currentUserProfile);
    }
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
 * Muestra el modal de perfil con estadísticas del usuario
 */
export const showProfileModal = async () => {
    const modal = document.getElementById('profile-modal');
    if (!modal || !currentUser || !currentUserProfile) return;

    // Mostrar modal
    modal.classList.remove('hidden');

    // Cargar datos del usuario
    const profileAvatar = document.getElementById('profile-avatar');
    const profileUsername = document.getElementById('profile-username');
    const profileCommentCount = document.getElementById('profile-comment-count');
    const profileRanking = document.getElementById('profile-ranking');

    if (profileAvatar) {
        profileAvatar.innerHTML = currentUserProfile.photoURL
            ? `<img src="${currentUserProfile.photoURL}" class="w-20 h-20 rounded-full border-4 border-white" alt="${currentUserProfile.username}">`
            : `<div class="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center font-bold text-3xl border-4 border-white">${currentUserProfile.username.charAt(0).toUpperCase()}</div>`;
    }

    if (profileUsername) {
        profileUsername.textContent = currentUserProfile.username;
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
            profileRanking.textContent = `#${stats.ranking}`;
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
        if (profileCommentCount) profileCommentCount.textContent = '0';
        if (profileRanking) profileRanking.textContent = '#-';
    }
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
                'size': 'invisible',
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

        // Inicializar y renderizar reCAPTCHA si no existe
        if (!recaptchaVerifier) {
            console.log('Inicializando reCAPTCHA...');
            initRecaptcha();

            // Intentar renderizar
            try {
                await recaptchaVerifier.render();
                console.log('reCAPTCHA renderizado correctamente');
            } catch (renderErr) {
                console.warn('No se pudo renderizar (puede que ya esté renderizado):', renderErr);
            }
        }

        console.log('Enviando SMS a:', phoneNumber);

        // Enviar SMS
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
        phoneConfirmationResult = confirmationResult;

        console.log('SMS enviado exitosamente');
        return confirmationResult;
    } catch (error) {
        console.error('Error detallado:', error);
        console.error('Code:', error.code);
        console.error('Message:', error.message);

        // Reset reCAPTCHA en error
        if (recaptchaVerifier) {
            try {
                recaptchaVerifier.clear();
            } catch (e) { /* ignore */ }
            recaptchaVerifier = null;
        }

        // Mensaje de error más útil
        if (error.code === 'auth/captcha-check-failed') {
            throw new Error('Error de verificación. Recarga la página e intenta de nuevo.');
        } else if (error.code === 'auth/invalid-phone-number') {
            throw new Error('Número inválido. Verifica el formato (+54...)');
        } else if (error.code === 'auth/quota-exceeded') {
            throw new Error('Demasiados intentos. Espera un momento.');
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

export { currentUser, currentUserProfile, currentUserRole };
