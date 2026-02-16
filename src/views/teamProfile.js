/**
 * Team Profile View Module
 * 
 * Propósito: Vista de perfil de equipo con info, partidos, fichajes, tabla y HISTORIALES
 * 
 * Exports:
 * - showTeamProfile(params): Muestra perfil de un equipo
 * - showHistory(teamId, country): Muestra la vista de selección de rival
 * - loadHeadToHead(teamId1, teamId2): Carga y muestra el historial vs
 */

import { fetchAPI } from '../core/api.js';
import { navigate } from '../core/router.js';

// IDs de ligas europeas (para formato de temporada)
const EUROPEAN_LEAGUES = [39, 140, 78, 135, 61, 2, 3, 143, 137];

/**
 * Determina la temporada actual para una liga
 */
const determineCurrentSeason = (leagueId) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;

    if (EUROPEAN_LEAGUES.includes(parseInt(leagueId))) {
        return month >= 7 ? currentYear : currentYear - 1;
    }
    return currentYear;
};

let currentTeamContext = null;

/**
 * Muestra el perfil de un equipo
 * @param {Object|number} params - { id } desde router o ID directo
 */
export const showTeamProfile = async (params) => {
    let teamId;
    if (typeof params === 'object' && params !== null) {
        teamId = params.id;
    } else {
        teamId = params;
    }

    // Setup layout: sidebar izq visible, sidebar der oculto
    document.getElementById('view-match-list').classList.add('hidden');
    document.getElementById('view-standings').classList.add('hidden');
    document.getElementById('view-forum').classList.add('hidden');
    document.getElementById('view-match-detail').classList.add('hidden');
    const viewLineup = document.getElementById('view-lineup-builder');
    if (viewLineup) viewLineup.classList.add('hidden');
    document.getElementById('date-nav').classList.add('hidden');

    const viewTeam = document.getElementById('view-team');
    viewTeam.classList.remove('hidden');

    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('hidden');
    sidebar.classList.add('lg:flex');

    const rightSidebar = document.getElementById('right-sidebar');
    rightSidebar.classList.add('hidden');
    rightSidebar.classList.remove('lg:flex');

    document.querySelector('main').classList.remove('lg:w-auto');

    // Scroll to top
    document.getElementById('main-content').scrollTo(0, 0);

    // Show loader
    viewTeam.innerHTML = `<div class="flex justify-center py-20"><div class="loader"></div></div>`;

    try {
        // Fetch team info + last 5 + next 5 in parallel
        const [teamData, lastMatches, nextMatches, transfersData] = await Promise.all([
            fetchAPI(`/teams?id=${teamId}`),
            fetchAPI(`/fixtures?team=${teamId}&last=5&timezone=America/Argentina/Buenos_Aires`),
            fetchAPI(`/fixtures?team=${teamId}&next=5&timezone=America/Argentina/Buenos_Aires`),
            fetchAPI(`/transfers?team=${teamId}`)
        ]);

        const team = teamData.response?.[0]?.team;
        const venue = teamData.response?.[0]?.venue;

        if (!team) {
            viewTeam.innerHTML = `<div class="text-center text-gray-500 py-20 text-xs uppercase tracking-widest">Equipo no encontrado.</div>`;
            return;
        }

        currentTeamContext = team; // Guardar info del equipo actual para el historial

        const last5 = lastMatches.response || [];
        const next5 = nextMatches.response || [];

        // Flatten all transfers from all players in the response
        // API returns: response = [{ player: {...}, transfers: [...] }, ...]
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const allTransfers = [];
        if (transfersData.response && Array.isArray(transfersData.response)) {
            for (const playerEntry of transfersData.response) {
                if (playerEntry.transfers && Array.isArray(playerEntry.transfers)) {
                    for (const transfer of playerEntry.transfers) {
                        allTransfers.push({
                            ...transfer,
                            player: playerEntry.player
                        });
                    }
                }
            }
        }
        const recentTransfers = allTransfers.filter(t => {
            const d = new Date(t.date);
            return d >= oneYearAgo;
        });

        // Deduplicate: keep only the most recent transfer per player (by player.id)
        const dedupMap = new Map();
        for (const t of recentTransfers) {
            const key = `${t.player.id}-${t.teams.in.id === parseInt(teamId) ? 'in' : 'out'}`;
            const existing = dedupMap.get(key);
            if (!existing || new Date(t.date) > new Date(existing.date)) {
                dedupMap.set(key, t);
            }
        }
        const uniqueTransfers = Array.from(dedupMap.values());

        // Sort by price descending (most expensive first), free/unknown at bottom
        const parsePrice = (t) => {
            if (!t.type || t.type === 'Free' || t.type === 'N/A') return 0;
            const match = t.type?.match(/([\d.]+)\s*M/i);
            if (match) return parseFloat(match[1]) * 1000000;
            const match2 = t.type?.match(/([\d.]+)\s*K/i);
            if (match2) return parseFloat(match2[1]) * 1000;
            return 1;
        };
        const sortByPrice = (a, b) => parsePrice(b) - parsePrice(a);

        const arrivals = uniqueTransfers.filter(t => t.teams.in.id === parseInt(teamId)).sort(sortByPrice);
        const departures = uniqueTransfers.filter(t => t.teams.out.id === parseInt(teamId)).sort(sortByPrice);

        // Determine league for standings
        let leagueId = null;
        let leagueName = '';
        // Try to get from recent matches
        const allMatches = [...last5, ...next5];
        if (allMatches.length > 0) {
            // Prefer a league match (not cup)
            const leagueMatch = allMatches.find(m => {
                const lid = m.league.id;
                return [128, 1032, 129, 71, 39, 140, 78, 135, 61].includes(lid);
            }) || allMatches[0];
            leagueId = leagueMatch.league.id;
            leagueName = leagueMatch.league.name;
        }

        // Render the profile
        viewTeam.innerHTML = `
            <!-- Header -->
            <div class="sticky top-0 z-20 bg-black/95 backdrop-blur py-2 border-b border-[#222] mb-6">
                <div class="flex items-center justify-between px-1">
                    <div class="flex items-center gap-3">
                        <button onclick="app.navigateToMatches()" class="lg:hidden p-1 text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <button onclick="history.back()" class="hidden lg:block bg-[#111] p-2 rounded hover:bg-[#222] border border-[#333] transition-colors group" title="Volver">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Team Info Card -->
            <div class="bg-[#0a0a0a] border border-[#222] rounded-xl p-6 mb-6 flex flex-col items-center text-center relative">
                <img src="${team.logo}" class="w-24 h-24 object-contain mb-4">
                <h1 class="text-2xl font-bold text-white uppercase tracking-wider font-sport mb-2">${team.name}</h1>
                ${venue ? `
                    <div class="flex items-center gap-2 text-gray-400 mb-4">
                        <img src="https://i.postimg.cc/mrVjjgxJ/4905563-2.png" class="w-4 h-4 object-contain opacity-60">
                        <span class="text-xs font-bold uppercase tracking-widest">${venue.name}</span>
                    </div>
                ` : ''}
            </div>

            <!-- Main Content Container (Toggleable) -->
            <div id="team-main-content">
                <!-- Content Grid -->
                <div class="flex flex-col lg:flex-row gap-6">
                    <!-- Left Column: Matches -->
                    <div class="w-full lg:flex-1 space-y-6">
                        <!-- Últimos 5 Partidos -->
                        <div class="bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden">
                             <div class="px-4 py-3 bg-[#111] border-b border-[#222]">
                                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Últimos Partidos</h3>
                            </div>
                            <div class="divide-y divide-[#1a1a1a]">
                                ${last5.length > 0 ? last5.map(m => renderMatchRow(m, parseInt(teamId))).join('') : '<div class="text-center text-gray-600 py-6 text-xs">Sin partidos recientes</div>'}
                            </div>
                        </div>

                        <!-- Próximos 5 Partidos -->
                        <div class="bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden">
                            <div class="px-4 py-3 bg-[#111] border-b border-[#222]">
                                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Próximos Partidos</h3>
                            </div>
                            <div class="divide-y divide-[#1a1a1a]">
                                ${next5.length > 0 ? next5.map(m => renderUpcomingRow(m, parseInt(teamId))).join('') : '<div class="text-center text-gray-600 py-6 text-xs">Sin próximos partidos</div>'}
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Transfers + Standings -->
                    <div class="w-full lg:w-96 shrink-0 space-y-6">
                        <!-- Llegadas -->
                        <div class="bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden">
                            <div class="px-4 py-3 bg-[#111] border-b border-[#222]">
                                <h3 class="text-xs font-bold text-green-500 uppercase tracking-widest">Llegadas</h3>
                            </div>
                             <div class="max-h-[270px] overflow-y-auto">
                                ${arrivals.length > 0 ? `<div class="divide-y divide-[#1a1a1a]">${arrivals.map(t => renderTransferRow(t, 'in')).join('')}</div>` : '<div class="text-gray-600 text-xs p-4">Sin fichajes recientes</div>'}
                            </div>
                        </div>

                        <!-- Salidas -->
                        <div class="bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden">
                            <div class="px-4 py-3 bg-[#111] border-b border-[#222]">
                                <h3 class="text-xs font-bold text-red-500 uppercase tracking-widest">Salidas</h3>
                            </div>
                            <div class="max-h-[270px] overflow-y-auto">
                                ${departures.length > 0 ? `<div class="divide-y divide-[#1a1a1a]">${departures.map(t => renderTransferRow(t, 'out')).join('')}</div>` : '<div class="text-gray-600 text-xs p-4">Sin salidas recientes</div>'}
                            </div>
                        </div>

                        <!-- Mini Standings -->
                        <div id="team-standings-container" class="bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden">
                            <div class="px-4 py-3 bg-[#111] border-b border-[#222]">
                                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Posiciones</h3>
                            </div>
                            <div id="team-standings-table" class="p-0">
                                <div class="flex justify-center py-6"><div class="loader"></div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- History View Container (Hidden initially) -->
            <div id="team-history-container" class="hidden"></div>
        `;

        // Load standings async
        if (leagueId) {
            loadTeamStandings(leagueId, parseInt(teamId));
        } else {
            document.getElementById('team-standings-table').innerHTML = `<div class="text-center text-gray-600 py-6 text-xs">Sin datos de liga</div>`;
        }

    } catch (e) {
        console.error('Error loading team profile:', e);
        viewTeam.innerHTML = `<div class="text-center text-gray-500 py-20 text-xs uppercase tracking-widest">Error al cargar datos del equipo.</div>`;
    }
};

