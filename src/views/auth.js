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

            console.log('Role loaded:', currentUserRole);

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
            const modBtn = document.getElementById('moderation-btn');
            if (modBtn) {
                if (currentUserRole === 'developer') {
                    modBtn.classList.remove('hidden');
                } else {
                    modBtn.classList.add('hidden');
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

            // Ocultar botón de moderación
            const modBtn = document.getElementById('moderation-btn');
            if (modBtn) {
                modBtn.classList.add('hidden');
            }

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
