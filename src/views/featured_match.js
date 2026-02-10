/**
 * Featured Match Module
 * 
 * Propósito: Permitir al desarrollador destacar un partido del día
 * que se muestra en el sidebar derecho con vista compacta.
 * 
 * Exports:
 * - setFeaturedMatch(fixtureId, matchData): Guarda el partido destacado
 * - clearFeaturedMatch(): Quita el partido destacado
 * - loadFeaturedMatch(): Carga y renderiza el partido destacado
 * - renderFeaturedMatchButton(match, isDeveloper): Retorna HTML del botón ⭐
 */

import { db, doc, getDoc, setDoc, deleteDoc } from '../core/firebase.js';
import { fetchAPI } from '../core/api.js';

/**
 * Guarda un partido como destacado en Firestore
 * @param {number} fixtureId - ID del partido
 * @param {object} matchData - Datos básicos del partido para render rápido
 */
export const setFeaturedMatch = async (fixtureId, matchData) => {
    try {
        const docRef = doc(db, "app_config", "featured_match");
        await setDoc(docRef, {
            fixtureId: fixtureId,
            homeName: matchData.teams.home.name,
            awayName: matchData.teams.away.name,
            homeLogo: matchData.teams.home.logo,
            awayLogo: matchData.teams.away.logo,
            leagueName: matchData.league.name,
            leagueLogo: matchData.league.logo,
            date: matchData.fixture.date,
            updatedAt: Date.now()
        });
        console.log('Featured match set:', fixtureId);

        // Recargar el widget
        await loadFeaturedMatch();

        // Visual feedback
        const btn = document.getElementById(`star-btn-${fixtureId}`);
        if (btn) {
            btn.classList.add('text-yellow-400');
            btn.classList.remove('text-gray-600');
        }
    } catch (error) {
        console.error('Error setting featured match:', error);
    }
};

/**
 * Quita el partido destacado
 */
export const clearFeaturedMatch = async () => {
    try {
        const docRef = doc(db, "app_config", "featured_match");
        await deleteDoc(docRef);
        console.log('Featured match cleared');

        // Limpiar widget
        const container = document.getElementById('featured-match-container');
        if (container) container.innerHTML = '';

        // Quitar highlight de todos los botones estrella
        document.querySelectorAll('[id^="star-btn-"]').forEach(btn => {
            btn.classList.remove('text-yellow-400');
            btn.classList.add('text-gray-600');
        });
    } catch (error) {
        console.error('Error clearing featured match:', error);
    }
};

/**
 * Carga y renderiza el partido destacado en el sidebar
 */
export const loadFeaturedMatch = async () => {
    const container = document.getElementById('featured-match-container');
    if (!container) return;

    try {
        const docRef = doc(db, "app_config", "featured_match");
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            container.innerHTML = '';
            return;
        }

        const featured = docSnap.data();

        // Intentar obtener datos frescos de la API
        try {
            const data = await fetchAPI(`/fixtures?id=${featured.fixtureId}`);
            if (data.response && data.response.length > 0) {
                const match = data.response[0];
                renderFeaturedWidget(container, match);
                return;
            }
        } catch (e) {
            console.warn('Could not fetch fresh match data, using cached:', e);
        }

        // Fallback: usar datos guardados en Firestore (sin score en vivo)
        renderFeaturedWidgetFallback(container, featured);
    } catch (error) {
        console.error('Error loading featured match:', error);
        container.innerHTML = '';
    }
};

/**
 * Renderiza el widget con datos completos de la API
 */
