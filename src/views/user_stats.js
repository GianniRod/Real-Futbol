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
    doc,
    getDoc,
    setDoc
} from '../core/firebase.js';

/**
 * Obtiene el número de comentarios de un usuario desde su perfil
 * Como fallback, cuenta manualmente sus mensajes
 * @param {string} uid - UID del usuario
 * @returns {Promise<number>} - Cantidad de comentarios
 */
export const getUserCommentCount = async (uid) => {
    try {
        console.log('getUserCommentCount called for UID:', uid);

        // Primero intentar obtener del perfil del usuario
        const userProfileRef = doc(db, "user_profiles", uid);
        const userProfileSnap = await getDoc(userProfileRef);

        if (userProfileSnap.exists() && userProfileSnap.data().commentCount !== undefined) {
            const count = userProfileSnap.data().commentCount || 0;
            console.log('Comment count from profile:', count);
            return count;
        }

        // Si no existe en el perfil, contar manualmente (solo PROPIOS mensajes)
        console.log('Counting manually from messages...');
        let count = 0;

        try {
            // Contar en foro global
            const globalQuery = query(collection(db, "forum_messages"), where("userId", "==", uid));
            const globalSnapshot = await getDocs(globalQuery);
            count += globalSnapshot.size;
            console.log('Global forum count:', globalSnapshot.size);
        } catch (e) {
            console.log('Could not count global messages:', e.message);
        }

        try {
            // Contar en foros de partidos (match_forum_messages)
            const matchQuery = query(collection(db, "match_forum_messages"), where("userId", "==", uid));
            const matchSnapshot = await getDocs(matchQuery);
            count += matchSnapshot.size;
            console.log('Match forum count:', matchSnapshot.size);
        } catch (e) {
            console.log('Could not count match messages:', e.message);
        }

        console.log('Total manual count:', count);

        // Guardar el count en el perfil para la próxima vez
        if (count > 0 && userProfileSnap.exists()) {
            try {
                await setDoc(userProfileRef, { commentCount: count }, { merge: true });
                console.log('Saved comment count to profile');
            } catch (e) {
                console.log('Could not save count to profile:', e.message);
            }
        }

        return count;
    } catch (error) {
        console.error("Error getting comment count:", error);
        return 0;
    }
};

/**
 * Obtiene el ranking simplificado del usuario
 * Retorna 0 si no se puede calcular por permisos
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

        // Intentar obtener todos los perfiles para calcular ranking
        try {
            const profilesSnapshot = await getDocs(collection(db, "user_profiles"));
            const usersWithComments = [];

            profilesSnapshot.forEach(docSnap => {
                const data = docSnap.data();
                const userCount = data.commentCount || 0;
                if (userCount > 0) {
                    usersWithComments.push({
                        uid: docSnap.id,
                        count: userCount
                    });
                }
            });

            // Ordenar por comentarios (descendente)
            usersWithComments.sort((a, b) => b.count - a.count);

            // Encontrar posición del usuario actual
            const position = usersWithComments.findIndex(user => user.uid === uid);

            if (position >= 0) {
                const ranking = position + 1;
                console.log('Ranking calculated:', ranking);
                return ranking;
            }

            // Si no se encontró, agregarlo manualmente
            usersWithComments.push({ uid, count: commentCount });
            usersWithComments.sort((a, b) => b.count - a.count);
            const newPosition = usersWithComments.findIndex(user => user.uid === uid);
            const ranking = newPosition + 1;
            console.log('Ranking calculated (added user):', ranking);
            return ranking;

        } catch (e) {
            console.log('Could not calculate ranking from profiles:', e.message);
            // Si no podemos acceder a perfiles, retornar 0
            return 0;
        }
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

/**
 * Incrementa el contador de comentarios del usuario
 * Se debe llamar cada vez que el usuario envía un mensaje
 * @param {string} uid - UID del usuario
 */
export const incrementUserCommentCount = async (uid) => {
    try {
        const userProfileRef = doc(db, "user_profiles", uid);
        const userProfileSnap = await getDoc(userProfileRef);

        if (userProfileSnap.exists()) {
            const currentCount = userProfileSnap.data().commentCount || 0;
            await setDoc(userProfileRef, { commentCount: currentCount + 1 }, { merge: true });
            console.log('Incremented comment count for user:', uid);
        }
    } catch (error) {
        console.error("Error incrementing comment count:", error);
    }
};
