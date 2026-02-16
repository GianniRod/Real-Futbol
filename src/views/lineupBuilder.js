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

                <!-- Moved formation dropdown logic to standard location -->
            </div>
            
            <div class="flex items-center gap-2">
                 <!-- Download Button -->
                 <button class="flex items-center gap-2 bg-[#222] border border-[#333] hover:bg-[#333] text-white text-xs font-bold px-4 py-2 rounded-full transition-colors" onclick="app.downloadLineup()">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Descargar</span>
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
                
                <!-- Corners via CSS -->
                <div class="corner-arc corner-top-left"></div>
                <div class="corner-arc corner-top-right"></div>
                <div class="corner-arc corner-bottom-left"></div>
                <div class="corner-arc corner-bottom-right"></div>

                <!-- Branding / Logo Overlay -->
                <div class="absolute bottom-4 right-4 flex items-center gap-2 opacity-90 z-10 pointer-events-none">
                    <img src="https://i.postimg.cc/vBgSB9tn/favicon.jpg" class="w-6 h-6 rounded-full border border-white/20 shadow-sm">
                    <span class="text-white font-sport font-bold text-sm tracking-widest drop-shadow-md">REALFUTBOL</span>
                </div>

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
                            ` : `
                                <!-- Empty State: Silhouette + Plus Button -->
                                <div class="relative w-full h-full flex items-center justify-center group">
                                    <div class="w-[45px] h-[45px] rounded-full bg-[#333] flex items-end justify-center overflow-hidden border border-[#444]">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-[#555]" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                        </svg>
                                    </div>
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
    // UPDATED: Reduced available height to 75 to bring players down from the top edge
    const availableHeight = 75;
    const spacing = availableHeight / (Math.max(1, totalLines - 1));

    // We want GK (index 0) at Bottom (90%) and Forwards (last index) at Top.
    // However, formation array is usually [GK, DEF, MID, FWD].
    // So lineIndex 0 is GK.

    formation.forEach((count, lineIndex) => {
        // Calculate Y
        // If lineIndex 0 (GK) -> Y ~ 92%
        // If lineIndex max -> Y ~ 92 - (max * spacing)
        const y = 92 - (lineIndex * spacing);

        // Horizontal distribution:
        // UPDATED: Spread players wider using full width (0-100)
        // Formula: Center in their segment. Segment width = 100 / count.
        const segmentWidth = 100 / count;

        for (let i = 0; i < count; i++) {
            // x = (start of segment) + (half segment)
            let x = (i * segmentWidth) + (segmentWidth / 2);
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
            // "Global" Search Strategy:
            // API-Football often requires 'league' + 'season' for player search.
            // To support "no competition selection", we search across major leagues in parallel.
            // UPDATED: Using 2025/2026 seasons as current date is Feb 2026.

            const leaguesToSearch = [
                { id: 1, season: 2022 },   // World Cup (Keep 2022 until 2026 squad lists are out/populated)
                { id: 39, season: 2025 },  // Premier League (25/26)
                { id: 140, season: 2025 }, // La Liga (25/26)
                { id: 135, season: 2025 }, // Serie A (25/26)
                { id: 78, season: 2025 },  // Bundesliga (25/26)
                { id: 61, season: 2025 },  // Ligue 1 (25/26)
                { id: 2, season: 2025 },   // UCL (25/26)
                { id: 128, season: 2026 }, // Liga Profesional ARG (2026 active)
                { id: 71, season: 2025 },  // Brasileirao (2025)
                { id: 253, season: 2025 }  // MLS (2025)
            ];

            // Trigger all fetches in parallel
            const promises = leaguesToSearch.map(l =>
                fetchAPI(`/players?search=${query}&season=${l.season}&league=${l.id}`)
                    .then(res => res.response || [])
                    .catch(() => []) // Ignore errors per league
            );

            const resultsArrays = await Promise.all(promises);

            // Flatten results
            const allResults = resultsArrays.flat();

            if (allResults.length === 0) {
                resultsContainer.innerHTML = '<div class="text-center text-gray-600 mt-10 text-sm">No se encontraron jugadores. Prueba con el nombre completo.</div>';
                return;
            }

            // Deduplicate by Player ID (keep first occurrence)
            const seenIds = new Set();
            const uniqueResults = [];

            for (const item of allResults) {
                if (!seenIds.has(item.player.id)) {
                    seenIds.add(item.player.id);
                    uniqueResults.push(item);
                }
            }

            resultsContainer.innerHTML = uniqueResults.map(item => {
                const p = item.player;
                const stats = item.statistics[0];
                const team = stats?.team;
                const league = stats?.league;

                return `
                    <div class="flex items-center gap-3 p-3 bg-[#111] border border-[#222] rounded-lg hover:bg-[#222] cursor-pointer transition-colors"
                         onclick="app.selectBuilderPlayer(${p.id}, '${p.name.replace(/'/g, "\\\'")}', '${p.photo}')">
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
 * Descarga la formación como imagen PNG
 */
export const downloadLineup = () => {
    const element = document.getElementById('builder-pitch');

    if (typeof html2canvas === 'undefined') {
        alert('Error: Librería de imagen no cargada. Recarga la página.');
        return;
    }

    // Capture the pitch with high quality
    html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'realfutbol-11.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(err => {
        console.error('Error generando imagen:', err);
        alert('Hubo un error al generar la imagen. Intenta nuevamente.');
    });
};
