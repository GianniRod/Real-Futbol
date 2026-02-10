/**
 * Standings View Module
 * 
 * Propósito: Manejar vista de tabla de posiciones
 * 
 * Exports:
 * - showStandings(id, name): Muestra tabla de una liga
 * - changeSeason(year): Cambia la temporada
 * - processStandings(data): Procesa datos de standings
 * - renderTable(groupIndex): Renderiza tabla específica
 */

import { fetchAPI } from '../core/api.js';
import { showOnly, hideView } from '../core/dom.js';

// State
// State extended for fixtures
const state = {
    selectedLeague: null,
    season: 2024,
    standingsData: null,
    rounds: [],
    currentRound: null,
    fixtures: []
};

/**
 * Cambia la temporada
 * @param {number|string} year - Año de la temporada
 */
export const changeSeason = (year) => {
    state.season = parseInt(year);
    if (state.selectedLeague) {
        showStandings(state.selectedLeague.id, state.selectedLeague.name);
    }
};

/**
 * Obtiene las rondas (fechas) disponibles para una liga y temporada
 */
const fetchRounds = async (leagueId, season) => {
    try {
        const data = await fetchAPI(`/fixtures/rounds?league=${leagueId}&season=${season}`);
        state.rounds = data.response;
        // Seleccionar la última ronda por defecto o la actual
        state.currentRound = state.rounds[state.rounds.length - 1]; // Default to last for now, or logic to find current
        return state.rounds;
    } catch (e) {
        console.error("Error fetching rounds:", e);
        return [];
    }
};

/**
 * Obtiene los partidos de una ronda específica
 */
const fetchFixturesByRound = async (leagueId, season, round) => {
    try {
        const data = await fetchAPI(`/fixtures?league=${leagueId}&season=${season}&round=${round}&timezone=America/Argentina/Buenos_Aires`);
        state.fixtures = data.response;
        renderFixtures();
    } catch (e) {
        console.error("Error fetching fixtures:", e);
        document.getElementById('fixtures-list').innerHTML = `<div class="text-center text-gray-500 py-4 text-xs">Error al cargar partidos.</div>`;
    }
};

/**
 * Cambia la ronda seleccionada
 */
export const changeRound = (round) => {
    state.currentRound = round;
    // Mostrar loader en lista de partidos
    document.getElementById('fixtures-list').innerHTML = `<div class="flex justify-center py-10"><div class="loader"></div></div>`;
    fetchFixturesByRound(state.selectedLeague.id, state.season, round);
};

/**
 * Renderiza la lista de partidos en el sidebar derecho
 */
