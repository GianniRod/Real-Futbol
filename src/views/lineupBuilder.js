/**
 * Lineup Builder Module
 * 
 * Propósito: Permitir a los usuarios crear y personalizar alineaciones.
 * 
 * Exports:
 * - initLineupBuilder(): Inicializa la vista y estado.
 * - renderBuilder(): Renderiza la cancha y controles.
 * - openPlayerSearch(posIndex): Abre modal de búsqueda.
 * - selectFormation(formation): Cambia la formación.
 */

import { fetchAPI } from '../core/api.js';

// State
let currentFormation = '4-3-3';
let lineup = Array(11).fill(null); // { id, name, photo, position, number? }
let selectedPositionIndex = null;

const FORMATIONS = {
    '4-4-2': [1, 4, 4, 2],
    '4-3-3': [1, 4, 3, 3],
    '4-2-3-1': [1, 4, 2, 3, 1],
    '3-5-2': [1, 3, 5, 2],
    '5-3-2': [1, 5, 3, 2],
    '4-1-2-1-2': [1, 4, 1, 2, 1, 2],
    '3-4-3': [1, 3, 4, 3],
    '4-2-4': [1, 4, 2, 4],
    '4-5-1': [1, 4, 5, 1],
    '5-4-1': [1, 5, 4, 1],
    '4-3-2-1': [1, 4, 3, 2, 1]
};

/**
 * Inicializa el builder
 */
export const initLineupBuilder = () => {
    // Reset state if needed, or keep it persistent? 
    // Let's keep it persistent while app is open, maybe reset on specific action.
    // For now, render.
    renderBuilder();
};

/**
 * Renderiza la interfaz del builder
 */
