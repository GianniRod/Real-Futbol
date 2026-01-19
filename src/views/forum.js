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

import { db, collection, addDoc, query, where, onSnapshot, doc, deleteDoc, updateDoc, getDocs } from '../core/firebase.js';
import { showOnly, hideView } from '../core/dom.js';
import { DEVELOPER_UID } from './moderation.js';

// State
let activeForumUnsubscribe = null;
let currentForumContext = 'global';
let replyingTo = null; // {messageId, username, text}

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

        // Importar para obtener role y usuario actual
        const { getCurrentUserRole, getCurrentUser } = await import('./auth.js');
        const userRole = getCurrentUserRole();
        const currentUser = getCurrentUser();
        const currentUserId = currentUser ? currentUser.uid : null;
        const canDelete = userRole === 'developer' || userRole === 'moderator';

        container.innerHTML = messagesData.map(msg => {
            // Comparar por userId en lugar de username de localStorage
            const isMe = currentUserId && msg.userId === currentUserId;
            const date = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            // Badge según role del autor
            let badge = '';
            if (msg.userId === DEVELOPER_UID) {
                badge = '<span class="ml-2 px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-[9px] font-black uppercase rounded shadow-lg">DESARROLLADOR</span>';
            } else if (msg.userRole === 'moderator') {
                badge = '<span class="ml-2 px-1.5 py-0.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[9px] font-black uppercase rounded">MOD</span>';
            }

            return `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-3 animate-fade-in group relative message-container" 
                     data-message-id="${msg.id}"
                     data-message-user="${msg.user.replace(/"/g, '&quot;')}"
                     data-message-text="${msg.text.substring(0, 100).replace(/"/g, '&quot;').replace(/\n/g, ' ')}">
                    <div class="flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}">
                        <span class="text-[10px] text-gray-500 font-bold uppercase px-1">${msg.user}</span>
                        ${badge}
                        <span class="font-normal text-[#444] text-[10px]">${date}</span>
                    </div>
                    <div class="relative max-w-[85%]">
                        <div class="${isMe ? 'bg-white text-black border-white' : 'bg-[#111] text-gray-300 border-[#333]'} border px-3 py-2 rounded-lg text-sm break-words shadow-sm">
                            ${msg.replyTo ? `
                                <div class="mb-2 pl-2 border-l-2 border-gray-500 text-xs opacity-70">
                                    <div class="font-bold">@${msg.replyTo.username}</div>
                                    <div class="truncate">${msg.replyTo.text}</div>
                                </div>
                            ` : ''}
                            ${msg.text}
                        </div>
                        
                        <!-- Reply arrow (desktop only, on hover) -->
                        ${currentUserId ? `
                            <button onclick="app.startReply('${msg.id}', '${msg.user.replace(/'/g, "\\\\'")}', '${msg.text.substring(0, 100).replace(/'/g, "\\\\'").replace(/\n/g, ' ')}')"
                                class="hidden lg:block absolute top-1 ${isMe ? '-left-7' : '-right-7'} opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white"
                                title="Responder">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                            </button>
                        ` : ''}
                        
                        <!-- Delete button (desktop only, on hover, moderators/dev only) -->
                        ${canDelete ? `
                            <button onclick="app.deleteMessage('${msg.id}'); event.stopPropagation();" 
                                class="hidden lg:block absolute top-1 ${isMe ? '-left-14' : '-right-14'} opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400"
                                title="Borrar mensaje">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>`;
        }).join('');

        console.log('Messages rendered, scrolling to bottom');

        // Auto scroll to bottom
        container.scrollTop = container.scrollHeight;

        // Agregar swipe gestures para móvil
        setupSwipeGestures(containerId);
    });

    // Ya no usamos localStorage para username
};

/**
 * Configura swipe gestures para responder en móvil
 * @param {string} containerId - ID del contenedor
 */
const setupSwipeGestures = (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const messages = container.querySelectorAll('.message-container');

    messages.forEach(messageEl => {
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;
        let currentMessageEl = null;

        const messageId = messageEl.dataset.messageId;
        const messageUser = messageEl.dataset.messageUser;
        const messageText = messageEl.dataset.messageText;

        // Touch start - identificar el mensaje específico
        messageEl.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            currentMessageEl = messageEl;
            isSwiping = true;
        }, { passive: true });

        // Touch move - aplicar transformación solo a este mensaje
        messageEl.addEventListener('touchmove', (e) => {
            if (!isSwiping || !currentMessageEl) return;

            currentX = e.touches[0].clientX;
            const diffX = currentX - startX;

            // Solo permitir swipe a la derecha y hasta 80px
            if (diffX > 0 && diffX <= 80) {
                // Prevenir el scroll del contenedor padre
                e.preventDefault();
                currentMessageEl.style.transform = `translateX(${diffX}px)`;
                currentMessageEl.style.transition = 'none';
            }
        }, { passive: false }); // passive: false para poder usar preventDefault

        // Touch end - reset del mensaje específico
        messageEl.addEventListener('touchend', () => {
            if (!isSwiping || !currentMessageEl) return;

            const diffX = currentX - startX;

            // Si swipe > 50px, activar reply
            if (diffX > 50) {
                if (window.app && window.app.startReply) {
                    window.app.startReply(messageId, messageUser, messageText);
                }
            }

            // Reset position solo de este mensaje
            currentMessageEl.style.transform = '';
            currentMessageEl.style.transition = 'transform 0.2s ease-out';

            isSwiping = false;
            currentMessageEl = null;
            startX = 0;
            currentX = 0;
        });

        // Touch cancel - reset por si se cancela el gesto
        messageEl.addEventListener('touchcancel', () => {
            if (currentMessageEl) {
                currentMessageEl.style.transform = '';
                currentMessageEl.style.transition = 'transform 0.2s ease-out';
            }
            isSwiping = false;
            currentMessageEl = null;
            startX = 0;
            currentX = 0;
        });
    });
};

/**
 * Envía un mensaje al foro actual
 * @param {string} userFieldId - ID del campo de username (ya no se usa, se mantiene por compatibilidad)
 * @param {string} textFieldId - ID del campo de texto
 */
export const sendMessage = async (userFieldId, textFieldId) => {
    // Importar auth dinámicamente para evitar dependencias circulares
    const { getCurrentUser, getCurrentUserProfile, getCurrentUserRole } = await import('./auth.js');
    const { incrementUserCommentCount } = await import('./user_stats.js');

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
        const messageData = {
            context: currentForumContext,
            userId: user.uid,
            user: profile.username,
            userRole: userRole,
            text: text,
            timestamp: Date.now(),
            userEmail: user.email
        };

        // Agregar replyTo si está respondiendo
        if (replyingTo) {
            messageData.replyTo = {
                messageId: replyingTo.messageId,
                username: replyingTo.username,
                text: replyingTo.text
            };
        }

        await addDoc(collection(db, "forum_messages"), messageData);

        // Incrementar contador de comentarios del usuario
        await incrementUserCommentCount(user.uid);

        textInp.value = '';

        // Cancelar reply si está activo
        if (replyingTo) {
            cancelReply();
        }
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

/**
 * Inicia una respuesta a un mensaje
 * @param {string} messageId - ID del mensaje a responder  
 * @param {string} username - Nombre del usuario a responder
 * @param {string} text - Texto del mensaje original
 */
export const startReply = (messageId, username, text) => {
    replyingTo = {
        messageId,
        username,
        text: text.substring(0, 100)
    };

    const replyIndicator = `
        <div id="reply-indicator" class="bg-[#1a1a1a] border border-[#333] rounded p-2 mb-2 flex items-center justify-between">
            <div class="text-xs">
                <div class="text-gray-400">Respondiendo a <span class="text-white font-bold">@${username}</span></div>
                <div class="text-gray-600 truncate">${text.substring(0, 50)}...</div>
            </div>
            <button onclick="app.cancelReply()" class="text-gray-500 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    `;

    const inputContainer = document.getElementById('forum-input-container') || document.getElementById('match-forum-input-container');
    if (inputContainer) {
        const oldIndicator = document.getElementById('reply-indicator');
        if (oldIndicator) oldIndicator.remove();

        inputContainer.insertAdjacentHTML('afterbegin', replyIndicator);

        const textField = document.getElementById('forum-text') || document.getElementById('match-forum-text');
        if (textField) textField.focus();
    }
};

/**
 * Cancela la respuesta actual
 */
export const cancelReply = () => {
    replyingTo = null;
    const indicator = document.getElementById('reply-indicator');
    if (indicator) indicator.remove();
};

// Exportar para acceso desde matchDetail
export { activeForumUnsubscribe, currentForumContext };
export const setForumContext = (context) => { currentForumContext = context; };
