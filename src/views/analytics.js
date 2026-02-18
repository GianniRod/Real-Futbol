/**
 * Analytics Module
 * 
 * Propósito: Mostrar estadísticas de la plataforma al desarrollador
 * 
 * Exports:
 * - openAnalyticsPanel(): Abre el panel de analytics
 * - closeAnalyticsPanel(): Cierra el panel
 * - recordVisit(): Registra una visita semanal
 */

import {
    db,
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    setDoc
} from '../core/firebase.js';

/**
 * Obtiene la clave de la semana actual (ej: "2026-W08")
 * @returns {string}
 */
const getWeekKey = (date = new Date()) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

/**
 * Registra una visita semanal en Firestore
 * Se llama desde auth.js al autenticar usuario
 */
export const recordVisit = async () => {
    try {
        const weekKey = getWeekKey();
        const visitRef = doc(db, "site_visits", weekKey);
        const visitSnap = await getDoc(visitRef);

        if (visitSnap.exists()) {
            const currentCount = visitSnap.data().count || 0;
            await setDoc(visitRef, {
                count: currentCount + 1,
                week: weekKey,
                updatedAt: Date.now()
            });
        } else {
            await setDoc(visitRef, {
                count: 1,
                week: weekKey,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }
    } catch (error) {
        console.error('Error recording visit:', error);
    }
};

/**
 * Cuenta usuarios totales (email + phone)
 * @returns {Promise<number>}
 */
const countTotalUsers = async () => {
    try {
        const snapshot = await getDocs(collection(db, "user_profiles"));
        let count = 0;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Contar solo si tiene email o phoneNumber (usuarios reales)
            if (data.email || data.phoneNumber) {
                count++;
            }
        });
        return count;
    } catch (error) {
        console.error('Error counting users:', error);
        return 0;
    }
};

/**
 * Obtiene visitas semanales (últimas 8 semanas)
 * @returns {Promise<Array<{week: string, count: number}>>}
 */
const getWeeklyVisits = async () => {
    try {
        const snapshot = await getDocs(collection(db, "site_visits"));
        const visits = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            visits.push({
                week: docSnap.id,
                count: data.count || 0
            });
        });

        // Ordenar por semana descendente y tomar últimas 8
        visits.sort((a, b) => b.week.localeCompare(a.week));
        return visits.slice(0, 8).reverse(); // Más antiguas primero para el gráfico
    } catch (error) {
        console.error('Error getting weekly visits:', error);
        return [];
    }
};

/**
 * Cuenta usuarios activos (lastActive en últimos 7 días)
 * @returns {Promise<number>}
 */
const countActiveUsers = async () => {
    try {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const snapshot = await getDocs(collection(db, "user_profiles"));
        let count = 0;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.lastActive && data.lastActive >= sevenDaysAgo) {
                count++;
            }
        });
        return count;
    } catch (error) {
        console.error('Error counting active users:', error);
        return 0;
    }
};

/**
 * Cuenta todos los comentarios en foros (global + partidos)
 * @returns {Promise<{total: number, global: number, matches: number}>}
 */
const countAllComments = async () => {
    let globalCount = 0;
    let matchCount = 0;

    try {
        // Contar mensajes del foro global (no deleted)
        const globalSnapshot = await getDocs(collection(db, "forum_messages"));
        globalSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.deleted) {
                globalCount++;
            }
        });
    } catch (error) {
        console.error('Error counting global messages:', error);
    }

    try {
        // Contar mensajes de foros de partidos
        const matchSnapshot = await getDocs(collection(db, "match_forum_messages"));
        matchSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.deleted) {
                matchCount++;
            }
        });
    } catch (error) {
        console.error('Error counting match messages:', error);
    }

    return {
        total: globalCount + matchCount,
        global: globalCount,
        matches: matchCount
    };
};

/**
 * Genera el HTML del mini gráfico de barras para visitas semanales
 * @param {Array<{week: string, count: number}>} visits
 * @returns {string}
 */
