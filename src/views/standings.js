/**
 * Standings View Module
 * 
 * Propósito: Manejar vista de tabla de posiciones con layout dividido
 * 
 * Exports:
 * - showStandings(id, name): Muestra tabla de una liga y calendario
 * - changeSeason(year): Cambia la temporada
 * - processStandings(data): Procesa datos de standings
 * - renderTable(groupIndex): Renderiza tabla específica
 * - changeRound(round): Cambia la fecha del calendario
 * - toggleSidebarInLeague(): Muestra/oculta sidebar de ligas
 */

import { fetchAPI } from '../core/api.js';
import { showOnly, hideView } from '../core/dom.js';

// State extended for fixtures
const state = {
    selectedLeague: null,
    season: 2024,
    standingsData: null,
    rounds: [],
    currentRound: null,
    fixtures: []
};

// IDs de ligas europeas (para formato de temporada)
const EUROPEAN_LEAGUES = [39, 140, 78, 135, 61, 2, 3, 143, 137]; // PL, LaLiga, Bundesliga, SerieA, Ligue1, UCL, UEL, CopaRey, CoppaItalia
// IDs de Copas (para vista de Bracket)
const CUP_LEAGUES = [130, 137, 143]; // Copa Argentina, Coppa Italia, Copa del Rey

/**
 * Determina la temporada actual para una liga
 * @param {number} leagueId 
 */
const determineCurrentSeason = (leagueId) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    if (EUROPEAN_LEAGUES.includes(parseInt(leagueId))) {
        // En Europa, si estamos en la segunda mitad del año (Agosto+), es el inicio de temporada (ej: 2025 para 25/26)
        // Si estamos en la primera mitad (Enero-Julio), es el final de la temporada que empezó el año anterior (ej: 2024 para 24/25)
        if (month >= 7) {
            return currentYear;
        } else {
            return currentYear - 1;
        }
    } else {
        // En América (anual), la temporada es simplemente el año actual
        return currentYear;
    }
};

/**
 * Formatea el label de la temporada
 * @param {number} seasonYear 
 * @param {number} leagueId 
 */
const formatSeasonLabel = (seasonYear, leagueId) => {
    if (EUROPEAN_LEAGUES.includes(parseInt(leagueId))) {
        const nextYear = (seasonYear + 1).toString().slice(-2);
        const current = seasonYear.toString().slice(-2);
        return `${current}/${nextYear}`;
    }
    return seasonYear.toString();
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

        // Intentar obtener la ronda actual desde la API
        try {
            const currentData = await fetchAPI(`/fixtures/rounds?league=${leagueId}&season=${season}&current=true`);
            if (currentData.response && currentData.response.length > 0) {
                state.currentRound = currentData.response[0];
            } else {
                state.currentRound = state.rounds[state.rounds.length - 1]; // Fallback a la última
            }
        } catch {
            state.currentRound = state.rounds[state.rounds.length - 1];
        }

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
        // Mostrar loader
        document.getElementById('fixtures-list').innerHTML = `<div class="flex justify-center py-10"><div class="loader"></div></div>`;

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
    // Si round es 'prev' o 'next', calcular índice
    if (round === 'prev' || round === 'next') {
        const currentIndex = state.rounds.indexOf(state.currentRound);
        let newIndex = currentIndex;

        if (round === 'prev' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        } else if (round === 'next' && currentIndex < state.rounds.length - 1) {
            newIndex = currentIndex + 1;
        }

        if (newIndex !== currentIndex) {
            state.currentRound = state.rounds[newIndex];
        } else {
            return; // No change
        }
    } else {
        state.currentRound = round;
    }

    // Actualizar selector UI
    updateRoundSelectorUI();

    // Cargar fixtures
    fetchFixturesByRound(state.selectedLeague.id, state.season, state.currentRound);
};

/**
 * Actualiza la UI del selector de rondas (texto y estado de botones)
 */
const updateRoundSelectorUI = () => {
    const selector = document.getElementById('round-selector-text');
    if (selector && state.currentRound) {
        selector.innerText = state.currentRound.replace(/Regular Season - /g, 'FECHA ').replace(/_/g, ' ').toUpperCase();
    }

    // Actualizar value del select oculto si existe
    const hiddenSelect = document.getElementById('hidden-round-select');
    if (hiddenSelect) {
        hiddenSelect.value = state.currentRound;
    }
};

/**
 * Abre el selector de rondas (dropdown nativo via JS)
 */