const renderFeaturedWidget = (container, m) => {
    const s = m.fixture.status;
    const isLive = ['1H', '2H', 'ET', 'P', 'LIVE'].includes(s.short);
    const isHT = s.short === 'HT';
    const isFin = ['FT', 'AET', 'PEN'].includes(s.short);
    const notStarted = ['NS', 'TBD'].includes(s.short);

    const timeDisplay = isLive
        ? `<span class="text-white font-bold animate-pulse text-[10px]">${s.elapsed}'</span>`
        : isHT
            ? '<span class="text-white font-bold text-[10px]">ET</span>'
            : isFin
                ? '<span class="text-gray-500 text-[10px] font-bold">FINAL</span>'
                : `<span class="text-gray-500 text-[10px]">${new Date(m.fixture.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>`;

    const homeScore = m.goals.home ?? '-';
    const awayScore = m.goals.away ?? '-';

    let liveIndicator = '';
    if (isLive) {
        liveIndicator = `<div class="absolute top-2 right-2 flex items-center gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
            <span class="text-[8px] font-bold text-red-500 uppercase">VIVO</span>
        </div>`;
    }

    container.innerHTML = `
        <div class="rounded-xl border border-[#222] bg-gradient-to-br from-[#0a0a0a] to-[#111] p-3 hover:border-[#555] transition-all duration-300 relative cursor-pointer"
             onclick="app.navigate('/partido/${m.fixture.id}'); event.preventDefault();">
            ${liveIndicator}
            <div class="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <img src="${m.league.logo}" class="w-3 h-3 object-contain">
                <span>Partido Destacado</span>
            </div>
            
            <div class="flex items-center justify-between gap-1">
                <!-- Home -->
                <div class="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <img src="${m.teams.home.logo}" class="w-8 h-8 object-contain">
                    <span class="text-[9px] font-bold text-white uppercase leading-tight text-center truncate w-full">${m.teams.home.name}</span>
                </div>

                <!-- Score -->
                <div class="flex flex-col items-center px-1 shrink-0">
                    ${notStarted
            ? `<div class="text-sm font-bold text-gray-600">${timeDisplay}</div>`
            : `<div class="flex items-center gap-1.5 text-lg font-black text-white font-mono">
                            <span>${homeScore}</span>
                            <span class="text-gray-700 text-sm">-</span>
                            <span>${awayScore}</span>
                          </div>
                          <div class="mt-0.5">${timeDisplay}</div>`
        }
                </div>

                <!-- Away -->
                <div class="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <img src="${m.teams.away.logo}" class="w-8 h-8 object-contain">
                    <span class="text-[9px] font-bold text-white uppercase leading-tight text-center truncate w-full">${m.teams.away.name}</span>
                </div>
            </div>

            <!-- Forum button -->
            <div class="mt-2 flex justify-center">
                <div class="px-2 py-1 bg-[#111] hover:bg-[#222] border border-[#222] rounded flex items-center gap-1 transition-colors cursor-pointer"
                     onclick="app.openDetailWithTab(${m.fixture.id}, 'forum'); event.stopPropagation(); event.preventDefault();">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span class="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Foro</span>
                </div>
            </div>
        </div>
    `;
};

/**
 * Renderiza el widget con datos básicos de Firestore (sin score)
 */
const renderFeaturedWidgetFallback = (container, featured) => {
    const timeDisplay = new Date(featured.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

    container.innerHTML = `
        <div class="rounded-xl border border-[#222] bg-gradient-to-br from-[#0a0a0a] to-[#111] p-3 hover:border-[#555] transition-all duration-300 cursor-pointer"
             onclick="app.navigate('/partido/${featured.fixtureId}'); event.preventDefault();">
            <div class="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <img src="${featured.leagueLogo}" class="w-3 h-3 object-contain">
                <span>Partido Destacado</span>
            </div>
            
            <div class="flex items-center justify-between gap-1">
                <div class="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <img src="${featured.homeLogo}" class="w-8 h-8 object-contain">
                    <span class="text-[9px] font-bold text-white uppercase leading-tight text-center truncate w-full">${featured.homeName}</span>
                </div>
                <div class="flex flex-col items-center px-1 shrink-0">
                    <span class="text-gray-500 text-[10px]">${timeDisplay}</span>
                </div>
                <div class="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <img src="${featured.awayLogo}" class="w-8 h-8 object-contain">
                    <span class="text-[9px] font-bold text-white uppercase leading-tight text-center truncate w-full">${featured.awayName}</span>
                </div>
            </div>

            <div class="mt-2 flex justify-center">
                <div class="px-2 py-1 bg-[#111] hover:bg-[#222] border border-[#222] rounded flex items-center gap-1 transition-colors cursor-pointer"
                     onclick="app.openDetailWithTab(${featured.fixtureId}, 'forum'); event.stopPropagation(); event.preventDefault();">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span class="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Foro</span>
                </div>
            </div>
        </div>
    `;
};

/**
 * Obtiene el ID del partido destacado actual (para marcar el botón ⭐)
 * @returns {Promise<number|null>}
 */
export const getFeaturedMatchId = async () => {
    try {
        const docRef = doc(db, "app_config", "featured_match");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().fixtureId;
        }
        return null;
    } catch (error) {
        console.error('Error getting featured match ID:', error);
        return null;
    }
};
