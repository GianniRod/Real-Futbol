/**
 * Matches View Module
 * 
 * Propósito: Manejar listado de partidos, calendario y filtros
 * 
 * Exports:
 * - initMatches(): Inicialización
 * - loadMatches(silent): Carga partidos del día
 * - renderMatches(): Renderiza partidos en DOM
 * - loadMessageCounts(): Carga contadores de mensajes
 * - changeDate(days): Navegación de fechas
 * - resetDate(): Volver a hoy
 * - renderCalendar(): Renderiza calendario
 * - toggleLiveFilter(): Toggle filtro en vivo
 */

import { fetchAPI } from '../core/api.js';
import { db, collection, where, query, getCountFromServer } from '../core/firebase.js';

// State
const state = {
    date: new Date(),
    matches: [],
    liveOnly: false
};

// Helpers
const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDayName = (d) => d.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase().replace('.', '');

/**
 * Renderiza el calendario de 7 días
 */
export const renderCalendar = () => {
    const container = document.getElementById('calendar-days');
    const month = document.getElementById('current-month');
    const todayTxt = document.getElementById('current-day-text');
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

    month.innerText = months[state.date.getMonth()];
    const isToday = state.date.toDateString() === new Date().toDateString();
    todayTxt.innerText = isToday ? "HOY" : state.date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).toUpperCase();

    container.innerHTML = '';
    const start = new Date(state.date);
    start.setDate(start.getDate() - 3);

    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const isSel = d.toDateString() === state.date.toDateString();
        const div = document.createElement('div');
        div.className = `flex flex-col items-center justify-center w-10 h-14 rounded cursor-pointer transition-all ${isSel ? 'bg-white text-black font-bold' : 'hover:bg-[#222] text-gray-500'}`;
        div.innerHTML = `<span class="text-[9px] font-bold uppercase tracking-widest">${getDayName(d)}</span><span class="text-sm font-bold">${d.getDate()}</span>`;
        div.onclick = () => {
            state.date = d;
            renderCalendar();
            loadMatches();
        };
        container.appendChild(div);
    }
};

/**
 * Cambia la fecha en N días
 * @param {number} days - Días a sumar/restar
 */
export const changeDate = (days) => {
    state.date.setDate(state.date.getDate() + days);
    renderCalendar();
    loadMatches();
};

/**
 * Resetea a la fecha actual
 */
export const resetDate = () => {
    state.date = new Date();
    renderCalendar();
    loadMatches();
};

/**
 * Carga partidos del día seleccionado
 * @param {boolean} silent - Si es true, no muestra loader
 */
export const loadMatches = async (silent = false) => {
    if (!silent) {
        document.getElementById('view-match-list').innerHTML = `<div class="flex justify-center py-20"><div class="loader"></div></div>`;
    }

    const dateStr = formatDate(state.date);
    const targetIds = [128, 1032, 129, 39, 140, 78, 71, 13, 11, 135, 556, 152, 150, 77, 335, 61, 48, 51, 25, 371];

    try {
        const data = await fetchAPI(`/fixtures?date=${dateStr}&timezone=America/Argentina/Buenos_Aires`);

        let matches = data.response.filter(m => targetIds.includes(m.league.id));
        matches.sort((a, b) => {
            const isArgA = [128, 1032].includes(a.league.id);
            const isArgB = [128, 1032].includes(b.league.id);
            if (isArgA && !isArgB) return -1;
            if (!isArgA && isArgB) return 1;
            return a.fixture.timestamp - b.fixture.timestamp;
        });

        state.matches = matches;
        renderMatches();
        loadMessageCounts();
    } catch (e) {
        console.error("Full API Error:", e);
        const container = document.getElementById('view-match-list');
        container.style.overflow = 'hidden';
        container.style.height = '100%';
        container.innerHTML = `
            <div class="flex justify-center items-start pt-4 px-4 h-full">
                <div class="max-w-md w-full bg-black p-8 text-center">
                    <div class="mb-6">
                        <h2 class="text-2xl font-black text-white mb-2">¡Estamos a tope! 🚀</h2>
                    </div>
                    <p class="text-gray-300 text-sm leading-relaxed mb-6">
                        Nuestros servidores han alcanzado su límite por hoy debido a la gran cantidad de usuarios. 
                        Estamos trabajando para ampliar nuestra capacidad.
                    </p>
                    <div class="border-t border-[#222] my-6"></div>
                    <p class="text-gray-400 text-xs mb-4">
                        Si te gustaría ayudarnos para que esto no vuelva a suceder, podrías considerar realizar un aporte en la sección donar.
                    </p>
                    <button 
                        onclick="document.getElementById('donation-modal').classList.remove('hidden')"
                        class="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-6 uppercase tracking-widest text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-yellow-500/50">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                            <path d="M12 18V6"></path>
                        </svg>
                        Donar
                    </button>
                </div>
            </div>
        `;
    }
};

