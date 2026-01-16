/**
 * Match Detail View Module
 * 
 * Propósito: Vista detallada de partido con tabs (timeline, lineups, stats, forum)
 * 
 * Exports:
 * - openDetail(id, initialTab): Abre detalle de un partido
 * - closeDetail(): Cierra vista de detalle
 * - switchTab(btn, targetId): Cambia entre tabs
 * - renderTimeline(match): Renderiza cronología de eventos
 * - renderLineups(match): Renderiza alineaciones
 * - renderStats(match): Renderiza estadísticas
 */

import { fetchAPI } from '../core/api.js';
import { getMatches } from './matches.js';
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

    if (targetId === 'tab-forum' && selectedMatch) {
        initForum(`match_${selectedMatch.fixture.id}`, 'match-forum-messages', 'match-forum-username');
    }
};

/**
 * Renderiza el timeline de eventos
 * @param {Object} m - Datos completos del partido
 */
export const renderTimeline = (m) => {
    const c = document.getElementById('tab-timeline');
    let ev = [...(m.events || [])];

    // Ordenar: Más reciente arriba
    ev.sort((a, b) => {
        const tA = a.time.elapsed + (a.time.extra || 0);
        const tB = b.time.elapsed + (b.time.extra || 0);
        if (tA === tB) return 0;
        return tA > tB ? -1 : 1;
    });

    if (ev.length === 0) {
        c.innerHTML = '<div class="text-center py-10 text-gray-600 text-xs uppercase tracking-widest">Sin eventos</div>';
        return;
    }

    c.innerHTML = ev.map(e => {
        const isHome = e.team.id === m.teams.home.id;
        const sideClass = isHome ? 'flex-row' : 'flex-row-reverse';
        const boxClass = isHome ? '' : 'flex-row-reverse text-right';

        let content = '';
        if (e.type === 'subst') {
            content = `
                <div class="flex flex-col gap-0.5">
                    <span class="text-xs font-bold text-green-400 uppercase">Entra: ${e.player.name}</span>
                    <span class="text-[10px] font-bold text-red-400 uppercase opacity-70">Sale: ${e.assist.name}</span>
                </div>
            `;
        } else {
            content = `
                <span class="text-sm font-bold text-white">${e.player.name}</span>
                <span class="text-[9px] px-2 py-0.5 uppercase font-bold tracking-wider ${e.type === 'Goal' ? 'bg-white text-black' : 'bg-[#333] text-gray-400'}">${e.type === 'Goal' ? 'GOL' : e.detail}</span>
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
};

/**
 * Renderiza las alineaciones y cancha táctica
 * @param {Object} m - Datos completos del partido
 */
export const renderLineups = (m) => {
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

    // Helper para comparar IDs
    const idsMatch = (id1, id2) => String(id1) === String(id2);

    // Renderizar listas de jugadores
    const renderList = (lineup) => {
        // Titulares
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

    // Renderizar cancha táctica
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

                el.innerHTML = `<span class="text-xs font-bold font-mono pointer-events-none">${displayNumber}</span>`;

                // Goal indicator
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

                // Posicionamiento
                let x;
                if (side === 'home') {
                    x = 4 + (lineIdx - 1) * 11;
                    if (lineIdx === 1) x = 2;
                } else {
                    x = 96 - (lineIdx - 1) * 11;
                    if (lineIdx === 1) x = 98;
                }

                const segment = 100 / (count + 1);
                let y = segment * (index + 1);
                if (y < 5) y = 5;
                if (y > 95) y = 95;

                el.style.left = x + '%';
                el.style.top = y + '%';

                // Name label
                const nameEl = document.createElement('div');
                nameEl.className = `absolute -bottom-7 left-1/2 -translate-x-1/2 text-[8px] font-bold whitespace-nowrap bg-black/80 px-2 py-1 rounded flex flex-col items-center leading-none z-30 border border-[#333] pointer-events-none`;

                if (isSubbed) {
                    const inNameShort = subInName.split(' ').pop();
                    const outNameShort = displayName.split(' ').pop();
                    nameEl.innerHTML = `<span class="text-white mb-0.5">${inNameShort}</span><span class="text-gray-400 opacity-50 text-[7px]">${outNameShort}</span>`;
                } else {
                    const shortName = displayName.split(' ').pop();
                    nameEl.innerHTML = `<span class="text-white">${shortName}</span>`;
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
 * @param {Object} m - Datos completos del partido
 */
export const renderStats = (m) => {
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
 * Abre el detalle de un partido
 * @param {number} id - ID del fixture
 * @param {string} initialTab - Tab inicial a mostrar (opcional)
 */
export const openDetail = async (id, initialTab = null) => {
    const matches = getMatches();
    const m = matches.find(x => x.fixture.id == id);
    if (!m) return;

    selectedMatch = m;

    document.getElementById('view-match-detail').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('detail-content-wrapper').classList.add('hidden');
    document.getElementById('detail-loader').classList.remove('hidden');

    // Datos básicos
    document.getElementById('detail-home-logo').src = m.teams.home.logo;
    document.getElementById('detail-away-logo').src = m.teams.away.logo;
    document.getElementById('detail-home-score').innerText = m.goals.home ?? 0;
    document.getElementById('detail-away-score').innerText = m.goals.away ?? 0;
    document.getElementById('detail-status').innerText = m.fixture.status.long;

    // Red cards para header
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

    // Goleadores en header
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
        const data = await fetchAPI(`/fixtures?id=${id}`);
        const fullMatch = data.response[0];

        renderTimeline(fullMatch);
        renderLineups(fullMatch);
        renderStats(fullMatch);
    } catch (e) {
        console.error(e);
    }

    document.getElementById('detail-loader').classList.add('hidden');
    document.getElementById('detail-content-wrapper').classList.remove('hidden');

    // Switch to requested tab
    if (initialTab) {
        const btn = document.querySelector(`.tab-btn[data-target="${initialTab}"]`);
        if (btn) btn.click();
    } else {
        const btn = document.querySelector(`.tab-btn[data-target="tab-timeline"]`);
        if (btn) btn.click();
    }
};

/**
 * Cierra la vista de detalle
 */
export const closeDetail = () => {
    document.getElementById('view-match-detail').classList.add('hidden');
    document.body.style.overflow = '';
};

export const getSelectedMatch = () => selectedMatch;
