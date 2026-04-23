document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const promptWrapper    = document.getElementById('prompt-wrapper');
    const tiltBox          = document.getElementById('tilt-box');
    const feelingBox       = document.getElementById('feeling-box');
    const feelingInput     = document.getElementById('feeling-input');
    const taskInput        = document.getElementById('task-input');
    const sendBtn          = document.getElementById('send-btn');
    const resultsContainer = document.getElementById('results');
    const taskList         = document.getElementById('task-list');
    const energyBadge      = document.getElementById('energy-badge');
    const pointsTotal      = document.getElementById('points-total');
    const addTaskBtn       = document.getElementById('add-task-btn');
    const backBtn          = document.getElementById('back-btn');

    let totalPoints = 0;

    // --- PARALLAX EFFECT on feeling box ---
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    let rafId = null;

    function lerp(a, b, t) { return a + (b - a) * t; }

    function animateParallax() {
        targetX = lerp(targetX, mouseX, 0.07);
        targetY = lerp(targetY, mouseY, 0.07);

        const dx = targetX - 0.5;
        const dy = targetY - 0.5;

        feelingBox.style.transform = `translate(${dx * 18}px, ${dy * 10}px)`;

        rafId = requestAnimationFrame(animateParallax);
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX / window.innerWidth;
        mouseY = e.clientY / window.innerHeight;
        if (!rafId) animateParallax();
    });

    document.addEventListener('mouseleave', () => {
        cancelAnimationFrame(rafId);
        rafId = null;
        mouseX = 0.5; mouseY = 0.5;
        // Let it ease back
        function easeBack() {
            targetX = lerp(targetX, 0.5, 0.07);
            targetY = lerp(targetY, 0.5, 0.07);
            const dx = targetX - 0.5;
            const dy = targetY - 0.5;
            feelingBox.style.transform = `translate(${dx * 18}px, ${dy * 10}px)`;
            if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
                rafId = requestAnimationFrame(easeBack);
            } else {
                feelingBox.style.transform = '';
                rafId = null;
            }
        }
        rafId = requestAnimationFrame(easeBack);
    });

    // --- TILT EFFECT (on tiltBox only) ---
    tiltBox.addEventListener('mousemove', (e) => {
        const rect = tiltBox.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotateY = ((x / rect.width) - 0.5) * 8;
        const rotateX = ((y / rect.height) - 0.5) * -8;
        tiltBox.style.transition = 'none';
        tiltBox.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        tiltBox.style.boxShadow = `${-rotateY}px ${-rotateX}px 30px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)`;
    });
    tiltBox.addEventListener('mouseleave', () => {
        tiltBox.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        tiltBox.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
        tiltBox.style.boxShadow = '0 10px 40px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(255,255,255,0.5)';
    });

    // --- AUTO-EXPAND TEXTAREAS with push effect ---
    function autoExpand(el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    // On input, auto-expand AND nudge the other box
    feelingInput.addEventListener('input', () => {
        autoExpand(feelingInput);
        tiltBox.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
        tiltBox.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1) translateY(4px)';
        clearTimeout(feelingInput._nudgeTimer);
        feelingInput._nudgeTimer = setTimeout(() => {
            tiltBox.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1) translateY(0px)';
        }, 300);
    });

    taskInput.addEventListener('input', () => {
        autoExpand(taskInput);
        feelingBox.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
        // Preserve parallax translate while also nudging up
        const dx = (targetX - 0.5) * 18;
        const dy = (targetY - 0.5) * 10;
        feelingBox.style.transform = `translate(${dx}px, ${dy - 4}px)`;
        clearTimeout(taskInput._nudgeTimer);
        taskInput._nudgeTimer = setTimeout(() => {
            feelingBox.style.transition = '';
        }, 300);
    });

    [feelingInput, taskInput].forEach(el => autoExpand(el));

    // --- ENTER TO SEND (Shift+Enter = newline) ---
    [feelingInput, taskInput].forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        });
    });

    // --- NAVBAR ---
    const navButtons = document.querySelectorAll('.nav-buttons .icon-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);
        });
    });

    // --- ACTIVE USERS ---
    const userCountElement = document.getElementById('user-count');
    let currentUsers = 12480;
    setInterval(() => {
        currentUsers += Math.floor(Math.random() * 9) - 4;
        userCountElement.textContent = currentUsers.toLocaleString();
    }, 4500);

    // --- ENERGY SCORE RENDERING (no emojis) ---
    function renderEnergyBadge(score) {
        let cls, label;
        if (score < 30) {
            cls = 'energy-low'; label = 'Low Energy';
        } else if (score < 60) {
            cls = 'energy-medium'; label = 'Medium Energy';
        } else {
            cls = 'energy-high'; label = 'High Energy';
        }
        energyBadge.className = `energy-badge ${cls}`;
        energyBadge.innerHTML = `${label} <span style="opacity:0.5;font-weight:400;margin-left:4px;">(${score}/100)</span>`;
    }

    // --- POINTS LABEL ---
    function ptsClass(pts) {
        if (pts >= 30) return 'pts-hard';
        if (pts >= 15) return 'pts-medium';
        return 'pts-easy';
    }

    // --- BUILD A TASK LIST ITEM ---
    function createTaskItem(task) {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.isMVE ? ' mve' : '');
        li.dataset.points = task.points || 0;

        li.innerHTML = `
            <input type="checkbox" class="task-check" aria-label="Mark task done">
            <div class="task-content">
                <span class="task-text">${task.step}</span>
                <div class="task-meta">
                    ${task.isMVE ? '<span class="task-mve-tag">1% Start</span>' : ''}
                    <span class="task-pts ${ptsClass(task.points || 0)}">${task.points || 0} pts</span>
                </div>
            </div>
            <button class="task-remove" title="Remove task"><i class="fas fa-times"></i></button>
        `;

        // Checkbox toggle
        const checkbox = li.querySelector('.task-check');
        checkbox.addEventListener('change', () => {
            li.classList.toggle('done', checkbox.checked);
            recalcPoints();
        });

        // Remove task
        const removeBtn = li.querySelector('.task-remove');
        removeBtn.addEventListener('click', () => {
            li.style.transition = 'all 0.2s ease';
            li.style.opacity = '0';
            li.style.transform = 'translateX(20px)';
            setTimeout(() => { li.remove(); recalcPoints(); }, 200);
        });

        return li;
    }

    // --- RECALCULATE TOTAL POINTS ---
    function recalcPoints() {
        let earned = 0;
        document.querySelectorAll('.task-item').forEach(item => {
            const checkbox = item.querySelector('.task-check');
            if (checkbox && checkbox.checked) {
                earned += parseInt(item.dataset.points || 0, 10);
            }
        });
        totalPoints = earned;
        pointsTotal.textContent = `${totalPoints} pts`;
    }

    // --- SCORE A SINGLE TASK VIA AI ---
    async function scoreTaskWithAI(stepText) {
        const systemPrompt = `You are a task difficulty evaluator. Given a task step, return ONLY a raw JSON object with a single "points" field (integer). Use this scale:
- Easy / quick (under 5 min): 5–10 pts
- Medium effort (5–15 min): 15–25 pts
- Hard / draining (15+ min or cognitively heavy): 30–50 pts
Return ONLY: {"points": number}`;

        try {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 1000,
                    system: systemPrompt,
                    messages: [{ role: "user", content: stepText }]
                })
            });
            const data = await response.json();
            const text = data.content.map(i => i.text || '').join('');
            const clean = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean);
            return parsed.points || 10;
        } catch (e) {
            console.error('AI scoring failed:', e);
            return 10; // fallback
        }
    }

    // --- ADD TASK INLINE FORM ---
    addTaskBtn.addEventListener('click', () => {
        if (document.querySelector('.add-task-form')) return;

        const form = document.createElement('li');
        form.className = 'add-task-form';
        form.innerHTML = `
            <input type="text" placeholder="Describe a new step…" maxlength="200">
            <button class="cancel-btn">Cancel</button>
            <button class="confirm-btn">Add</button>
        `;
        taskList.appendChild(form);

        const input = form.querySelector('input');
        const confirmBtn = form.querySelector('.confirm-btn');
        const cancelBtn = form.querySelector('.cancel-btn');
        input.focus();

        async function submitNew() {
            const text = input.value.trim();
            if (!text) return;

            // Show loading state
            confirmBtn.textContent = '…';
            confirmBtn.disabled = true;
            input.disabled = true;

            const points = await scoreTaskWithAI(text);
            const newTask = { step: text, isMVE: false, points };
            const li = createTaskItem(newTask);

            // Animate in
            li.style.opacity = '0';
            li.style.transform = 'translateY(8px)';
            taskList.insertBefore(li, form);
            form.remove();
            requestAnimationFrame(() => {
                li.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                li.style.opacity = '1';
                li.style.transform = 'translateY(0)';
            });
        }

        confirmBtn.addEventListener('click', submitNew);
        cancelBtn.addEventListener('click', () => form.remove());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitNew();
            if (e.key === 'Escape') form.remove();
        });
    });

    // --- BACK BUTTON ---
    backBtn.addEventListener('click', () => {
        resultsContainer.classList.remove('show-animated');
        resultsContainer.classList.add('hide-animated');
        setTimeout(() => {
            resultsContainer.style.display = 'none';
            resultsContainer.classList.remove('hide-animated');
            promptWrapper.style.display = 'flex';
            promptWrapper.classList.add('show-animated');
            feelingInput.value = '';
            taskInput.value = '';
            autoExpand(feelingInput);
            autoExpand(taskInput);
            setTimeout(() => promptWrapper.classList.remove('show-animated'), 500);
        }, 400);
    });

    // --- SEND ---
    sendBtn.addEventListener('click', async () => {
        const feeling = feelingInput.value.trim();
        const task    = taskInput.value.trim();

        if (!task) {
            taskInput.focus();
            taskInput.placeholder = 'Please describe your task first…';
            setTimeout(() => { taskInput.placeholder = 'Describe your task…'; }, 2000);
            return;
        }

        const originalIcon = sendBtn.innerHTML;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        sendBtn.disabled = true;

        const combinedPrompt = feeling
            ? `Feeling: ${feeling}\nTask: ${task}`
            : `Task: ${task}`;

        try {
            const response = await fetch('/api/decompose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: combinedPrompt })
            });

            if (!response.ok) throw new Error(`API returned status: ${response.status}`);

            const data = await response.json();

            renderEnergyBadge(data.energy_score);

            taskList.innerHTML = '';
            totalPoints = 0;
            data.tasks.forEach(task => {
                taskList.appendChild(createTaskItem(task));
            });
            pointsTotal.textContent = '0 pts';

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
            sendBtn.disabled = false;
        }
    });
});
