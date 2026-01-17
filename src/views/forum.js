/**
 * Forum Module
 * 
 * Propósito: Manejar foro global y foros de partidos
 * 
 * Exports:
 * - navigateToForum(): Navega al foro global
 * - initForum(context, containerId, usernameInputId): Inicializa un foro
 * - sendMessage(userFieldId, textFieldId): Envía un mensaje
 */

import { db, collection, addDoc, query, where, onSnapshot, doc, deleteDoc, updateDoc } from '../core/firebase.js';
import { showOnly, hideView } from '../core/dom.js';
import { DEVELOPER_UID } from './moderation.js';

// State
let activeForumUnsubscribe = null;
let currentForumContext = 'global';

/**
 * Inicializa un foro (global o de partido)
 * @param {string} context - Contexto del foro ('global' o 'match_{id}')
 * @param {string} containerId - ID del contenedor de mensajes
 * @param {string} usernameInputId - ID del input de username
 */
export const initForum = (context, containerId, usernameInputId) => {
    // Desuscribirse del anterior si existe
    if (activeForumUnsubscribe) {
        activeForumUnsubscribe();
        activeForumUnsubscribe = null;
    }

    currentForumContext = context;

    // Query con filtro de contexto (sin orderBy para evitar índice)
    const q = query(
        collection(db, "forum_messages"),
        where("context", "==", context)
    );

    activeForumUnsubscribe = onSnapshot(q, async (snapshot) => {
        const container = document.getElementById(containerId);
        console.log('Forum container found:', !!container, 'Container ID:', containerId);

        if (!container) return;

        if (snapshot.empty) {
            console.log('No messages in forum');
            container.innerHTML = '<div class="text-center text-gray-600 py-10 text-xs uppercase tracking-widest">Sé el primero en escribir.</div>';
            return;
        }

        const messages = [];
        const messagesData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Filtrar mensajes borrados
            if (!data.deleted) {
                messagesData.push({ id: doc.id, ...data });
            }
        });

        console.log('Messages loaded:', messagesData.length);

        // Client-side sort
        messagesData.sort((a, b) => a.timestamp - b.timestamp);
        // Importar para obtener role actual
        const { getCurrentUserRole } = await import('./auth.js');
        const userRole = getCurrentUserRole();
        const canDelete = userRole === 'developer' || userRole === 'moderator';
        container.innerHTML = messagesData.map(msg => {
            const isMe = localStorage.getItem('chat_username') === msg.user;
            const date = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            // Badge según role del autor
            let badge = '';
            if (msg.userId === DEVELOPER_UID) {
                badge = '<span class="ml-2 px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-[9px] font-black uppercase rounded shadow-lg">DESARROLLADOR</span>';
            } else if (msg.userRole === 'moderator') {
                badge = '<span class="ml-2 px-1.5 py-0.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[9px] font-black uppercase rounded">MOD</span>';
            }
            return `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-3 animate-fade-in">
                    <div class="flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}">
                        <span class="text-[10px] text-gray-500 font-bold uppercase px-1">${msg.user}</span>
                        ${badge}
                        <span class="font-normal text-[#444] text-[10px]">${date}</span>
                        ${canDelete ? `
                            <button onclick="app.deleteMessage('${msg.id}'); event.stopPropagation();" 
                                class="text-red-500 hover:text-red-400 p-1 transition-colors"
                                title="Borrar mensaje">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                    <div class="${isMe ? 'bg-white text-black border-white' : 'bg-[#111] text-gray-300 border-[#333]'} border px-3 py-2 rounded-lg max-w-[85%] text-sm break-words shadow-sm">
                        ${msg.text}
                    </div>
                </div>`;
        }).join('');

        console.log('Messages rendered, scrolling to bottom');

        // Auto scroll to bottom
        container.scrollTop = container.scrollHeight;
    });

    // Pre-fill username if exists
    const savedUser = localStorage.getItem('chat_username');
    if (savedUser) {
        const inp = document.getElementById(usernameInputId);
        if (inp) inp.value = savedUser;
    }
};

/**
 * Envía un mensaje al foro actual
 * @param {string} userFieldId - ID del campo de username (ya no se usa, se mantiene por compatibilidad)
 * @param {string} textFieldId - ID del campo de texto
 */
export const sendMessage = async (userFieldId, textFieldId) => {
    // Importar auth dinámicamente para evitar dependencias circulares
    const { getCurrentUser, getCurrentUserProfile, getCurrentUserRole } = await import('./auth.js');

    const user = getCurrentUser();
    const profile = getCurrentUserProfile();
    const userRole = getCurrentUserRole();

    // Verificar autenticación
    if (!user) {
        alert("Debes iniciar sesión para enviar mensajes.");
        return;
    }

    // Verificar que tenga username
    if (!profile || !profile.username) {
        alert("Por favor establece tu nombre de usuario primero.");
        return;
    }

    const textInp = document.getElementById(textFieldId);
    const text = textInp.value.trim();

    if (!text) return;

    try {
        await addDoc(collection(db, "forum_messages"), {
            context: currentForumContext,
            userId: user.uid,
            user: profile.username,
            userRole: userRole, // Incluir rol para badges
            text: text,
            timestamp: Date.now(),
            userEmail: user.email // Para debugging si es necesario
        });
        textInp.value = '';
    } catch (e) {
        console.error("Error sending message: ", e);
        alert("Error al enviar mensaje.");
    }
};

/**
 * Navega al foro global
 */
export const navigateToForum = () => {
    document.getElementById('view-match-list').classList.add('hidden');
    document.getElementById('view-standings').classList.add('hidden');
    document.getElementById('view-match-detail').classList.add('hidden');
    document.getElementById('date-nav').classList.add('hidden');
    document.getElementById('view-forum').classList.remove('hidden');

    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('mobile-backdrop').classList.add('hidden');

    initForum('global', 'forum-messages', 'forum-username');

    // Actualizar URL
    if (window.app && window.app.navigate) {
        window.app.navigate('/foro', true); // replace para no agregar al historial
    }
};

/**
 * Borra un mensaje del foro
 * @param {string} messageId - ID del mensaje a borrar
 */
export const deleteMessage = async (messageId) => {
    if (!confirm('¿Estás seguro de borrar este mensaje?')) {
        return;
    }

    try {
        const { getCurrentUser, getCurrentUserRole } = await import('./auth.js');
        const user = getCurrentUser();
        const role = getCurrentUserRole();

        if (role !== 'developer' && role !== 'moderator') {
            alert('No tienes permisos para borrar mensajes');
            return;
        }

        // Borrado lógico - marcar como deleted
        await updateDoc(doc(db, 'forum_messages', messageId), {
            deleted: true,
            deletedBy: user.uid,
            deletedAt: Date.now()
        });

    } catch (error) {
        console.error('Error deleting message:', error);
        alert('Error al borrar mensaje: ' + error.message);
    }
};

// Exportar para acceso desde matchDetail
export { activeForumUnsubscribe, currentForumContext };
export const setForumContext = (context) => { currentForumContext = context; };
