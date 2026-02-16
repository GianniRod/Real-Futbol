/**
 * Match Detail View Module
 * 
 * Propósito: Vista detallada de partido con tabs (timeline, lineups, stats, forum)
 * 
 * Exports:
 * - openDetail(params): Abre detalle de un partido desde router
 * - openMatchDetailWithTab(params): Abre con tab específico
 * - closeDetail(): Cierra vista de detalle
 * - switchTab(btn, targetId): Cambia entre tabs
 */

import { fetchAPI } from '../core/api.js';
import { getMatches, updateMatchEvents } from './matches.js';
import { initForum } from './forum.js';

// State
let selectedMatch = null;


/**
 * Renderiza el timeline de eventos
 */
const renderTimeline = (m) => {
    const c = document.getElementById('tab-timeline');
    let ev = [...(m.events || [])];

    // Separar penales de tiempo regular
    const isPenalty = (e) => e.comments === "Penalty Shootout";
    const regularEvents = ev.filter(e => !isPenalty(e));
    const penaltyEvents = ev.filter(e => isPenalty(e));

    // Ordenar eventos regulares por tiempo (descendente para mostrar lo último arriba)
    regularEvents.sort((a, b) => {
        const tA = a.time.elapsed + (a.time.extra || 0);
        const tB = b.time.elapsed + (b.time.extra || 0);
        if (tA === tB) return 0;
        return tA > tB ? -1 : 1;
    });

    let html = '';

    if (regularEvents.length === 0 && penaltyEvents.length === 0) {
        html = '<div class="text-center py-10 text-gray-600 text-xs uppercase tracking-widest">Sin eventos</div>';
    }

    // Renderizar eventos regulares
    html += regularEvents.map(e => {
        const isHome = e.team.id === m.teams.home.id;
        const sideClass = isHome ? 'flex-row' : 'flex-row-reverse';
        const boxClass = isHome ? '' : 'flex-row-reverse text-right';

        let content = '';
        if (e.type === 'subst') {
            content = `
                <div class="flex flex-col gap-0.5">
                    <span class="text-xs font-bold text-green-400 uppercase">Entra: ${e.assist.name}</span>
                    <span class="text-[10px] font-bold text-red-400 uppercase opacity-70">Sale: ${e.player.name}</span>
                </div>
            `;
        } else {
            let eventLabel = e.detail;
            let eventClass = 'bg-[#333] text-gray-400';

            if (e.type === 'Goal') {
                eventLabel = 'GOL';
                eventClass = 'bg-white text-black';
            } else if (e.type === 'Card') {
                const isYellow = e.detail === 'Yellow Card';
                const isRed = e.detail === 'Red Card';

                if (isYellow || isRed) {
                    eventClass = 'bg-[#222] text-gray-300 border border-[#333]';
                    const colorClass = isYellow ? 'bg-yellow-400' : 'bg-red-600';
                    const text = isYellow ? 'TARJETA AMARILLA' : 'TARJETA ROJA';
                    eventLabel = `<div class="w-2 h-3 ${colorClass} rounded-[1px] mr-1.5"></div>${text}`;
                }
            }

            content = `
                <span class="text-sm font-bold text-white">${e.player.name}</span>
                <span class="text-[9px] px-2 py-1 uppercase font-bold tracking-wider ${eventClass} flex items-center h-6 rounded">${eventLabel}</span>
            `;
        }

        return `
            <div class="flex items-center gap-4 mb-4 ${sideClass}">
                <div class="w-8 text-center text-xs font-bold text-gray-500 font-mono">${e.time.elapsed}'</div>
                <div class="bg-[#111] border border-[#222] px-4 py-3 flex items-center gap-3 ${boxClass} min-w-[140px]">
                    ${content}
                </div>
            </div>
        `;
    }).join('');

    // Renderizar Tanda de Penales (si existen)
    if (penaltyEvents.length > 0) {
        html += `<div class="my-8 flex items-center justify-center">
            <div class="h-[1px] bg-[#222] flex-1"></div>
            <span class="px-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Tanda de Penales</span>
            <div class="h-[1px] bg-[#222] flex-1"></div>
        </div>`;

        // Calcular score acumulado
        let homeScore = m.goals.home; // Goles antes de penales (120 min)
        let awayScore = m.goals.away;

        // Pero para "running score" de penales, usualmente se muestra solo el conteo de penales
        // O el score total acumulado. El usuario pidió: "despues de ese penal cuanto va la serie de penales"
        // Entonces iniciamos conteo de penales en 0-0
        let penHome = 0;
        let penAway = 0;

        // Necesitamos ordenar penales cronológicamente para el running score
        // API-Football no siempre da orden perfecto por tiempo, pero confiemos en el array o detalle
        // Asumamos que vienen en orden o intentemos ordenar si tienen secuencia
        // Generalmente vienen mezclados, hay que tener cuidado.
        // Pero para simplificar, iteraremos y asumiremos el orden del array (ajustar si es necesario)
        // O mejor: NO reordenamos penaltyEvents si ya venían mezclados, el sort inicial los puso por tiempo.
        // Pero el sort inicial ponía lo mas NUEVO arriba. Para penales queremos orden CRONOLOGICO (1o al ultimo)?
        // El usuario dijo "cronologia". Normalmente timeline es Lo Nuevo Arriba.
        // Pero "tanda de penales" suele leerse mejor penal 1, penal 2... 
        // Si el timeline general es DESC (min 90 arriba, min 1 abajo), penales debería seguir esa logica invertida?
        // O ser un bloque aparte?
        // El usuario pidió "separes la cronologia". Haremos un bloque distinto.
        // Probemos mostrar penales en orden de tiro (ascendente).

        // Re-ordenar penales Ascendente para calcular score
        // El usuario reportó que estaba invertido.
        // Si API devuelve en orden cronológico (0->N), y ev (que usamos para filtrar) estaba ordenado DESC (N->0),
        // entonces penaltyEvents estaba DESC.
        // Mi fix anterior hacía reverse() para volver a ASC.
        // Sin embargo, usuario dice que estaba al revés.
        // Vamos a confiar en la lógica: penaltyEvents viene de 'ev' (DESC). Entonces penaltyEvents[0] es el ULTIMO penal.
        // reverse() debería poner penaltyEvents[0] (ULTIMO) al final. 
        // Tal vez el sort inicial mezcló los penales si tienen mismo timestamp.

        // CORRECCION: Usar array original m.events para obtener orden correcto de API
        // API suele mandar index 0 = primer evento.
        const originalPenalties = (m.events || []).filter(e => isPenalty(e));
        // Asumimos originalPenalties[0] es el primer tiro.

        const penAsc = [...originalPenalties]; // Ya debería estar en orden correcto

        html += `<div class="space-y-3">`;

        html += penAsc.map(e => {
            const isHome = e.team.id === m.teams.home.id;

            // Detección de Gol o Fallo
            // API-Football:
            // Goal + Penalty = Gol
            // Missed Penalty = Fallo
            // Saved Penalty = Fallo (atajado)
            // A veces type='Goal' pero detail='Missed Penalty' -> Fallo
            // A veces type='Var' -> Fallo

            const detail = (e.detail || '').toLowerCase();
            const type = (e.type || '').toLowerCase();
            const comments = (e.comments || '').toLowerCase();

            let isGoal = false;

            if (type === 'goal' && detail !== 'missed penalty' && detail !== 'saved penalty') {
                isGoal = true;
            }

            if (detail.includes('missed') || detail.includes('saved')) {
                isGoal = false;
            }

            if (isGoal) {
                if (isHome) penHome++; else penAway++;
            }
            // Si es errado, marcador no cambia.

            const checkIcon = `<div class="w-5 h-5 rounded-full bg-green-900/40 border border-green-500/50 flex items-center justify-center text-green-500"><svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;
            const crossIcon = `<div class="w-5 h-5 rounded-full bg-red-900/40 border border-red-500/50 flex items-center justify-center text-red-500"><svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>`;

            const icon = isGoal ? checkIcon : crossIcon;
            const scoreDisplay = `${penHome}-${penAway}`;

            // Alineación
            // Izquierda Home, Derecha Away
            const rowClass = isHome ? 'flex-row' : 'flex-row-reverse';
            const textClass = isHome ? 'text-left' : 'text-right';
            const scoreClass = isHome ? 'ml-auto' : 'mr-auto'; // Score en el medio aprox

            // Diseño solicitado: Nombre Simbolo Score
            // Ej: Messi (V) 1-0 ... 

            // Ajustamos layout para que parezca una lista balanceada
            /*
              Home Player (V) 1-0
                              1-0 (X) Away Player
            */

            // Contenedor principal de la fila
            return `
            <div class="flex items-center relative py-1">
                <div class="absolute left-1/2 -translate-x-1/2 text-xs font-mono font-bold text-gray-600">${scoreDisplay}</div>
                
                <div class="w-1/2 flex items-center gap-3 ${isHome ? 'justify-end pr-8' : 'hidden'}">
                    <span class="text-sm font-bold text-white text-right">${e.player.name}</span>
                    ${icon}
                </div>
                
                <div class="w-1/2 flex items-center gap-3 ${!isHome ? 'justify-start pl-8' : 'hidden'} ml-auto">
                     ${icon}
                    <span class="text-sm font-bold text-white text-left">${e.player.name}</span>
                </div>
            </div>
           `;
        }).join('');

        html += `</div>`;
    }

    c.innerHTML = html;

    // Append Mobile-Only Match Info at the bottom of Timeline (Actually appending to innerHTML directly or modifying html string? Modifying html string BEFORE setting innerHTML is better, but I can also append to c.innerHTML if I want)
    // Wait, the previous block ends with c.innerHTML = html;
    // I should REPLACE "c.innerHTML = html;" with the logic to append to html AND THEN set innerHTML.

    // Append Mobile-Only Match Info
    const leagueLogo = m.league.logo;
    const leagueName = m.league.name;
    const leagueRound = m.league.round;
    const referee = m.fixture.referee || 'Árbitro no asignado';
    const venueName = m.fixture.venue.name || 'Estadio desconocido';
    const venueCity = m.fixture.venue.city || '';
    const whistleIcon = 'https://i.postimg.cc/LsXj3CWR/silbato.png';
    const stadiumIcon = 'https://i.postimg.cc/mrVjjgxJ/4905563-2.png';

    const createRow = (imgSrc, text, isRounded = false) => `
        <div class="flex items-center gap-4">
            <div class="w-8 flex justify-center">
                <img src="${imgSrc}" class="w-6 h-6 object-contain ${isRounded ? '' : 'opacity-70'}">
            </div>
            <span class="text-base text-gray-300 font-medium">${text}</span>
        </div>
    `;

    html += `
        <div class="mt-8 pt-6 border-t border-[#222] lg:hidden space-y-4 pb-6 px-2">
            ${createRow(leagueLogo, `${leagueName} - ${leagueRound}`, true)}
            ${createRow(whistleIcon, referee)}
            ${createRow(stadiumIcon, `${venueName}${venueCity ? `, ${venueCity}` : ''}`)}
        </div>
    `;

    c.innerHTML = html;
};

/**
 * Obtiene el color del borde del rating según la calificación
 * @param {number} rating - Calificación del jugador
 * @returns {object} { bg, text, border } - Colores CSS
 */
const getRatingColors = (rating) => {
    if (rating >= 8.0) return { bg: '#87CEEB', text: '#000', border: '#87CEEB' }; // Celeste
    if (rating >= 7.0) return { bg: '#4CAF50', text: '#fff', border: '#4CAF50' }; // Verde
    if (rating >= 6.0) return { bg: '#FF9800', text: '#000', border: '#FF9800' }; // Naranja
    return { bg: '#F44336', text: '#fff', border: '#F44336' }; // Rojo
};

/**
 * Shows a detailed player modal with match stats
 */
const showPlayerModal = (player) => {
    const modal = document.getElementById('player-modal');
    const photo = player.photo || `https://media.api-sports.io/football/players/${player.id}.png`;
    const s = player.stats || {};

    // Position label
    const posLabels = {
        'G': 'Arquero', 'D': 'Defensor', 'M': 'Mediocampista', 'F': 'Delantero',
        'Goalkeeper': 'Arquero', 'Defender': 'Defensor', 'Midfielder': 'Mediocampista', 'Attacker': 'Delantero'
    };
    const posLabel = posLabels[player.position] || player.position || '';

    // Rating colors
    const rating = player.rating;
    let ratingBg = '#333', ratingText = '#aaa';
    if (rating) {
        if (rating >= 8) { ratingBg = '#16a34a'; ratingText = '#fff'; }
        else if (rating >= 7) { ratingBg = '#65a30d'; ratingText = '#fff'; }
        else if (rating >= 6) { ratingBg = '#ca8a04'; ratingText = '#fff'; }
        else { ratingBg = '#dc2626'; ratingText = '#fff'; }
    }

    // Build stat items from available data
    const statItems = [];
    const addStat = (label, value) => {
        if (value !== null && value !== undefined && value !== '-') {
            statItems.push({ label, value });
        }
    };

    addStat('Minutos', s.games?.minutes);
    addStat('Goles', s.goals?.total);
    addStat('Asistencias', s.goals?.assists);
    addStat('Disparos', s.shots?.total);
    addStat('Al arco', s.shots?.on);
    if (s.passes?.total != null && s.passes?.accuracy != null) {
        const total = parseInt(s.passes.total);
        const acc = parseInt(s.passes.accuracy);
        const completed = Math.round(total * acc / 100);
        addStat('Pases acertados', `${completed}/${total} (${acc}%)`);
    } else if (s.passes?.total != null) {
        addStat('Pases', s.passes.total);
    }
    addStat('Pases clave', s.passes?.key);
    addStat('Tackles', s.tackles?.total);
    addStat('Intercepciones', s.tackles?.interceptions);
    addStat('Duelos ganados', s.duels?.won);
    addStat('Duelos total', s.duels?.total);
    addStat('Dribles', s.dribbles?.success != null ? `${s.dribbles.success}/${s.dribbles.attempts}` : null);
    addStat('Faltas cometidas', s.fouls?.committed);
    addStat('Faltas recibidas', s.fouls?.drawn);

    // For goalkeepers
    if (player.position === 'G' || player.position === 'Goalkeeper') {
        addStat('Atajadas', s.goals?.saves);
        addStat('Goles recibidos', s.goals?.conceded);
    }

    const statsGrid = statItems.length > 0 ? `
        <div class="grid grid-cols-3 gap-px bg-[#222] rounded-lg overflow-hidden mt-4">
            ${statItems.map(si => `
                <div class="bg-[#111] p-2.5 text-center">
                    <div class="text-sm font-bold text-white font-mono">${si.value}</div>
                    <div class="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">${si.label}</div>
                </div>
            `).join('')}
        </div>
    ` : '<div class="text-center text-gray-600 text-xs mt-4 uppercase tracking-widest">Sin estadísticas disponibles</div>';

    modal.innerHTML = `
        <div class="bg-[#0a0a0a] border border-[#333] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <!-- Header -->
            <div class="relative bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] p-5 flex items-center gap-4">
                <button onclick="document.getElementById('player-modal').classList.add('hidden')"
                    class="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 shrink-0" style="border-color:${ratingBg}; background:#222;">
                    <img src="${photo}" class="w-full h-full object-cover" onerror="this.style.display='none'" />
                </div>
                <div class="min-w-0 flex-1">
                    <div class="text-white font-bold text-base uppercase tracking-tight leading-tight truncate">${player.name}</div>
                    <div class="text-gray-500 text-[10px] uppercase tracking-widest mt-1">${player.number ? '#' + player.number + ' · ' : ''}${posLabel}</div>
                    ${rating ? `<div class="mt-2 inline-block text-xs font-black px-2 py-0.5 rounded" style="background:${ratingBg};color:${ratingText}">${rating.toFixed(1)}</div>` : ''}
                </div>
            </div>
            <!-- Stats -->
            <div class="px-4 pb-5">
                ${statsGrid}
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
};

/**
 * Renderiza las alineaciones y cancha táctica
 */
const renderLineups = (m) => {
    const pitch = document.getElementById('football-pitch');
    pitch.querySelectorAll('.player-marker').forEach(el => el.remove());
    const hList = document.getElementById('lineup-home-list');
    const aList = document.getElementById('lineup-away-list');

    if (!m.lineups || m.lineups.length === 0) {
        hList.innerHTML = 'No disponible';
        aList.innerHTML = 'No disponible';
        return;
    }

    const homeL = m.lineups[0];
    const awayL = m.lineups[1];
    const events = m.events || [];
    const isFinished = ['FT', 'AET', 'PEN'].includes(m.fixture.status.short);

    // Build player stats map from m.players if available
    // m.players contains [{team: {id, name}, players: [{player: {id, name, photo}, statistics: [{games: {rating}, ...}]}]}]
    const playerStatsMap = {};
    let bestPlayerId = null;
    let bestRating = -1;
    if (m.players && m.players.length > 0) {
        m.players.forEach(teamData => {
            if (teamData.players) {
                teamData.players.forEach(p => {
                    const stats = p.statistics && p.statistics[0];
                    const rating = stats && stats.games && stats.games.rating ? parseFloat(stats.games.rating) : null;
                    playerStatsMap[String(p.player.id)] = {
                        photo: p.player.photo || null,
                        rating: rating,
                        stats: stats || null,
                        playerInfo: p.player || null
                    };
                    if (rating !== null && rating > bestRating) {
                        bestRating = rating;
                        bestPlayerId = String(p.player.id);
                    }
                });
            }
        });
    }

    const idsMatch = (id1, id2) => String(id1) === String(id2);

    // Helper to build a player face thumbnail for the list
    const buildListFace = (playerId, size = 'w-7 h-7') => {
        const pStats = playerStatsMap[String(playerId)] || {};
        const photo = pStats.photo || `https://media.api-sports.io/football/players/${playerId}.png`;
        const rating = pStats.rating;
        let borderColor = '#555';
        if (rating !== null && rating !== undefined) {
            const colors = getRatingColors(rating);
            borderColor = colors.border;
        }
        return `<div class="${size} rounded-full overflow-hidden border-2 shrink-0" style="border-color:${borderColor}; background:#222;"><img src="${photo}" class="w-full h-full object-cover" onerror="this.style.display='none'"/></div>`;
    };

    const renderList = (lineup) => {
        let html = '';

        // === SUSTITUTOS (players who actually entered the game) ===
        const substitutesWhoEntered = [];
        if (lineup.substitutes && lineup.substitutes.length > 0) {
            lineup.substitutes.forEach(p => {
                // Check both e.player and e.assist for the substitute coming in
                // API-Football: e.player = OUT, e.assist = IN (in some versions it's reversed)
                const subInEvent = events.find(e => {
                    const et = (e.type || '').toLowerCase();
                    if (et !== 'subst' && et !== 'substitution') return false;
                    // Check if this sub is referenced in the event
                    if (e.player && idsMatch(e.player.id, p.player.id)) return true;
                    if (e.assist && idsMatch(e.assist.id, p.player.id)) return true;
                    return false;
                });
                if (subInEvent) {
                    substitutesWhoEntered.push({ player: p, event: subInEvent });
                }
            });
        }

        if (substitutesWhoEntered.length > 0) {
            html += `<div class="mb-2 text-xs font-bold text-gray-500 uppercase tracking-widest">Sustitutos</div>`;
            html += substitutesWhoEntered.map(({ player: p, event: subInEvent }) => {
                const pStats = playerStatsMap[String(p.player.id)] || {};
                const rating = pStats.rating;
                let ratingHtml = '';
                if (rating !== null && rating !== undefined) {
                    const colors = getRatingColors(rating);
                    ratingHtml = `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded" style="background:${colors.bg}; color:${colors.text}">${rating.toFixed(1).replace('.', ',')}</span>`;
                }
                const faceHtml = buildListFace(p.player.id);
                const minute = subInEvent.time.elapsed;
                const enteredIcon = `<div class="flex items-center gap-1.5 ml-auto shrink-0">
                    <img src="https://i.postimg.cc/rsvxwJQj/Proyecto_nuevo_3.png" class="w-4 h-4 object-contain" alt="Ingresa" />
                    <span class="text-green-400 text-[10px] font-bold font-mono">${minute}'</span>
                </div>`;
                return `<div class="flex items-center gap-2 border-b border-[#222] py-2 cursor-pointer hover:bg-[#111] transition-colors" data-player-id="${p.player.id}" data-player-name="${p.player.name}" data-player-pos="${p.player.pos || ''}">
                    ${faceHtml}
                    ${ratingHtml}
                    <span class="text-gray-300 text-sm font-medium">${p.player.name}</span>
                    ${enteredIcon}
                </div>`;
            }).join('');
        }

        // === SUPLENTES (players who didn't enter — just face + name) ===
        const benchOnly = (lineup.substitutes || []).filter(p => {
            return !substitutesWhoEntered.some(s => idsMatch(s.player.player.id, p.player.id));
        });

        if (benchOnly.length > 0) {
            html += `<div class="mt-4 mb-2 text-xs font-bold text-gray-500 uppercase tracking-widest">Suplentes</div>`;
            html += benchOnly.map(p => {
                const faceHtml = buildListFace(p.player.id, 'w-6 h-6');
                return `<div class="flex items-center gap-2 border-b border-[#222] py-1.5 cursor-pointer hover:bg-[#111] transition-colors" data-player-id="${p.player.id}" data-player-name="${p.player.name}" data-player-pos="${p.player.pos || ''}">
                    ${faceHtml}
                    <span class="text-gray-500 text-sm">${p.player.name}</span>
                </div>`;
            }).join('');
        }

        return html;
    };

    hList.innerHTML = renderList(homeL);
    aList.innerHTML = renderList(awayL);

    // Add click handlers to list player rows
    [hList, aList].forEach(list => {
        list.querySelectorAll('[data-player-id]').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.playerId;
                const pData = playerStatsMap[String(id)] || {};
                showPlayerModal({
                    name: row.dataset.playerName,
                    number: '',
                    id: id,
                    photo: pData.photo,
                    rating: pData.rating,
                    stats: pData.stats,
                    position: row.dataset.playerPos || (pData.stats?.games?.position) || ''
                });
            });
        });
    });

    const addPlayers = (lineup, side) => {
        const players = lineup.startXI;
        const formation = lineup.formation;

        let lines = {};
        let hasGrid = players.every(p => p.player.grid);

        if (hasGrid) {
            players.forEach(p => {
                const parts = p.player.grid.split(':');
                const lineIdx = parseInt(parts[0]);
                if (!lines[lineIdx]) lines[lineIdx] = [];
                lines[lineIdx].push(p);
            });
        } else {
            let formationParts = formation ? formation.split('-').map(Number) : [4, 4, 2];
            formationParts.unshift(1);
            let playerIdx = 0;
            formationParts.forEach((count, i) => {
                const lineIdx = i + 1;
                lines[lineIdx] = [];
                for (let k = 0; k < count; k++) {
                    if (playerIdx < players.length) {
                        lines[lineIdx].push(players[playerIdx]);
                        playerIdx++;
                    }
                }
            });
        }

        Object.keys(lines).forEach(lineKey => {
            const lineIdx = parseInt(lineKey);
            const linePlayers = lines[lineKey];
            if (hasGrid) {
                linePlayers.sort((a, b) => {
                    const rowA = parseInt(a.player.grid.split(':')[1]);
                    const rowB = parseInt(b.player.grid.split(':')[1]);
                    return rowA - rowB;
                });
            }

            const count = linePlayers.length;
            linePlayers.forEach((p, index) => {
                const el = document.createElement('div');
                el.className = `player-marker ${side === 'home' ? 'home-player' : 'away-player'}`;

                let displayNumber = p.player.number;
                let displayName = p.player.name;
                let isSubbed = false;
                let subInName = '';
                let currentPlayerId = p.player.id; // ID del jugador actual en posición

                const subOutEvent = events.find(e => {
                    const et = (e.type || '').toLowerCase();
                    return (et === 'subst' || et === 'substitution') && e.assist && idsMatch(e.assist.id, p.player.id);
                });

                if (subOutEvent) {
                    isSubbed = true;
                    const subInPlayer = lineup.substitutes.find(s => idsMatch(s.player.id, subOutEvent.player.id));
                    if (subInPlayer) {
                        displayNumber = subInPlayer.player.number;
                        subInName = subInPlayer.player.name;
                        currentPlayerId = subInPlayer.player.id;
                    } else {
                        subInName = subOutEvent.player.name;
                        displayNumber = "⇄";
                        currentPlayerId = subOutEvent.player.id;
                    }
                }

                // Get player stats (photo & rating)
                const pStats = playerStatsMap[String(currentPlayerId)] || playerStatsMap[String(p.player.id)] || {};
                const playerPhoto = pStats.photo || `https://media.api-sports.io/football/players/${currentPlayerId}.png`;
                const playerRating = pStats.rating;
                const isBestPlayer = isFinished && String(currentPlayerId) === bestPlayerId;

                // Determine border color based on rating
                let borderColor = '#555'; // Default gray when no rating
                if (playerRating !== null && playerRating !== undefined) {
                    const colors = getRatingColors(playerRating);
                    borderColor = colors.border;
                }

                // Build player circle with face photo
                el.innerHTML = `
                    <div class="player-face-circle" style="border-color: ${borderColor}">
                        <img src="${playerPhoto}" alt="${displayName}" 
                             class="player-face-img" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        />
                        <div class="player-face-fallback" style="display:none;">${displayNumber}</div>
                    </div>
                `;

                // Rating badge (top-right)
                if (playerRating !== null && playerRating !== undefined) {
                    const colors = getRatingColors(playerRating);
                    const ratingBadge = document.createElement('div');
                    ratingBadge.className = 'player-rating-badge';
                    ratingBadge.style.backgroundColor = colors.bg;
                    ratingBadge.style.color = colors.text;

                    // Show star for best player when match is finished
                    if (isBestPlayer) {
                        ratingBadge.innerHTML = `${playerRating.toFixed(1).replace('.', ',')} <span class="player-star">★</span>`;
                    } else {
                        ratingBadge.textContent = playerRating.toFixed(1).replace('.', ',');
                    }
                    el.appendChild(ratingBadge);
                }

                // === EVENT ICONS around the player face ===
                const checkId = isSubbed ? currentPlayerId : p.player.id;
                const originalId = p.player.id;
                const eventIcons = [];

                // Goal → custom ball image
                const goals = events.filter(e => e.type === 'Goal' && e.detail !== 'Own Goal' && e.player && (idsMatch(e.player.id, checkId) || idsMatch(e.player.id, originalId)));
                goals.forEach(() => {
                    eventIcons.push(`<div class="player-event-icon" title="Gol"><img src="https://i.postimg.cc/R0XtH9g4/Proyecto_nuevo_6.png" class="w-3 h-3 object-contain" /></div>`);
                });

                // Assist → custom boot image
                const playerAssists = events.filter(e => e.type === 'Goal' && e.assist && (idsMatch(e.assist.id, checkId) || idsMatch(e.assist.id, originalId)));
                playerAssists.forEach(() => {
                    eventIcons.push(`<div class="player-event-icon" title="Asistencia"><img src="https://i.postimg.cc/QCR1db0b/Proyecto_nuevo_2.png" class="w-3 h-3 object-contain" /></div>`);
                });

                // Yellow Card
                const yellows = events.filter(e => e.type === 'Card' && e.detail === 'Yellow Card' && e.player && (idsMatch(e.player.id, checkId) || idsMatch(e.player.id, originalId)));
                yellows.forEach(() => {
                    eventIcons.push(`<div class="player-event-icon" title="Tarjeta Amarilla"><div style="width:9px;height:12px;background:#FACC15;border-radius:1.5px;border:1px solid #a38a00;"></div></div>`);
                });

                // Red Card
                const reds = events.filter(e => e.type === 'Card' && e.detail === 'Red Card' && e.player && (idsMatch(e.player.id, checkId) || idsMatch(e.player.id, originalId)));
                reds.forEach(() => {
                    eventIcons.push(`<div class="player-event-icon" title="Tarjeta Roja"><div style="width:9px;height:12px;background:#EF4444;border-radius:1.5px;border:1px solid #991b1b;"></div></div>`);
                });

                // Substituted out → custom sub-out image + visible minute
                if (isSubbed && subOutEvent) {
                    const subMinute = subOutEvent.time.elapsed;
                    eventIcons.push(`<div class="player-event-sub-out-container" title="Sust. ${subMinute}'"><img src="https://i.postimg.cc/fy6mRKB5/Proyecto_nuevo_4.png" class="w-3.5 h-3.5 object-contain" /><span class="sub-minute">${subMinute}'</span></div>`);
                }

                if (eventIcons.length > 0) {
                    const iconsContainer = document.createElement('div');
                    iconsContainer.className = 'player-events-container';
                    iconsContainer.innerHTML = eventIcons.join('');
                    el.appendChild(iconsContainer);
                }

                let x, y;
                const isMobile = window.innerWidth < 1024; // Use 1024px as breakpoint for desktop layout

                // Add or remove horizontal class based on device
                if (!isMobile) {
                    pitch.classList.add('horizontal');
                } else {
                    pitch.classList.remove('horizontal');
                }

                if (isMobile) {
                    // === MOBILE: VERTICAL PITCH ===
                    const totalLines = Object.keys(lines).length;

                    if (side === 'away') {
                        const availableSpace = 40;
                        const spacing = availableSpace / Math.max(1, totalLines - 1);
                        y = 5 + (lineIdx - 1) * spacing;
                        if (lineIdx === 1) y = 5;
                    } else {
                        const availableSpace = 37;
                        const spacing = availableSpace / Math.max(1, totalLines - 1);
                        y = 92 - (lineIdx - 1) * spacing;
                        if (lineIdx === 1) y = 92;
                    }

                    const segment = 100 / (count + 1);
                    x = segment * (index + 1);
                    // Constrain x to keep players inside
                    if (x < 3) x = 3;
                    if (x > 97) x = 97;

                } else {
                    // === DESKTOP: HORIZONTAL PITCH ===
                    const totalLines = Object.keys(lines).length;

                    // Horizontal Spacing (X-axis)
                    // Home: Left (0-50%), Away: Right (50-100%)

                    if (side === 'home') {
                        // Home GK (line 1) at Left (e.g. 5%) -> Forwards near center
                        // Available space: Increased spread (Home starts 3%, ends 48%)
                        const availableSpace = 45;
                        const spacing = availableSpace / Math.max(1, totalLines - 1);
                        x = 3 + (lineIdx - 1) * spacing;
                        if (lineIdx === 1) x = 3; // GK fixed near goal line
                    } else {
                        // Away GK (line 1) at Right (e.g. 95%) -> Forwards near center
                        // Available space: Increased spread (Away starts 97%, ends 52%)
                        const availableSpace = 45;
                        const spacing = availableSpace / Math.max(1, totalLines - 1);
                        x = 97 - (lineIdx - 1) * spacing;
                        if (lineIdx === 1) x = 97; // GK fixed near goal line
                    }

                    // Vertical Spacing (Y-axis) within the line
                    const segment = 100 / (count + 1);
                    y = segment * (index + 1);

                    // Constrain Y to keep players inside vertical bounds
                    if (y < 8) y = 8;
                    if (y > 92) y = 92;
                }

                el.style.left = x + '%';
                el.style.top = y + '%';

                const nameEl = document.createElement('div');
                nameEl.className = 'player-name-label';

                // Función para formatear nombre como "L. Messi"
                const formatPlayerName = (fullName) => {
                    const parts = fullName.trim().split(' ');
                    if (parts.length === 1) return parts[0];
                    const firstName = parts[0];
                    const lastName = parts[parts.length - 1];
                    return `${firstName.charAt(0)}. ${lastName}`;
                };

                if (isSubbed) {
                    const inNameFormatted = formatPlayerName(subInName);
                    const outNameFormatted = formatPlayerName(displayName);
                    nameEl.innerHTML = `<span class="text-white mb-0.5">${displayNumber} ${inNameFormatted}</span><span class="text-gray-400 opacity-50 text-[7px]">${outNameFormatted}</span>`;
                } else {
                    const formattedName = formatPlayerName(displayName);
                    nameEl.innerHTML = `<span class="text-white">${displayNumber} ${formattedName}</span>`;
                }
                el.appendChild(nameEl);

                el.onclick = () => {
                    const pId = isSubbed ? currentPlayerId : p.player.id;
                    const pData = playerStatsMap[String(pId)] || playerStatsMap[String(p.player.id)] || {};
                    showPlayerModal({
                        name: isSubbed ? subInName : p.player.name,
                        number: isSubbed ? '' : (p.player.number || ''),
                        id: pId,
                        photo: pData.photo,
                        rating: pData.rating,
                        stats: pData.stats,
                        position: p.player.pos || (pData.stats?.games?.position) || ''
                    });
                };

                pitch.appendChild(el);
            });
        });
    };

    addPlayers(homeL, 'home');
    addPlayers(awayL, 'away');
};

