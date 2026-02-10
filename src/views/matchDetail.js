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
 * Cambia entre tabs del detalle
 * @param {HTMLElement} btn - Botón clickeado
 * @param {string} targetId - ID del tab a mostrar
 */
export const switchTab = (btn, targetId) => {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('text-white', 'border-b-2', 'border-white');
        b.classList.add('text-gray-500');
    });
    btn.classList.add('text-white', 'border-b-2', 'border-white');
    btn.classList.remove('text-gray-500');

    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');

    // NO actualizar URL aquí para evitar bucle infinito
    // La URL se actualiza solo cuando se navega directamente a una URL con tab

    if (targetId === 'tab-forum' && selectedMatch) {
        initForum(`match_${selectedMatch.fixture.id}`, 'match-forum-messages', 'match-forum-username');
    }
};

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

    if (regularEvents.length === 0 && penaltyEvents.length === 0) {
        c.innerHTML = '<div class="text-center py-10 text-gray-600 text-xs uppercase tracking-widest">Sin eventos</div>';
        return;
    }

    let html = '';

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

    const idsMatch = (id1, id2) => String(id1) === String(id2);

    const renderList = (lineup) => {
        let html = lineup.startXI.map(p => {
            const subOut = events.find(e => {
                const eventType = (e.type || '').toLowerCase();
                return (eventType === 'subst' || eventType === 'substitution') && e.assist && idsMatch(e.assist.id, p.player.id);
            });
            const subInfo = subOut ? `<span class="text-red-400 text-[10px] ml-2 font-bold">▼ ${subOut.time.elapsed}'</span>` : '';

            return `<div class="flex justify-between border-b border-[#222] py-1.5 items-center">
                <div class="flex items-center gap-2"><span class="text-gray-300 transition-colors">${p.player.name}</span>${subInfo}</div>
                <span class="text-gray-600 font-mono text-xs">${p.player.number}</span>
            </div>`;
        }).join('');

        if (lineup.substitutes && lineup.substitutes.length > 0) {
            html += `<div class="mt-4 mb-2 text-xs font-bold text-gray-500 uppercase tracking-widest">Suplentes</div>`;
            html += lineup.substitutes.map(p => {
                const subIn = events.find(e => {
                    const eventType = (e.type || '').toLowerCase();
                    return (eventType === 'subst' || eventType === 'substitution') && e.player && idsMatch(e.player.id, p.player.id);
                });
                const subInfo = subIn ? `<span class="text-green-400 text-[10px] ml-2 font-bold">▲ ${subIn.time.elapsed}'</span>` : '';

                return `<div class="flex justify-between border-b border-[#222] py-1.5 items-center">
                    <div class="flex items-center gap-2"><span class="text-gray-400 text-sm">${p.player.name}</span>${subInfo}</div>
                    <span class="text-gray-600 font-mono text-xs">${p.player.number}</span>
                </div>`;
            }).join('');
        }
        return html;
    };

    hList.innerHTML = renderList(homeL);
    aList.innerHTML = renderList(awayL);

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

                const subOutEvent = events.find(e => e.type === 'subst' && e.assist && idsMatch(e.assist.id, p.player.id));

                if (subOutEvent) {
                    isSubbed = true;
                    const subInPlayer = lineup.substitutes.find(s => idsMatch(s.player.id, subOutEvent.player.id));
                    if (subInPlayer) {
                        displayNumber = subInPlayer.player.number;
                        subInName = subInPlayer.player.name;
                    } else {
                        subInName = subOutEvent.player.name;
                        displayNumber = "⇄";
                    }
                }

                // SVG de camiseta con número
                const shirtColor = side === 'home' ? '#ffffff' : '#333333';
                const textColor = side === 'home' ? '#000000' : '#ffffff';
                el.innerHTML = `
                    <svg viewBox="0 0 40 44" width="100%" height="100%" class="pointer-events-none">
                        <path d="M8 4 L16 0 L24 0 L32 4 L40 10 L36 18 L32 16 L32 44 L8 44 L8 16 L4 18 L0 10 Z" 
                              fill="${shirtColor}" stroke="${side === 'home' ? '#000' : '#fff'}" stroke-width="1"/>
                        <text x="20" y="28" text-anchor="middle" fill="${textColor}" 
                              font-size="14" font-weight="bold" font-family="monospace">${displayNumber}</text>
                    </svg>
                `;

                const playerGoals = events.filter(e => e.type === 'Goal' && (idsMatch(e.player.id, p.player.id) || (isSubbed && subOutEvent && idsMatch(e.player.id, subOutEvent.player.id))));

                if (playerGoals.length > 0) {
                    const ballIcon = document.createElement('div');
                    ballIcon.className = `absolute -top-2 -right-2 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-black shadow-sm z-20`;
                    const isOwn = playerGoals[playerGoals.length - 1].detail === 'Own Goal';
                    ballIcon.innerHTML = isOwn
                        ? `<div class="w-2.5 h-2.5 rounded-full bg-red-500"></div>`
                        : `<div class="w-full h-full rounded-full bg-white flex items-center justify-center"><div class="w-1.5 h-1.5 bg-black rounded-full opacity-80"></div></div>`;
                    el.appendChild(ballIcon);
                }

                let x, y;
                const isMobile = window.innerWidth < 768;

                if (isMobile) {
                    // En móvil: cancha vertical
                    // Equipo visitante arriba, local abajo (como imagen de referencia)
                    const totalLines = Object.keys(lines).length;

                    if (side === 'away') {
                        // Equipo visitante arriba (5%-45%)
                        const availableSpace = 40;
                        const spacing = availableSpace / Math.max(1, totalLines - 1);
                        y = 5 + (lineIdx - 1) * spacing;
                        if (lineIdx === 1) y = 5;
                    } else {
                        // Equipo local abajo (55%-92%)
                        const availableSpace = 37;
                        const spacing = availableSpace / Math.max(1, totalLines - 1);
                        y = 92 - (lineIdx - 1) * spacing;
                        if (lineIdx === 1) y = 92;
                    }

                    // Aprovechar más los costados en móvil
                    const segment = 100 / (count + 1);
                    x = segment * (index + 1);
                    if (x < 3) x = 3;
                    if (x > 97) x = 97;
                } else {
                    // En desktop: cancha horizontal - reducir separación entre equipos
                    const totalLines = Object.keys(lines).length;

                    if (side === 'home') {
                        // Equipo local izquierda (3-46%) - espaciado dinámico
                        const availableSpace = 43;
                        const spacing = availableSpace / Math.max(1, totalLines - 1);
                        x = 3 + (lineIdx - 1) * spacing;
                        if (lineIdx === 1) x = 3;
                    } else {
                        // Equipo visitante derecha (54-97%) - espaciado dinámico
                        const availableSpace = 43;
                        const spacing = availableSpace / Math.max(1, totalLines - 1);
                        x = 97 - (lineIdx - 1) * spacing;
                        if (lineIdx === 1) x = 97;
                    }

                    const segment = 100 / (count + 1);
                    y = segment * (index + 1);
                    if (y < 6) y = 6;
                    if (y > 94) y = 94;
                }

                el.style.left = x + '%';
                el.style.top = y + '%';

                const nameEl = document.createElement('div');
                nameEl.className = `absolute -bottom-6 left-1/2 -translate-x-1/2 text-[7px] font-bold whitespace-nowrap bg-black/80 px-1.5 py-0.5 rounded flex flex-col items-center leading-none z-30 border border-[#333] pointer-events-none`;

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
                    document.getElementById('modal-player-name').innerText = p.player.name;
                    document.getElementById('player-modal').classList.remove('hidden');
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

    const m = matches.find(x => String(x.fixture.id) === String(id));

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

    if (hasPenalties) {
        // Format: (5) 1 - 1 (4)
        document.getElementById('detail-home-score').innerHTML = `<span class="text-sm text-gray-400 font-normal mr-1">(${m.score.penalty.home})</span>${homeScore}`;
        document.getElementById('detail-away-score').innerHTML = `${awayScore}<span class="text-sm text-gray-400 font-normal ml-1">(${m.score.penalty.away})</span>`;
    } else {
        document.getElementById('detail-home-score').innerText = homeScore;
        document.getElementById('detail-away-score').innerText = awayScore;
    }

    const statusShort = m.fixture.status.short;
    let statusText = m.fixture.status.long;

    if (['1H', '2H', 'ET', 'P'].includes(statusShort)) {
        statusText = m.fixture.status.elapsed + "'";
    } else if (statusShort === 'HT') {
        statusText = 'ENTRETIEMPO';
    }

    document.getElementById('detail-status').innerText = statusText;

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

    // Goleadores
    const hList = document.getElementById('detail-home-scorers-list');
    const aList = document.getElementById('detail-away-scorers-list');
    hList.innerHTML = '';
    aList.innerHTML = '';

    if (m.events && m.events.length > 0) {
        const goals = m.events.filter(e => e.type === 'Goal');
        const formatScorer = (ev) => `<div class="truncate leading-tight max-w-[120px] text-center">${ev.player.name} ${ev.time.elapsed}'</div>`;

        const hGoals = goals.filter(e => e.team.id === m.teams.home.id).map(formatScorer);
        if (hGoals.length > 0) hList.innerHTML = hGoals.join('');

        const aGoals = goals.filter(e => e.team.id === m.teams.away.id).map(formatScorer);
        if (aGoals.length > 0) aList.innerHTML = aGoals.join('');
    }

    try {
        const isFinished = ['FT', 'AET', 'PEN'].includes(m.fixture.status.short);
        const hasFullData = m.events && m.lineups && m.statistics;

        // Si el partido terminó y ya tenemos datos completos, no gastar un request
        if (isFinished && hasFullData) {
            renderTimeline(m);
            renderLineups(m);
            renderStats(m);
        } else {
            const data = await fetchAPI(`/fixtures?id=${id}`, true);
            const fullMatch = data.response[0];

            // Actualizar eventos en el state de matches para mostrar tarjetas rojas en la lista
            if (fullMatch && fullMatch.events) {
                updateMatchEvents(id, fullMatch.events);
            }

            // Guardar datos completos en el objeto del match para futuras visitas
            if (fullMatch) {
                m.lineups = fullMatch.lineups || m.lineups;
                m.statistics = fullMatch.statistics || m.statistics;
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

    // Determinar si el partido ha comenzado
    const notStarted = ['NS', 'TBD', 'PST', 'CANC', 'ABD'].includes(m.fixture.status.short);

    // Ocultar/mostrar tabs según el estado del partido
    const timelineTab = document.querySelector('.tab-btn[data-target="tab-timeline"]');
    const lineupsTab = document.querySelector('.tab-btn[data-target="tab-lineups"]');
    const statsTab = document.querySelector('.tab-btn[data-target="tab-stats"]');
    const forumTab = document.querySelector('.tab-btn[data-target="tab-forum"]');

    if (notStarted) {
        // Partido no iniciado: solo mostrar foro
        if (timelineTab) timelineTab.style.display = 'none';
        if (lineupsTab) lineupsTab.style.display = 'none';
        if (statsTab) statsTab.style.display = 'none';
        // Forzar ir al tab de foro si el partido no ha comenzado
        if (forumTab) {
            forumTab.click();
        }
    } else {
        // Partido iniciado o finalizado: mostrar todos los tabs
        if (timelineTab) timelineTab.style.display = '';
        if (lineupsTab) lineupsTab.style.display = '';
        if (statsTab) statsTab.style.display = '';

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

    // Navegar de vuelta a matches
    if (window.app && window.app.navigate) {
        window.app.navigate('/');
    }
};

export const getSelectedMatch = () => selectedMatch;
