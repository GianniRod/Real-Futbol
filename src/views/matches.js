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
    liveOnly: false,
    isViewingToday: true
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
            state.isViewingToday = d.toDateString() === new Date().toDateString();
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
    state.isViewingToday = state.date.toDateString() === new Date().toDateString();
    renderCalendar();
    loadMatches();
};

/**
 * Resetea a la fecha actual
 */
export const resetDate = () => {
    state.date = new Date();
    state.isViewingToday = true;
    renderCalendar();
    loadMatches();
};

/**
 * Carga partidos del día seleccionado
 * @param {boolean} silent - Si es true, no muestra loader
 */
export const loadMatches = async (silent = false) => {
    // Auto-update date if viewing today (handles midnight transition)
    if (state.isViewingToday) {
        const now = new Date();
        const currentStr = formatDate(state.date);
        const newStr = formatDate(now);
        if (currentStr !== newStr) {
            state.date = now;
            console.log("Auto-updating date to new day:", newStr);
            renderCalendar();
        }
    }

    if (!silent) {
        document.getElementById('view-match-list').innerHTML = `<div class="flex justify-center py-20"><div class="loader"></div></div>`;
    }

    const dateStr = formatDate(state.date);
    const targetIds = [128, 1032, 129, 130, 39, 140, 78, 71, 13, 11, 135, 2, 3, 848, 143, 137];

    try {
        const data = await fetchAPI(`/fixtures?date=${dateStr}&timezone=America/Argentina/Buenos_Aires`, silent);

        let matches = data.response.filter(m => targetIds.includes(m.league.id));
        matches.sort((a, b) => {
            const isArgA = [128, 1032, 130].includes(a.league.id);
            const isArgB = [128, 1032, 130].includes(b.league.id);
            if (isArgA && !isArgB) return -1;
            if (!isArgA && isArgB) return 1;
            return a.fixture.timestamp - b.fixture.timestamp;
        });

        state.matches = matches;

        // Fetch aggregate scores for 2nd leg matches
        await loadAggregateScores(matches);

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
 * Carga scores agregados para partidos de vuelta (2nd Leg)
 * Busca el partido de ida y calcula el global
 */
const loadAggregateScores = async (matches) => {
    // Find 2nd leg matches
    const secondLegMatches = matches.filter(m => {
        const round = (m.league.round || '').toLowerCase();
        return round.includes('2nd leg') || round.includes('leg 2');
    });

    if (secondLegMatches.length === 0) return;

    // For each 2nd leg match, fetch the 1st leg
    const promises = secondLegMatches.map(async (m) => {
        try {
            // Build the 1st leg round name
            const firstLegRound = m.league.round
                .replace(/2nd Leg/i, '1st Leg')
                .replace(/Leg 2/i, 'Leg 1');

            // Fetch 1st leg fixtures for same league, season, and round
            const data = await fetchAPI(
                `/fixtures?league=${m.league.id}&season=${m.league.season}&round=${encodeURIComponent(firstLegRound)}`,
                true // silent
            );

            if (data.response && data.response.length > 0) {
                // Find the specific 1st leg match with same teams (reversed home/away)
                const firstLeg = data.response.find(f =>
                    (f.teams.home.id === m.teams.away.id && f.teams.away.id === m.teams.home.id) ||
                    (f.teams.home.id === m.teams.home.id && f.teams.away.id === m.teams.away.id)
                );

                if (firstLeg && firstLeg.goals.home !== null) {
                    // Calculate aggregate from perspective of 2nd leg's home/away
                    // 1st leg: Team A (home) vs Team B (away) -> score X - Y
                    // 2nd leg: Team B (home) vs Team A (away) -> score W - Z
                    // Aggregate for 2nd leg home team = W + (1st leg score where they played)

                    const isReversed = firstLeg.teams.home.id === m.teams.away.id;

                    let homeAgg, awayAgg;
                    if (isReversed) {
                        // Normal case: teams are flipped between legs
                        homeAgg = (m.goals.home ?? 0) + (firstLeg.goals.away ?? 0);
                        awayAgg = (m.goals.away ?? 0) + (firstLeg.goals.home ?? 0);
                    } else {
                        // Same order (rare)
                        homeAgg = (m.goals.home ?? 0) + (firstLeg.goals.home ?? 0);
                        awayAgg = (m.goals.away ?? 0) + (firstLeg.goals.away ?? 0);
                    }

                    m._aggregate = { home: homeAgg, away: awayAgg };
                }
            }
        } catch (e) {
            console.warn('Could not fetch 1st leg for aggregate:', e);
        }
    });

    await Promise.all(promises);
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

    const groupsList = [];
    const groupsMap = {};

    list.forEach(m => {
        if (!groupsMap[m.league.id]) {
            const group = { id: m.league.id, name: m.league.name, logo: m.league.logo, matches: [] };
            groupsMap[m.league.id] = group;
            groupsList.push(group);
        }
        groupsMap[m.league.id].matches.push(m);
    });

    let html = '';
    groupsList.forEach(g => {
        html += `
            <div class="mb-6">
                <div class="bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden flex flex-col">
                    <div class="px-4 py-3 flex items-center justify-between border-b border-[#222] cursor-pointer hover:bg-[#111] transition-colors group" onclick="app.showStandings({id: ${g.id}, name: '${g.name}'})">
                        <div class="flex items-center gap-3">
                            <img src="${g.logo}" class="w-5 h-5 object-contain group-hover:scale-110 transition-transform">
                            <h3 class="text-xs font-black text-white uppercase tracking-widest group-hover:text-gray-200 transition-colors">${g.name}</h3>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>`;

        g.matches.forEach((m, index) => {
            const s = m.fixture.status;
            const isLive = ['1H', '2H', 'ET', 'P', 'LIVE'].includes(s.short);
            const isHT = s.short === 'HT';
            const isFin = ['FT', 'AET', 'PEN'].includes(s.short);
            const notStarted = ['NS', 'TBD'].includes(s.short);

            const timeDisplay = isLive
                ? (s.short === 'P' ? '<span class="text-red-500 font-bold animate-pulse text-xs">PEN</span>' : `<span class="text-white font-bold animate-pulse text-xs">${s.elapsed ?? ''}'</span>`)
                : (isHT ? '<span class="text-white font-bold text-xs">ET</span>'
                    : (isFin ? '' : new Date(m.fixture.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })));

            let homeOpacity = 'opacity-100';
            let awayOpacity = 'opacity-100';
            if (isFin) {
                if ((m.goals.home ?? 0) > (m.goals.away ?? 0)) {
                    awayOpacity = 'opacity-50';
                } else if ((m.goals.away ?? 0) > (m.goals.home ?? 0)) {
                    homeOpacity = 'opacity-50';
                }
            }

            let hRedCards = '';
            let aRedCards = '';

            if (m.events && m.events.length > 0) {
                const redCards = m.events.filter(e => e.type === 'Card' && e.detail === 'Red Card');
                const hReds = redCards.filter(e => e.team.id == m.teams.home.id).length;
                const aReds = redCards.filter(e => e.team.id == m.teams.away.id).length;
                if (hReds > 0) hRedCards = `<div class="absolute -top-1 -left-2 flex gap-0.5 z-10">${'<div class="w-1.5 h-2 bg-red-600 rounded-[1px]"></div>'.repeat(hReds)}</div>`;
                if (aReds > 0) aRedCards = `<div class="absolute -top-1 -right-2 flex gap-0.5 z-10">${'<div class="w-1.5 h-2 bg-red-600 rounded-[1px]"></div>'.repeat(aReds)}</div>`;
            }

            const clickableClass = notStarted ? 'not-clickable' : 'clickable';
            const clickAttr = notStarted ? '' : `onclick="app.navigate('/partido/${m.fixture.id}'); event.preventDefault();"`;
            const isLast = index === g.matches.length - 1;
            const borderClass = isLast ? '' : 'border-b border-[#222]';

            // Aggregate Score Logic (from _aggregate calculated by loadAggregateScores)
            let aggHtml = '';
            if (m._aggregate) {
                aggHtml = `<div class="text-[10px] text-gray-400 font-bold tracking-wider">(${m._aggregate.home}-${m._aggregate.away})</div>`;
            }

            html += `
        <div class="p-4 match-card ${clickableClass} relative hover:bg-[#111] transition-colors ${borderClass}" ${clickAttr}>
            ${isLive ? '<div class="absolute top-3 right-3 flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div><span class="text-[9px] font-bold text-red-500 uppercase tracking-widest">EN VIVO</span></div>' : ''}

            <!-- Forum/Chat Button (Absolute Right) -->
            <div class="absolute right-3 top-1/2 -translate-y-1/2 z-20" onclick="app.openDetailWithTab(${m.fixture.id}, 'forum'); event.stopPropagation(); event.preventDefault();">
                <div class="w-8 h-8 rounded-full bg-[#161616] border border-[#333] flex items-center justify-center hover:bg-[#222] hover:border-gray-500 transition-colors group/chat relative shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-500 group-hover/chat:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span id="msg-count-${m.fixture.id}" class="hidden absolute -top-1 -right-1 bg-blue-600 text-[8px] font-bold text-white px-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full border border-[#111]"></span>
                </div>
            </div>

            <!-- Row 1: Teams + Score (centered vertically) -->
            <div class="flex items-center justify-center pr-10">
                <!-- HOME TEAM -->
                <div class="flex-1 flex justify-end items-center gap-2 md:gap-3 text-right min-w-0">
                    <span class="font-bold text-white text-xs md:text-sm uppercase tracking-tight leading-none md:truncate text-wrap text-right">${m.teams.home.name}</span>
                    <img src="${m.teams.home.logo}" class="w-8 h-8 object-contain shrink-0">
                </div>

                <!-- SCORE / TIME (same height as crests) -->
                <div class="px-2 md:px-3 flex items-center justify-center shrink-0 min-w-[80px]">
                    ${notStarted
                    ? `<span class="text-lg font-bold text-gray-600 score-font tracking-tighter">${timeDisplay}</span>`
                    : `<div class="flex items-center gap-1.5 justify-center">
                                    ${(m.score?.penalty?.home != null) ? `<span class="text-xs text-gray-400 font-bold">(${m.score.penalty.home})</span>` : ''}
                                    <div class="flex gap-2 text-xl md:text-2xl font-black text-white score-font tracking-widest">
                                     <span class="relative">
                                        ${hRedCards}
                                        <span class="${homeOpacity}">${m.goals.home ?? 0}</span>
                                     </span>
                                     <span class="text-gray-700">-</span>
                                     <span class="relative">
                                        <span class="${awayOpacity}">${m.goals.away ?? 0}</span>
                                        ${aRedCards}
                                     </span>
                                   </div>
                                   ${(m.score?.penalty?.away != null) ? `<span class="text-xs text-gray-400 font-bold">(${m.score.penalty.away})</span>` : ''}
                                   </div>`
                }
                </div>

                <!-- AWAY TEAM -->
                <div class="flex-1 flex justify-start items-center gap-2 md:gap-3 text-left min-w-0">
                    <img src="${m.teams.away.logo}" class="w-8 h-8 object-contain shrink-0">
                    <span class="font-bold text-white text-xs md:text-sm uppercase tracking-tight leading-none md:truncate text-wrap text-left">${m.teams.away.name}</span>
                </div>
            </div>

            <!-- Row 2: Status + Aggregate (below, centered) -->
            ${(isLive || isHT || aggHtml) ? `
            <div class="flex flex-col items-center mt-1">
                ${isLive || isHT ? `<span class="text-[9px] font-bold uppercase text-gray-500 tracking-widest text-center whitespace-nowrap">${timeDisplay}</span>` : ''}
                ${aggHtml}
            </div>` : ''}
        </div>`;
        });

        html += `</div></div > `;
    });

    container.innerHTML = html;
    loadMessageCounts();
};

/**
 * Carga los contadores de mensajes para cada partido
 */
export const loadMessageCounts = async () => {
    const matches = getMatches();
    if (!matches) return;

    matches.forEach(async m => {
        try {
            const context = `match_${m.fixture.id}`;
            const q = query(collection(db, "forum_messages"), where("context", "==", context));
            const snapshot = await getCountFromServer(q);
            const count = snapshot.data().count;

            const el = document.getElementById(`msg-count-${m.fixture.id}`);
            if (el) {
                if (count > 0) {
                    el.innerText = count;
                    el.classList.remove('hidden');
                } else {
                    el.innerText = '';
                    el.classList.add('hidden');
                }
            }
        } catch (e) {
            console.error("Error loading msg count:", e);
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

// loadEventsForFinishedMatches eliminado — los eventos se cargan
// solo cuando el usuario abre el detalle de un partido (ahorra ~10 req/ciclo)

// Calendar State
let calendarDate = new Date(); // Para navegación del calendario
let isCalendarOpen = false;

/**
 * Toggle del calendario desplegable
 */
export const toggleCalendar = () => {
    const dropdown = document.getElementById('calendar-dropdown');
    isCalendarOpen = !isCalendarOpen;

    if (isCalendarOpen) {
        dropdown.classList.remove('hidden');
        // Sincronizar calendario con fecha seleccionada actual
        calendarDate = new Date(state.date);
        renderFullCalendar();
    } else {
        dropdown.classList.add('hidden');
    }
};

/**
 * Cambia el mes del calendario desplegable
 * @param {number} delta - +1 o -1
 */
export const changeMonth = (delta) => {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
    renderFullCalendar();
};

/**
 * Renderiza el grid del calendario completo
 */
const renderFullCalendar = () => {
    const grid = document.getElementById('calendar-grid');
    const monthLabel = document.getElementById('cal-month-year');

    // Texto Mes Año
    const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    monthLabel.innerText = `${months[calendarDate.getMonth()]} ${calendarDate.getFullYear()} `;

    grid.innerHTML = '';

    // Primer día del mes
    const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const lastDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);

    // Días previos (padding)
    let startDayVal = firstDay.getDay(); // 0 = Domingo

    // Rellenar días vacíos
    for (let i = 0; i < startDayVal; i++) {
        const div = document.createElement('div');
        grid.appendChild(div);
    }

    // Días del mes
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const currentDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), i);
        const isSelected = currentDate.toDateString() === state.date.toDateString();
        const isToday = currentDate.toDateString() === new Date().toDateString();

        const btn = document.createElement('button');
        btn.className = `p - 2 rounded text - sm font - bold transition - colors ${isSelected
            ? 'bg-white text-black'
            : (isToday ? 'text-yellow-500 hover:bg-[#222]' : 'text-gray-300 hover:bg-[#222]')
            } `;
        btn.innerText = i;
        btn.onclick = () => {
            state.date = currentDate;
            renderCalendar(); // Renderiza la tira horizontal
            loadMatches();
            toggleCalendar(); // Cierra el dropdown
        };
        grid.appendChild(btn);
    }
};

/**
 * Inicializa el módulo de matches
 */
export const initMatches = () => {
    renderCalendar();
    loadMatches();

    // Auto-refresh cada 2 minutos (antes era 1 min)
    setInterval(() => loadMatches(true), 120000);

    // Cerrar calendario al hacer click fuera
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('calendar-dropdown');
        const nav = document.getElementById('date-nav');
        if (isCalendarOpen && !dropdown.contains(e.target) && !nav.contains(e.target)) {
            toggleCalendar();
        }
    });
};

// Exportar state para acceso desde otros módulos si es necesario
export const getMatchesState = () => state;
export const getMatches = () => state.matches;

/**
 * Actualiza los eventos de un partido específico en el state
 * @param {number|string} fixtureId - ID del partido
 * @param {Array} events - Array de eventos del partido
 */
export const updateMatchEvents = (fixtureId, events) => {
    const match = state.matches.find(m => String(m.fixture.id) === String(fixtureId));
    if (match && events) {
        match.events = events;
        // Re-renderizar para mostrar las tarjetas rojas
        renderMatches();
    }
};
