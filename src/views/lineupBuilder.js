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
        <div class="sticky top-0 z-20 bg-black/95 backdrop-blur py-2 border-b border-[#222] mb-4">
            <div class="flex items-center justify-between px-4">
                <div class="flex items-center gap-3">
                    <button onclick="app.navigateToForum()" class="text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h2 class="text-xl font-bold text-white uppercase tracking-wider font-sport">Arma tu 11</h2>
                </div>
                <button class="bg-white text-black text-xs font-bold uppercase px-3 py-1.5 rounded hover:bg-gray-200 transaction-colors" onclick="app.shareLineup()">
                    Compartir
                </button>
            </div>
            
            <!-- Formation Selector -->
            <div class="flex overflow-x-auto gap-2 px-4 py-2 mt-2 no-scrollbar">
                ${Object.keys(FORMATIONS).map(f => `
                    <button onclick="app.selectFormation('${f}')" 
                        class="px-3 py-1 text-xs font-bold border rounded whitespace-nowrap transition-colors ${currentFormation === f ? 'bg-white text-black border-white' : 'bg-[#111] text-gray-400 border-[#333] hover:border-gray-500'}">
                        ${f}
                    </button>
                `).join('')}
            </div>
        </div>

        <!-- Pitch -->
        <div class="relative w-full max-w-2xl mx-auto px-4 pb-20">
            <div class="football-pitch" id="builder-pitch">
                <div class="penalty-box top-box"></div>
                <div class="penalty-box bottom-box"></div>
                <div class="center-line"></div>
                <div class="center-circle"></div>
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
                                    <span class="text-white">${formatName(player.name)}</span>
                                </div>
                                <div class="absolute -top-1 -right-1 bg-[#111] rounded-full p-0.5 border border-[#333]">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                </div>
                            ` : `
                                <div class="w-full h-full rounded-full border-2 border-dashed border-gray-600 bg-black/50 flex items-center justify-center hover:border-white transition-colors group">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-500 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                            `}
                        </div>
                    `;
    }).join('')}
            </div>
        </div>

        <!-- Search Modal -->
        <div id="player-search-modal" class="fixed inset-0 z-50 bg-black/90 backdrop-blur hidden flex flex-col">
            <div class="p-4 border-b border-[#222] bg-black flex items-center gap-3">
                <button onclick="document.getElementById('player-search-modal').classList.add('hidden')" class="text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div class="flex-1 relative">
                    <input type="text" id="builder-search-input" placeholder="Buscar jugador..." 
                        class="w-full bg-[#111] border border-[#333] text-white py-2 pl-10 pr-4 rounded-full focus:outline-none focus:border-white transition-colors"
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

    // Total lines = formation.length
    // We distribute players per line.

    let allPositions = [];

    // We assume index 0 is GK, index 1..N is DEF, etc.
    // BUT lineup array is flat 11. We need to map lineup index to formation line.
    // Usually: GK is index 0. Then DEFs, then MIDs, then FWDs.

    let playerIdx = 0;
    const isMobile = window.innerWidth < 768;

    formation.forEach((count, lineIndex) => {
        // Line spacing
        // Mobile: GK at bottom (90%) or top? Usually Formation View is GK bottom -> Top.
        // Let's assume GK is at Bottom (y ~ 90%) and Forwards at Top (y ~ 10%).

        let y;
        if (isMobile) {
            // Vertical pitch
            const totalLines = formation.length;
            const availableHeight = 85;
            const spacing = availableHeight / (totalLines); // spacing between lines
            // lineIndex 0 (GK) -> Bottom
            // lineIndex last (FWD) -> Top

            y = 90 - (lineIndex * spacing);
        } else {
            // Horizontal pitch? Or keep vertical?
            // Existing matchDetail pitch attempts horizontal on desktop.
            // Let's stick to Vertical for Builder for simplicity on "Arma tu once" which is usually vertical cards.
            // Or reuse logic from matchDetail?
            // matchDetail logic:
            /*
               if (isMobile) {
                  y = 92 - ...
               } else {
                  // Horizontal
                  x = 3 + ... 
               }
            */
            // Let's enforce Vertical for now as it's easier for "Arma tu once" on most screens or adapt.
            // If desktop, maybe fit in center vertically.
            const totalLines = formation.length;
            const availableHeight = 85;
            const spacing = availableHeight / (totalLines);
            y = 90 - (lineIndex * spacing);
        }

        // Horizontal distribution within the line
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
            // Use API search (GLOBAL or filtered?)
            // API-Football supports /players?search=messi&league=X&season=Y
            // Without league it might require >= 3 chars and return global results?
            // Let's try global search with season 2024.
            const data = await fetchAPI(`/players?search=${query}&season=2024`); // Adjust season if needed

            if (!data.response || data.response.length === 0) {
                resultsContainer.innerHTML = '<div class="text-center text-gray-600 mt-10 text-sm">No se encontraron jugadores.</div>';
                return;
            }

            const results = data.response; // Array of { player, statistics }

            resultsContainer.innerHTML = results.map(item => {
                const p = item.player;
                const stats = item.statistics[0];
                const team = stats?.team;

                return `
                    <div class="flex items-center gap-3 p-3 bg-[#111] border border-[#222] rounded-lg hover:bg-[#222] cursor-pointer transition-colors"
                         onclick="app.selectBuilderPlayer(${p.id}, '${p.name.replace(/'/g, "\\'")}', '${p.photo}')">
                        <img src="${p.photo}" class="w-10 h-10 rounded-full object-cover bg-black border border-[#333]">
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-bold text-white truncate">${p.name}</div>
                            <div class="text-xs text-gray-500 flex items-center gap-1">
                                ${team ? `<img src="${team.logo}" class="w-3 h-3 object-contain"> ${team.name}` : 'Sin equipo'}
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
