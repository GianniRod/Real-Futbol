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
let messageReactions = {}; // {messageId: {likes: count, dislikes: count, userLike: bool, userDislike: bool}}

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
            // Get reaction data for this message
            const reactions = messageReactions[msg.id] || { likes: 0, dislikes: 0, userLike: false, userDislike: false };

            return `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-3 animate-fade-in group relative" data-message-id="${msg.id}">
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
                    
                    <div class="flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''} w-full max-w-[85%]">
                        <!-- Message content -->
                        <div class="flex-1 ${isMe ? 'bg-white text-black border-white' : 'bg-[#111] text-gray-300 border-[#333]'} border px-3 py-2 rounded-lg text-sm break-words shadow-sm relative">
                            ${msg.replyTo ? `
                                <div class="mb-2 pl-2 border-l-2 border-gray-500 text-xs opacity-70">
                                    <div class="font-bold">@${msg.replyTo.username}</div>
                                    <div class="truncate">${msg.replyTo.text}</div>
                                </div>
                            ` : ''}
                            ${msg.text}
                            
                            <!-- 3-dot menu (desktop only, on hover) -->
                            ${currentUserId ? `
                                <button onclick="app.startReply('${msg.id}', '${msg.user.replace(/'/g, "\\\\'")}', '${msg.text.substring(0, 100).replace(/'/g, "\\\\'").replace(/\n/g, ' ')}')"
                                    class="hidden lg:block absolute -top-2 ${isMe ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity bg-[#222] hover:bg-[#333] rounded-full p-1.5"
                                    title="Responder">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                        
                        <!-- Reactions (right side for others, left side for me) -->
                        <div class="flex flex-col gap-0.5 shrink-0">
                            <button onclick="app.toggleReaction('${msg.id}', 'like')" 
                                class="flex items-center justify-center gap-1 ${reactions.userLike ? 'text-green-500' : 'text-gray-600'} hover:text-green-400 transition-colors text-xs"
                                title="Me gusta">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                ${reactions.likes > 0 ? `<span class="font-mono text-[10px]">${reactions.likes}</span>` : ''}
                            </button>
                            <button onclick="app.toggleReaction('${msg.id}', 'dislike')" 
                                class="flex items-center justify-center gap-1 ${reactions.userDislike ? 'text-red-500' : 'text-gray-600'} hover:text-red-400 transition-colors text-xs"
                                title="No me gusta">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                ${reactions.dislikes > 0 ? `<span class="font-mono text-[10px]">${reactions.dislikes}</span>` : ''}
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');

        console.log('Messages rendered, scrolling to bottom');

        // Auto scroll to bottom
        container.scrollTop = container.scrollHeight;

        // Cargar reacciones en tiempo real
        const messageIds = messagesData.map(m => m.id);
        if (messageIds.length > 0) {
            loadReactionsRealtime(messageIds, containerId);
        }
    });

    // Ya no usamos localStorage para username
};

/**
 * Carga las reacciones en tiempo real
 * @param {Array} messageIds - IDs de los mensajes
 * @param {string} containerId - ID del contenedor para re-render
 */
let reactionsUnsubscribe = null;
const loadReactionsRealtime = (messageIds, containerId) => {
    // Desuscribirse del listener anterior
    if (reactionsUnsubscribe) {
        reactionsUnsubscribe();
    }

    // Resetear reactions
    messageReactions = {};

    if (!messageIds.length) return;

    // Listener en tiempo real para reacciones
    const reactionsQuery = query(
        collection(db, 'message_reactions'),
        where('messageId', 'in', messageIds.slice(0, 10)) // Firestore limit
    );

    reactionsUnsubscribe = onSnapshot(reactionsQuery, async (snapshot) => {
        const { getCurrentUser } = await import('./auth.js');
        const currentUser = getCurrentUser();
        const currentUserId = currentUser ? currentUser.uid : null;

        // Resetear contadores
        messageReactions = {};

        snapshot.forEach(reactionDoc => {
            const reaction = reactionDoc.data();
            const msgId = reaction.messageId;

            if (!messageReactions[msgId]) {
                messageReactions[msgId] = {
                    likes: 0,
                    dislikes: 0,
                    userLike: false,
                    userDislike: false
                };
            }

            if (reaction.type === 'like') {
                messageReactions[msgId].likes++;
                if (reaction.userId === currentUserId) {
                    messageReactions[msgId].userLike = true;
                }
            } else if (reaction.type === 'dislike') {
                messageReactions[msgId].dislikes++;
                if (reaction.userId === currentUserId) {
                    messageReactions[msgId].userDislike = true;
                }
            }
        });

        // Re-render solo los botones de reacciones sin scroll
        updateReactionButtons(containerId);
    });
};

