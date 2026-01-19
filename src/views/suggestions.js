/**
 * Suggestions Module
 * 
 * Propósito: Manejar envío de sugerencias de usuarios
 * 
 * Exports:
 * - openSuggestionModal(): Abre el modal de sugerencias
 * - closeSuggestionModal(): Cierra el modal de sugerencias
 * - sendSuggestion(): Envía una sugerencia a Firestore
 */

import {
    db,
    collection,
    addDoc
} from '../core/firebase.js';

/**
 * Abre el modal de sugerencias
 */
export const openSuggestionModal = () => {
    const modal = document.getElementById('suggestion-modal');
    const input = document.getElementById('suggestion-input');
    const charCount = document.getElementById('suggestion-char-count');

    if (modal) {
        modal.classList.remove('hidden');

        // Limpiar input
        if (input) {
            input.value = '';
            if (charCount) charCount.textContent = '0 / 500';
        }

        // Ocultar error
        const errorDiv = document.getElementById('suggestion-error');
        if (errorDiv) errorDiv.classList.add('hidden');

        // Focus en textarea
        if (input) input.focus();

        // Agregar contador de caracteres
        if (input && !input.dataset.listenerAdded) {
            input.addEventListener('input', () => {
                const count = input.value.length;
                if (charCount) {
                    charCount.textContent = `${count} / 500`;
                    if (count > 450) {
                        charCount.classList.add('text-yellow-500');
                        charCount.classList.remove('text-gray-600');
                    } else {
                        charCount.classList.add('text-gray-600');
                        charCount.classList.remove('text-yellow-500');
                    }
                }
            });
            input.dataset.listenerAdded = 'true';
        }
    }
};

/**
 * Cierra el modal de sugerencias
 */
export const closeSuggestionModal = () => {
    const modal = document.getElementById('suggestion-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

/**
 * Muestra un mensaje de error en el modal
 * @param {string} message - Mensaje de error
 */
const showSuggestionError = (message) => {
    const errorDiv = document.getElementById('suggestion-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
};

/**
 * Envía una sugerencia a Firestore
 */
export const sendSuggestion = async () => {
    // Importar auth para obtener usuario
    const { getCurrentUser, getCurrentUserProfile } = await import('./auth.js');

    const user = getCurrentUser();
    const profile = getCurrentUserProfile();

    // Verificar autenticación
    if (!user) {
        showSuggestionError('Debes iniciar sesión para enviar sugerencias');
        return;
    }

    const input = document.getElementById('suggestion-input');
    const text = input?.value.trim();

    if (!text) {
        showSuggestionError('Por favor escribe tu sugerencia');
        return;
    }

    if (text.length < 10) {
        showSuggestionError('La sugerencia debe tener al menos 10 caracteres');
        return;
    }

    try {
        // Guardar sugerencia en Firestore
        await addDoc(collection(db, 'suggestions'), {
            userId: user.uid,
            username: profile?.username || 'Usuario',
            userEmail: user.email,
            suggestion: text,
            timestamp: Date.now(),
            status: 'pending', // pending, reviewed, implemented
            createdAt: new Date().toISOString()
        });

        // Mostrar mensaje de éxito
        if (input) input.value = '';

        // Cerrar modal con un pequeño delay para feedback
        const successMsg = document.createElement('div');
        successMsg.className = 'text-green-500 text-sm font-bold text-center py-2';
        successMsg.textContent = '✓ Sugerencia enviada correctamente';

        const modal = document.getElementById('suggestion-modal');
        const form = modal?.querySelector('.space-y-4');
        if (form) {
            form.insertBefore(successMsg, form.firstChild);
        }

        setTimeout(() => {
            closeSuggestionModal();
            if (successMsg.parentNode) {
                successMsg.remove();
            }
        }, 2000);

    } catch (error) {
        console.error('Error sending suggestion:', error);
        showSuggestionError('Error al enviar sugerencia: ' + error.message);
    }
};
