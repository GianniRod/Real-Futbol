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