/**
 * Renderiza las estadísticas del partido
 */
const renderStats = (m) => {
    const c = document.getElementById('tab-stats');
    if (!m.statistics || m.statistics.length === 0) {
        c.innerHTML = 'No disponible';
        return;
    }

    const statsTypes = [
        { api: 'Ball Possession', es: 'Posesión' },
        { api: 'Total Shots', es: 'Tiros Totales' },
        { api: 'Shots on Goal', es: 'Tiros al Arco' },
        { api: 'Corner Kicks', es: 'Tiros de Esquina' },
        { api: 'Fouls', es: 'Faltas' },
        { api: 'Yellow Cards', es: 'Tarjetas Amarillas' },
        { api: 'Red Cards', es: 'Tarjetas Rojas' }
    ];

    const hStats = m.statistics[0].statistics;
    const aStats = m.statistics[1].statistics;

    c.innerHTML = statsTypes.map(stat => {
        const hVal = hStats.find(s => s.type === stat.api)?.value || 0;
        const aVal = aStats.find(s => s.type === stat.api)?.value || 0;
        const hNum = parseInt(hVal);
        const aNum = parseInt(aVal);
        const total = hNum + aNum || 1;
        const hPerc = (hNum / total) * 100;

        return `
            <div class="bg-[#111] p-4 border border-[#222]">
                <div class="flex justify-between text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">
                    <span>${hVal}</span><span>${stat.es}</span><span>${aVal}</span>
                </div>
                <div class="h-1 bg-[#333] flex overflow-hidden">
                    <div class="h-full bg-white" style="width: ${hPerc}%"></div>
                    <div class="h-full bg-[#555]" style="width: ${100 - hPerc}%"></div>
                </div>
            </div>`;
    }).join('');
};