const renderVisitsChart = (visits) => {
    if (visits.length === 0) {
        return '<div class="text-gray-500 text-xs text-center py-4">Sin datos de visitas</div>';
    }

    const maxCount = Math.max(...visits.map(v => v.count), 1);

    const bars = visits.map(v => {
        const height = Math.max((v.count / maxCount) * 100, 4); // Mínimo 4% de altura
        const weekLabel = v.week.split('-W')[1] ? `S${v.week.split('-W')[1]}` : v.week;
        return `
            <div class="flex flex-col items-center gap-1 flex-1">
                <span class="text-[9px] text-gray-400 font-mono">${v.count}</span>
                <div class="w-full bg-[#222] rounded-t overflow-hidden" style="height: 60px;">
                    <div class="w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t transition-all" 
                         style="height: ${height}%; margin-top: ${100 - height}%;"></div>
                </div>
                <span class="text-[8px] text-gray-600 font-mono">${weekLabel}</span>
            </div>
        `;
    }).join('');

    return `<div class="flex items-end gap-1 mt-2">${bars}</div>`;
};

/**
 * Abre el panel de analytics y carga datos
 */
export const openAnalyticsPanel = async () => {
    const modal = document.getElementById('analytics-modal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Mostrar loading
    const content = document.getElementById('analytics-content');
    if (content) {
        content.innerHTML = `
            <div class="flex items-center justify-center py-16">
                <div class="loader"></div>
            </div>
        `;
    }

    // Cargar datos en paralelo
    const [totalUsers, weeklyVisits, activeUsers, comments] = await Promise.all([
        countTotalUsers(),
        getWeeklyVisits(),
        countActiveUsers(),
        countAllComments()
    ]);

    // Renderizar
    if (content) {
        content.innerHTML = `
            <!-- Usuarios Totales -->
            <div class="bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
                <div class="flex items-center gap-3 mb-1">
                    <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div>
                        <div class="text-2xl font-black text-white font-mono">${totalUsers}</div>
                        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Usuarios Totales</div>
                    </div>
                </div>
                <div class="text-[9px] text-gray-600 mt-1">Cuentan email y teléfono</div>
            </div>

            <!-- Visitas Semanales -->
            <div class="bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
                <div class="flex items-center gap-3 mb-2">
                    <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div>
                        <div class="text-2xl font-black text-white font-mono">${weeklyVisits.length > 0 ? weeklyVisits[weeklyVisits.length - 1].count : 0}</div>
                        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Visitas esta semana</div>
                    </div>
                </div>
                ${renderVisitsChart(weeklyVisits)}
            </div>

            <!-- Usuarios Activos -->
            <div class="bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
                <div class="flex items-center gap-3 mb-1">
                    <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                    </div>
                    <div>
                        <div class="text-2xl font-black text-white font-mono">${activeUsers}</div>
                        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Usuarios Activos</div>
                    </div>
                </div>
                <div class="text-[9px] text-gray-600 mt-1">Conectados al menos 1 vez en los últimos 7 días</div>
            </div>

            <!-- Comentarios Totales -->
            <div class="bg-[#0a0a0a] border border-[#222] rounded-lg p-4">
                <div class="flex items-center gap-3 mb-1">
                    <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <div>
                        <div class="text-2xl font-black text-white font-mono">${comments.total}</div>
                        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Comentarios Totales</div>
                    </div>
                </div>
                <div class="flex gap-4 mt-2">
                    <div class="text-[10px] text-gray-400">
                        <span class="text-white font-bold font-mono">${comments.global}</span> Foro Global
                    </div>
                    <div class="text-[10px] text-gray-400">
                        <span class="text-white font-bold font-mono">${comments.matches}</span> Foros de Partidos
                    </div>
                </div>
            </div>
        `;
    }
};

/**
 * Cierra el panel de analytics
 */
export const closeAnalyticsPanel = () => {
    const modal = document.getElementById('analytics-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};
