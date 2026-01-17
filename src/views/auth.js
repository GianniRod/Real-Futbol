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

// State
let currentUser = null;
let currentUserProfile = null;

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
        console.log('[DEBUG] Buscando username en Firestore:', username);
        const q = query(collection(db, "user_profiles"), where("username", "==", username));
        const querySnapshot = await getDocs(q);

        console.log('[DEBUG] Documentos encontrados:', querySnapshot.size);
        console.log('[DEBUG] Query vacía (disponible):', querySnapshot.empty);

        return querySnapshot.empty; // true si no existe (disponible)
    } catch (error) {
        console.error("Error checking username:", error);
        alert('Error al verificar username: ' + error.message);
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
        console.log('[DEBUG] Intentando guardar username:', username);

        // Verificar si el username ya existe (solo si no es el mismo usuario actualizando)
        const existingProfile = await getUserProfile(uid);
        console.log('[DEBUG] Perfil existente:', existingProfile);

        // Si es un usuario nuevo o está cambiando su username
        if (!existingProfile || existingProfile.username !== username) {
            console.log('[DEBUG] Verificando disponibilidad del username...');
            const available = await isUsernameAvailable(username);
            console.log('[DEBUG] Username disponible:', available);

            if (!available) {
                console.log('[DEBUG] Username NO disponible - mostrando alerta');
                alert('Este nombre de usuario ya está en uso. Por favor elige otro.');
                return false;
            }
        } else {
            console.log('[DEBUG] Usuario mantiene su mismo username - no se valida');
        }

        console.log('[DEBUG] Guardando en Firestore...');
        const docRef = doc(db, "user_profiles", uid);
        await setDoc(docRef, {
            uid: uid,
            email: email,
            username: username,
            photoURL: photoURL,
            createdAt: existingProfile?.createdAt || Date.now()
        });

        console.log('[DEBUG] Guardado exitoso en Firestore');

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
        alert('Error al guardar el nombre de usuario: ' + error.message);
        return false;
    }
};

/**
 * Actualiza la UI según el estado de autenticación
 * @param {object|null} user - Usuario de Firebase Auth
 * @param {object|null} profile - Perfil del usuario
 */
const updateAuthUI = (user, profile) => {
    const loginBtn = document.getElementById('auth-login-btn');
    const userInfo = document.getElementById('auth-user-info');
    const userAvatar = document.getElementById('auth-user-avatar');
    const userName = document.getElementById('auth-user-name');

    // Forum UI elements
    const forumLoginRequired = document.getElementById('forum-login-required');
    const forumInputContainer = document.getElementById('forum-input-container');
    const matchForumLoginRequired = document.getElementById('match-forum-login-required');
    const matchForumInputContainer = document.getElementById('match-forum-input-container');

    if (!user) {
        // No autenticado
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userInfo) userInfo.classList.add('hidden');

        // Mostrar login requerido en foros
        if (forumLoginRequired) forumLoginRequired.classList.remove('hidden');
        if (forumInputContainer) forumInputContainer.classList.add('hidden');
        if (matchForumLoginRequired) matchForumLoginRequired.classList.remove('hidden');
        if (matchForumInputContainer) matchForumInputContainer.classList.add('hidden');
    } else {
        // Autenticado
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');

        // Mostrar inputs de foros
        if (forumLoginRequired) forumLoginRequired.classList.add('hidden');
        if (forumInputContainer) forumInputContainer.classList.remove('hidden');
        if (matchForumLoginRequired) matchForumLoginRequired.classList.add('hidden');
        if (matchForumInputContainer) matchForumInputContainer.classList.remove('hidden');

        if (profile && profile.username) {
            if (userName) userName.textContent = profile.username;
            if (userAvatar) {
                userAvatar.innerHTML = profile.photoURL
                    ? `<img src="${profile.photoURL}" class="w-8 h-8 rounded-full" alt="${profile.username}">`
                    : `<div class="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm">${profile.username.charAt(0).toUpperCase()}</div>`;
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
    }
};

/**
 * Guarda el username establecido por el usuario
 */
export const saveUsername = async () => {
    const input = document.getElementById('username-input');
    const username = input?.value.trim();

    if (!username) {
        alert('Por favor ingresa un nombre de usuario');
        return;
    }

    if (username.length < 3) {
        alert('El nombre de usuario debe tener al menos 3 caracteres');
        return;
    }

    if (username.length > 20) {
        alert('El nombre de usuario no puede tener más de 20 caracteres');
        return;
    }

    if (!currentUser) {
        alert('Error: no hay usuario autenticado');
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
    } else {
        alert('Error al guardar el nombre de usuario. Intenta de nuevo.');
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
export const initAuth = () => {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;

        if (user) {
            // Usuario autenticado - cargar perfil
            const profile = await getUserProfile(user.uid);
            currentUserProfile = profile;

            if (!profile || !profile.username) {
                // No tiene username - mostrar modal
                showUsernameModal(user);
            } else {
                updateAuthUI(user, profile);
            }
        } else {
            // No autenticado
            currentUserProfile = null;
            updateAuthUI(null, null);
        }
    });
};