/**
 * Actualiza solo los botones de reacciones sin re-renderizar todo
 * @param {string} containerId - ID del contenedor
 */
const updateReactionButtons = (containerId) => {
    Object.keys(messageReactions).forEach(messageId => {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;

        const reactions = messageReactions[messageId];
        const reactionsContainer = messageEl.querySelector('.flex.flex-col.gap-0\\.5');

        if (reactionsContainer) {
            const likeBtn = reactionsContainer.children[0];
            const dislikeBtn = reactionsContainer.children[1];

            // Update like button
            if (likeBtn) {
                likeBtn.className = `flex items-center justify-center gap-1 ${reactions.userLike ? 'text-green-500' : 'text-gray-600'} hover:text-green-400 transition-colors text-xs`;
                const likeCount = likeBtn.querySelector('span');
                if (reactions.likes > 0) {
                    if (likeCount) {
                        likeCount.textContent = reactions.likes;
                    } else {
                        likeBtn.insertAdjacentHTML('beforeend', `<span class="font-mono text-[10px]">${reactions.likes}</span>`);
                    }
                } else if (likeCount) {
                    likeCount.remove();
                }
            }

            // Update dislike button
            if (dislikeBtn) {
                dislikeBtn.className = `flex items-center justify-center gap-1 ${reactions.userDislike ? 'text-red-500' : 'text-gray-600'} hover:text-red-400 transition-colors text-xs`;
                const dislikeCount = dislikeBtn.querySelector('span');
                if (reactions.dislikes > 0) {
                    if (dislikeCount) {
                        dislikeCount.textContent = reactions.dislikes;
                    } else {
                        dislikeBtn.insertAdjacentHTML('beforeend', `<span class="font-mono text-[10px]">${reactions.dislikes}</span>`);
                    }
                } else if (dislikeCount) {
                    dislikeCount.remove();
                }
            }
        }
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
 * Toggle like/dislike en un mensaje
 * @param {string} messageId - ID del mensaje
 * @param {string} type - 'like' o 'dislike'
 */
export const toggleReaction = async (messageId, type) => {
    const { getCurrentUser } = await import('./auth.js');
    const currentUser = getCurrentUser();

    if (!currentUser) {
        alert('Debes iniciar sesión para reaccionar');
        return;
    }

    const currentUserId = currentUser.uid;

    try {
        // Buscar si ya existe una reacción de este usuario para este mensaje
        const reactionQuery = query(
            collection(db, 'message_reactions'),
            where('messageId', '==', messageId),
            where('userId', '==', currentUserId)
        );

        const existingReactions = await getDocs(reactionQuery);

        // Si ya existe una reacción
        if (!existingReactions.empty) {
            const existingReaction = existingReactions.docs[0];
            const existingType = existingReaction.data().type;

            // Si es del mismo tipo, eliminar (toggle off)
            if (existingType === type) {
                await deleteDoc(existingReaction.ref);
            } else {
                // Si es de tipo diferente, actualizar
                await updateDoc(existingReaction.ref, { type });
            }
        } else {
            // No existe reacción, crear una nueva
            await addDoc(collection(db, 'message_reactions'), {
                messageId,
                userId: currentUserId,
                type,
                timestamp: Date.now()
            });
        }

        console.log('Reaction toggled successfully');

    } catch (error) {
        console.error('Error toggling reaction:', error);
        alert('Error al reaccionar: ' + error.message);
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
