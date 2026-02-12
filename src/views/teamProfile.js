/**
 * Team Profile View Module
 * 
 * Propósito: Vista de perfil de equipo con info, partidos, fichajes y tabla
 * 
 * Exports:
 * - showTeamProfile(params): Muestra perfil de un equipo
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

        const last5 = lastMatches.response || [];
        const next5 = nextMatches.response || [];

        // Filter transfers from last year
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const allTransfers = transfersData.response?.[0]?.transfers || [];
        const recentTransfers = allTransfers.filter(t => {
            const d = new Date(t.date);
            return d >= oneYearAgo;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));

        const arrivals = recentTransfers.filter(t => t.teams.in.id === parseInt(teamId));
        const departures = recentTransfers.filter(t => t.teams.out.id === parseInt(teamId));

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
            <div class="bg-[#0a0a0a] border border-[#222] rounded-xl p-6 mb-6 flex flex-col items-center text-center">
                <img src="${team.logo}" class="w-24 h-24 object-contain mb-4">
                <h1 class="text-2xl font-bold text-white uppercase tracking-wider font-sport mb-2">${team.name}</h1>
                ${venue ? `
                    <div class="flex items-center gap-2 text-gray-400">
                        <img src="https://i.postimg.cc/mrVjjgxJ/4905563-2.png" class="w-4 h-4 object-contain opacity-60">
                        <span class="text-xs font-bold uppercase tracking-widest">${venue.name}</span>
                    </div>
                ` : ''}
            </div>

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
                    <!-- Fichajes -->
                    <div class="bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden">
                        <div class="px-4 py-3 bg-[#111] border-b border-[#222]">
                            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Fichajes</h3>
                        </div>
                        <div class="p-3 space-y-4">
                            <!-- Llegadas -->
                            <div>
                                <div class="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2 px-1">Llegadas</div>
                                ${arrivals.length > 0 ? `<div class="space-y-1">${arrivals.map(t => renderTransferRow(t, 'in')).join('')}</div>` : '<div class="text-gray-600 text-xs px-1">Sin fichajes recientes</div>'}
                            </div>
                            <!-- Salidas -->
                            <div>
                                <div class="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2 px-1">Salidas</div>
                                ${departures.length > 0 ? `<div class="space-y-1">${departures.map(t => renderTransferRow(t, 'out')).join('')}</div>` : '<div class="text-gray-600 text-xs px-1">Sin salidas recientes</div>'}
                            </div>
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
    const date = new Date(t.date);
    const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    const fromTo = direction === 'in' ? t.teams.out : t.teams.in;
    const typeLabel = t.type === 'Free' ? 'Libre' : (t.type === 'Loan' ? 'Préstamo' : (t.type === 'N/A' ? '' : t.type));

    return `
        <div class="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-[#111] transition-colors">
            <img src="${fromTo.logo || ''}" class="w-4 h-4 object-contain shrink-0 opacity-50" onerror="this.style.display='none'">
            <div class="min-w-0 flex-1">
                <div class="text-xs font-bold text-gray-300 truncate">${t.player.name}</div>
                <div class="text-[10px] text-gray-600 truncate">${direction === 'in' ? 'De' : 'A'} ${fromTo.name} ${typeLabel ? `· ${typeLabel}` : ''}</div>
            </div>
            <div class="text-[10px] text-gray-600 font-mono shrink-0">${dateStr}</div>
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
