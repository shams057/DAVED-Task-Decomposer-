document.addEventListener('DOMContentLoaded', () => {
    const promptWrapper   = document.getElementById('prompt-wrapper');
    const tiltBox         = document.getElementById('tilt-box');
    const feelingBox      = document.getElementById('feeling-box');
    const feelingInput    = document.getElementById('feeling-input');
    const taskInput       = document.getElementById('task-input');
    const sendBtn         = document.getElementById('send-btn');
    const resultsContainer= document.getElementById('results');
    const taskList        = document.getElementById('task-list');
    const energyBadge     = document.getElementById('energy-badge');
    const pointsTotal     = document.getElementById('points-total');
    const addTaskBtn      = document.getElementById('add-task-btn');
    const backBtn         = document.getElementById('back-btn');

    // Daily limit
    const PtsLimit = 100;
    let CurrDayPts = 0;
    let limitToastShown = false;

    let totalPoints = 0;
    let currentSessionId = null;
    let currentTasksState = [];

    // ── Load today's pts once user is known ──
    async function initDayPoints() {
        await window.davedAuthReady;
        if (window.davedUser) {
            CurrDayPts = await getTodayPoints(window.davedUser.id);
        }
        updateDayPtsDisplay();
    }

    function updateDayPtsDisplay() {
        const badge = document.getElementById('daily-pts-badge');
        if (!badge) return;
        const remaining = Math.max(0, PtsLimit - CurrDayPts);
        badge.textContent = remaining <= 0 ? 'Daily limit reached' : `${remaining} pts left today`;
        badge.className = 'daily-pts-badge' + (remaining <= 0 ? ' exhausted' : remaining <= 25 ? ' low' : '');
    }

    function showLimitToast() {
        if (limitToastShown) return;
        limitToastShown = true;
        let toast = document.getElementById('limit-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'limit-toast';
            toast.className = 'limit-toast';
            toast.innerHTML = `<span>You've hit today's 100 pt limit — great work! Come back tomorrow.</span>`;
            document.body.appendChild(toast);
        }
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 400);
            limitToastShown = false;
        }, 4000);
    }

    initDayPoints();

    // ── PARALLAX ──
    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0, rafId = null;
    function lerp(a, b, t) { return a + (b - a) * t; }
    function animateParallax() {
        targetX = lerp(targetX, mouseX, 0.07); targetY = lerp(targetY, mouseY, 0.07);
        const dx = targetX - 0.5, dy = targetY - 0.5;
        feelingBox.style.transform = `translate(${dx * 18}px, ${dy * 10}px)`;
        rafId = requestAnimationFrame(animateParallax);
    }
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX / window.innerWidth; mouseY = e.clientY / window.innerHeight;
        if (!rafId) animateParallax();
    });
    document.addEventListener('mouseleave', () => {
        cancelAnimationFrame(rafId); rafId = null; mouseX = 0.5; mouseY = 0.5;
        function easeBack() {
            targetX = lerp(targetX, 0.5, 0.07); targetY = lerp(targetY, 0.5, 0.07);
            const dx = targetX - 0.5, dy = targetY - 0.5;
            feelingBox.style.transform = `translate(${dx * 18}px, ${dy * 10}px)`;
            if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) rafId = requestAnimationFrame(easeBack);
            else { feelingBox.style.transform = ''; rafId = null; }
        }
        rafId = requestAnimationFrame(easeBack);
    });

    // ── TILT ──
    tiltBox.addEventListener('mousemove', (e) => {
        const rect = tiltBox.getBoundingClientRect();
        const rotateY = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
        const rotateX = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
        tiltBox.style.transition = 'none';
        tiltBox.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        tiltBox.style.boxShadow = `${-rotateY}px ${-rotateX}px 30px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)`;
    });
    tiltBox.addEventListener('mouseleave', () => {
        tiltBox.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        tiltBox.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
        tiltBox.style.boxShadow = '0 10px 40px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(255,255,255,0.5)';
    });

    // ── AUTO-EXPAND ──
    function autoExpand(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
    feelingInput.addEventListener('input', () => {
        autoExpand(feelingInput);
        tiltBox.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
        tiltBox.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1) translateY(4px)';
        clearTimeout(feelingInput._t);
        feelingInput._t = setTimeout(() => { tiltBox.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1) translateY(0px)'; }, 300);
    });
    taskInput.addEventListener('input', () => {
        autoExpand(taskInput);
        feelingBox.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
        const dx = (targetX - 0.5) * 18, dy = (targetY - 0.5) * 10;
        feelingBox.style.transform = `translate(${dx}px, ${dy - 4}px)`;
        clearTimeout(taskInput._t);
        taskInput._t = setTimeout(() => { feelingBox.style.transition = ''; }, 300);
    });
    [feelingInput, taskInput].forEach(el => autoExpand(el));

    // ── ENTER TO SEND ──
    [feelingInput, taskInput].forEach(el => {
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });
    });

    // ── NAVBAR ──
    const navButtons = document.querySelectorAll('.nav-buttons .icon-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);
        });
    });

    // ── ACTIVE USERS ──
    const userCountEl = document.getElementById('user-count');
    let cu = 12480;
    setInterval(() => { cu += Math.floor(Math.random() * 9) - 4; userCountEl.textContent = cu.toLocaleString(); }, 4500);

    // ── ENERGY BADGE ──
    function renderEnergyBadge(score) {
        let cls, label;
        if (score < 30) { cls = 'energy-low'; label = 'Low Energy'; }
        else if (score < 60) { cls = 'energy-medium'; label = 'Medium Energy'; }
        else { cls = 'energy-high'; label = 'High Energy'; }
        energyBadge.className = `energy-badge ${cls}`;
        energyBadge.innerHTML = `${label} <span style="opacity:0.5;font-weight:400;margin-left:4px;">(${score}/100)</span>`;
    }

    function ptsClass(pts) { return pts >= 30 ? 'pts-hard' : pts >= 15 ? 'pts-medium' : 'pts-easy'; }

    // ── CREATE TASK ITEM ──
    function createTaskItem(task, index) {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.isMVE ? ' mve' : '');
        li.dataset.points = task.points || 0;
        li.dataset.index = index;
        li.innerHTML = `
            <input type="checkbox" class="task-check" aria-label="Mark task done" ${task.completed ? 'checked' : ''}>
            <div class="task-content">
                <span class="task-text">${task.step}</span>
                <div class="task-meta">
                    ${task.isMVE ? '<span class="task-mve-tag">1% Start</span>' : ''}
                    <span class="task-pts ${ptsClass(task.points || 0)}">${task.points || 0} pts</span>
                </div>
            </div>
            <button class="task-remove" title="Remove task"><i class="fas fa-times"></i></button>
        `;
        if (task.completed) li.classList.add('done');

        const checkbox = li.querySelector('.task-check');
        checkbox.addEventListener('change', () => {
            li.classList.toggle('done', checkbox.checked);
            const pts = parseInt(li.dataset.points || 0, 10);
            if (checkbox.checked) {
                const remaining = Math.max(0, PtsLimit - CurrDayPts);
                const award = Math.min(pts, remaining);
                CurrDayPts += award;
                if (CurrDayPts >= PtsLimit) showLimitToast();
            } else {
                CurrDayPts = Math.max(0, CurrDayPts - pts);
            }
            updateDayPtsDisplay();
            recalcPoints();
            const idx = parseInt(li.dataset.index, 10);
            if (!isNaN(idx) && currentTasksState[idx]) currentTasksState[idx].completed = checkbox.checked;
            persistProgress();
        });

        li.querySelector('.task-remove').addEventListener('click', () => {
            const cb = li.querySelector('.task-check');
            if (cb.checked) {
                // Deduct from today's counter when a completed step is removed
                CurrDayPts = Math.max(0, CurrDayPts - parseInt(li.dataset.points || 0, 10));
                updateDayPtsDisplay();
            }
            li.style.transition = 'all 0.2s ease';
            li.style.opacity = '0'; li.style.transform = 'translateX(20px)';
            setTimeout(() => { li.remove(); recalcPoints(); }, 200);
        });

        return li;
    }

    // ── PERSIST ──
    async function persistProgress() {
        if (!currentSessionId || !window.davedUser) return;
        try {
            await updateTaskProgress(currentSessionId, currentTasksState);
            await updateStreak(window.davedUser.id);
        } catch (e) { console.warn('Could not persist progress:', e); }
    }

    function recalcPoints() {
        let earned = 0;
        document.querySelectorAll('.task-item').forEach(item => {
            const cb = item.querySelector('.task-check');
            if (cb && cb.checked) earned += parseInt(item.dataset.points || 0, 10);
        });
        totalPoints = earned;
        pointsTotal.textContent = `${totalPoints} pts`;
    }

    async function scoreTaskWithAI(stepText) {
        try {
            const r = await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: stepText }) });
            const d = await r.json(); return d?.points || 10;
        } catch { return 10; }
    }

    // ── ADD TASK ──
    addTaskBtn.addEventListener('click', () => {
        if (document.querySelector('.add-task-form')) return;
        const form = document.createElement('li');
        form.className = 'add-task-form';
        form.innerHTML = `<input type="text" placeholder="Describe a new step…" maxlength="200"><button class="cancel-btn">Cancel</button><button class="confirm-btn">Add</button>`;
        taskList.appendChild(form);
        const input = form.querySelector('input');
        input.focus();
        async function submitNew() {
            const text = input.value.trim(); if (!text) return;
            const confirmBtn = form.querySelector('.confirm-btn');
            confirmBtn.textContent = '…'; confirmBtn.disabled = true; input.disabled = true;
            const points = await scoreTaskWithAI(text);
            const newTask = { step: text, isMVE: false, points, completed: false };
            currentTasksState.push(newTask);
            const li = createTaskItem(newTask, currentTasksState.length - 1);
            li.style.opacity = '0'; li.style.transform = 'translateY(8px)';
            taskList.insertBefore(li, form); form.remove();
            requestAnimationFrame(() => { li.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; li.style.opacity = '1'; li.style.transform = 'translateY(0)'; });
            persistProgress();
        }
        form.querySelector('.confirm-btn').addEventListener('click', submitNew);
        form.querySelector('.cancel-btn').addEventListener('click', () => form.remove());
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') form.remove(); });
    });

    // ── BACK ──
    backBtn.addEventListener('click', () => {
        resultsContainer.classList.remove('show-animated');
        resultsContainer.classList.add('hide-animated');
        setTimeout(() => {
            resultsContainer.style.display = 'none';
            resultsContainer.classList.remove('hide-animated');
            promptWrapper.style.display = 'flex';
            promptWrapper.classList.add('show-animated');
            feelingInput.value = ''; taskInput.value = '';
            autoExpand(feelingInput); autoExpand(taskInput);
            currentSessionId = null; currentTasksState = [];
            setTimeout(() => promptWrapper.classList.remove('show-animated'), 500);
        }, 400);
    });

    // ══════════════════════════════════════════════════════════
    // SEND — login gate + AI validation
    // Pending payload is persisted to sessionStorage so it
    // survives OAuth redirects (Google opens a new page flow).
    // ══════════════════════════════════════════════════════════
    const PENDING_KEY = 'daved_pending_payload';

    sendBtn.addEventListener('click', () => handleSend());

    async function handleSend() {
        const feeling = feelingInput.value.trim();
        const task    = taskInput.value.trim();

        if (!task) {
            taskInput.focus();
            taskInput.placeholder = 'Please describe your task first…';
            setTimeout(() => { taskInput.placeholder = 'Describe your task…'; }, 2000);
            return;
        }

        if (!window.davedUser) {
            // Save payload so it survives a full-page OAuth redirect
            sessionStorage.setItem(PENDING_KEY, JSON.stringify({ feeling, task }));
            openAuthModal();
            showLoginGateHint();
            return;
        }

        await runDecompose(feeling, task);
    }

    // ── Check for pending payload (runs after auth resolves) ──
    // Handles the OAuth redirect case: Google redirects back to the page,
    // Supabase picks up the session, davedAuthReady resolves, we fire decompose.
    async function checkPendingPayload() {
        // Wait for auth.js to finish its session check before reading davedUser
        await window.davedAuthReady;
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (!raw || !window.davedUser) return;
        sessionStorage.removeItem(PENDING_KEY);
        let payload;
        try { payload = JSON.parse(raw); } catch { return; }
        if (payload?.task) {
            feelingInput.value = payload.feeling || '';
            taskInput.value    = payload.task;
            autoExpand(feelingInput); autoExpand(taskInput);
            // Small delay so the page fully renders before the spinner appears
            await new Promise(r => setTimeout(r, 80));
            await runDecompose(payload.feeling || '', payload.task);
        }
    }

    checkPendingPayload();

    async function runDecompose(feeling, task) {
        const originalIcon = sendBtn.innerHTML;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        sendBtn.disabled  = true;

        const combinedPrompt = feeling ? `Feeling: ${feeling}\nTask: ${task}` : `Task: ${task}`;

        try {
            const response = await fetch('/api/decompose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: combinedPrompt })
            });
            if (!response.ok) throw new Error(`API status: ${response.status}`);
            const data = await response.json();

            if (data.invalid) {
                showInputError(data.message || 'Please enter a valid feeling and task.');
                return;
            }

            renderEnergyBadge(data.energy_score);
            taskList.innerHTML = '';
            totalPoints = 0;
            currentTasksState = data.tasks.map(t => ({ ...t, completed: false }));
            currentTasksState.forEach((t, i) => taskList.appendChild(createTaskItem(t, i)));
            pointsTotal.textContent = '0 pts';

            if (window.davedUser) {
                try {
                    currentSessionId = await saveTaskSession(window.davedUser.id, feeling, task, data.energy_score, currentTasksState);
                    await updateStreak(window.davedUser.id);
                    loadStreakBadge();
                } catch (e) { console.warn('Session save failed:', e); }
            }

            promptWrapper.style.transform = '';
            promptWrapper.style.transition = '';
            promptWrapper.classList.add('hide-animated');
            setTimeout(() => {
                promptWrapper.style.display = 'none';
                promptWrapper.classList.remove('hide-animated');
                resultsContainer.style.display = 'block';
                resultsContainer.classList.add('show-animated');
                resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 400);

        } catch (error) {
            console.error('Engine failure:', error);
            alert('The AI brain didn\'t respond. Check the console!');
        } finally {
            sendBtn.innerHTML = originalIcon;
            sendBtn.disabled  = false;
        }
    }

    function showInputError(msg) {
        let el = document.getElementById('input-validation-msg');
        if (!el) {
            el = document.createElement('div');
            el.id = 'input-validation-msg';
            el.className = 'input-validation-msg';
            tiltBox.after(el);
        }
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 5000);
    }

    function showLoginGateHint() {
        let hint = document.getElementById('login-gate-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.id = 'login-gate-hint';
            hint.className = 'login-gate-hint';
            hint.textContent = 'Your task is saved. Sign in or create an account to continue.';
            promptWrapper.appendChild(hint);
        }
        hint.style.display = 'block';
        setTimeout(() => { hint.style.display = 'none'; }, 8000);
    }

    function openAuthModal() {
        const overlay = document.getElementById('auth-overlay');
        if (overlay) { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
        // Refresh modal view (show sign-in)
        const signinView = document.getElementById('auth-signin-view');
        const signupView = document.getElementById('auth-signup-view');
        const userView   = document.getElementById('auth-user-view');
        if (signinView) signinView.style.display = 'block';
        if (signupView) signupView.style.display = 'none';
        if (userView)   userView.style.display   = 'none';
    }

    // ── After email/password login → fire pending ──
    // OAuth redirect is handled by checkPendingPayload. This handler covers
    // in-page email/password login (modal stays open until this fires).
    window.addEventListener('davedLoggedIn', async () => {
        // Close modal smoothly first
        const overlay = document.getElementById('auth-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 0.2s ease';
            overlay.style.opacity = '0';
            await new Promise(r => setTimeout(r, 220));
            overlay.style.display = 'none';
            overlay.style.opacity = '';
            overlay.style.transition = '';
            document.body.style.overflow = '';
        }

        const raw = sessionStorage.getItem(PENDING_KEY);
        if (raw && window.davedUser) {
            sessionStorage.removeItem(PENDING_KEY);
            let payload;
            try { payload = JSON.parse(raw); } catch { payload = null; }
            if (payload?.task) {
                feelingInput.value = payload.feeling || '';
                taskInput.value    = payload.task;
                autoExpand(feelingInput); autoExpand(taskInput);
                // Show the prompt wrapper if it was hidden somehow
                promptWrapper.style.display = 'flex';
                // Brief pause so user sees inputs before spinner
                await new Promise(r => setTimeout(r, 120));
                await runDecompose(payload.feeling || '', payload.task);
                return;
            }
        }
        // No pending payload — refresh badge + streak
        if (window.davedUser) {
            CurrDayPts = await getTodayPoints(window.davedUser.id);
            updateDayPtsDisplay();
            loadStreakBadge();
        }
    });

    // ── Streak badge ──
    async function loadStreakBadge() {
        await window.davedAuthReady;
        const badge     = document.getElementById('streak-count');
        const streakBtn = document.getElementById('streak-btn');
        if (!badge) return;
        if (!window.davedUser) { badge.textContent = '0'; return; }
        try {
            const data    = await getStreakData(window.davedUser.id);
            const streak  = data?.current_streak || 0;
            const used    = (data?.freezes_month === monthStr()) ? (data?.freezes_used || 0) : 0;
            const freezes = 5 - used;
            // Active = user has a streak AND was active today
            const activeToday = data?.last_active_date === todayUTC();
            badge.textContent = streak;
            if (streakBtn) {
                streakBtn.title = streak > 0
                    ? `${streak}-day streak · ${freezes} freeze${freezes !== 1 ? 's' : ''} left this month`
                    : 'No streak yet — complete tasks to start one';
                streakBtn.classList.toggle('streak-active', streak > 0 && activeToday);
            }
        } catch (e) { console.warn('Streak load failed:', e); }
    }

    loadStreakBadge();
});
