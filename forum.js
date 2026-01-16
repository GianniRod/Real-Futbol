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

import { db, collection, addDoc, query, where, onSnapshot } from '../core/firebase.js';
import { showOnly, hideView } from '../core/dom.js';

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

    activeForumUnsubscribe = onSnapshot(q, (snapshot) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-center text-gray-600 py-10 text-xs uppercase tracking-widest">Sé el primero en escribir.</div>';
            return;
        }

        const messages = [];
        snapshot.forEach(doc => messages.push(doc.data()));

        // Client-side sort
        messages.sort((a, b) => a.timestamp - b.timestamp);

        container.innerHTML = messages.map(msg => {
            const isMe = localStorage.getItem('chat_username') === msg.user;
            const date = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-3 animate-fade-in">
                    <span class="text-[10px] text-gray-500 font-bold uppercase mb-1 px-1">${msg.user} <span class="font-normal text-[#444] ml-1">${date}</span></span>
                    <div class="${isMe ? 'bg-white text-black border-white' : 'bg-[#111] text-gray-300 border-[#333]'} border px-3 py-2 rounded-lg max-w-[85%] text-sm break-words shadow-sm">
                        ${msg.text}
                    </div>
                </div>`;
        }).join('');

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
 * @param {string} userFieldId - ID del campo de username
 * @param {string} textFieldId - ID del campo de texto
 */
export const sendMessage = async (userFieldId, textFieldId) => {
    const userInp = document.getElementById(userFieldId);
    const textInp = document.getElementById(textFieldId);
    const user = userInp.value.trim();
    const text = textInp.value.trim();

    if (!user) {
        alert("Por favor ingresa un nombre o usuario.");
        return;
    }
    if (!text) return;

    localStorage.setItem('chat_username', user);

    try {
        await addDoc(collection(db, "forum_messages"), {
            context: currentForumContext,
            user: user,
            text: text,
            timestamp: Date.now()
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
    document.getElementById('date-nav').classList.add('hidden');
    document.getElementById('view-forum').classList.remove('hidden');

    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('mobile-backdrop').classList.add('hidden');

    initForum('global', 'forum-messages', 'forum-username');
};

// Exportar para acceso desde matchDetail
export { activeForumUnsubscribe, currentForumContext };
export const setForumContext = (context) => { currentForumContext = context; };