export const renderBuilder = () => {
    const container = document.getElementById('view-lineup-builder');
    if (!container) return;

    // Determine coords for current formation
    const positions = calculatePositions(currentFormation);

    container.innerHTML = `
        <!-- Header -->
        <div class="sticky top-0 z-20 bg-[#111] py-3 border-b border-[#222] mb-4">
            <div class="flex items-center justify-between px-4 max-w-2xl mx-auto">
                <div class="flex items-center gap-3">
                    <button onclick="app.navigateToForum()" class="text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    
                    <!-- Formation Dropdown -->
                    <div class="relative group">
                        <button class="flex items-center gap-2 bg-[#222] border border-[#333] text-white text-sm font-bold px-4 py-2 rounded-full hover:bg-[#333] transition-colors">
                            ${currentFormation}
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <!-- Dropdown Menu -->
                        <div class="absolute top-full left-0 mt-2 w-48 bg-[#222] border border-[#333] rounded-lg shadow-xl overflow-hidden hidden group-hover:block z-50">
                            <div class="max-h-60 overflow-y-auto">
                                ${Object.keys(FORMATIONS).map(f => `
                                    <button onclick="app.selectFormation('${f}')" 
                                        class="w-full text-left px-4 py-3 text-sm font-bold text-gray-300 hover:bg-[#333] hover:text-white border-b border-[#333] last:border-0 ${currentFormation === f ? 'bg-[#333] text-white' : ''}">
                                        ${f}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex gap-2">
                     <button class="bg-[#222] text-gray-300 text-xs font-bold px-3 py-1.5 rounded-full border border-[#333]" onclick="alert('Coming soon')">Club</button>
                     <button class="bg-[#222] text-gray-300 text-xs font-bold px-3 py-1.5 rounded-full border border-[#333]" onclick="alert('Coming soon')">País</button>
                </div>

                <button class="text-white" onclick="app.shareLineup()">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Pitch Container - Responsive Height -->
        <!-- Added calc(100vh - 180px) to fit screen, keeping aspect ratio -->
        <div class="relative w-full mx-auto px-4 pb-10 flex justify-center items-start" style="height: calc(100vh - 140px); min-height: 500px;">
            <div class="football-pitch" id="builder-pitch" style="height: 100%; width: auto; aspect-ratio: 68/105;">
                <div class="penalty-box top-box"></div>
                <div class="goal-box top"></div>
                <div class="penalty-box bottom-box"></div>
                <div class="goal-box bottom"></div>
                <div class="center-line"></div>
                <div class="center-circle"></div>
                <!-- Corners via CSS now -->
                <div class="corner-arc corner-top-left"></div>
                <div class="corner-arc corner-top-right"></div>
                <div class="corner-arc corner-bottom-left"></div>
                <div class="corner-arc corner-bottom-right"></div>

                <!-- Players -->
                ${positions.map((pos, index) => {
        const player = lineup[index];
        return `
                        <div class="player-marker builder-player" style="left: ${pos.x}%; top: ${pos.y}%;" onclick="app.openPlayerSearch(${index})">
                            ${player ? `
                                <div class="player-face-circle" style="border-color: #fff">
                                    <img src="${player.photo}" class="player-face-img" onerror="this.style.display='none'">
                                </div>
                                <div class="player-name-label">
                                    <span class="text-white" style="font-size: 11px; font-weight: 800; text-shadow: 0 1px 2px black;">${formatName(player.name)}</span>
                                </div>
                                <div class="absolute -bottom-2 -right-2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center border border-black z-20" onclick="event.stopPropagation(); app.removeBuilderPlayer(${index})">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                                </div>
                            ` : `
                                <!-- Empty State: Silhouette + Plus Button -->
                                <div class="relative w-full h-full flex items-center justify-center group">
                                    <!-- Silhouette -->
                                    <div class="w-[45px] h-[45px] rounded-full bg-[#333] flex items-end justify-center overflow-hidden border border-[#444]">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-[#555]" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                        </svg>
                                    </div>
                                    <!-- Plus Button -->
                                    <div class="absolute -bottom-1 bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-lg z-10">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M12 5v14M5 12h14" />
                                        </svg>
                                    </div>
                                </div>
                            `}
                        </div>
                    `;
    }).join('')}
            </div>
        </div>

        <!-- Search Modal -->
        <div id="player-search-modal" class="fixed inset-0 z-50 bg-black/90 backdrop-blur hidden flex flex-col">
            <div class="p-4 border-b border-[#222] bg-black flex flex-col gap-3">
                <div class="flex items-center gap-3">
                    <button onclick="document.getElementById('player-search-modal').classList.add('hidden')" class="text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h3 class="text-lg font-bold text-white uppercase">Buscar Jugador</h3>
                 </div>
                 
                 <!-- League Selector REMOVED as per request -->

                <div class="relative">
                    <input type="text" id="builder-search-input" placeholder="Escribe el nombre del jugador..." 
                        class="w-full bg-[#111] border border-[#333] text-white py-3 pl-10 pr-4 rounded-full focus:outline-none focus:border-white transition-colors"
                        onkeyup="app.handleBuilderSearch(this.value)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>
            <div id="builder-search-results" class="flex-1 overflow-y-auto p-4 space-y-2">
                <div class="text-center text-gray-600 mt-10 text-sm">Escribe para buscar jugadores...</div>
            </div>
        </div>
    `;
};

/**
 * Calcula posiciones (x,y) basado en la formación para móvil (vertical)
 * Se adapta si es desktop (aunque el requerimiento mencionaba "cancha" y layout vertical es mejor para mobile first)
 */
const calculatePositions = (formationKey) => {
    const formation = FORMATIONS[formationKey] || FORMATIONS['4-4-2']; // e.g. [1, 4, 4, 2] lines (GK, DEF, MID, FWD)

    // Vertical Pitch Logic (Always)
    let allPositions = [];

    // Spacing for vertical pitch
    const totalLines = formation.length;
    const availableHeight = 85;
    const spacing = availableHeight / (Math.max(1, totalLines - 1));

    // We want GK (index 0) at Bottom (90%) and Forwards (last index) at Top.
    // However, formation array is usually [GK, DEF, MID, FWD].
    // So lineIndex 0 is GK.

    formation.forEach((count, lineIndex) => {
        // Calculate Y
        // If lineIndex 0 (GK) -> Y ~ 90%
        // If lineIndex max -> Y ~ 90 - (max * spacing)
        const y = 90 - (lineIndex * spacing);

        // Horizontal distribution within the line (0-100%)
        const segment = 100 / (count + 1);

        for (let i = 0; i < count; i++) {
            let x = segment * (i + 1);
            allPositions.push({ x, y });
        }
    });

    return allPositions;
};

const formatName = (fullName) => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName.charAt(0)}. ${lastName}`;
};

/**
 * Cambia la formación
 */
export const selectFormation = (f) => {
    currentFormation = f;
    renderBuilder();
};

/**
 * Abre el modal de búsqueda para una posición
 */
export const openPlayerSearch = (index) => {
    selectedPositionIndex = index;
    const modal = document.getElementById('player-search-modal');
    const input = document.getElementById('builder-search-input');
    const results = document.getElementById('builder-search-results');

    if (modal) {
        modal.classList.remove('hidden');
        input.value = '';
        input.focus();
        results.innerHTML = '<div class="text-center text-gray-600 mt-10 text-sm">Escribe para buscar jugadores...</div>';
    }
};

let searchTimeout;
/**
 * Maneja input de búsqueda (debounce)
 */
export const handleBuilderSearch = (query) => {
    clearTimeout(searchTimeout);
    if (query.length < 3) return;

    const resultsContainer = document.getElementById('builder-search-results');
    resultsContainer.innerHTML = '<div class="flex justify-center mt-10"><div class="loader"></div></div>';

    searchTimeout = setTimeout(async () => {
        try {
            // Global search logic - API Football allows search by name + season
            // We use 2024 or 2023 as default "current" season for broad search
            // If API supports searching all leagues, this will return mixed results.

            const season = 2024; // Generic season fallbacks

            // Note: Some endpoints require league, but /players?search=X&season=Y usually works globally or we might need to iterate.
            // If it fails, we might need to default to a popular league or handle error.
            // Recent docs say: "requires league" for some plans, but let's try.
            // Actually, if league is removed, we might need to hardcode a default popular league (e.g. PL or WC) or use a "World" context?
            // User requested "only write name". 
            // Let's try searching without league first.
            let data = await fetchAPI(`/players?search=${query}&season=${season}`);

            // If that fails or returns empty because league is mandatory (common in free tier), 
            // we might default to WC (1) or PL (39).
            if (!data.response || data.response.length === 0) {
                // Retry with PL ID (39) just in case? Or maybe API works but no results.
                // let's try with PL just to be safe if global fails? 
                // actually let's stick to global attempt.
            }

            if (!data.response || data.response.length === 0) {
                resultsContainer.innerHTML = '<div class="text-center text-gray-600 mt-10 text-sm">No se encontraron jugadores. Pruba con el nombre completo.</div>';
                return;
            }

            const results = data.response; // Array of { player, statistics }

            // Filter duplicates if any (same player, diff leagues)
            // ...

            resultsContainer.innerHTML = results.map(item => {
                const p = item.player;
                const stats = item.statistics[0];
                const team = stats?.team;
                const league = stats?.league;

                return `
                    <div class="flex items-center gap-3 p-3 bg-[#111] border border-[#222] rounded-lg hover:bg-[#222] cursor-pointer transition-colors"
                         onclick="app.selectBuilderPlayer(${p.id}, '${p.name.replace(/'/g, "\\'")}', '${p.photo}')">
                        <img src="${p.photo}" class="w-10 h-10 rounded-full object-cover bg-black border border-[#333]">
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-bold text-white truncate">${p.name}</div>
                            <div class="text-xs text-gray-500 flex items-center gap-1">
                                ${team ? `<img src="${team.logo}" class="w-3 h-3 object-contain"> ${team.name}` : ''}
                                ${league ? ` • <span class="text-[10px] text-gray-600">${league.name}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            console.error('Search error:', e);
            resultsContainer.innerHTML = '<div class="text-center text-gray-600 mt-10 text-sm">Error al buscar. Intenta nuevamente.</div>';
        }
    }, 500);
};

/**
 * Selecciona un jugador para la posición actual
 */
export const selectBuilderPlayer = (id, name, photo) => {
    if (selectedPositionIndex === null) return;

    lineup[selectedPositionIndex] = { id, name, photo };

    // Close modal
    document.getElementById('player-search-modal').classList.add('hidden');

    // Re-render
    renderBuilder();
};

/**
 * (Placeholder) Compartir lineup
 */
export const shareLineup = () => {
    alert('Función de compartir próximamente.');
    // Here we could generate an image or a link
};