/**
 * Renderiza el historial H2H (últimos 15 partidos)
 */
const renderHeadToHead = async (m) => {
    const c = document.getElementById('tab-h2h');
    c.innerHTML = `<div class="flex justify-center py-10"><div class="loader"></div></div>`;

    const team1Id = m.teams.home.id;
    const team2Id = m.teams.away.id;

    try {
        // Fetch H2H data (last 15 matches)
        const data = await fetchAPI(`/fixtures/headtohead?h2h=${team1Id}-${team2Id}&last=15&timezone=America/Argentina/Buenos_Aires`);
        const fixtures = data.response;

        if (!fixtures || fixtures.length === 0) {
            c.innerHTML = '<div class="text-center py-10 text-gray-600 text-xs uppercase tracking-widest">Sin historial reciente</div>';
            return;
        }

        c.innerHTML = fixtures.map(match => {
            const date = new Date(match.fixture.date);
            const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

            const isHome = match.teams.home.id === team1Id;
            const homeScore = match.goals.home;
            const awayScore = match.goals.away;

            // Determine opacity for losing score
            // If home won, away score is 50% opacity. If away won, home score is 50% opacity.
            // If draw, both normal.
            let homeOpacity = 'opacity-100';
            let awayOpacity = 'opacity-100';

            if (homeScore > awayScore) {
                awayOpacity = 'opacity-50';
            } else if (awayScore > homeScore) {
                homeOpacity = 'opacity-50';
            }

            return `
                <div class="flex items-center justify-between px-4 py-3 bg-[#111] border-b border-[#222] hover:bg-[#1a1a1a] transition-colors cursor-pointer" onclick="app.navigate('/partido/${match.fixture.id}')">
                    <div class="flex items-center gap-4 min-w-0 flex-1">
                        <span class="text-[10px] font-mono text-gray-600 shrink-0">${dateStr}</span>
                        
                        <div class="flex items-center justify-center flex-1 gap-4">
                            <!-- Team 1 (Home in this match) -->
                            <div class="flex items-center justify-end gap-2 flex-1">
                                <span class="text-[10px] font-bold text-gray-400 truncate hidden sm:block">${match.teams.home.name}</span>
                                <img src="${match.teams.home.logo}" class="w-5 h-5 object-contain">
                                <span class="text-lg font-bold text-white font-mono ${homeOpacity}">${homeScore}</span>
                            </div>

                            <span class="text-gray-600 text-[10px]">-</span>

                            <!-- Team 2 (Away in this match) -->
                            <div class="flex items-center justify-start gap-2 flex-1">
                                <span class="text-lg font-bold text-white font-mono ${awayOpacity}">${awayScore}</span>
                                <img src="${match.teams.away.logo}" class="w-5 h-5 object-contain">
                                <span class="text-[10px] font-bold text-gray-400 truncate hidden sm:block">${match.teams.away.name}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error('Error fetching H2H:', e);
        c.innerHTML = '<div class="text-center py-10 text-gray-600 text-xs uppercase tracking-widest">Error al cargar historial</div>';
    }
};

/**
 * Abre el detalle de un partido desde el router
 * @param {Object|number} params - { id, tab } desde URL o ID directo
 */
export const openDetail = async (params) => {
    let id, initialTab;

    // Manejar tanto params object como ID directo
    if (typeof params === 'object' && params !== null) {
        id = params.id;
        initialTab = params.tab || 'timeline';
    } else {
        id = params;
        initialTab = 'timeline';
    }

    const matches = getMatches();

    let m = matches.find(x => String(x.fixture.id) === String(id));

    // Si no está en el state local (ej: partido de otra fecha desde el calendario de standings),
    // buscarlo directamente en la API
    if (!m) {
        try {
            const data = await fetchAPI(`/fixtures?id=${id}`, true);
            if (data.response && data.response.length > 0) {
                m = data.response[0];
            }
        } catch (e) {
            console.error('Error fetching match:', e);
        }
    }

    if (!m) {
        console.warn('Match not found:', id);
        alert('Partido no encontrado. Intenta recargar la página.');
        return;
    }

    selectedMatch = m;

    const detailView = document.getElementById('view-match-detail');

    // Resetear scroll del modal completamente antes de mostrarlo
    detailView.scrollTo(0, 0);

    // Mostrar el modal
    detailView.classList.remove('hidden');

    // Ocultar otras vistas para que no se solapen en Desktop
    document.getElementById('view-match-list').classList.add('hidden');
    document.getElementById('view-standings').classList.add('hidden');
    document.getElementById('view-forum').classList.add('hidden');
    const viewTeam = document.getElementById('view-team');
    if (viewTeam) viewTeam.classList.add('hidden');
    const viewLineup = document.getElementById('view-lineup-builder');
    if (viewLineup) viewLineup.classList.add('hidden');

    // Ocultar sidebar derecha (comunidad) para dar más espacio al detalle
    const rightSidebar = document.getElementById('right-sidebar');
    if (rightSidebar) {
        rightSidebar.style.display = 'none';
    }

    // Ocultar fecha en mobile (en desktop ya está en sidebar/header o no molesta)
    const dateNav = document.getElementById('date-nav');
    if (dateNav) {
        if (window.innerWidth < 1024) {
            dateNav.style.display = 'none';
        } else {
            // En desktop ocultamos el date-nav porque el detalle ocupa su lugar
            dateNav.classList.add('hidden');
        }
    }

    // Ocultar header principal SOLO en móvil
    const header = document.querySelector('header');
    if (header && window.innerWidth < 1024) {
        header.style.display = 'none';
    }

    // Ocultar bottom nav en móvil
    const bottomNav = document.querySelector('nav.fixed.bottom-0');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }

    // Prevenir scroll del fondo SOLO en móvil
    if (window.innerWidth < 1024) {
        document.body.style.overflow = 'hidden';
    }

    // Asegurar que el modal inicia desde arriba
    detailView.scrollTop = 0;

    document.getElementById('detail-content-wrapper').classList.add('hidden');
    document.getElementById('detail-loader').classList.remove('hidden');

    document.getElementById('detail-home-logo').src = m.teams.home.logo;
    document.getElementById('detail-away-logo').src = m.teams.away.logo;
    const homeScore = m.goals.home ?? 0;
    const awayScore = m.goals.away ?? 0;

    // Check for penalties logic
    const hasPenalties = m.score && m.score.penalty && (m.score.penalty.home !== null || m.score.penalty.away !== null);

    // Populate Match Info Header (League, Ref, Stadium)
    const infoContainer = document.getElementById('detail-match-info');
    if (infoContainer) {
        const leagueName = m.league.name;
        const leagueLogo = m.league.logo;
        const leagueRound = m.league.round; // e.g., "Regular Season - 1"
        const referee = m.fixture.referee || 'Árbitro no asignado';
        const venueName = m.fixture.venue.name || 'Estadio desconocido';
        const venueCity = m.fixture.venue.city || '';

        // Custom Whistle Icon
        const whistleIcon = 'https://i.postimg.cc/LsXj3CWR/silbato.png';

        // Stadium Icon from Profile
        const stadiumIcon = 'https://i.postimg.cc/mrVjjgxJ/4905563-2.png';

        infoContainer.innerHTML = `
            <div class="flex items-center gap-6 text-xs text-gray-400 font-medium">
                <div class="flex items-center gap-2">
                    <img src="${leagueLogo}" class="w-4 h-4 object-contain opacity-80">
                    <span class="uppercase tracking-wider hover:text-white transition-colors cursor-default">${leagueName} - ${leagueRound}</span>
                </div>
                
                <div class="w-[1px] h-3 bg-[#333]"></div>

                <div class="flex items-center gap-2">
                    <img src="${whistleIcon}" class="h-3 w-auto object-contain opacity-60">
                    <span>${referee}</span>
                </div>

                <div class="w-[1px] h-3 bg-[#333]"></div>

                <div class="flex items-center gap-2">
                    <img src="${stadiumIcon}" class="h-3 w-auto object-contain opacity-50">
                    <span>${venueName}${venueCity ? `, ${venueCity}` : ''}</span>
                </div>
            </div>
        `;
    }

    // Headers
    // Red cards
    let homeRedCardsHTML = '';
    let awayRedCardsHTML = '';
    if (m.events && m.events.length > 0) {
        const redCards = m.events.filter(e => e.type === 'Card' && e.detail === 'Red Card');
        const hReds = redCards.filter(e => e.team.id === m.teams.home.id).length;
        const aReds = redCards.filter(e => e.team.id === m.teams.away.id).length;

        if (hReds > 0) homeRedCardsHTML = '<div class="flex gap-1 justify-center mt-1">' + '<div class="w-3 h-4 bg-red-600 rounded-sm"></div>'.repeat(hReds) + '</div>';
        if (aReds > 0) awayRedCardsHTML = '<div class="flex gap-1 justify-center mt-1">' + '<div class="w-3 h-4 bg-red-600 rounded-sm"></div>'.repeat(aReds) + '</div>';
    }

    document.getElementById('detail-home-name').innerHTML = m.teams.home.name + homeRedCardsHTML;
    document.getElementById('detail-away-name').innerHTML = m.teams.away.name + awayRedCardsHTML;
    document.getElementById('detail-home-logo').src = m.teams.home.logo;
    document.getElementById('detail-away-logo').src = m.teams.away.logo;

    // Score & Status Logic
    // Score & Status Logic
    const statusShort = m.fixture.status.short;
    const isLive = ['1H', '2H', 'ET', 'P', 'LIVE', 'BT', 'INT'].includes(statusShort);
    const isHT = statusShort === 'HT';
    const isFin = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(statusShort);
    const notStarted = !isLive && !isHT && !isFin; // Catch-all for any other status (NS, TBD, PST, CANC, ABD, etc)

    const scoreDiv = document.getElementById('detail-score-container');
    const statusDiv = document.getElementById('detail-status');

    if (notStarted) {
        // Pre-match: Show ONLY time in the big score slot, no colon.
        scoreDiv.classList.remove('hidden');

        let displayTime = '';
        if (statusShort === 'TBD') {
            displayTime = 'TBD';
        } else if (['PST', 'CANC', 'ABD'].includes(statusShort)) {
            displayTime = m.fixture.status.short; // Show PST/CANC code or long text if preferred
        } else {
            displayTime = new Date(m.fixture.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        scoreDiv.innerHTML = `<span class="text-4xl text-white font-bold">${displayTime}</span>`;

        // Clear status div
        statusDiv.innerHTML = '';
    } else {
        // Match started/finished: Restore standard scoreboard structure
        scoreDiv.classList.remove('hidden');

        // Rebuild structure if it was overwritten by time
        if (!scoreDiv.querySelector('#detail-home-score')) {
            scoreDiv.innerHTML = `
                <span id="detail-home-score">-</span>
                <span class="text-gray-600 text-2xl">:</span>
                <span id="detail-away-score">-</span>
            `;
        }

        // Handle Penalties
        const hasPenalties = m.score.penalty.home !== null && m.score.penalty.away !== null;
        if (hasPenalties) {
            document.getElementById('detail-home-score').innerHTML = `<span class="text-sm text-gray-400 font-normal mr-1">(${m.score.penalty.home})</span>${m.goals.home ?? 0}`;
            document.getElementById('detail-away-score').innerHTML = `${m.goals.away ?? 0}<span class="text-sm text-gray-400 font-normal ml-1">(${m.score.penalty.away})</span>`;
        } else {
            document.getElementById('detail-home-score').innerText = m.goals.home ?? 0;
            document.getElementById('detail-away-score').innerText = m.goals.away ?? 0;
        }

        // Status Text
        if (isLive) {
            statusDiv.innerHTML = `<span class="text-red-500 animate-pulse">${m.fixture.status.elapsed}'</span>`;
        } else if (isHT) {
            statusDiv.innerText = 'ET';
        } else if (isFin) {
            statusDiv.innerText = 'FINALIZADO';
        } else {
            statusDiv.innerText = m.fixture.status.long;
        }

        statusDiv.className = "mt-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest";
        if (isLive) statusDiv.classList.add('text-red-500');
    }

    // Make team logos and names clickable
    const homeLogo = document.getElementById('detail-home-logo');
    const awayLogo = document.getElementById('detail-away-logo');
    const homeName = document.getElementById('detail-home-name');
    const awayName = document.getElementById('detail-away-name');

    [homeLogo, homeName].forEach(el => {
        el.style.cursor = 'pointer';
        el.onclick = (e) => { e.stopPropagation(); app.navigate(`/equipo/${m.teams.home.id}`); };
    });
    [awayLogo, awayName].forEach(el => {
        el.style.cursor = 'pointer';
        el.onclick = (e) => { e.stopPropagation(); app.navigate(`/equipo/${m.teams.away.id}`); };
    });

    // Goleadores - Render in the new row
    const hList = document.getElementById('detail-home-scorers-list');
    const aList = document.getElementById('detail-away-scorers-list');
    if (hList) hList.innerHTML = '';
    if (aList) aList.innerHTML = ''; // Bug in original code? Checking if aList exists but clearing hList? Fixed below.

    if (m.events) {
        const goals = m.events.filter(e => e.type === 'Goal');
        goals.forEach(g => {
            const isHome = g.team.id === m.teams.home.id;
            const container = isHome ? hList : aList;
            if (container) {
                const min = g.time.elapsed + (g.time.extra ? `+${g.time.extra}` : '');
                const player = g.player.name;
                const div = document.createElement('div');
                // Style for scorers: simplified
                div.innerHTML = `${player} (${min}')`;
                container.appendChild(div);
            }
        });
    }

    try {
        const hasFullData = m.events && m.lineups && m.statistics;

        // Si el partido terminó y ya tenemos datos completos, no gastar un request
        if (isFin && hasFullData) {
            // Fetch player stats (photos & ratings) if not already loaded
            if (!m.players) {
                try {
                    const playersData = await fetchAPI(`/fixtures/players?fixture=${id}`, true);
                    if (playersData && playersData.response) {
                        m.players = playersData.response;
                    }
                } catch (pe) {
                    console.warn('Could not fetch player stats:', pe);
                }
            }
            renderTimeline(m);
            renderLineups(m);
            renderStats(m);
        } else {
            const data = await fetchAPI(`/fixtures?id=${id}`, true);
            const fullMatch = data.response[0];

            // Actualizar eventos en el state de matches para mostrar tarjetas rojas en la lista
            if (fullMatch && fullMatch.events) {
                // Also re-render scorers with fresh data
                if (hList) hList.innerHTML = '';
                if (aList) aList.innerHTML = '';
                const freshGoals = fullMatch.events.filter(e => e.type === 'Goal');
                freshGoals.forEach(g => {
                    const isHome = g.team.id === fullMatch.teams.home.id;
                    const container = isHome ? hList : aList;
                    if (container) {
                        const min = g.time.elapsed + (g.time.extra ? `+${g.time.extra}` : '');
                        const player = g.player.name;
                        const div = document.createElement('div');
                        div.innerHTML = `${player} (${min}')`;
                        container.appendChild(div);
                    }
                });

                updateMatchEvents(id, fullMatch.events);
            }

            // Guardar datos completos en el objeto del match para futuras visitas
            if (fullMatch) {
                m.lineups = fullMatch.lineups || m.lineups;
                m.statistics = fullMatch.statistics || m.statistics;
                m.events = fullMatch.events || m.events; // Update events too
            }

            // Fetch player stats (photos & ratings)
            try {
                const playersData = await fetchAPI(`/fixtures/players?fixture=${id}`, true);
                if (playersData && playersData.response) {
                    fullMatch.players = playersData.response;
                    m.players = playersData.response;
                }
            } catch (pe) {
                console.warn('Could not fetch player stats:', pe);
            }

            renderTimeline(fullMatch);
            renderLineups(fullMatch);
            renderStats(fullMatch);
        }
    } catch (e) {
        console.error(e);
    }

    document.getElementById('detail-loader').classList.add('hidden');
    document.getElementById('detail-content-wrapper').classList.remove('hidden');

    // Asegurar que después de cargar, el scroll está arriba
    setTimeout(() => {
        detailView.scrollTo(0, 0);
    }, 100);

    // Determinar si el partido ha comenzado (para tabs)
    const tabNotStarted = ['NS', 'TBD', 'PST', 'CANC', 'ABD'].includes(m.fixture.status.short);

    // Ocultar/mostrar tabs según el estado del partido
    const timelineTab = document.querySelector('.tab-btn[data-target="tab-timeline"]');
    const lineupsTab = document.querySelector('.tab-btn[data-target="tab-lineups"]');
    const statsTab = document.querySelector('.tab-btn[data-target="tab-stats"]');
    const h2hTab = document.querySelector('.tab-btn[data-target="tab-h2h"]');
    const forumTab = document.querySelector('.tab-btn[data-target="tab-forum"]');

    if (tabNotStarted) {
        // Partido no iniciado: solo mostrar foro y H2H
        if (timelineTab) timelineTab.style.display = 'none';
        if (lineupsTab) lineupsTab.style.display = 'none';
        if (statsTab) statsTab.style.display = 'none';
        if (h2hTab) h2hTab.style.display = '';

        // Forzar ir al tab de foro si el partido no ha comenzado (por defecto, pero usuario puede cambiar a H2H)
        if (forumTab && initialTab === 'timeline') {
            forumTab.click();
        } else if (initialTab !== 'timeline') {
            // Si el usuario pidió un tab específico (ej: h2h), intentamos ir ahí
            const tabId = initialTab.startsWith('tab-') ? initialTab : `tab-${initialTab}`;
            const btn = document.querySelector(`.tab-btn[data-target="${tabId}"]`);
            if (btn) btn.click();
        }
    } else {
        // Partido iniciado o finalizado: mostrar todos los tabs
        if (timelineTab) timelineTab.style.display = '';
        if (lineupsTab) lineupsTab.style.display = '';
        if (statsTab) statsTab.style.display = '';
        if (h2hTab) h2hTab.style.display = '';

        // Switch to requested tab
        const tabId = initialTab.startsWith('tab-') ? initialTab : `tab-${initialTab}`;
        const btn = document.querySelector(`.tab-btn[data-target="${tabId}"]`);
        if (btn) {
            btn.click();
        }
    }
};

/**
 * Wrapper para compatibilidad - abre detalle con tab específico
 */
export const openMatchDetailWithTab = (params) => {
    openDetail(params);
};

/**
* Cierra la vista de detalle
*/
export const closeDetail = () => {
    const detailView = document.getElementById('view-match-detail');
    detailView.classList.add('hidden');

    // Restaurar scroll del body
    document.body.style.overflow = '';

    // Restaurar elementos ocultos al abrir el detalle
    const dateNav = document.getElementById('date-nav');
    if (dateNav) {
        dateNav.style.display = '';
        dateNav.classList.remove('hidden');
    }

    // Restaurar header principal
    const header = document.querySelector('header');
    if (header) {
        header.style.display = '';
    }

    // Restaurar bottom nav
    const bottomNav = document.querySelector('nav.fixed.bottom-0');
    if (bottomNav) {
        bottomNav.style.display = '';
    }

    // Restaurar sidebar derecha (comunidad)
    const rightSidebar = document.getElementById('right-sidebar');
    if (rightSidebar) {
        rightSidebar.style.display = '';
    }

    // Navegar de vuelta a matches
    if (window.app && window.app.navigate) {
        window.app.navigate('/');
    }
};

export const getSelectedMatch = () => selectedMatch;

export const switchTab = (btn, targetId) => {
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('text-white', 'border-b-2', 'border-white');
        b.classList.add('text-gray-500');
    });
    btn.classList.remove('text-gray-500');
    btn.classList.add('text-white', 'border-b-2', 'border-white');

    // Update content visibility
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('block');
    });
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('block');
    }

    if (targetId === 'tab-forum' && selectedMatch) {
        // Assuming initForum is globally available or imported
        // We need to check if it's imported. It seems standard.
        if (window.initForum) window.initForum(`match_${selectedMatch.fixture.id}`, 'match-forum-messages', 'match-forum-username');
        else if (typeof initForum === 'function') initForum(`match_${selectedMatch.fixture.id}`, 'match-forum-messages', 'match-forum-username');
    }

    if (targetId === 'tab-h2h' && selectedMatch) {
        renderHeadToHead(selectedMatch);
    }
};