/**
 * Renderiza los partidos en el DOM
 */
export const renderMatches = () => {
    const container = document.getElementById('view-match-list');
    let list = state.matches;
    if (state.liveOnly) {
        list = list.filter(m => ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(m.fixture.status.short));
    }

    if (list.length === 0) {
        container.innerHTML = `<div class="text-center py-20 text-gray-600 uppercase tracking-widest text-xs"><p>${state.liveOnly ? 'No hay partidos en vivo' : 'No hay partidos destacados'}</p></div>`;
        return;
    }

    const groups = {};
    list.forEach(m => {
        if (!groups[m.league.id]) {
            groups[m.league.id] = { name: m.league.name, logo: m.league.logo, matches: [] };
        }
        groups[m.league.id].matches.push(m);
    });

    let html = '';
    Object.values(groups).forEach(g => {
        html += `<div class="mb-6"><div class="px-2 py-2 flex items-center gap-3"><img src="${g.logo}" class="w-4 h-4 object-contain"><h3 class="text-xs font-bold text-white uppercase tracking-widest">${g.name}</h3></div><div class="space-y-2">`;

        g.matches.forEach(m => {
            const s = m.fixture.status;
            const isLive = ['1H', '2H', 'ET', 'P', 'LIVE'].includes(s.short);
            const isHT = s.short === 'HT';
            const isFin = ['FT', 'AET', 'PEN'].includes(s.short);
            const notStarted = ['NS', 'TBD'].includes(s.short);

            const timeDisplay = isLive ? `<span class="text-white font-bold animate-pulse text-xs">${s.elapsed}'</span>` : (isHT ? '<span class="text-white font-bold text-xs">ET</span>' : (isFin ? 'FINAL' : new Date(m.fixture.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })));

            let homeOpacity = 'opacity-100';
            let awayOpacity = 'opacity-100';
            if (isFin) {
                if ((m.goals.home ?? 0) > (m.goals.away ?? 0)) {
                    awayOpacity = 'opacity-50';
                } else if ((m.goals.away ?? 0) > (m.goals.home ?? 0)) {
                    homeOpacity = 'opacity-50';
                }
            }

            let hScorers = '';
            let aScorers = '';
            let hRedCards = '';
            let aRedCards = '';

            if (m.events && m.events.length > 0) {
                const goals = m.events.filter(e => e.type === 'Goal');
                if (goals.length > 0) {
                    const formatScorer = (ev, align) => `<div class="truncate leading-tight ${align}">${ev.player.name} ${ev.time.elapsed}'</div>`;
                    const hGoals = goals.filter(e => e.team.id === m.teams.home.id).map(g => formatScorer(g, 'text-right'));
                    const aGoals = goals.filter(e => e.team.id === m.teams.away.id).map(g => formatScorer(g, 'text-left'));
                    if (hGoals.length > 0) hScorers = `<div class="flex flex-col items-end gap-0.5 mt-1 min-w-0 w-full">${hGoals.join('')}</div>`;
                    if (aGoals.length > 0) aScorers = `<div class="flex flex-col items-start gap-0.5 mt-1 min-w-0 w-full">${aGoals.join('')}</div>`;
                }

                const redCards = m.events.filter(e => e.type === 'Card' && e.detail === 'Red Card');
                const hReds = redCards.filter(e => e.team.id === m.teams.home.id).length;
                const aReds = redCards.filter(e => e.team.id === m.teams.away.id).length;
                if (hReds > 0) hRedCards = `<div class="flex gap-0.5 ml-1">${'<div class="w-2 h-3 bg-red-600 rounded-sm"></div>'.repeat(hReds)}</div>`;
                if (aReds > 0) aRedCards = `<div class="flex gap-0.5 mr-1">${'<div class="w-2 h-3 bg-red-600 rounded-sm"></div>'.repeat(aReds)}</div>`;
            }

            const clickableClass = notStarted ? 'not-clickable' : 'clickable';
            const clickAttr = notStarted ? '' : `onclick="app.openDetail(${m.fixture.id})"`;

            html += `
                <div class="p-4 match-card ${clickableClass} relative bg-[#0a0a0a] rounded" ${clickAttr}>
                    ${isLive ? '<div class="absolute top-3 right-3"><div class="live-dot"></div></div>' : ''}
                    
                    <div class="flex items-center justify-between">
                        <!-- HOME TEAM -->
                        <div class="flex-1 flex justify-end items-center gap-2 md:gap-3 transition-opacity duration-300 text-right min-w-0">
                            <div class="flex flex-col items-end min-w-0 max-w-full">
                                <div class="flex items-center gap-1 w-full justify-end">
                                    <span class="font-bold text-white text-xs md:text-sm uppercase tracking-tight leading-none md:truncate text-wrap">${m.teams.home.name}</span>
                                    ${hRedCards}
                                </div>
                                ${hScorers ? `<div class="text-[9px] text-gray-500 font-mono w-full overflow-hidden">${hScorers}</div>` : ''}
                            </div>
                            <img src="${m.teams.home.logo}" class="w-8 h-8 object-contain shrink-0">
                        </div>

                        <!-- SCORE / TIME -->
                        <div class="px-2 md:px-3 flex flex-col items-center w-20 md:w-24 shrink-0">
                            ${notStarted
                    ? `<span class="text-xl font-bold text-gray-600 score-font tracking-tighter">${timeDisplay}</span>`
                    : `<div class="flex gap-2 text-xl md:text-2xl font-black text-white score-font tracking-widest">
                                     <span class="${homeOpacity}">${m.goals.home ?? 0}</span>
                                     <span class="text-gray-700">-</span>
                                     <span class="${awayOpacity}">${m.goals.away ?? 0}</span>
                                   </div>`
                }
                            <span class="text-[9px] font-bold uppercase text-gray-500 mt-1 tracking-widest text-center whitespace-nowrap">${isLive || isHT || isFin ? timeDisplay : ''}</span>
                            <div class="mt-1 px-1.5 py-0.5 bg-[#111] hover:bg-[#222] border border-[#222] rounded flex items-center gap-1 transition-colors cursor-pointer" onclick="app.openDetail(${m.fixture.id}, 'tab-forum'); event.stopPropagation();">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                <span id="msg-count-${m.fixture.id}" class="text-[8px] font-bold text-gray-500 font-mono">...</span>
                            </div>
                        </div>

                        <!-- AWAY TEAM -->
                        <div class="flex-1 flex justify-start items-center gap-2 md:gap-3 transition-opacity duration-300 text-left min-w-0">
                            <img src="${m.teams.away.logo}" class="w-8 h-8 object-contain shrink-0">
                            <div class="flex flex-col items-start min-w-0 max-w-full">
                                <div class="flex items-center gap-1 w-full justify-start">
                                    ${aRedCards}
                                    <span class="font-bold text-white text-xs md:text-sm uppercase tracking-tight leading-none md:truncate text-wrap">${m.teams.away.name}</span>
                                </div>
                                ${aScorers ? `<div class="text-[9px] text-gray-500 font-mono w-full overflow-hidden">${aScorers}</div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
    loadMessageCounts();
};

/**
 * Carga los contadores de mensajes para cada partido
 */
export const loadMessageCounts = async () => {
    const matches = state.matches;
    matches.forEach(async m => {
        try {
            const q = query(collection(db, "forum_messages"), where("context", "==", `match_${m.fixture.id}`));
            const snapshot = await getCountFromServer(q);
            const count = snapshot.data().count;
            const el = document.getElementById(`msg-count-${m.fixture.id}`);
            if (el) el.innerText = count > 0 ? count : '';
        } catch (e) {
            console.error(e);
        }
    });
};

/**
 * Toggle del filtro de partidos en vivo
 */
export const toggleLiveFilter = () => {
    const isChecked = document.getElementById('live-toggle').checked;
    state.liveOnly = isChecked;
    renderMatches();
};

/**
 * Inicializa el módulo de matches
 */
export const initMatches = () => {
    renderCalendar();
    loadMatches();

    // Auto-refresh cada minuto
    setInterval(() => loadMatches(true), 60000);
};

// Exportar state para acceso desde otros módulos si es necesario
export const getMatchesState = () => state;
export const getMatches = () => state.matches;