export const openRoundSelector = () => {
    const select = document.getElementById('hidden-round-select');
    if (select) {
        if (typeof select.showPicker === 'function') {
            select.showPicker();
        } else {
            select.focus(); // Fallback for some browsers
            select.click();
        }
    }
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

    // Ordenar por fecha
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
    // NOTE: El container ID ahora es distinto porque está dentro del layout split
    const container = document.getElementById('standings-table-container');

    if (!container || !table || table.length === 0) return;

    const isPromedios = table[0].group && (table[0].group.includes('Promedio') || table[0].group === 'PROMEDIOS');
    const ptsLabel = isPromedios ? 'PROM' : 'Pts';

    container.innerHTML = `
        <div class="bg-[#0a0a0a] border border-[#222] overflow-hidden rounded-lg mx-2 mb-3 md:mx-3">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-gray-400">
                    <thead class="text-[9px] md:text-[10px] text-gray-500 uppercase bg-[#111] border-b border-[#222] tracking-widest">
                        <tr>
                            <th class="px-2 py-2 md:px-3 md:py-3 text-center w-6 md:w-8">#</th>
                            <th class="px-2 py-2 md:px-3 md:py-3">Equipo</th>
                            <th class="px-1 py-2 md:px-2 md:py-3 text-center text-white">${ptsLabel}</th>
                            <th class="px-1 py-2 md:px-2 md:py-3 text-center">PJ</th>
                            <th class="px-1 py-2 md:px-2 md:py-3 text-center font-mono">DG</th>
                            <th class="px-1 py-2 md:px-2 md:py-3 text-center hidden md:table-cell">Forma</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1a1a1a]">
                        ${table.map(t => {
        const pointsDisplay = isPromedios
            ? (t.all.played > 0 ? (t.points / t.all.played).toFixed(3) : '0.000')
            : t.points;

        return `
                            <tr class="hover:bg-[#111] transition-colors">
                                <td class="px-2 py-2 md:px-3 md:py-3 text-center font-bold ${t.rank <= 4 ? 'text-white' : 'text-gray-600'} border-r border-[#222] text-[10px] md:text-xs">${t.rank}</td>
                                <td class="px-2 py-2 md:px-3 md:py-3 font-bold text-gray-300 flex items-center gap-2 md:gap-3 whitespace-nowrap uppercase text-[10px] md:text-xs">
                                    <img src="${t.team.logo}" class="w-4 h-4 md:w-6 md:h-6 object-contain">
                                    ${t.team.name}
                                </td>
                                <td class="px-1 py-2 md:px-2 md:py-3 text-center font-bold text-white bg-[#111]/50 text-[10px] md:text-xs">${pointsDisplay}</td>
                                <td class="px-1 py-2 md:px-2 md:py-3 text-center font-mono text-[10px] md:text-xs">${t.all.played}</td>
                                <td class="px-1 py-2 md:px-2 md:py-3 text-center font-mono text-[10px] md:text-xs ${t.goalsDiff > 0 ? 'text-white' : 'text-gray-600'}">${t.goalsDiff > 0 ? '+' : ''}${t.goalsDiff}</td>
                                <td class="px-2 py-3 text-center hidden md:table-cell">
                                    <div class="flex justify-center gap-0.5">
                                        ${t.form ? t.form.split('').slice(-5).map(f => `<div class="w-1.5 h-1.5 rounded-full ${f === 'W' ? 'bg-green-500' : (f === 'D' ? 'bg-gray-500' : 'bg-red-500')}"></div>`).join('') : '-'}
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
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
    // El container de tabs ahora es diferente
    const tabsContainer = document.getElementById('standings-tabs-container');

    // Custom Tab Names logic
    const getTabName = (rawName) => {
        if (!rawName) return 'TABLA';
        if (rawName.includes('Group A')) return 'ZONA A';
        if (rawName.includes('Group B')) return 'ZONA B';
        if (rawName.includes('Overall') || rawName.includes('Table') || rawName.includes('Anual')) return 'TABLA ANUAL';
        if (rawName.includes('Promedio')) return 'PROMEDIOS';
        return rawName.toUpperCase();
    };

    // Ensure we have Promedios if user wants it
    // If we have 3 tables (Zone A, Zone B, Annual), generate Promedios from Annual
    if (standingsData.length > 0) {
        // Check if Promedios exists
        const hasPromedios = standingsData.some(g => g[0] && g[0].group && g[0].group.includes('Promedio'));

        if (!hasPromedios) {
            // Find Annual or take the last one (usually Overall)
            const annualIndex = standingsData.findIndex(g => g[0].group.includes('Overall') || g[0].group.includes('Table') || g[0].group.includes('Anual'));
            const sourceTable = annualIndex >= 0 ? standingsData[annualIndex] : standingsData[standingsData.length - 1];

            if (sourceTable) {
                // Clone and sort by average
                const promediosTable = JSON.parse(JSON.stringify(sourceTable));
                // Hack: Rename the group in the first item so our renderer knows
                promediosTable.forEach(t => t.group = 'PROMEDIOS');

                // Sort by Avg (Points / Played)
                promediosTable.sort((a, b) => {
                    const avgA = a.all.played > 0 ? (a.points / a.all.played) : 0;
                    const avgB = b.all.played > 0 ? (b.points / b.all.played) : 0;
                    return avgB - avgA;
                });

                // Re-rank
                promediosTable.forEach((t, i) => t.rank = i + 1);

                standingsData.push(promediosTable);
            }
        }
    }

    if (standingsData.length > 1) {
        // Múltiples grupos
        if (tabsContainer) {
            tabsContainer.innerHTML = standingsData.map((g, i) => {
                const rawName = g[0] && g[0].group ? g[0].group : 'GRUPO ' + (i + 1);
                const displayName = getTabName(rawName);
                return `
                <button onclick="app.renderTable(${i})" class="px-3 py-1 bg-[#111] text-[10px] font-bold uppercase border border-[#333] text-gray-400 hover:text-white hover:border-white transition-all whitespace-nowrap rounded mr-2 last:mr-0">
                    ${displayName}
                </button>
            `}).join('');
        }
        state.standingsData = standingsData;
        renderTable(0);
    } else {
        // Un solo grupo
        if (tabsContainer) tabsContainer.innerHTML = '';
        state.standingsData = standingsData;
        renderTable(0);
    }
};

