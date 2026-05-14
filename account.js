// ============================================================
// account.js — Profile & History page logic
// Depends on: auth.js
// ============================================================

const PAGE_SIZE = 8;
let currentPage = 0;
let totalSessions = 0;
let allSessions = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    const loadingEl = document.getElementById('loading-state');
    const unauthEl = document.getElementById('unauth-state');
    const contentEl = document.getElementById('profile-content');

    await new Promise(r => setTimeout(r, 400));

    const user = window.davedUser;
    loadingEl.style.display = 'none';

    if (!user) { unauthEl.style.display = 'block'; return; }

    contentEl.style.display = 'block';
    await Promise.all([loadProfile(user), loadHistory(user, 0)]);
    await loadStats(user);
    await loadStreakStats(user);
    setupPagination(user);
    setupFilters();
});

// ============================================================
// CUSTOM CONFIRMATION DIALOG
// ============================================================
function showConfirm({ title, message, note, confirmLabel = 'Delete', confirmClass = 'confirm-danger', onConfirm }) {
    document.getElementById('custom-confirm-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-modal glass">
            <div class="confirm-icon-wrap">
                <div class="confirm-icon"><i class="fas fa-exclamation-triangle"></i></div>
            </div>
            <h3 class="confirm-title">${title}</h3>
            <p class="confirm-message">${message}</p>
            ${note ? `<div class="confirm-note">${note}</div>` : ''}
            <div class="confirm-actions">
                <button class="confirm-cancel-btn" id="confirm-cancel">Cancel</button>
                <button class="confirm-ok-btn ${confirmClass}" id="confirm-ok">${confirmLabel}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('confirm-visible'));

    function close() {
        overlay.classList.remove('confirm-visible');
        setTimeout(() => overlay.remove(), 200);
    }

    overlay.querySelector('#confirm-cancel').addEventListener('click', close);
    overlay.querySelector('#confirm-ok').addEventListener('click', () => { close(); onConfirm(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    const escHandler = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
}

// ============================================================
// PROFILE HEADER
// ============================================================
async function loadProfile(user) {
    const profile = await getProfile(user.id);
    document.getElementById('profile-name').textContent = profile?.full_name || user.email?.split('@')[0] || 'User';
    document.getElementById('profile-email').textContent = user.email || '';
    document.getElementById('profile-joined').textContent = `Joined ${formatDate(profile?.created_at || user.created_at, true)}`;

    const avatarEl = document.getElementById('profile-avatar');
    if (profile?.avatar_url) avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="avatar">`;

    document.getElementById('profile-signout-btn')?.addEventListener('click', () => {
        showConfirm({
            title: 'Sign out',
            message: 'Are you sure you want to sign out of your account?',
            confirmLabel: 'Sign out',
            confirmClass: 'confirm-neutral',
            onConfirm: () => signOut()
        });
    });
}

// ============================================================
// STATS — computed entirely from local session data (no double-count)
// The DB trigger adds total_points on INSERT (all step pts), then
// completed_points delta on UPDATE — causing a double count.
// We bypass user_stats entirely and compute from task sessions directly.
// ============================================================
async function loadStats(user) {
    const { sessions: all } = await getTaskHistory(user.id, 0, 9999);

    const totalCount = all.length;
    const completedSteps = all.reduce((s, ss) => s + (ss.completed_steps || 0), 0);
    const earnedPoints = all.reduce((s, ss) => s + (ss.completed_points || 0), 0);
    const doneSessions = all.filter(ss => ss.total_steps > 0 && ss.completed_steps >= ss.total_steps).length;

    animateNumber('stat-sessions', totalCount);
    animateNumber('stat-steps', completedSteps);
    animateNumber('stat-points', earnedPoints);
    animateNumber('stat-completed', doneSessions);
}

// ============================================================
// STREAK STATS
// ============================================================
async function loadStreakStats(user) {
    try {
        const data = await getStreakData(user.id);
        const streak = data?.current_streak || 0;
        const longest = data?.longest_streak || 0;
        const usedThisMonth = (data?.freezes_month === monthStr()) ? (data?.freezes_used || 0) : 0;
        const freezesLeft = 5 - usedThisMonth;

        animateNumber('stat-streak', streak);

        const metaEl = document.getElementById('streak-meta');
        if (metaEl) {
            metaEl.innerHTML = `
                <span title="Longest streak">Best: ${longest}</span>
                &bull;
                <span title="Streak freezes left this month">❄️ ${freezesLeft}/5</span>
            `;
        }

        // Today's points (capped at 100)
        const todayPts = Math.min(await getTodayPoints(user.id), 100);
        const todayEl = document.getElementById('stat-today-pts');
        if (todayEl) todayEl.textContent = `${todayPts}/100`;

        // All-time total: sum of each day's completed_points, each day capped at 100
        const alltimePts = await getAllTimeDailyPoints(user.id);
        animateNumber('stat-alltime-pts', alltimePts);

        // Streak navbar badge
        const badge = document.getElementById('streak-count');
        if (badge) badge.textContent = streak;
        const streakBtn = document.getElementById('streak-btn');
        const activeToday = data?.last_active_date === todayUTC();
        if (streakBtn) {
            streakBtn.title = streak > 0
                ? `${streak}-day streak · ${freezesLeft} freeze${freezesLeft !== 1 ? 's' : ''} left`
                : 'No streak yet';
            streakBtn.classList.toggle('streak-active', streak > 0 && activeToday);
        }
        // Streak dashboard card
        const streakCard = document.getElementById('streak-stat-card');
        if (streakCard) streakCard.classList.toggle('streak-active', streak > 0 && activeToday);
    } catch (e) {
        console.warn('Streak load failed:', e);
    }
}

async function refreshDailyAndTotalPts() {
    if (!window.davedUser) return;
    try {
        const todayPts = Math.min(await getTodayPoints(window.davedUser.id), 100);
        const todayEl = document.getElementById('stat-today-pts');
        if (todayEl) todayEl.textContent = `${todayPts}/100`;

        const alltimePts = await getAllTimeDailyPoints(window.davedUser.id);
        const allEl = document.getElementById('stat-alltime-pts');
        if (allEl) allEl.textContent = alltimePts.toLocaleString();
    } catch (e) { console.warn('refreshDailyAndTotalPts failed:', e); }
}

function animateNumber(elId, target) {
    const el = document.getElementById(elId);
    if (!el) return;
    const duration = 800;
    const start = performance.now();
    function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(eased * target).toLocaleString();
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// ============================================================
// HISTORY
// ============================================================
async function loadHistory(user, page) {
    const listEl = document.getElementById('history-list');
    const emptyEl = document.getElementById('history-empty');
    const paginEl = document.getElementById('pagination');

    listEl.innerHTML = `<div class="account-loading" style="height:160px;"><div class="loading-spinner"></div></div>`;

    const { sessions, total } = await getTaskHistory(user.id, page, PAGE_SIZE);
    totalSessions = total;
    allSessions = sessions;
    currentPage = page;
    listEl.innerHTML = '';

    if (total === 0) {
        emptyEl.style.display = 'block';
        paginEl.style.display = 'none';
        return;
    }

    const filtered = applyFilter(sessions);
    emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach((session, i) => {
        const card = buildSessionCard(session);
        card.style.animationDelay = `${i * 40}ms`;
        listEl.appendChild(card);
    });

    if (total > PAGE_SIZE) {
        paginEl.style.display = 'flex';
        document.getElementById('page-indicator').textContent = `Page ${page + 1} of ${Math.ceil(total / PAGE_SIZE)}`;
        document.getElementById('prev-page').disabled = page === 0;
        document.getElementById('next-page').disabled = (page + 1) * PAGE_SIZE >= total;
    } else {
        paginEl.style.display = 'none';
    }
}

function applyFilter(sessions) {
    if (activeFilter === 'done')
        return sessions.filter(s => s.total_steps > 0 && s.completed_steps >= s.total_steps);
    if (activeFilter === 'in-progress')
        return sessions.filter(s => s.total_steps > 0 && s.completed_steps < s.total_steps);
    return sessions;
}

// ============================================================
// AI SCORING FOR ADDED STEPS
// ============================================================
async function scoreStepWithAI(stepText) {
    try {
        const res = await fetch('/api/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: stepText })
        });

        if (!res.ok) throw new Error('Backend failed');

        const data = await res.json();
        return data.points || 10;
    } catch (e) {
        console.error("Scoring failed:", e);
        return 10;
    }
}

// ============================================================
// SESSION CARD
// ============================================================
function buildSessionCard(session) {
    const card = document.createElement('div');
    card.className = 'session-card glass';
    card.dataset.id = session.id;

    let tasks = (session.tasks || []).map(t => ({ ...t }));

    function computeMeta() {
        const total = tasks.length;
        const done = tasks.filter(t => t.completed).length;
        const pts = tasks.filter(t => t.completed).reduce((s, t) => s + (t.points || 0), 0);
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return { total, done, pts, pct, isFullyDone: total > 0 && done >= total };
    }

    const date = new Date(session.created_at);
    const day = date.getDate();
    const mon = date.toLocaleString('en', { month: 'short' });

    const energyScore = session.energy_score ?? 50;
    let energyClass, energyLabel;
    if (energyScore < 30) { energyClass = 'badge-energy-low'; energyLabel = 'Low energy'; }
    else if (energyScore < 60) { energyClass = 'badge-energy-medium'; energyLabel = 'Medium energy'; }
    else { energyClass = 'badge-energy-high'; energyLabel = 'High energy'; }

    card.innerHTML = `
        <div class="session-header">
            <div class="session-date-badge">
                <div class="session-date-day">${day}</div>
                <div class="session-date-mon">${mon}</div>
            </div>
            <div class="session-main">
                <div class="session-task">${escHtml(session.task_prompt)}</div>
                ${session.feeling ? `<div class="session-feeling">Feeling: ${escHtml(session.feeling)}</div>` : ''}
                <div class="session-meta" id="meta-${session.id}"></div>
                <div class="session-progress-bar" id="progbar-${session.id}" style="display:none">
                    <div class="session-progress-fill" id="progfill-${session.id}" style="width:0%"></div>
                </div>
            </div>
            <i class="fas fa-chevron-down session-expand-icon"></i>
            <button class="session-delete" title="Delete session"><i class="fas fa-trash"></i></button>
        </div>
        <div class="session-steps" id="steps-${session.id}">
            <div class="steps-inner"></div>
            <div class="add-step-row">
                <button class="add-step-btn"><i class="fas fa-plus"></i> Add step</button>
            </div>
        </div>
    `;

    function syncCache() {
        const si = allSessions.findIndex(s => s.id === session.id);
        if (si !== -1) {
            allSessions[si].tasks = tasks;
            allSessions[si].completed_steps = tasks.filter(t => t.completed).length;
            allSessions[si].completed_points = tasks.filter(t => t.completed).reduce((s, t) => s + (t.points || 0), 0);
        }
    }

    function renderMeta() {
        const { total, done, pts, pct, isFullyDone } = computeMeta();
        card.querySelector(`#meta-${session.id}`).innerHTML = `
            <span class="session-badge ${energyClass}">${energyLabel}</span>
            <span class="session-badge ${isFullyDone ? 'badge-done' : 'badge-progress'}">
                ${isFullyDone ? '✓ Done' : `${done}/${total} steps`}
            </span>
            <span class="session-badge badge-progress">${pts} pts</span>
        `;
        const bar = card.querySelector(`#progbar-${session.id}`);
        const fill = card.querySelector(`#progfill-${session.id}`);
        bar.style.display = pct > 0 ? 'block' : 'none';
        fill.style.width = `${pct}%`;
    }

    function renderSteps() {
        const inner = card.querySelector(`#steps-${session.id} .steps-inner`);
        inner.innerHTML = tasks.map((t, idx) => `
            <div class="step-item" data-idx="${idx}" style="--step-i:${idx}">
                <label class="step-checkbox-label">
                    <input type="checkbox" class="step-checkbox" data-idx="${idx}" ${t.completed ? 'checked' : ''}>
                    <span class="step-dot-custom ${t.completed ? 'done-dot' : ''} ${t.isMVE && !t.completed ? 'mve-dot' : ''}"></span>
                </label>
                <span class="step-text ${t.completed ? 'done-text' : ''}">${escHtml(t.step)}</span>
                <span class="step-pts">${t.points || 0}pt</span>
                <button class="step-delete-btn" data-idx="${idx}" title="Remove step"><i class="fas fa-times"></i></button>
            </div>
        `).join('');

        inner.querySelectorAll('.step-checkbox').forEach(cb => {
            cb.addEventListener('change', async e => {
                const idx = parseInt(e.target.dataset.idx);
                tasks[idx].completed = e.target.checked;
                renderMeta();
                renderSteps();
                syncCache();
                await updateTaskProgress(session.id, tasks);
                if (window.davedUser) { loadStats(window.davedUser); refreshDailyAndTotalPts(); }
            });
        });

        inner.querySelectorAll('.step-delete-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                const step = tasks[idx];
                const pts = step.completed ? (step.points || 0) : 0;
                showConfirm({
                    title: 'Remove step',
                    message: `Remove "<strong>${escHtml(step.step)}</strong>"?`,
                    note: pts > 0 ? `<i class="fas fa-minus-circle"></i> This will deduct <strong>${pts} pts</strong> from your earned score.` : null,
                    confirmLabel: 'Remove',
                    onConfirm: async () => {
                        tasks.splice(idx, 1);
                        renderMeta();
                        renderSteps();
                        syncCache();
                        await updateTaskProgress(session.id, tasks);
                        if (window.davedUser) { loadStats(window.davedUser); refreshDailyAndTotalPts(); }
                    }
                });
            });
        });
    }

    // Add step inline
    card.querySelector('.add-step-btn').addEventListener('click', e => {
        e.stopPropagation();
        const addRow = card.querySelector('.add-step-row');
        if (addRow.querySelector('.add-step-form')) return;

        const form = document.createElement('div');
        form.className = 'add-step-form';
        form.innerHTML = `
            <input type="text" class="add-step-input" placeholder="Describe a new step…" maxlength="200">
            <button class="add-step-cancel" title="Cancel"><i class="fas fa-times"></i></button>
            <button class="add-step-confirm" title="Add"><i class="fas fa-check"></i></button>
        `;
        addRow.appendChild(form);
        form.querySelector('.add-step-input').focus();

        async function submitStep() {
            const input = form.querySelector('.add-step-input');
            const confirmBtn = form.querySelector('.add-step-confirm');
            const text = input.value.trim();
            if (!text) return;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            confirmBtn.disabled = true;
            input.disabled = true;
            const points = await scoreStepWithAI(text);
            const newTask = { step: text, isMVE: false, points, completed: false };
            tasks.push(newTask);
            form.remove();
            renderMeta();
            renderSteps();
            syncCache();
            await updateTaskProgress(session.id, tasks);
        }

        form.querySelector('.add-step-confirm').addEventListener('click', submitStep);
        form.querySelector('.add-step-cancel').addEventListener('click', () => form.remove());
        form.querySelector('.add-step-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') submitStep();
            if (e.key === 'Escape') form.remove();
        });
    });

    renderMeta();
    renderSteps();

    card.querySelector('.session-header').addEventListener('click', e => {
        if (e.target.closest('.session-delete')) return;
        card.classList.toggle('expanded');
    });

    card.querySelector('.session-delete').addEventListener('click', e => {
        e.stopPropagation();
        const earnedPts = tasks.filter(t => t.completed).reduce((s, t) => s + (t.points || 0), 0);
        showConfirm({
            title: 'Delete session',
            message: `Delete this task? <br><em style="font-size:12px;color:#999;">"${escHtml(session.task_prompt)}"</em>`,
            note: earnedPts > 0
                ? `<i class="fas fa-minus-circle"></i> This will remove <strong>${earnedPts} earned pts</strong> from your stats.`
                : null,
            confirmLabel: 'Delete',
            onConfirm: async () => {
                await deleteSession(session.id);
                card.style.transition = 'all 0.2s ease';
                card.style.opacity = '0';
                card.style.transform = 'translateX(20px)';
                setTimeout(() => {
                    card.remove();
                    const si = allSessions.findIndex(s => s.id === session.id);
                    if (si !== -1) allSessions.splice(si, 1);
                }, 200);
                if (window.davedUser) { loadStats(window.davedUser); refreshDailyAndTotalPts(); }
            }
        });
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
            const emptyEl = document.getElementById('history-empty');
            listEl.innerHTML = '';
            const filtered = applyFilter(allSessions);

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
