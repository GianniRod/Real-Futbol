/**
 * Moderation Module
 * 
 * Propósito: Gestionar moderadores y permisos
 * 
 * Exports:
 * - DEVELOPER_UID: UID del desarrollador
 * - openModerationPanel(): Abre panel de moderación
 * - closeModerationPanel(): Cierra panel
 * - addModerator(uid): Agrega moderador
 * - removeModerator(uid): Quita moderador
 * - getUserRole(uid): Obtiene el rol del usuario
 */

import {
    db,
    collection,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    getDocs,
    query
} from '../core/firebase.js';

// UID del desarrollador (hardcoded)
export const DEVELOPER_UID = 'SvMj82K5gNXub6StrHjz4JVpRB83';

/**
 * Obtiene el rol de un usuario
 * @param {string} uid - UID del usuario
 * @returns {Promise<string>} - 'developer', 'moderator', o 'user'
 */
export const getUserRole = async (uid) => {
    // Verificar si es developer
    if (uid === DEVELOPER_UID) {
        return 'developer';
    }

    // Verificar si es moderador
    try {
        const modDoc = await getDoc(doc(db, 'moderators', uid));
        if (modDoc.exists()) {
            return 'moderator';
        }
    } catch (error) {
        console.error('Error checking moderator status:', error);
    }

    return 'user';
};

/**
 * Abre el panel de moderación
 */
export const openModerationPanel = () => {
    const modal = document.getElementById('moderation-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadModerators();
        loadFirstUsers();
        loadMutedUsers();
        loadBannedUsers();
    }
};

/**
 * Cierra el panel de moderación
 */