const renderFixtures = () => {
    const container = document.getElementById('fixtures-list');
    if (!state.fixtures || state.fixtures.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 py-10 text-xs uppercase tracking-widest">No hay partidos en esta fecha.</div>`;
        return;
    }

    // Agrupar por día
    const matches = state.fixtures;
    matches.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);

    container.innerHTML = matches.map(m => {
        const date = new Date(m.fixture.date);
        const dayName = date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
        const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const status = m.fixture.status.short;
        const isLive = ['1H', '2H', 'ET', 'P', 'LIVE'].includes(status);
        const isFin = ['FT', 'AET', 'PEN'].includes(status);

        // Score display
        const scoreHome = m.goals.home ?? '-';
        const scoreAway = m.goals.away ?? '-';

        return `
            <div class="bg-[#1a1a1a] border border-[#333] rounded p-3 hover:bg-[#222] transition-colors cursor-pointer" onclick="app.openDetailWithTab(${m.fixture.id}, 'forum')">
                <div class="flex justify-between items-center mb-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    <span>${dayName}</span>
                    <span class="${isLive ? 'text-red-500 animate-pulse' : ''}">${isLive ? `${m.fixture.status.elapsed}'` : (isFin ? 'FINAL' : time)}</span>
                </div>
                <div class="flex flex-col gap-2">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-2">
                            <img src="${m.teams.home.logo}" class="w-5 h-5 object-contain">
                            <span class="text-xs font-bold text-gray-200 truncate max-w-[100px]">${m.teams.home.name}</span>
                        </div>
                        <span class="text-sm font-bold text-white font-mono">${scoreHome}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-2">
                            <img src="${m.teams.away.logo}" class="w-5 h-5 object-contain">
                            <span class="text-xs font-bold text-gray-200 truncate max-w-[100px]">${m.teams.away.name}</span>
                        </div>
                        <span class="text-sm font-bold text-white font-mono">${scoreAway}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

/**
 * Renderiza una tabla específica (para ligas con grupos)
 * @param {number} groupIndex - Índice del grupo a renderizar
 */
export const renderTable = (groupIndex) => {
    const table = state.standingsData[groupIndex];
    const container = document.getElementById('standings-table-container'); // Changed target ID

    container.innerHTML = `
        <div class="bg-[#0a0a0a] border border-[#222] overflow-hidden rounded-lg">
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-400">
                    <thead class="text-[10px] text-gray-500 uppercase bg-[#111] border-b border-[#222] tracking-widest">
                        <tr>
                            <th class="px-3 py-3 text-center w-8">#</th>
                            <th class="px-3 py-3">Equipo</th>
                            <th class="px-2 py-3 text-center text-white">Pts</th>
                            <th class="px-2 py-3 text-center">PJ</th>
                            <th class="px-2 py-3 text-center font-mono">DG</th>
                            <th class="px-2 py-3 text-center hidden md:table-cell">Forma</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1a1a1a]">
                        ${table.map(t => `
                            <tr class="hover:bg-[#111] transition-colors">
                                <td class="px-3 py-3 text-center font-bold ${t.rank <= 4 ? 'text-white' : 'text-gray-600'} border-r border-[#222] text-xs">${t.rank}</td>
                                <td class="px-3 py-3 font-bold text-gray-300 flex items-center gap-3 whitespace-nowrap uppercase text-xs">
                                    <img src="${t.team.logo}" class="w-6 h-6 object-contain">
                                    ${t.team.name}
                                </td>
                                <td class="px-2 py-3 text-center font-bold text-white bg-[#111]/50">${t.points}</td>
                                <td class="px-2 py-3 text-center font-mono text-xs">${t.all.played}</td>
                                <td class="px-2 py-3 text-center font-mono text-xs ${t.goalsDiff > 0 ? 'text-white' : 'text-gray-600'}">${t.goalsDiff > 0 ? '+' : ''}${t.goalsDiff}</td>
                                <td class="px-2 py-3 text-center hidden md:table-cell">
                                    <div class="flex justify-center gap-0.5">
                                        ${t.form ? t.form.split('').slice(-5).map(f => `<div class="w-1.5 h-1.5 rounded-full ${f === 'W' ? 'bg-white' : (f === 'D' ? 'bg-gray-500' : 'bg-[#333]')}"></div>`).join('') : '-'}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
};

/**
 * Procesa los datos de standings (maneja grupos si existen)
 * @param {Array} standingsData - Datos de standings de la API
 */
export const processStandings = (standingsData) => {
    const tabs = document.getElementById('standings-tabs');
    // Ensure table container exists inside the new layout
    const tableContainer = document.getElementById('standings-table-container');

    if (standingsData.length > 1) {
        // Múltiples grupos
        tabs.classList.remove('hidden');
        tabs.innerHTML = standingsData.map((g, i) => `
            <button onclick="app.renderTable(${i})" class="px-4 py-2 bg-[#111] text-xs font-bold uppercase border border-[#333] text-gray-400 hover:text-white hover:border-white transition-all whitespace-nowrap">
                ${g.group}
            </button>
        `).join('');
        state.standingsData = standingsData;
        renderTable(0);
    } else {
        // Un solo grupo
        tabs.classList.add('hidden');
        state.standingsData = standingsData;
        renderTable(0);
    }
};

/**
 * Toggle del menú lateral
 */
export const toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-backdrop');

    // Logic for mobile vs desktop override
    if (window.innerWidth >= 1024) {
        // Desktop: Toggle visibility class for sidebar
        sidebar.classList.toggle('hidden');
        if (sidebar.classList.contains('hidden')) {
            // If hidden, main content takes full width
            document.querySelector('main').classList.remove('lg:w-auto');
        } else {
            // If shown, restore layout
        }
    } else {
        // Mobile: Use standard openMobileTab logic
        app.openMobileTab('leagues');
    }
};

/**
 * Muestra la tabla de posiciones de una liga en el nuevo layout
 * Puede recibir params del router o argumentos legacy
 * @param {Object|number} idOrParams - Params { id, name } o solo ID
 * @param {string} name - Nombre de la liga (opcional si params)
 */
export const showStandings = async (idOrParams, name) => {
    let id, leagueName;

    if (typeof idOrParams === 'object') {
        // Llamado desde router con params
        id = idOrParams.id;
        leagueName = idOrParams.name || '';
    } else {
        // Llamado legacy con (id, name)
        id = idOrParams;
        leagueName = name || '';
    }

    state.selectedLeague = { id, name: leagueName };

    // Validar si estamos en la vista correcta, si no, resetear containers
    const viewStandings = document.getElementById('view-standings');
    const container = document.getElementById('standings-container'); // This will now hold the split layout

    // Update UI Visibility
    document.getElementById('view-match-list').classList.add('hidden');
    document.getElementById('date-nav').classList.add('hidden');
    viewStandings.classList.remove('hidden');

    // START: Layout Modification
    // Ocultar sidebars globales
    document.getElementById('sidebar').classList.add('hidden'); // Force hide sidebar on desktop
    document.getElementById('right-sidebar').classList.add('hidden'); // Force hide right sidebar
    document.querySelector('main').classList.remove('lg:w-auto'); // Allow main to expanded

    // Update Header
    document.getElementById('standings-title').innerHTML = `
        <div class="flex items-center gap-3">
            <button onclick="app.toggleSidebarInLeague()" class="bg-[#111] p-2 rounded hover:bg-[#222] border border-[#333] transition-colors" title="Ver Ligas">
                 <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            <span class="text-xl font-bold text-white uppercase tracking-wider font-sport">${leagueName}</span>
        </div>
    `;

    document.getElementById('standings-tabs').classList.add('hidden');

    // Setup Split Views Layout
    container.innerHTML = `
        <div class="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6 overflow-hidden">
            <!-- Left: Table (Scrollable) -->
            <div class="flex-1 flex flex-col min-h-0 bg-[#050505] rounded-xl border border-[#222] overflow-hidden">
                 <div class="p-4 bg-black border-b border-[#222] flex justify-between items-center shrink-0">
                    <h3 class="font-bold text-gray-400 uppercase tracking-widest text-xs">Posiciones</h3>
                    <div id="standings-tabs-container"></div>
                </div>
                <div id="standings-table-container" class="flex-1 overflow-y-auto p-0">
                    <div class="flex justify-center py-20"><div class="loader"></div></div>
                </div>
            </div>

            <!-- Right: Fixtures (Fixed width) -->
            <div class="w-full lg:w-96 shrink-0 flex flex-col bg-[#050505] rounded-xl border border-[#222] overflow-hidden h-full">
                <!-- Round Selector -->
                <div class="p-4 border-b border-[#222] shrink-0 bg-black">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-gray-400 uppercase tracking-widest text-xs">Calendario</h3>
                    </div>
                    <select id="round-selector" onchange="app.changeRound(this.value)" class="w-full bg-[#111] border border-[#333] text-white text-xs p-2 rounded focus:outline-none uppercase font-bold">
                        <option>Cargando fechas...</option>
                    </select>
                </div>
                <!-- Fixtures List -->
                <div id="fixtures-list" class="flex-1 overflow-y-auto p-3 space-y-2">
                    <div class="text-center py-10 text-gray-600 text-xs">Selecciona una fecha</div>
                </div>
            </div>
        </div>
    `;

    // Fetch Data
    try {
        const [standingsData, roundsData] = await Promise.all([
            fetchAPI(`/standings?league=${id}&season=${state.season}`),
            fetchRounds(id, state.season)
        ]);

        // Process Standings
        if (standingsData.response && standingsData.response.length > 0) {
            const standings = standingsData.response[0].league.standings;
            processStandings(standings);
        } else {
            document.getElementById('standings-table-container').innerHTML = `<div class="text-center text-gray-500 py-10">Sin datos.</div>`;
        }

        // Process Rounds
        const roundSelector = document.getElementById('round-selector');
        if (roundsData && roundsData.length > 0) {
            roundSelector.innerHTML = roundsData.map(r => `
                <option value="${r}" ${r === state.currentRound ? 'selected' : ''}>${r.replace(/Regular Season - /g, 'Fecha ').replace(/_/g, ' ')}</option>
            `).join('');

            // Cargar fixtures de la ronda actual
            if (state.currentRound) {
                fetchFixturesByRound(id, state.season, state.currentRound);
            }
        } else {
            roundSelector.innerHTML = `<option>No hay fechas disponibles</option>`;
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="text-center text-gray-500 py-10 text-xs uppercase tracking-widest">Error al cargar datos.</div>`;
    }
};

export const toggleSidebarInLeague = () => {
    const sidebar = document.getElementById('sidebar');
    // Forzamos "flex" porque usamos "hidden lg:flex" originalmente
    if (sidebar.classList.contains('hidden')) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('lg:flex'); // Restore desktop flex
        // Adjust main content width if needed, but absolute positioning or overlay might be better for temporary menu
        // For this specific request: "un boton que lo tocas y vuelve las ligas" -> likely as an overlay or pushing content

        // Let's use the mobile drawer logic/style for consistency or just toggle the class we removed
    } else {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('lg:flex');
    }
};


export const getStandingsState = () => state;
