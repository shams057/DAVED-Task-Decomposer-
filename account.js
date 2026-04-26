// ============================================================
// account.js — Profile & History page logic
// Depends on: auth.js
// ============================================================

const PAGE_SIZE = 8;
let currentPage = 0;
let totalSessions = 0;
let allSessions = []; // locally cached for filter
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    const loadingEl  = document.getElementById('loading-state');
    const unauthEl   = document.getElementById('unauth-state');
    const contentEl  = document.getElementById('profile-content');

    // Wait a tick for auth.js initAuth() to complete
    await new Promise(r => setTimeout(r, 400));

    const user = window.davedUser;

    loadingEl.style.display = 'none';

    if (!user) {
        unauthEl.style.display = 'block';
        return;
    }

    contentEl.style.display = 'block';
    await Promise.all([loadProfile(user), loadStats(user), loadHistory(user, 0)]);
    setupPagination(user);
    setupFilters();
});

// ============================================================
// PROFILE HEADER
// ============================================================
async function loadProfile(user) {
    const profile = await getProfile(user.id);

    document.getElementById('profile-name').textContent  = profile?.full_name || user.email?.split('@')[0] || 'User';
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('profile-joined').textContent = `Joined ${formatDate(profile?.created_at || user.created_at, true)}`;

    const avatarEl = document.getElementById('profile-avatar');
    if (profile?.avatar_url) {
        avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="avatar">`;
    }
}

// ============================================================
// STATS
// ============================================================
async function loadStats(user) {
    const stats = await getUserStats(user.id);
    if (!stats) return;

    animateNumber('stat-sessions',  stats.total_sessions      || 0);
    animateNumber('stat-steps',     stats.total_steps         || 0); // this is total_steps from DB (all steps across sessions); we'll show completed steps instead
    animateNumber('stat-points',    stats.total_points_earned || 0);
    animateNumber('stat-completed', stats.sessions_completed  || 0);

    // Recalculate completed steps from sessions for accuracy
    const { sessions } = await getTaskHistory(user.id, 0, 999);
    const completedSteps = sessions.reduce((sum, s) => sum + (s.completed_steps || 0), 0);
    animateNumber('stat-steps', completedSteps);
}

function animateNumber(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    const duration = 800;
    const start = performance.now();
    function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
        el.textContent = Math.round(eased * target).toLocaleString();
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// ============================================================
// HISTORY
// ============================================================
async function loadHistory(user, page) {
    const listEl  = document.getElementById('history-list');
    const emptyEl = document.getElementById('history-empty');
    const paginEl = document.getElementById('pagination');

    listEl.innerHTML = `<div class="account-loading" style="height:160px;"><div class="loading-spinner"></div></div>`;

    const { sessions, total } = await getTaskHistory(user.id, page, PAGE_SIZE);
    totalSessions = total;
    allSessions   = sessions;
    currentPage   = page;

    listEl.innerHTML = '';

    const filtered = applyFilter(sessions);

    if (filtered.length === 0 && total === 0) {
        emptyEl.style.display = 'block';
        paginEl.style.display = 'none';
        return;
    }
    emptyEl.style.display = 'none';

    filtered.forEach((session, i) => {
        const card = buildSessionCard(session);
        card.style.animationDelay = `${i * 40}ms`;
        listEl.appendChild(card);
    });

    // Pagination
    if (total > PAGE_SIZE) {
        paginEl.style.display = 'flex';
        document.getElementById('page-indicator').textContent = `Page ${page + 1} of ${Math.ceil(total / PAGE_SIZE)}`;
        document.getElementById('prev-page').disabled = (page === 0);
        document.getElementById('next-page').disabled = ((page + 1) * PAGE_SIZE >= total);
    } else {
        paginEl.style.display = 'none';
    }
}

function applyFilter(sessions) {
    if (activeFilter === 'done') {
        return sessions.filter(s => s.completed_steps > 0 && s.completed_steps >= s.total_steps);
    }
    if (activeFilter === 'in-progress') {
        return sessions.filter(s => s.completed_steps > 0 && s.completed_steps < s.total_steps);
    }
    return sessions;
}

// ============================================================
// SESSION CARD
// ============================================================
function buildSessionCard(session) {
    const card = document.createElement('div');
    card.className = 'session-card glass';
    card.dataset.id = session.id;

    const tasks    = session.tasks || [];
    const total    = tasks.length;
    const done     = session.completed_steps || 0;
    const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
    const isFullyDone = done >= total && total > 0;

    const date     = new Date(session.created_at);
    const day      = date.getDate();
    const mon      = date.toLocaleString('en', { month: 'short' });

    const energyScore = session.energy_score ?? 50;
    let energyClass, energyLabel;
    if (energyScore < 30)       { energyClass = 'badge-energy-low';    energyLabel = 'Low energy'; }
    else if (energyScore < 60)  { energyClass = 'badge-energy-medium'; energyLabel = 'Medium energy'; }
    else                         { energyClass = 'badge-energy-high';   energyLabel = 'High energy'; }

    card.innerHTML = `
        <div class="session-header">
            <div class="session-date-badge">
                <div class="session-date-day">${day}</div>
                <div class="session-date-mon">${mon}</div>
            </div>
            <div class="session-main">
                <div class="session-task">${escHtml(session.task_prompt)}</div>
                ${session.feeling ? `<div class="session-feeling">Feeling: ${escHtml(session.feeling)}</div>` : ''}
                <div class="session-meta">
                    <span class="session-badge ${energyClass}">${energyLabel}</span>
                    <span class="session-badge ${isFullyDone ? 'badge-done' : 'badge-progress'}">
                        ${isFullyDone ? '✓ Done' : `${done}/${total} steps`}
                    </span>
                    <span class="session-badge badge-progress">${session.completed_points || 0} pts</span>
                </div>
                <div class="session-progress-bar" style="display:${pct > 0 ? 'block' : 'none'}">
                    <div class="session-progress-fill" style="width:${pct}%"></div>
                </div>
            </div>
            <i class="fas fa-chevron-down session-expand-icon"></i>
            <button class="session-delete" title="Delete session"><i class="fas fa-trash"></i></button>
        </div>
        <div class="session-steps">
            ${tasks.map(t => `
                <div class="step-item">
                    <div class="step-dot ${t.completed ? 'done-dot' : ''} ${t.isMVE && !t.completed ? 'mve-dot' : ''}"></div>
                    <span class="step-text ${t.completed ? 'done-text' : ''}">${escHtml(t.step)}</span>
                    <span class="step-pts">${t.points || 0}pt</span>
                </div>
            `).join('')}
        </div>
    `;

    // Toggle expand
    card.querySelector('.session-header').addEventListener('click', (e) => {
        if (e.target.closest('.session-delete')) return;
        card.classList.toggle('expanded');
    });

    // Delete
    card.querySelector('.session-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this task session?')) return;
        await deleteSession(session.id);
        card.style.transition = 'all 0.2s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => card.remove(), 200);
        // Refresh stats
        if (window.davedUser) loadStats(window.davedUser);
    });

    return card;
}

// ============================================================
// FILTERS
// ============================================================
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;

            const listEl = document.getElementById('history-list');
            listEl.innerHTML = '';
            const filtered = applyFilter(allSessions);

            const emptyEl = document.getElementById('history-empty');
            if (filtered.length === 0) {
                emptyEl.style.display = 'block';
            } else {
                emptyEl.style.display = 'none';
                filtered.forEach((session, i) => {
                    const card = buildSessionCard(session);
                    card.style.animationDelay = `${i * 40}ms`;
                    listEl.appendChild(card);
                });
            }
        });
    });
}

// ============================================================
// PAGINATION
// ============================================================
function setupPagination(user) {
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 0) loadHistory(user, currentPage - 1);
    });
    document.getElementById('next-page').addEventListener('click', () => {
        if ((currentPage + 1) * PAGE_SIZE < totalSessions) loadHistory(user, currentPage + 1);
    });
}

// ============================================================
// UTILS
// ============================================================
function formatDate(iso, longForm = false) {
    if (!iso) return '';
    const d = new Date(iso);
    if (longForm) return d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
