/**
 * Match Detail View Module
 * 
 * Propósito: Mostrar detalle de partido, timeline, alineaciones y stats
 */

import { fetchAPI } from '../core/api.js';
import { getMatches, updateMatchEvents } from './matches.js';

let selectedMatch = null;

/**
 * Inicializa la vista de detalle
 */
export const initMatchDetail = () => {
    // Event listeners para tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('text-yellow-500', 'border-yellow-500');
                b.classList.add('text-gray-400', 'border-transparent');
            });

            // Add active to clicked
            e.currentTarget.classList.remove('text-gray-400', 'border-transparent');
            e.currentTarget.classList.add('text-yellow-500', 'border-yellow-500');

            // Show content
            const target = e.currentTarget.dataset.target;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');

            // Load forum msg if needed
            if (target === 'tab-forum' && selectedMatch) {
                // Dispatch event to forum module
                window.dispatchEvent(new CustomEvent('open-forum', { detail: { matchId: selectedMatch.fixture.id } }));
            }
        });
    });

    // Close button
    document.getElementById('close-detail-btn').addEventListener('click', closeDetail);
};

const renderTimeline = (m) => {
    const container = document.getElementById('tab-timeline');
    if (!m.events || m.events.length === 0) {
        container.innerHTML = '<div class="py-10 text-center text-gray-500 text-xs uppercase tracking-widest">No hay eventos disponibles</div>';
        return;
    }

    let html = '<div class="relative pl-4 border-l border-[#222] space-y-6 my-4">';

    // Sort events
    const events = [...m.events].reverse();

    events.forEach(e => {
        const isHome = e.team.id === m.teams.home.id;
        const color = isHome ? 'text-blue-400' : 'text-red-400';
        const align = 'text-left'; // Always left aligned in this vertical timeline design

        let icon = '';
        if (e.type === 'Goal') icon = '⚽';
        else if (e.type === 'Card' && e.detail === 'Yellow Card') icon = '🟨';
        else if (e.type === 'Card' && e.detail === 'Red Card') icon = '🟥';
        else if (e.type === 'subst') icon = '🔄';
        else icon = '•';

        html += `
            <div class="relative">
                <div class="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-[#111] border border-gray-600 flex items-center justify-center text-[8px] text-gray-400 bg-black z-10"></div>
                <div class="flex items-start gap-3">
                    <span class="font-bold text-yellow-500 w-8 text-right shrink-0">${e.time.elapsed}'</span>
                    <div class="flex-1 bg-[#111] p-2 rounded border border-[#222]">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-lg">${icon}</span>
                            <span class="font-bold text-white text-sm uppercase tracking-tight">${e.type === 'Goal' ? 'GOL' : e.type}</span>
                            <span class="text-[10px] text-gray-500 px-1.5 py-0.5 border border-[#333] rounded ml-auto">${e.team.name}</span>
                        </div>
                        <div class="text-gray-300 text-sm font-medium">${e.player.name}</div>
                        ${e.assist.name ? `<div class="text-gray-500 text-xs mt-0.5">Asist: ${e.assist.name}</div>` : ''}
                        ${e.detail ? `<div class="text-gray-500 text-[10px] mt-1 uppercase tracking-widest">${e.detail}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
};

const renderLineups = (m) => {
    const homeContainer = document.getElementById('lineup-home-list');
    const awayContainer = document.getElementById('lineup-away-list');

    if (!m.lineups || m.lineups.length === 0) {
        homeContainer.innerHTML = '<div class="text-center text-gray-500 text-xs p-4">Sin alineación</div>';
        awayContainer.innerHTML = '<div class="text-center text-gray-500 text-xs p-4">Sin alineación</div>';
        return;
    }

    const renderXI = (lineup, teamId) => {
        let html = '';

        // Coach
        if (lineup.coach) {
            html += `<div class="mb-4 pb-2 border-b border-[#222]">
                <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Entrenador</div>
                <div class="font-bold text-white text-sm">${lineup.coach.name}</div>
             </div>`;
        }

        // Starters
        html += '<div class="space-y-3">';
        lineup.startXI.forEach(p => {
            // Find stats (rating & photo) from m.players
            let rating = null;
            let photo = null;

            if (m.players) {
                const teamStats = m.players.find(t => t.team.id === teamId);
                if (teamStats) {
                    const playerStats = teamStats.players.find(ps => ps.player.id === p.player.id);
                    if (playerStats) {
                        photo = playerStats.player.photo;
                        rating = playerStats.statistics[0].games.rating;
                    }
                }
            }

            // Fallback photo
            if (!photo) photo = 'https://media.api-sports.io/football/players/' + p.player.id + '.png';

            // Rating styling
            let ratingClass = 'bg-gray-700 text-gray-300';
            if (rating) {
                const r = parseFloat(rating);
                if (r >= 8) ratingClass = 'bg-blue-600 text-white';
                else if (r >= 7) ratingClass = 'bg-green-600 text-white';
                else if (r >= 6) ratingClass = 'bg-orange-500 text-black';
                else ratingClass = 'bg-red-500 text-white';
            }

            html += `
                <div class="flex items-center gap-3 group">
                    <div class="relative w-8 h-8 shrink-0">
                        <img src="${photo}" class="w-full h-full rounded-full object-cover bg-[#222] border border-[#333]" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNTU1IiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iOCIgcj0iNCIvPjxwYXRoIGQ9Ik02IDIxdjItYTQgNCAwIDAgMSA0LTRoNGE0IDQgMCAwIDEgNCA0djIiLz48L3N2Zz4='">
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-[#111] rounded-full flex items-center justify-center border border-[#333] text-[9px] font-bold text-gray-400">${p.player.number}</div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-sm text-gray-200 truncate group-hover:text-white transition-colors">${p.player.name}</div>
                        <div class="text-[10px] text-gray-500 truncate">${p.player.pos}</div>
                    </div>
                    ${rating ? `<div class="${ratingClass} text-[10px] font-bold px-1.5 py-0.5 rounded">${parseFloat(rating).toFixed(1)}</div>` : ''}
                </div>
            `;
        });
        html += '</div>';

        // Substitutes
        if (lineup.substitutes && lineup.substitutes.length > 0) {
            html += `<div class="mt-6 mb-2 text-[10px] text-gray-500 uppercase tracking-widest border-t border-[#222] pt-2">Suplentes</div>
            <div class="space-y-2 opacity-75">`;

            lineup.substitutes.forEach(p => {
                html += `
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-gray-600 w-4 text-right">${p.player.number}</span>
                    <span class="text-xs text-gray-400">${p.player.name}</span>
                </div>`;
            });
            html += '</div>';
        }

        return html;
    };

    homeContainer.innerHTML = renderXI(m.lineups[0], m.teams.home.id);
    awayContainer.innerHTML = renderXI(m.lineups[1], m.teams.away.id);
};

const renderStats = (m) => {
    const container = document.getElementById('tab-stats');
    if (!m.statistics || m.statistics.length === 0) {
        container.innerHTML = '<div class="py-10 text-center text-gray-500 text-xs uppercase tracking-widest">No hay estadísticas</div>';
        return;
    }

    const homeStats = m.statistics[0].statistics;
    const awayStats = m.statistics[1].statistics;

    // Map stats to an object for easy access
    const getStat = (arr, type) => {
        const item = arr.find(s => s.type === type);
        return item ? item.value : 0; // value can be null, handle carefully
    }

    const statTypes = [
        { label: 'Tiros Totales', key: 'Total Shots' },
        { label: 'Tiros al Arco', key: 'Shots on Goal' },
        { label: 'Posesión', key: 'Ball Possession' },
        { label: 'Pases', key: 'Passes Total' },
        { label: 'Precisión Pases', key: 'Passes %' },
        { label: 'Faltas', key: 'Fouls' },
        { label: 'Tarjetas Amarillas', key: 'Yellow Cards' },
        { label: 'Tarjetas Rojas', key: 'Red Cards' },
        { label: 'Offsides', key: 'Offsides' },
        { label: 'Corners', key: 'Corner Kicks' },
    ];

    let html = '<div class="space-y-4 my-4">';

    statTypes.forEach(s => {
        let valH = getStat(homeStats, s.key);
        let valA = getStat(awayStats, s.key);

        if (valH === null) valH = 0;
        if (valA === null) valA = 0;

        // Clean percentage string
        const cleanH = String(valH).replace('%', '');
        const cleanA = String(valA).replace('%', '');

        const numH = parseFloat(cleanH) || 0;
        const numA = parseFloat(cleanA) || 0;
        const total = numH + numA;
        const percH = total === 0 ? 50 : (numH / total) * 100;

        html += `
            <div>
                <div class="flex justify-between text-xs font-bold text-gray-300 mb-1 px-1">
                    <span>${valH}</span>
                    <span class="text-gray-500 uppercase tracking-widest text-[10px]">${s.label}</span>
                    <span>${valA}</span>
                </div>
                <div class="flex h-1.5 bg-[#111] rounded-full overflow-hidden">
                    <div class="bg-yellow-500 h-full" style="width: ${percH}%"></div>
                    <div class="bg-gray-700 h-full flex-1"></div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
};

/**
 * Abre el detalle de un partido desde el router
 * @param {Object|number} params - { id, tab } desde URL o ID directo
 */
export const openDetail = (params) => {
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

    // --- RENDER HEADER IMMEDIATELY ---
    try {
        // Prepare UI
        const detailView = document.getElementById('view-match-detail');
        const contentWrapper = document.getElementById('detail-content-wrapper');
        const loader = document.getElementById('detail-loader');

        // Reset & Show Modal
        detailView.scrollTo(0, 0);
        detailView.classList.remove('hidden');

        // Hide main content & others to prevent overlap/scroll issues
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.classList.add('hidden');

        const rightSidebar = document.getElementById('right-sidebar');
        if (rightSidebar) rightSidebar.style.display = 'none';

        const dateNav = document.getElementById('date-nav');
        if (dateNav) {
            if (window.innerWidth < 1024) dateNav.style.display = 'none';
            else dateNav.classList.add('hidden');
        }

        const header = document.querySelector('header');
        if (header && window.innerWidth < 1024) header.style.display = 'none';

        const bottomNav = document.querySelector('nav.fixed.bottom-0');
        if (bottomNav) bottomNav.style.display = 'none';

        if (window.innerWidth < 1024) document.body.style.overflow = 'hidden';

        // Show Content wrapper immediately (Header info is available in 'm')
        // Hide loader initially because we have header data
        loader.classList.add('hidden');
        contentWrapper.classList.remove('hidden');

        // Populate Header
        document.getElementById('detail-home-logo').src = m.teams?.home?.logo || '';
        document.getElementById('detail-away-logo').src = m.teams?.away?.logo || '';
        const homeScore = m.goals?.home ?? 0;
        const awayScore = m.goals?.away ?? 0;

        const hasPenalties = m.score?.penalty && (m.score.penalty.home !== null || m.score.penalty.away !== null);
        if (hasPenalties) {
            document.getElementById('detail-home-score').innerHTML = `<span class="text-sm text-gray-400 font-normal mr-1">(${m.score.penalty.home})</span>${homeScore}`;
            document.getElementById('detail-away-score').innerHTML = `${awayScore}<span class="text-sm text-gray-400 font-normal ml-1">(${m.score.penalty.away})</span>`;
        } else {
            document.getElementById('detail-home-score').innerText = homeScore;
            document.getElementById('detail-away-score').innerText = awayScore;
        }

        const statusShort = m.fixture?.status?.short;
        let statusText = m.fixture?.status?.long || '';
        if (['1H', '2H', 'ET', 'P'].includes(statusShort)) {
            statusText = (m.fixture?.status?.elapsed || 0) + "'";
        } else if (statusShort === 'HT') {
            statusText = 'ENTRETIEMPO';
        }
        document.getElementById('detail-status').innerText = statusText;

        // Red cards header
        let homeRedCardsHTML = '';
        let awayRedCardsHTML = '';
        if (m.events && m.events.length > 0) {
            const redCards = m.events.filter(e => e.type === 'Card' && e.detail === 'Red Card');
            const hReds = redCards.filter(e => e.team?.id === m.teams?.home?.id).length;
            const aReds = redCards.filter(e => e.team?.id === m.teams?.away?.id).length;
            if (hReds > 0) homeRedCardsHTML = '<div class="flex gap-1 justify-center mt-1">' + '<div class="w-3 h-4 bg-red-600 rounded-sm"></div>'.repeat(hReds) + '</div>';
            if (aReds > 0) awayRedCardsHTML = '<div class="flex gap-1 justify-center mt-1">' + '<div class="w-3 h-4 bg-red-600 rounded-sm"></div>'.repeat(aReds) + '</div>';
        }
        document.getElementById('detail-home-name').innerHTML = (m.teams?.home?.name || 'Local') + homeRedCardsHTML;
        document.getElementById('detail-away-name').innerHTML = (m.teams?.away?.name || 'Visitante') + awayRedCardsHTML;

        // Scorer Lists (Basic from list view data, if available)
        const hList = document.getElementById('detail-home-scorers-list');
        const aList = document.getElementById('detail-away-scorers-list');
        if (hList) hList.innerHTML = '';
        if (aList) aList.innerHTML = '';
        if (m.events && m.events.length > 0) {
            const goals = m.events.filter(e => e.type === 'Goal');
            const formatScorer = (ev) => {
                const name = ev.player?.name || 'Jugador';
                const time = ev.time?.elapsed || '';
                return `<div class="truncate leading-tight max-w-[120px] text-center">${name} ${time}'</div>`;
            };
            const hGoals = goals.filter(e => e.team?.id === m.teams?.home?.id).map(formatScorer);
            if (hGoals.length > 0 && hList) hList.innerHTML = hGoals.join('');
            const aGoals = goals.filter(e => e.team?.id === m.teams?.away?.id).map(formatScorer);
            if (aGoals.length > 0 && aList) aList.innerHTML = aGoals.join('');
        }

        // Set placeholders in tabs while loading
        const tabTimeline = document.getElementById('tab-timeline');
        if (tabTimeline) tabTimeline.innerHTML = '<div class="py-10 text-center"><div class="loader"></div></div>';

        const lineupHome = document.getElementById('lineup-home-list');
        if (lineupHome) lineupHome.innerHTML = '<div class="text-center text-gray-500 py-4">Cargando...</div>';

        const lineupAway = document.getElementById('lineup-away-list');
        if (lineupAway) lineupAway.innerHTML = '<div class="text-center text-gray-500 py-4">Cargando...</div>';

        const tabStats = document.getElementById('tab-stats');
        if (tabStats) tabStats.innerHTML = '<div class="py-10 text-center"><div class="loader"></div></div>'; // Spinner for stats as well

    } catch (err) {
        console.error('Error rendering match detail header:', err);
        // Ensure wrapper is visible even on error
        document.getElementById('detail-loader')?.classList.add('hidden');
        document.getElementById('detail-content-wrapper')?.classList.remove('hidden');
    }

    // --- ASYNC DATA FETCH ---
    (async () => {
        try {
            const isFinished = ['FT', 'AET', 'PEN'].includes(m.fixture?.status?.short);
            const hasFullData = m.events && m.lineups && m.statistics;

            let matchData = m;

            // Fetch Full Data if needed
            if (!isFinished || !hasFullData) {
                try {
                    const data = await fetchAPI(`/fixtures?id=${id}`, true);
                    if (data.response?.[0]) {
                        matchData = data.response[0];

                        // Merge fields back to original object 'm' to cache them
                        m.lineups = matchData.lineups || m.lineups;
                        m.statistics = matchData.statistics || m.statistics;

                        // Update events if new data has them (e.g. new red cards)
                        if (matchData.events) {
                            updateMatchEvents(id, matchData.events);
                        }
                    }
                } catch (e) {
                    console.warn('Error fetching full match data:', e);
                }
            }

            // Fetch Players (in parallel or after)
            if (!matchData.players) {
                try {
                    const playersData = await fetchAPI(`/fixtures/players?fixture=${id}`, true);
                    if (playersData?.response) {
                        matchData.players = playersData.response;
                        // Cache
                        m.players = playersData.response;
                    }
                } catch (pe) {
                    console.warn('Error fetching player stats:', pe);
                }
            }

            // Now Render Tabs with available data
            renderTimeline(matchData);
            renderLineups(matchData);
            renderStats(matchData);

        } catch (e) {
            console.error('Async fetch error:', e);
            const tabTimeline = document.getElementById('tab-timeline');
            if (tabTimeline) tabTimeline.innerHTML = '<div class="py-10 text-center text-gray-500 text-xs uppercase tracking-widest">Error cargando detalles</div>';
        }
    })();

    // Initialize Tabs Logic & Navigation
    const notStarted = ['NS', 'TBD', 'PST', 'CANC', 'ABD'].includes(m.fixture?.status?.short);
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

    // Restaurar sidebar derecha (comunidad)
    const rightSidebar = document.getElementById('right-sidebar');
    if (rightSidebar) {
        rightSidebar.style.display = '';
    }

    // Restaurar main content
    const mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.classList.remove('hidden');

    // Navegar de vuelta a matches
    if (window.app && window.app.navigate) {
        window.app.navigate('/');
    }
};

export const getSelectedMatch = () => selectedMatch;
