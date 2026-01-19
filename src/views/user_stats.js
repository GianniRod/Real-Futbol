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
        console.log('getUserCommentCount called for UID:', uid);

        // Contar mensajes en foro global
        const globalQuery = query(collection(db, "forum_messages"), where("uid", "==", uid));
        const globalSnapshot = await getCountFromServer(globalQuery);
        const globalCount = globalSnapshot.data().count;
        console.log('Global forum count:', globalCount);

        // Contar mensajes en foros de partidos
        const matchQuery = query(collection(db, "match_forum_messages"), where("uid", "==", uid));
        const matchSnapshot = await getCountFromServer(matchQuery);
        const matchCount = matchSnapshot.data().count;
        console.log('Match forum count:', matchCount);

        const total = globalCount + matchCount;
        console.log('Total comment count:', total);
        return total;
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
        console.log('getUserRanking called for UID:', uid, 'with count:', commentCount);

        // Si el usuario no tiene comentarios, no está en el ranking
        if (commentCount === 0) {
            console.log('User has 0 comments, returning ranking 0');
            return 0;
        }

        // Obtener todos los usuarios únicos con sus conteos de comentarios
        const usersMap = new Map();

        // Mensajes de foro global
        console.log('Fetching global forum messages...');
        const globalSnapshot = await getDocs(collection(db, "forum_messages"));
        console.log('Global messages count:', globalSnapshot.size);
        globalSnapshot.forEach(doc => {
            const docUid = doc.data().uid;
            if (docUid) {
                usersMap.set(docUid, (usersMap.get(docUid) || 0) + 1);
            }
        });

        // Mensajes de foros de partidos
        console.log('Fetching match forum messages...');
        const matchSnapshot = await getDocs(collection(db, "match_forum_messages"));
        console.log('Match messages count:', matchSnapshot.size);
        matchSnapshot.forEach(doc => {
            const docUid = doc.data().uid;
            if (docUid) {
                usersMap.set(docUid, (usersMap.get(docUid) || 0) + 1);
            }
        });

        console.log('Total unique users:', usersMap.size);

        // Convertir a array de objetos y ordenar por comentarios (descendente)
        const userStats = Array.from(usersMap.entries())
            .map(([userId, count]) => ({ uid: userId, count }))
            .sort((a, b) => b.count - a.count);

        console.log('Top 10 users:', userStats.slice(0, 10));

        // Encontrar posición del usuario actual
        const position = userStats.findIndex(user => user.uid === uid);
        console.log('User position in array:', position);

        // Retornar posición (sumamos 1 porque findIndex es 0-indexed)
        const ranking = position >= 0 ? position + 1 : userStats.length + 1;
        console.log('Final ranking:', ranking);
        return ranking;
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
        console.log('getUserStats called for UID:', uid);
        const commentCount = await getUserCommentCount(uid);
        const ranking = await getUserRanking(uid, commentCount);

        const stats = {
            commentCount,
            ranking
        };
        console.log('Final stats:', stats);
        return stats;
    } catch (error) {
        console.error("Error getting user stats:", error);
        return {
            commentCount: 0,
            ranking: 0
        };
    }
};
