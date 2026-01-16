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
const state = {
    selectedLeague: null,
    season: 2024,
    standingsData: null
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
 * Renderiza una tabla específica (para ligas con grupos)
 * @param {number} groupIndex - Índice del grupo a renderizar
 */
export const renderTable = (groupIndex) => {
    const table = state.standingsData[groupIndex];
    const container = document.getElementById('standings-container');

    container.innerHTML = `
        <div class="bg-[#0a0a0a] border border-[#222] overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-400">
                    <thead class="text-[10px] text-gray-500 uppercase bg-[#111] border-b border-[#222] tracking-widest">
                        <tr>
                            <th class="px-4 py-3 text-center w-10">#</th>
                            <th class="px-3 py-3">Equipo</th>
                            <th class="px-2 py-3 text-center text-white">Pts</th>
                            <th class="px-2 py-3 text-center">PJ</th>
                            <th class="px-2 py-3 text-center font-mono">DG</th>
                            <th class="px-2 py-3 text-center hidden sm:table-cell">Forma</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1a1a1a]">
                        ${table.map(t => `
                            <tr class="hover:bg-[#111] transition-colors">
                                <td class="px-4 py-3 text-center font-bold ${t.rank <= 4 ? 'text-white' : 'text-gray-600'}">${t.rank}</td>
                                <td class="px-3 py-3 font-bold text-gray-300 flex items-center gap-3 whitespace-nowrap uppercase text-xs">
                                    <img src="${t.team.logo}" class="w-5 h-5 object-contain">
                                    ${t.team.name}
                                </td>
                                <td class="px-2 py-3 text-center font-bold text-white">${t.points}</td>
                                <td class="px-2 py-3 text-center font-mono text-xs">${t.all.played}</td>
                                <td class="px-2 py-3 text-center font-mono text-xs ${t.goalsDiff > 0 ? 'text-white' : 'text-gray-600'}">${t.goalsDiff > 0 ? '+' : ''}${t.goalsDiff}</td>
                                <td class="px-2 py-3 text-center hidden sm:table-cell">
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

    if (standingsData.length > 1) {
        // Múltiples grupos
        tabs.classList.remove('hidden');
        tabs.innerHTML = standingsData.map((g, i) => `
            <button onclick="app.renderTable(${i})" class="px-4 py-2 bg-[#111] text-xs font-bold uppercase border border-[#333] text-gray-400 hover:text-white hover:border-white transition-all whitespace-nowrap">
                ${g[0].group}
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
 * Muestra la tabla de posiciones de una liga
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

    // Actualizar UI
    document.getElementById('view-match-list').classList.add('hidden');
    document.getElementById('date-nav').classList.add('hidden');
    document.getElementById('view-standings').classList.remove('hidden');
    document.getElementById('standings-title').innerText = name;
    document.getElementById('standings-tabs').classList.add('hidden');

    // Cerrar sidebar mobile
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('mobile-backdrop').classList.add('hidden');

    const container = document.getElementById('standings-container');
    container.innerHTML = `<div class="flex justify-center py-20"><div class="loader"></div></div>`;

    try {
        const data = await fetchAPI(`/standings?league=${id}&season=${state.season}`);
        const standings = data.response[0].league.standings;
        processStandings(standings);
    } catch (e) {
        container.innerHTML = `<div class="text-center text-gray-500 py-10 text-xs uppercase tracking-widest">Sin datos para ${state.season}.</div>`;
    }
};

export const getStandingsState = () => state;