/**
 * Muestra la vista de selección de rival (equipos del mismo país)
 */
export const showHistory = async (teamId, country) => {
    const mainContent = document.getElementById('team-main-content');
    const historyContainer = document.getElementById('team-history-container');

    // Toggle views
    mainContent.classList.add('hidden');
    historyContainer.classList.remove('hidden');

    historyContainer.innerHTML = `<div class="flex justify-center py-20"><div class="loader"></div></div>`;

    try {
        // Ensure we have context, fetch if missing (though showTeamProfile should have set it)
        if (!currentTeamContext || currentTeamContext.id !== parseInt(teamId)) {
            const teamData = await fetchAPI(`/teams?id=${teamId}`);
            if (teamData.response && teamData.response[0]) {
                currentTeamContext = teamData.response[0].team;
            }
        }

        // Fetch teams from same country
        const data = await fetchAPI(`/teams?country=${country}`);

        if (!data.response || data.response.length === 0) {
            historyContainer.innerHTML = `
                <div class="text-center py-10">
                    <p class="text-gray-500 text-xs mb-4">No se encontraron equipos de ${country}</p>
                    <button onclick="app.closeHistory()" class="text-white underline text-xs">Volver</button>
                </div>`;
            return;
        }

        // Determine if current team is National Team
        const isCurrentNational = currentTeamContext && currentTeamContext.national;

        // Keywords to identify Reserve/B teams
        const reserveKeywords = ['Reserves', 'Reserva', ' II', ' B', 'U20', 'U23', 'U21', 'U19', 'Sub-20', 'Sub-21', 'Sub-23', 'Academy', 'Promesas'];

        // Filter out current team & sort alphabetically
        const teams = data.response
            .map(item => item.team)
            .filter(t => {
                if (t.id === parseInt(teamId)) return false;

                // RESERVE CHECK
                const name = t.name.toLowerCase();
                const isReserve =
                    name.includes('reserve') ||
                    name.includes('reserva') ||
                    name.endsWith(' ii') ||
                    name.endsWith(' b') ||
                    name.includes('u23') ||
                    name.includes('u21') ||
                    name.includes('u20') ||
                    name.includes('u19') ||
                    name.includes('sub-23') ||
                    name.includes('sub-20') ||
                    name.includes('youth') ||
                    name.includes('academy');

                if (isReserve) return false;

                // NATIONAL vs CLUB Check
                if (currentTeamContext.national) {
                    // Current is National Team -> Show ONLY other National Teams
                    return t.national === true;
                } else {
                    // Current is Club -> Show ONLY other Clubs (NOT National)
                    return t.national === false;
                }
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        historyContainer.innerHTML = `
            <div class="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-lg font-bold text-white uppercase tracking-wider font-sport">Seleccionar Rival</h2>
                     <button onclick="app.closeHistory()" class="text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest">
                        Cancelar
                    </button>
                </div>
                
                <input type="text" id="rival-search" placeholder="Buscar equipo..." 
                    class="w-full bg-[#111] border border-[#333] text-white p-3 rounded mb-4 focus:outline-none focus:border-white transition-colors"
                    onkeyup="app.filterRivals(this.value)">

                <div id="rivals-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto pr-1">
                    ${teams.map(t => `
                        <div class="rival-card flex items-center gap-3 p-3 bg-[#111] border border-[#222] rounded hover:bg-[#222] hover:border-gray-500 cursor-pointer transition-all"
                             onclick="app.loadHeadToHead(${teamId}, ${t.id}, '${t.name}', '${t.logo}')"
                             data-name="${t.name.toLowerCase()}">
                            <img src="${t.logo}" class="w-8 h-8 object-contain">
                            <span class="text-xs font-bold text-gray-300 truncate">${t.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div id="h2h-result-container"></div>
        `;

    } catch (e) {
        console.error('Error fetching rivals:', e);
        historyContainer.innerHTML = `<div class="text-center text-gray-500 py-10">Error al cargar rivales.</div>`;
    }
};

/**
 * Cierra la vista de historial y vuelve al perfil
 */
export const closeHistory = () => {
    document.getElementById('team-main-content').classList.remove('hidden');
    document.getElementById('team-history-container').classList.add('hidden');
};

/**
 * Filtra la lista de rivales en cliente
 */
export const filterRivals = (query) => {
    const term = query.toLowerCase();
    const cards = document.querySelectorAll('.rival-card');
    cards.forEach(card => {
        const name = card.dataset.name;
        if (name.includes(term)) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
};

/**
 * Carga y muestra los datos del Head to Head
 */
export const loadHeadToHead = async (team1Id, team2Id, team2Name, team2Logo) => {
    const container = document.getElementById('h2h-result-container');
    container.innerHTML = `<div class="flex justify-center py-20"><div class="loader"></div></div>`;

    // Scroll to container
    container.scrollIntoView({ behavior: 'smooth' });

    try {
        // Request the last 99 matches, which is a good proxy for "all available history"
        // The API might still be limited by date range, but this maximizes the count.
        const data = await fetchAPI(`/fixtures/headtohead?h2h=${team1Id}-${team2Id}&last=99&timezone=America/Argentina/Buenos_Aires`);
        const fixtures = data.response;

        if (!fixtures || fixtures.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-500 py-10 text-xs uppercase tracking-widest">No hay historial registrado entre estos equipos.</div>`;
            return;
        }

        // --- CALCULATE STATS ---
        let stats = {
            total: fixtures.length,
            team1Wins: 0,
            team2Wins: 0,
            draws: 0,
            team1Goals: 0,
            team2Goals: 0
        };

        fixtures.forEach(m => {
            const isTeam1Home = m.teams.home.id === parseInt(team1Id);
            const team1Score = isTeam1Home ? m.goals.home : m.goals.away;
            const team2Score = isTeam1Home ? m.goals.away : m.goals.home;

            stats.team1Goals += team1Score;
            stats.team2Goals += team2Score;

            if (team1Score > team2Score) stats.team1Wins++;
            else if (team2Score > team1Score) stats.team2Wins++;
            else stats.draws++;
        });

        // Current Team Info (Stored in global context or extracted from first match)
        const team1 = currentTeamContext;

        // --- RENDER ---
        container.innerHTML = `
            <div class="bg-[#0a0a0a] border border-[#333] rounded-xl overflow-hidden mb-8">
                <!-- Header VS -->
                <div class="bg-[#111] p-6 border-b border-[#222]">
                    <div class="flex justify-center items-center gap-4 lg:gap-12">
                        <div class="flex flex-col items-center gap-2 w-24 lg:w-32">
                            <img src="${team1.logo}" class="w-16 h-16 lg:w-20 lg:h-20 object-contain drop-shadow-lg">
                            <span class="text-xs lg:text-sm font-bold text-white text-center leading-tight font-sport">${team1.name}</span>
                        </div>
                        
                        <div class="flex flex-col items-center">
                            <span class="text-3xl lg:text-5xl font-black text-white italic font-sport">VS</span>
                            <span class="text-[10px] text-gray-500 uppercase tracking-widest mt-1">${stats.total} PJ</span>
                        </div>

                        <div class="flex flex-col items-center gap-2 w-24 lg:w-32">
                            <img src="${team2Logo}" class="w-16 h-16 lg:w-20 lg:h-20 object-contain drop-shadow-lg">
                            <span class="text-xs lg:text-sm font-bold text-white text-center leading-tight font-sport">${team2Name}</span>
                        </div>
                    </div>
                <!-- H2H Summary -->
                <div class="bg-[#111] px-6 pb-6 border-b border-[#222] flex justify-center">
                    ${(() => {
                const diff = stats.team1Wins - stats.team2Wins;
                if (diff === 0) {
                    return `<div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-gray-300 uppercase tracking-widest">Historial Empatado</span>
                            </div>`;
                }

                const leaderName = diff > 0 ? team1.name : team2Name;
                const leaderLogo = diff > 0 ? team1.logo : team2Logo;
                const absDiff = Math.abs(diff);

                return `
                            <div class="flex items-center gap-3">
                                <img src="${leaderLogo}" class="w-8 h-8 object-contain">
                                <span class="text-xs text-gray-300 uppercase tracking-wide">
                                    <span class="font-bold text-white">${leaderName}</span> está arriba en el historial por <span class="font-bold text-white">${absDiff}</span> partidos
                                </span>
                            </div>
                        `;
            })()}
                </div>

                <!-- Stats Bar -->
                <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Wins Chart -->
                     <div class="flex flex-col items-center justify-center">
                        <div class="flex gap-1 items-end h-32 w-full max-w-[200px] justify-center px-4">
                             <!-- Team 1 Bar -->
                            <div class="w-12 bg-white flex flex-col justify-end items-center relative group rounded-t" style="height: ${Math.max(10, (stats.team1Wins / stats.total) * 100)}%">
                                <span class="absolute -top-6 text-xl font-bold text-white">${stats.team1Wins}</span>
                            </div>
                            <!-- Draws Bar -->
                            <div class="w-12 bg-gray-600 flex flex-col justify-end items-center relative group rounded-t mx-1" style="height: ${Math.max(10, (stats.draws / stats.total) * 100)}%">
                                <span class="absolute -top-6 text-xl font-bold text-gray-400">${stats.draws}</span>
                            </div>
                            <!-- Team 2 Bar -->
                            <div class="w-12 bg-[#333] flex flex-col justify-end items-center relative group rounded-t" style="height: ${Math.max(10, (stats.team2Wins / stats.total) * 100)}%">
                                <span class="absolute -top-6 text-xl font-bold text-gray-400">${stats.team2Wins}</span>
                            </div>
                        </div>
                        <div class="flex gap-4 mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            <span class="text-white">Ganados</span>
                            <span>Empates</span>
                            <span>Perdidos</span>
                        </div>
                    </div>

                    <!-- Goals Stats -->
                    <div class="col-span-1 md:col-span-2 flex flex-col justify-center gap-4">
                        <div class="bg-[#111] rounded p-4 border border-[#222]">
                            <h4 class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Goles a Favor</h4>
                            <div class="flex items-center gap-4">
                                <div class="text-2xl font-bold text-white font-mono w-12 text-center">${stats.team1Goals}</div>
                                <div class="flex-1 h-2 bg-[#222] rounded-full overflow-hidden">
                                     <div class="h-full bg-white" style="width: ${(stats.team1Goals / (stats.team1Goals + stats.team2Goals)) * 100}%"></div>
                                </div>
                                <div class="text-2xl font-bold text-gray-500 font-mono w-12 text-center">${stats.team2Goals}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Last 15 Matches List -->
                <div class="border-t border-[#222]">
                    <div class="px-4 py-3 bg-[#111] border-b border-[#222]">
                        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Últimos 15 Enfrentamientos</h3>
                    </div>
                    <div class="divide-y divide-[#1a1a1a]">
                        ${fixtures.slice(0, 15).map(m => {
                const date = new Date(m.fixture.date);
                const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

                // Determine Winner Color
                const isHome = m.teams.home.id === parseInt(team1Id);
                const t1Score = isHome ? m.goals.home : m.goals.away;
                const t2Score = isHome ? m.goals.away : m.goals.home;

                let borderClass = 'border-l-4 border-transparent';
                if (t1Score > t2Score) borderClass = 'border-l-4 border-l-green-500'; // Win
                else if (t1Score < t2Score) borderClass = 'border-l-4 border-l-red-500'; // Loss
                else borderClass = 'border-l-4 border-l-gray-500'; // Draw

                return `
                            <div class="flex items-center justify-between px-4 py-3 hover:bg-[#111] transition-colors cursor-pointer ${borderClass}" onclick="app.navigate('/partido/${m.fixture.id}')">
                                <div class="flex items-center gap-4 min-w-0 flex-1">
                                    <span class="text-[10px] font-mono text-gray-600 shrink-0">${dateStr}</span>
                                    
                                    <div class="flex items-center gap-3">
                                        <div class="flex items-center gap-2 w-24 lg:w-32 justify-end">
                                            <span class="text-[10px] font-bold ${m.teams.home.id === parseInt(team1Id) ? 'text-white' : 'text-gray-400'} truncate">${m.teams.home.name}</span>
                                            <img src="${m.teams.home.logo}" class="w-5 h-5 object-contain">
                                        </div>
                                        
                                        <div class="px-2 py-1 bg-[#222] rounded text-xs font-bold text-white font-mono tracking-widest whitespace-nowrap">
                                            ${m.goals.home} - ${m.goals.away}
                                        </div>
                                        
                                        <div class="flex items-center gap-2 w-24 lg:w-32">
                                            <img src="${m.teams.away.logo}" class="w-5 h-5 object-contain">
                                            <span class="text-[10px] font-bold ${m.teams.away.id === parseInt(team1Id) ? 'text-white' : 'text-gray-400'} truncate">${m.teams.away.name}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="hidden lg:block text-[9px] text-gray-600 uppercase tracking-widest ml-4 truncate w-24 text-right">${m.league.name}</div>
                            </div>
                            `;
            }).join('')}
                    </div>
                </div>
            </div>
        `;

    } catch (e) {
        console.error('Error fetching h2h:', e);
        container.innerHTML = `<div class="text-center text-gray-500 py-10">Error al cargar historial.</div>`;
    }
};

/**
 * Renderiza una fila de partido jugado
 */
const renderMatchRow = (m, teamId) => {
    const isHome = m.teams.home.id === teamId;
    const myScore = isHome ? m.goals.home : m.goals.away;
    const oppScore = isHome ? m.goals.away : m.goals.home;
    const opponent = isHome ? m.teams.away : m.teams.home;
    const date = new Date(m.fixture.date);
    const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).toUpperCase();

    let resultClass = 'text-gray-500'; // Draw
    let resultText = 'E';
    if (myScore > oppScore) { resultClass = 'text-green-500'; resultText = 'V'; }
    else if (myScore < oppScore) { resultClass = 'text-red-500'; resultText = 'D'; }

    const status = m.fixture.status.short;
    const isFin = ['FT', 'AET', 'PEN'].includes(status);

    return `
        <div class="flex items-center justify-between px-4 py-3 hover:bg-[#111] transition-colors cursor-pointer" onclick="app.navigate('/partido/${m.fixture.id}')">
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${resultClass} bg-[#111] border border-[#222] shrink-0">${resultText}</div>
                <img src="${opponent.logo}" class="w-5 h-5 object-contain shrink-0">
                <div class="min-w-0">
                    <div class="text-xs font-bold text-gray-200 truncate uppercase">${isHome ? 'vs' : '@'} ${opponent.name}</div>
                    <div class="text-[10px] text-gray-600">${dateStr} · ${m.league.name}</div>
                </div>
            </div>
            <div class="text-sm font-bold text-white font-mono shrink-0 ml-3">${m.goals.home} - ${m.goals.away}</div>
        </div>
    `;
};

/**
 * Renderiza una fila de próximo partido
 */
const renderUpcomingRow = (m, teamId) => {
    const isHome = m.teams.home.id === teamId;
    const opponent = isHome ? m.teams.away : m.teams.home;
    const date = new Date(m.fixture.date);
    const dateStr = date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
    const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

    return `
        <div class="flex items-center justify-between px-4 py-3 hover:bg-[#111] transition-colors cursor-pointer" onclick="app.navigate('/partido/${m.fixture.id}')">
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <img src="${opponent.logo}" class="w-5 h-5 object-contain shrink-0">
                <div class="min-w-0">
                    <div class="text-xs font-bold text-gray-200 truncate uppercase">${isHome ? 'vs' : '@'} ${opponent.name}</div>
                    <div class="text-[10px] text-gray-600">${dateStr} · ${m.league.name}</div>
                </div>
            </div>
            <div class="text-xs font-bold text-gray-400 font-mono shrink-0 ml-3">${timeStr}</div>
        </div>
    `;
};

/**
 * Renderiza una fila de fichaje
 */
const renderTransferRow = (t, direction) => {
    const fromTo = direction === 'in' ? t.teams.out : t.teams.in;

    // Determine price/type label
    let priceLabel = '';
    let priceClass = 'text-gray-500';
    const type = (t.type || '').trim();
    if (!type || type === 'Free' || type === 'N/A') {
        priceLabel = 'LIBRE';
        priceClass = 'text-gray-500';
    } else if (type === 'Loan') {
        priceLabel = 'PRÉSTAMO';
        priceClass = 'text-yellow-500';
    } else if (type === 'Return from loan') {
        priceLabel = 'FIN PRÉSTAMO';
        priceClass = 'text-yellow-500';
    } else {
        // Actual price like "€ 30M", "€ 500K", etc.
        priceLabel = type;
        priceClass = 'text-emerald-400';
    }

    return `
        <div class="flex items-center gap-2 px-3 py-2.5 hover:bg-[#111] transition-colors">
            <img src="${fromTo.logo || ''}" class="w-5 h-5 object-contain shrink-0 opacity-50" onerror="this.style.display='none'">
            <div class="min-w-0 flex-1">
                <div class="text-xs font-bold text-gray-300 truncate">${t.player.name}</div>
                <div class="text-[10px] text-gray-600 truncate">${direction === 'in' ? 'De' : 'A'} ${fromTo.name}</div>
            </div>
            <div class="text-[10px] font-bold ${priceClass} shrink-0 uppercase tracking-wider">${priceLabel}</div>
        </div>
    `;
};

/**
 * Carga y renderiza la mini tabla de posiciones
 */
const loadTeamStandings = async (leagueId, teamId) => {
    const container = document.getElementById('team-standings-table');
    if (!container) return;

    try {
        const season = determineCurrentSeason(leagueId);
        const data = await fetchAPI(`/standings?league=${leagueId}&season=${season}`);

        if (!data.response || data.response.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-600 py-6 text-xs">Sin datos</div>`;
            return;
        }

        const allGroups = data.response[0].league.standings;

        // Find the group/table that contains this team
        let targetTable = null;
        for (const group of allGroups) {
            if (group.some(t => t.team.id === teamId)) {
                targetTable = group;
                break;
            }
        }

        if (!targetTable) {
            // Team not found in standings, try all groups
            container.innerHTML = `<div class="text-center text-gray-600 py-6 text-xs">Equipo no encontrado en la tabla</div>`;
            return;
        }

        // For Argentine league (128), only show the zone the team is in
        // For other leagues, show the full table

        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-left text-gray-400">
                    <thead class="text-[9px] text-gray-500 uppercase bg-[#111] border-b border-[#222] tracking-widest">
                        <tr>
                            <th class="px-2 py-2 text-center w-6">#</th>
                            <th class="px-2 py-2">Equipo</th>
                            <th class="px-1 py-2 text-center text-white">Pts</th>
                            <th class="px-1 py-2 text-center">PJ</th>
                            <th class="px-1 py-2 text-center font-mono">DG</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1a1a1a]">
                        ${targetTable.map(t => {
            const isSelected = t.team.id === teamId;
            return `
                                <tr class="${isSelected ? 'bg-white/5 border-l-2 border-white' : 'hover:bg-[#111]'} transition-colors cursor-pointer" onclick="app.navigate('/equipo/${t.team.id}')">
                                    <td class="px-2 py-1.5 text-center text-[10px] ${isSelected ? 'text-white font-bold' : 'text-gray-500'}">${t.rank}</td>
                                    <td class="px-2 py-1.5 flex items-center gap-2 whitespace-nowrap">
                                        <img src="${t.team.logo}" class="w-4 h-4 object-contain">
                                        <span class="text-[10px] font-bold ${isSelected ? 'text-white' : 'text-gray-400'} uppercase truncate">${t.team.name}</span>
                                    </td>
                                    <td class="px-1 py-1.5 text-center font-bold ${isSelected ? 'text-white' : 'text-gray-400'} text-[10px]">${t.points}</td>
                                    <td class="px-1 py-1.5 text-center text-[10px] font-mono text-gray-500">${t.all.played}</td>
                                    <td class="px-1 py-1.5 text-center text-[10px] font-mono ${t.goalsDiff > 0 ? 'text-white' : 'text-gray-600'}">${t.goalsDiff > 0 ? '+' : ''}${t.goalsDiff}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

    } catch (e) {
        console.error('Error loading team standings:', e);
        container.innerHTML = `<div class="text-center text-gray-600 py-6 text-xs">Error al cargar tabla</div>`;
    }
};
