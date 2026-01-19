/**
 * User Statistics Module
 * 
 * Propósito: Calcular estadísticas de usuario (comentarios, ranking)
 * 
 * Exports:
 * - getUserStats(uid): Obtiene estadísticas del usuario
 */

import {
    db,
    collection,
    query,
    where,
    getDocs,
    getCountFromServer
} from '../core/firebase.js';

/**
 * Obtiene el número de comentarios de un usuario
 * @param {string} uid - UID del usuario
 * @returns {Promise<number>} - Cantidad de comentarios
 */
export const getUserCommentCount = async (uid) => {
    try {
        // Contar mensajes en foro global
        const globalQuery = query(collection(db, "forum_messages"), where("uid", "==", uid));
        const globalSnapshot = await getCountFromServer(globalQuery);

        // Contar mensajes en foros de partidos
        const matchQuery = query(collection(db, "match_forum_messages"), where("uid", "==", uid));
        const matchSnapshot = await getCountFromServer(matchQuery);

        return globalSnapshot.data().count + matchSnapshot.data().count;
    } catch (error) {
        console.error("Error getting comment count:", error);
        return 0;
    }
};

/**
 * Obtiene el ranking del usuario basado en cantidad de comentarios
 * @param {string} uid - UID del usuario
 * @param {number} commentCount - Cantidad de comentarios del usuario
 * @returns {Promise<number>} - Posición en el ranking (1 = primero)
 */
export const getUserRanking = async (uid, commentCount) => {
    try {
        // Si el usuario no tiene comentarios, no está en el ranking
        if (commentCount === 0) {
            return 0;
        }

        // Obtener todos los usuarios únicos con sus conteos de comentarios
        const usersMap = new Map();

        // Mensajes de foro global
        const globalSnapshot = await getDocs(collection(db, "forum_messages"));
        globalSnapshot.forEach(doc => {
            const docUid = doc.data().uid;
            if (docUid) {
                usersMap.set(docUid, (usersMap.get(docUid) || 0) + 1);
            }
        });

        // Mensajes de foros de partidos
        const matchSnapshot = await getDocs(collection(db, "match_forum_messages"));
        matchSnapshot.forEach(doc => {
            const docUid = doc.data().uid;
            if (docUid) {
                usersMap.set(docUid, (usersMap.get(docUid) || 0) + 1);
            }
        });

        // Convertir a array de objetos y ordenar por comentarios (descendente)
        const userStats = Array.from(usersMap.entries())
            .map(([userId, count]) => ({ uid: userId, count }))
            .sort((a, b) => b.count - a.count);

        // Encontrar posición del usuario actual
        const position = userStats.findIndex(user => user.uid === uid);

        // Retornar posición (sumamos 1 porque findIndex es 0-indexed)
        return position >= 0 ? position + 1 : userStats.length + 1;
    } catch (error) {
        console.error("Error calculating ranking:", error);
        return 0;
    }
};

/**
 * Obtiene todas las estadísticas del usuario
 * @param {string} uid - UID del usuario
 * @returns {Promise<object>} - Estadísticas del usuario
 */
export const getUserStats = async (uid) => {
    try {
        const commentCount = await getUserCommentCount(uid);
        const ranking = await getUserRanking(uid, commentCount);

        return {
            commentCount,
            ranking
        };
    } catch (error) {
        console.error("Error getting user stats:", error);
        return {
            commentCount: 0,
            ranking: 0
        };
    }
};