/**
 * Toggle del menú lateral de ligas (Global Sidebar)
 * Se usa especificamente en la vista de liga
 */
export const toggleSidebarInLeague = () => {
    const sidebar = document.getElementById('sidebar');
    // En escritorio, usamos lg:flex y hidden para controlar visibilidad
    // Si tiene 'hidden', está oculto. Si se lo quitamos y tiene 'lg:flex', se muestra.

    if (sidebar.classList.contains('hidden')) {
        // Mostrar
        sidebar.classList.remove('hidden');
        sidebar.classList.add('lg:flex');
    } else {
        // Ocultar
        sidebar.classList.add('hidden');
        sidebar.classList.remove('lg:flex');
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
    // Determinar temporada automática si no se ha seteado explícitamente en el state (o siempre al abrir)
    // Para simplificar, recalculamos al abrir
    const calculatedSeason = determineCurrentSeason(id);
    state.season = calculatedSeason;

    // Validar si estamos en la vista correcta, si no, resetear containers
    const viewStandings = document.getElementById('view-standings');
    const container = document.getElementById('standings-container'); // This will now hold the split layout

    // Update UI Visibility
    document.getElementById('view-match-list').classList.add('hidden');
    document.getElementById('date-nav').classList.add('hidden');
    viewStandings.classList.remove('hidden');

    // START: Layout Modification
    // Ocultar sidebars globales
    const sidebar = document.getElementById('sidebar');
    const rightSidebar = document.getElementById('right-sidebar');

    // Keep Left Sidebar (Leagues) visible
    sidebar.classList.remove('hidden');
    sidebar.classList.add('lg:flex');

    // Hide Right Sidebar (Community)
    rightSidebar.classList.add('hidden');
    rightSidebar.classList.remove('lg:flex'); // Ensure it's hidden on desktop too

    // Allow main to expand
    document.querySelector('main').classList.remove('lg:w-auto');

    // Season Select Options
    const seasonLabel = formatSeasonLabel(state.season, id);
    const prevSeasonLabel = formatSeasonLabel(state.season - 1, id);

    // Update Header
    document.getElementById('standings-title').innerHTML = `
        <div class="flex items-center gap-3">
            <button onclick="app.toggleSidebarInLeague()" class="bg-[#111] p-2 rounded hover:bg-[#222] border border-[#333] transition-colors group" title="Ver Ligas">
                 <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            <div class="flex flex-col">
                <span class="text-xl font-bold text-white uppercase tracking-wider font-sport leading-none">${leagueName}</span>
            </div>
        </div>
    `;

    // Inject season selector (replacement logic for existing selector in view-standings header if it exists)
    const headerDiv = document.querySelector('#view-standings > div.sticky > div.flex');
    if (headerDiv) {
        const oldSelector = document.getElementById('season-selector');
        if (oldSelector) {
            oldSelector.innerHTML = `
                <option value="${state.season}" selected>${seasonLabel}</option>
                <option value="${state.season - 1}">${prevSeasonLabel}</option>
            `;
        }
    }

    // Hide old tabs container if visible
    const oldTabs = document.getElementById('standings-tabs');
    if (oldTabs) oldTabs.classList.add('hidden');

    // Setup Split Views Layout
    // Setup Split Views Layout

    // Check if Cup for Bracket View
    if (CUP_LEAGUES.includes(parseInt(id))) {
        renderCupView(id, state.season, container);
        return;
    }

    container.innerHTML = `
        <div class="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-140px)] gap-6 lg:overflow-hidden pb-20 lg:pb-0">
            <!-- Left: Table (Scrollable) -->
            <div class="w-full lg:flex-1 flex flex-col min-h-[500px] lg:min-h-0 bg-[#050505] rounded-xl border border-[#222] overflow-hidden">
                 <div class="p-4 bg-black border-b border-[#222] flex justify-between items-center shrink-0">
                    <h3 class="font-bold text-gray-400 uppercase tracking-widest text-xs">Posiciones ${seasonLabel}</h3>
                    <div id="standings-tabs-container" class="flex overflow-x-auto no-scrollbar"></div>
                </div>
                <div id="standings-table-container" class="flex-1 overflow-y-auto p-0 h-[500px] lg:h-auto">
                    <div class="flex justify-center py-20"><div class="loader"></div></div>
                </div>
            </div>

            <!-- Right: Fixtures (Fixed width) -->
            <div class="w-full lg:w-96 shrink-0 flex flex-col bg-[#050505] rounded-xl border border-[#222] overflow-hidden h-[500px] lg:h-full">
                <!-- Round Selector (Custom Nav) -->
                <div class="p-4 border-b border-[#222] shrink-0 bg-black relative">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-gray-400 uppercase tracking-widest text-xs">Calendario</h3>
                    </div>
                    
                    <div class="flex items-center justify-between bg-[#111] border border-[#333] rounded p-1">
                        <button onclick="app.changeRound('prev')" class="p-2 hover:bg-[#222] text-gray-400 hover:text-white rounded transition-colors" title="Fecha anterior">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        
                        <div class="flex-1 text-center cursor-pointer hover:text-gray-300 relative group" onclick="app.openRoundSelector()">
                            <span id="round-selector-text" class="text-xs font-bold text-white uppercase tracking-widest select-none">CARGANDO...</span>
                            <!-- Hidden Select Overlay -->
                            <select id="hidden-round-select" onchange="app.changeRound(this.value)" 
                                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs">
                                <!-- Options populated later -->
                            </select>
                        </div>

                        <button onclick="app.changeRound('next')" class="p-2 hover:bg-[#222] text-gray-400 hover:text-white rounded transition-colors" title="Siguiente fecha">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
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
        const hiddenSelect = document.getElementById('hidden-round-select');

        if (roundsData && roundsData.length > 0) {
            hiddenSelect.innerHTML = roundsData.map(r => `
                <option value="${r}" ${r === state.currentRound ? 'selected' : ''}>${r.replace(/Regular Season - /g, 'FECHA ').replace(/_/g, ' ').toUpperCase()}</option>
            `).join('');

            updateRoundSelectorUI();

            // Cargar fixtures de la ronda actual
            if (state.currentRound) {
                fetchFixturesByRound(id, state.season, state.currentRound);
            }
        } else {
            const selectorText = document.getElementById('round-selector-text');
            if (selectorText) selectorText.innerText = 'NO HAY DATOS';
            if (hiddenSelect) hiddenSelect.disabled = true;
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="text-center text-gray-500 py-10 text-xs uppercase tracking-widest">Error al cargar datos.</div>`;
    }
};