export const closeModerationPanel = () => {
    const modal = document.getElementById('moderation-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// ==================== MOD PANEL (GREEN - For Moderators Only) ====================

/**
 * Abre el panel verde de moderadores
 */
export const openModPanel = () => {
    const modal = document.getElementById('mod-panel-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadModMutedUsers();
        loadModBannedUsers();
    }
};

/**
 * Cierra el panel de moderadores
 */
export const closeModPanel = () => {
    const modal = document.getElementById('mod-panel-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

/**
 * Carga la lista de muteados para el panel de moderadores
 */
const loadModMutedUsers = async () => {
    const container = document.getElementById('mod-muted-users-list');
    if (!container) return;

    container.innerHTML = '<div class="text-gray-500 text-xs text-center py-2">Cargando...</div>';

    try {
        const q = query(collection(db, 'muted_users'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-gray-500 text-xs text-center py-2">No hay usuarios muteados</div>';
            return;
        }

        let html = '';
        const now = Date.now();

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            if (data.expiresAt && data.expiresAt < now) {
                await deleteDoc(doc(db, 'muted_users', docSnap.id));
                continue;
            }

            const timeRemaining = getMuteTimeRemaining(data);

            html += `
                <div class="flex items-center justify-between p-2 bg-[#0a0a0a] rounded border border-[#222] text-xs">
                    <div>
                        <div class="text-white font-bold">${data.username || 'Usuario'}</div>
                        <div class="text-yellow-500 text-[10px]">⏱ ${timeRemaining}</div>
                    </div>
                    <button onclick="app.unmuteUser('${data.uid}')" 
                        class="text-green-500 hover:text-green-400 text-[10px] font-bold px-2 py-1 border border-green-500 rounded">
                        Quitar
                    </button>
                </div>
            `;
        }

        container.innerHTML = html || '<div class="text-gray-500 text-xs text-center py-2">No hay usuarios muteados</div>';
    } catch (error) {
        console.error('Error loading muted users:', error);
        container.innerHTML = '<div class="text-red-500 text-xs text-center py-2">Error</div>';
    }
};

/**
 * Carga la lista de baneados para el panel de moderadores
 */
const loadModBannedUsers = async () => {
    const container = document.getElementById('mod-banned-users-list');
    if (!container) return;

    container.innerHTML = '<div class="text-gray-500 text-xs text-center py-2">Cargando...</div>';

    try {
        const q = query(collection(db, 'banned_users'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-gray-500 text-xs text-center py-2">No hay usuarios baneados</div>';
            return;
        }

        let html = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            html += `
                <div class="flex items-center justify-between p-2 bg-[#0a0a0a] rounded border border-red-500/30 text-xs">
                    <div>
                        <div class="text-white font-bold">${data.username || 'Usuario'}</div>
                        <div class="text-red-500 text-[10px]">⛔ Baneado</div>
                    </div>
                    <button onclick="app.unbanUser('${data.uid}')" 
                        class="text-green-500 hover:text-green-400 text-[10px] font-bold px-2 py-1 border border-green-500 rounded">
                        Quitar
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading banned users:', error);
        container.innerHTML = '<div class="text-red-500 text-xs text-center py-2">Error</div>';
    }
};

/**
 * Procesa el formulario de muteo del panel de moderadores
 */
export const handleModMuteForm = () => {
    const usernameInput = document.getElementById('mod-mute-username-input');
    const durationSelect = document.getElementById('mod-mute-duration-select');

    if (usernameInput && durationSelect) {
        const username = usernameInput.value;
        const duration = parseInt(durationSelect.value);

        muteUser(username, duration).then(success => {
            if (success) {
                usernameInput.value = '';
                loadModMutedUsers();
            }
        });
    }
};

/**
 * Procesa el formulario de baneo del panel de moderadores
 */
export const handleModBanForm = () => {
    const usernameInput = document.getElementById('mod-ban-username-input');

    if (usernameInput) {
        const username = usernameInput.value;

        banUser(username).then(success => {
            if (success) {
                usernameInput.value = '';
                loadModBannedUsers();
                loadModMutedUsers();
            }
        });
    }
};

/**
 * Carga y muestra la lista de moderadores
 */
const loadModerators = async () => {
    const container = document.getElementById('moderators-list');
    if (!container) return;

    container.innerHTML = '<div class="text-gray-500 text-xs text-center py-4">Cargando...</div>';

    try {
        const q = query(collection(db, 'moderators'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-gray-500 text-xs text-center py-4">No hay moderadores</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div class="flex items-center justify-between p-3 bg-[#0a0a0a] rounded border border-[#222]">
                    <div>
                        <div class="text-white text-sm font-bold">${data.username || 'Usuario'}</div>
                        <div class="text-gray-500 text-xs font-mono">${data.uid}</div>
                    </div>
                    <button onclick="app.removeModerator('${data.uid}')" 
                        class="text-red-500 hover:text-red-400 text-xs font-bold px-3 py-1 border border-red-500 rounded hover:bg-red-500/10">
                        Quitar
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading moderators:', error);
        container.innerHTML = '<div class="text-red-500 text-xs text-center py-4">Error al cargar moderadores</div>';
    }
};

/**
 * Agrega un moderador
 * @param {string} uid - UID del usuario a hacer moderador
 */
export const addModerator = async (uid) => {
    if (!uid || uid.trim() === '') {
        alert('Por favor ingresa un UID válido');
        return;
    }

    uid = uid.trim();

    // No permitir agregar al developer como mod
    if (uid === DEVELOPER_UID) {
        alert('El desarrollador ya tiene todos los permisos');
        return;
    }

    try {
        // Verificar si el usuario existe
        const userDoc = await getDoc(doc(db, 'user_profiles', uid));
        if (!userDoc.exists()) {
            alert('No se encontró un usuario con ese UID');
            return;
        }

        const userData = userDoc.data();

        // Agregar a la colección de moderadores
        await setDoc(doc(db, 'moderators', uid), {
            uid: uid,
            username: userData.username || 'Usuario',
            addedBy: DEVELOPER_UID,
            addedAt: Date.now()
        });

        // Actualizar el rol en el perfil del usuario
        await setDoc(doc(db, 'user_profiles', uid), {
            ...userData,
            role: 'moderator'
        });

        alert(`✅ ${userData.username} ahora es moderador`);
        loadModerators();

        // Limpiar input
        const input = document.getElementById('add-mod-input');
        if (input) input.value = '';

    } catch (error) {
        console.error('Error adding moderator:', error);
        alert('Error al agregar moderador: ' + error.message);
    }
};

/**
 * Quita un moderador
 * @param {string} uid - UID del moderador a quitar
 */
export const removeModerator = async (uid) => {
    if (!confirm('¿Estás seguro de quitar a este moderador?')) {
        return;
    }

    try {
        // Obtener datos del usuario antes de quitar
        const userDoc = await getDoc(doc(db, 'user_profiles', uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();

            // Actualizar rol a usuario normal
            await setDoc(doc(db, 'user_profiles', uid), {
                ...userData,
                role: 'user'
            });
        }

        // Eliminar de la colección de moderadores
        await deleteDoc(doc(db, 'moderators', uid));

        alert('✅ Moderador removido');
        loadModerators();

    } catch (error) {
        console.error('Error removing moderator:', error);
        alert('Error al quitar moderador: ' + error.message);
    }
};

/**
 * Procesa el formulario de agregar moderador
 */
export const handleAddModeratorForm = () => {
    const input = document.getElementById('add-mod-input');
    if (input) {
        addModerator(input.value);
    }
};

// ==================== PRIMER USUARIO BADGE ====================

/**
 * Obtiene los badges especiales de un usuario
 * @param {string} uid - UID del usuario
 * @returns {Promise<object>} - Objeto con badges {isFirstUser: boolean}
 */
export const getUserBadges = async (uid) => {
    const badges = {
        isFirstUser: false
    };

    try {
        const firstUserDoc = await getDoc(doc(db, 'first_users', uid));
        if (firstUserDoc.exists()) {
            badges.isFirstUser = true;
        }
    } catch (error) {
        console.error('Error getting user badges:', error);
    }

    return badges;
};

/**
 * Carga y muestra la lista de "Primer Usuario"
 */
export const loadFirstUsers = async () => {
    const container = document.getElementById('first-users-list');
    if (!container) return;

    container.innerHTML = '<div class="text-gray-500 text-xs text-center py-4">Cargando...</div>';

    try {
        const q = query(collection(db, 'first_users'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-gray-500 text-xs text-center py-4">No hay usuarios con esta insignia</div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div class="flex items-center justify-between p-3 bg-[#0a0a0a] rounded border border-[#222]">
                    <div>
                        <div class="text-white text-sm font-bold flex items-center gap-2">
                            ${data.username || 'Usuario'}
                            <span class="px-2 py-0.5 bg-gradient-to-r from-cyan-400 to-sky-500 text-black text-[9px] font-black uppercase rounded">PRIMER USUARIO</span>
                        </div>
                        <div class="text-gray-500 text-xs font-mono">${data.uid}</div>
                    </div>
                    <button onclick="app.removeFirstUser('${data.uid}')" 
                        class="text-red-500 hover:text-red-400 text-xs font-bold px-3 py-1 border border-red-500 rounded hover:bg-red-500/10">
                        Quitar
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading first users:', error);
        container.innerHTML = '<div class="text-red-500 text-xs text-center py-4">Error al cargar usuarios</div>';
    }
};

/**
 * Agrega un usuario con insignia "Primer Usuario"
 * @param {string} uid - UID del usuario
 */
export const addFirstUser = async (uid) => {
    if (!uid || uid.trim() === '') {
        alert('Por favor ingresa un UID válido');
        return;
    }

    uid = uid.trim();

    try {
        // Verificar si el usuario existe
        const userDoc = await getDoc(doc(db, 'user_profiles', uid));
        if (!userDoc.exists()) {
            alert('No se encontró un usuario con ese UID');
            return;
        }

        const userData = userDoc.data();

        // Agregar a la colección de first_users
        await setDoc(doc(db, 'first_users', uid), {
            uid: uid,
            username: userData.username || 'Usuario',
            addedBy: DEVELOPER_UID,
            addedAt: Date.now()
        });

        alert(`✅ ${userData.username} ahora tiene la insignia PRIMER USUARIO`);
        loadFirstUsers();

        // Limpiar input
        const input = document.getElementById('add-first-user-input');
        if (input) input.value = '';

    } catch (error) {
        console.error('Error adding first user:', error);
        alert('Error al agregar usuario: ' + error.message);
    }
};

/**
 * Quita la insignia "Primer Usuario" de un usuario
 * @param {string} uid - UID del usuario
 */
export const removeFirstUser = async (uid) => {
    if (!confirm('¿Estás seguro de quitar esta insignia?')) {
        return;
    }

    try {
        // Eliminar de la colección
        await deleteDoc(doc(db, 'first_users', uid));

        alert('✅ Insignia removida');
        loadFirstUsers();

    } catch (error) {
        console.error('Error removing first user:', error);
        alert('Error al quitar insignia: ' + error.message);
    }
};

/**
 * Procesa el formulario de agregar "Primer Usuario"
 */
export const handleAddFirstUserForm = () => {
    const input = document.getElementById('add-first-user-input');
    if (input) {
        addFirstUser(input.value);
    }
};

// ==================== MUTE/BAN SYSTEM ====================

/**
 * Busca un usuario por su username
 * @param {string} username - Username a buscar
 * @returns {Promise<object|null>} - Datos del usuario o null
 */
export const searchUserByUsername = async (username) => {
    if (!username || username.trim() === '') return null;

    username = username.trim().toLowerCase();

    try {
        const q = query(collection(db, 'user_profiles'));
        const snapshot = await getDocs(q);

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (data.username && data.username.toLowerCase() === username) {
                return { uid: docSnap.id, ...data };
            }
        }

        return null;
    } catch (error) {
        console.error('Error searching user:', error);
        return null;
    }
};

/**
 * Mutea un usuario por un tiempo determinado
 * @param {string} username - Username del usuario a mutear
 * @param {number} durationMinutes - Duración en minutos
 * @returns {Promise<boolean>} - Éxito o fallo
 */
export const muteUser = async (username, durationMinutes) => {
    try {
        // Buscar usuario por username
        const user = await searchUserByUsername(username);
        if (!user) {
            alert('No se encontró un usuario con ese nombre');
            return false;
        }

        // No permitir mutear al developer
        if (user.uid === DEVELOPER_UID) {
            alert('No puedes mutear al desarrollador');
            return false;
        }

        // Calcular fecha de expiración
        const expiresAt = Date.now() + (durationMinutes * 60 * 1000);

        // Guardar en Firestore
        await setDoc(doc(db, 'muted_users', user.uid), {
            uid: user.uid,
            username: user.username,
            mutedAt: Date.now(),
            expiresAt: expiresAt,
            durationMinutes: durationMinutes
        });

        // Formatear duración para mensaje
        let durationText = '';
        if (durationMinutes < 60) {
            durationText = `${durationMinutes} minutos`;
        } else if (durationMinutes < 1440) {
            durationText = `${durationMinutes / 60} horas`;
        } else if (durationMinutes < 10080) {
            durationText = `${durationMinutes / 1440} días`;
        } else {
            durationText = `${durationMinutes / 10080} semanas`;
        }

        alert(`✅ ${user.username} ha sido muteado por ${durationText}`);
        loadMutedUsers();
        return true;
    } catch (error) {
        console.error('Error muting user:', error);
        alert('Error al mutear usuario: ' + error.message);
        return false;
    }
};

/**
 * Quita el muteo de un usuario
 * @param {string} uid - UID del usuario
 */
export const unmuteUser = async (uid) => {
    if (!confirm('¿Estás seguro de quitar el muteo?')) return;

    try {
        await deleteDoc(doc(db, 'muted_users', uid));
        alert('✅ Muteo removido');
        loadMutedUsers();
    } catch (error) {
        console.error('Error unmuting user:', error);
        alert('Error al quitar muteo: ' + error.message);
    }
};

/**
 * Banea un usuario permanentemente
 * @param {string} username - Username del usuario a banear
 * @returns {Promise<boolean>} - Éxito o fallo
 */
export const banUser = async (username) => {
    try {
        // Buscar usuario por username
        const user = await searchUserByUsername(username);
        if (!user) {
            alert('No se encontró un usuario con ese nombre');
            return false;
        }

        // No permitir banear al developer
        if (user.uid === DEVELOPER_UID) {
            alert('No puedes banear al desarrollador');
            return false;
        }

        // Confirmar acción
        if (!confirm(`¿Estás seguro de banear PERMANENTEMENTE a "${user.username}"?`)) {
            return false;
        }

        // Guardar en Firestore
        await setDoc(doc(db, 'banned_users', user.uid), {
            uid: user.uid,
            username: user.username,
            bannedAt: Date.now()
        });

        // Si estaba muteado, quitar el muteo
        try {
            await deleteDoc(doc(db, 'muted_users', user.uid));
        } catch (e) { /* ignore */ }

        alert(`⛔ ${user.username} ha sido baneado permanentemente`);
        loadBannedUsers();
        loadMutedUsers();
        return true;
    } catch (error) {
        console.error('Error banning user:', error);
        alert('Error al banear usuario: ' + error.message);
        return false;
    }
};

/**
 * Quita el baneo de un usuario
 * @param {string} uid - UID del usuario
 */
export const unbanUser = async (uid) => {
    if (!confirm('¿Estás seguro de quitar el baneo?')) return;

    try {
        await deleteDoc(doc(db, 'banned_users', uid));
        alert('✅ Baneo removido');
        loadBannedUsers();
    } catch (error) {
        console.error('Error unbanning user:', error);
        alert('Error al quitar baneo: ' + error.message);
    }
};

/**
 * Verifica si un usuario está muteado
 * @param {string} uid - UID del usuario
 * @returns {Promise<object|null>} - Datos del muteo o null
 */
export const isUserMuted = async (uid) => {
    try {
        const docSnap = await getDoc(doc(db, 'muted_users', uid));
        if (!docSnap.exists()) return null;

        const data = docSnap.data();

        // Verificar si expiró
        if (data.expiresAt && data.expiresAt < Date.now()) {
            // Muteo expirado, eliminar
            await deleteDoc(doc(db, 'muted_users', uid));
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error checking mute status:', error);
        return null;
    }
};

/**
 * Verifica si un usuario está baneado
 * @param {string} uid - UID del usuario
 * @returns {Promise<object|null>} - Datos del baneo o null
 */
export const isUserBanned = async (uid) => {
    try {
        const docSnap = await getDoc(doc(db, 'banned_users', uid));
        if (!docSnap.exists()) return null;
        return docSnap.data();
    } catch (error) {
        console.error('Error checking ban status:', error);
        return null;
    }
};

/**
 * Obtiene el tiempo restante de muteo formateado
 * @param {object} muteData - Datos del muteo
 * @returns {string} - Tiempo restante formateado
 */
export const getMuteTimeRemaining = (muteData) => {
    if (!muteData || !muteData.expiresAt) return '';

    const remaining = muteData.expiresAt - Date.now();
    if (remaining <= 0) return '';

    const minutes = Math.floor(remaining / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days} día${days > 1 ? 's' : ''} y ${hours % 24} hora${hours % 24 !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `${hours} hora${hours > 1 ? 's' : ''} y ${minutes % 60} minuto${minutes % 60 !== 1 ? 's' : ''}`;
    } else {
        return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }
};

/**
 * Carga y muestra la lista de usuarios muteados
 */
export const loadMutedUsers = async () => {
    const container = document.getElementById('muted-users-list');
    if (!container) return;

    container.innerHTML = '<div class="text-gray-500 text-xs text-center py-4">Cargando...</div>';

    try {
        const q = query(collection(db, 'muted_users'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-gray-500 text-xs text-center py-4">No hay usuarios muteados</div>';
            return;
        }

        let html = '';
        const now = Date.now();

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // Verificar si expiró
            if (data.expiresAt && data.expiresAt < now) {
                // Eliminar muteo expirado
                await deleteDoc(doc(db, 'muted_users', docSnap.id));
                continue;
            }

            const timeRemaining = getMuteTimeRemaining(data);

            html += `
                <div class="flex items-center justify-between p-3 bg-[#0a0a0a] rounded border border-[#222]">
                    <div>
                        <div class="text-white text-sm font-bold">${data.username || 'Usuario'}</div>
                        <div class="text-yellow-500 text-xs">⏱ ${timeRemaining} restante</div>
                    </div>
                    <button onclick="app.unmuteUser('${data.uid}')" 
                        class="text-green-500 hover:text-green-400 text-xs font-bold px-3 py-1 border border-green-500 rounded hover:bg-green-500/10">
                        Quitar
                    </button>
                </div>
            `;
        }

        if (!html) {
            container.innerHTML = '<div class="text-gray-500 text-xs text-center py-4">No hay usuarios muteados</div>';
        } else {
            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading muted users:', error);
        container.innerHTML = '<div class="text-red-500 text-xs text-center py-4">Error al cargar</div>';
    }
};

/**
 * Carga y muestra la lista de usuarios baneados
 */
export const loadBannedUsers = async () => {
    const container = document.getElementById('banned-users-list');
    if (!container) return;

    container.innerHTML = '<div class="text-gray-500 text-xs text-center py-4">Cargando...</div>';

    try {
        const q = query(collection(db, 'banned_users'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-gray-500 text-xs text-center py-4">No hay usuarios baneados</div>';
            return;
        }

        let html = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            html += `
                <div class="flex items-center justify-between p-3 bg-[#0a0a0a] rounded border border-red-500/30">
                    <div>
                        <div class="text-white text-sm font-bold">${data.username || 'Usuario'}</div>
                        <div class="text-red-500 text-xs">⛔ Baneado permanentemente</div>
                    </div>
                    <button onclick="app.unbanUser('${data.uid}')" 
                        class="text-green-500 hover:text-green-400 text-xs font-bold px-3 py-1 border border-green-500 rounded hover:bg-green-500/10">
                        Quitar
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading banned users:', error);
        container.innerHTML = '<div class="text-red-500 text-xs text-center py-4">Error al cargar</div>';
    }
};

/**
 * Procesa el formulario de muteo
 */
export const handleMuteForm = () => {
    const usernameInput = document.getElementById('mute-username-input');
    const durationSelect = document.getElementById('mute-duration-select');

    if (usernameInput && durationSelect) {
        const username = usernameInput.value;
        const duration = parseInt(durationSelect.value);

        muteUser(username, duration).then(success => {
            if (success) {
                usernameInput.value = '';
            }
        });
    }
};

/**
 * Procesa el formulario de baneo
 */
export const handleBanForm = () => {
    const usernameInput = document.getElementById('ban-username-input');

    if (usernameInput) {
        const username = usernameInput.value;

        banUser(username).then(success => {
            if (success) {
                usernameInput.value = '';
            }
        });
    }
};

/**
 * Abre el panel de moderación (actualizado para cargar muteos/baneos)
 */
export const openModerationPanelFull = () => {
    const modal = document.getElementById('moderation-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadModerators();
        loadFirstUsers();
        loadMutedUsers();
        loadBannedUsers();
    }
};