export const getStandingsState = () => state;

/**
 * Renderiza la vista de Bracket para Copas (Versión Refinada)
 */
const renderCupView = async (leagueId, season, container) => {
    container.innerHTML = `<div class="flex justify-center items-center h-96"><div class="loader"></div></div>`;

    try {
        // Fetch all fixtures for the cup season
        const data = await fetchAPI(`/fixtures?league=${leagueId}&season=${season}&timezone=America/Argentina/Buenos_Aires`);
        const fixtures = data.response;

        if (!fixtures || fixtures.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-500 py-20 text-sm">No hay datos disponibles para el cuadro de esta copa.</div>`;
            return;
        }

        const roundOrder = ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];
        const displayRounds = {
            'Round of 16': 'Octavos',
            'Quarter-finals': 'Cuartos',
            'Semi-finals': 'Semifinal',
            'Final': 'Final'
        };

        const grouped = {};

        fixtures.forEach(f => {
            const r = f.league.round;
            const bucket = roundOrder.find(ro => r.includes(ro));
            if (bucket) {
                if (!grouped[bucket]) grouped[bucket] = [];
                grouped[bucket].push(f);
            }
        });

        Object.keys(grouped).forEach(k => {
            grouped[k].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
        });

        // Build HTML with reduced sizing and connector lines
        let html = `<div class="flex flex-nowrap overflow-x-auto p-6 items-stretch min-h-[600px] lg:justify-center bg-[#050505] rounded-xl border border-[#222]">`;

        roundOrder.forEach((roundKey, idx) => {
            const matches = grouped[roundKey];
            if (!matches || matches.length === 0) return;

            // Determine if first or last column for connector logic
            const isFirst = idx === 0;
            const isLast = idx === roundOrder.length - 1;

            html += `
                <div class="flex flex-col w-56 shrink-0 relative">
                    <h3 class="text-center font-bold text-gray-500 uppercase tracking-widest text-[10px] mb-6 border-b border-[#222] pb-2 mx-4">
                        ${displayRounds[roundKey] || roundKey}
                    </h3>
                    <div class="flex flex-col justify-around flex-1 gap-4 relative px-2">
            `;

            matches.forEach((m, mIdx) => {
                const isFin = ['FT', 'AET', 'PEN'].includes(m.fixture.status.short);
                const isLive = ['1H', '2H', 'ET', 'P', 'LIVE'].includes(m.fixture.status.short);

                const homeWin = isFin && ((m.goals.home > m.goals.away) || (m.score.penalty.home > m.score.penalty.away));
                const awayWin = isFin && ((m.goals.away > m.goals.home) || (m.score.penalty.away > m.score.penalty.home));

                const homeClass = homeWin ? 'text-white' : 'text-gray-500';
                const awayClass = awayWin ? 'text-white' : 'text-gray-500';
                const scoreClass = 'font-bold text-white text-[10px]';

                // Connectors
                let connectors = '';
                // Line to right (next round)
                if (!isLast) {
                    connectors += `<div class="absolute top-1/2 -right-4 w-4 h-[1px] bg-[#333]"></div>`;
                }
                // Line to left (prev round)
                if (!isFirst) {
                    connectors += `<div class="absolute top-1/2 -left-2 w-2 h-[1px] bg-[#333]"></div>`;
                }

                html += `
                    <div class="bg-[#111] border border-[#222] rounded p-2 flex flex-col gap-1 relative hover:border-gray-600 transition-colors cursor-pointer shadow-lg z-10" onclick="app.navigate('/partido/${m.fixture.id}')">
                        ${connectors}
                        ${isLive ? '<div class="absolute -top-1 -right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>' : ''}
                        
                        <!-- Home -->
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-2 min-w-0">
                                <img src="${m.teams.home.logo}" class="w-4 h-4 object-contain shrink-0">
                                <span class="text-[10px] ${homeClass} font-bold uppercase truncate">${m.teams.home.name}</span>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <span class="${scoreClass}">${m.goals.home ?? '-'}</span>
                                ${m.score.penalty.home ? `<span class="text-[9px] text-gray-600">(${m.score.penalty.home})</span>` : ''}
                            </div>
                        </div>

                        <!-- Away -->
                        <div class="flex justify-between items-center">
                             <div class="flex items-center gap-2 min-w-0">
                                <img src="${m.teams.away.logo}" class="w-4 h-4 object-contain shrink-0">
                                <span class="text-[10px] ${awayClass} font-bold uppercase truncate">${m.teams.away.name}</span>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <span class="${scoreClass}">${m.goals.away ?? '-'}</span>
                                ${m.score.penalty.away ? `<span class="text-[9px] text-gray-600">(${m.score.penalty.away})</span>` : ''}
                            </div>
                        </div>
                        
                        <div class="text-[8px] text-gray-700 text-center mt-0.5 uppercase font-mono tracking-wider">
                            ${isFin ? 'FINAL' : new Date(m.fixture.date).toLocaleDateString()}
                        </div>
                    </div>
                `;
            });

            html += `</div></div>`;

            // Spacer between columns for visual line continuity (handled by absolute lines now, but can keep small gap)
            if (idx < roundOrder.length - 1) {
                html += `<div class="w-8 shrink-0 relative"></div>`;
            }
        });

        html += `</div>`;
        container.innerHTML = html;

    } catch (e) {
        console.error("Error rendering cup bracket:", e);
        container.innerHTML = `<div class="text-center text-gray-500 py-10">Error al cargar el cuadro.</div>`;
    }
};

