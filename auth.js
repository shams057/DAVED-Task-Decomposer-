// ============================================================
// auth.js — DAVED Supabase Auth & DB client
// ============================================================
// SETUP: Replace these two values with your Supabase project's
//        URL and anon key (found in: Settings → API)
// ============================================================

const SUPABASE_URL = 'https://hegpsdvevhvrpdufovnz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZ3BzZHZldmh2cnBkdWZvdm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjI2ODMsImV4cCI6MjA5MjU5ODY4M30.m03mb36z0csDyWmBc-y5MlaCwL_O3jXACYOveRNQros';

// Load Supabase via CDN (add this to your HTML <head>):
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// AUTH HELPERS
// ============================================================

/** Returns the current session (or null if logged out) */
async function getSession() {
    const { data } = await db.auth.getSession();
    return data.session;
}

/** Returns the current user object (or null) */
async function getUser() {
    const { data } = await db.auth.getUser();
    return data.user;
}

/** Sign in with Google (redirects back to current page) */
async function signInWithGoogle() {
    const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/index.html',
            queryParams: { access_type: 'offline', prompt: 'consent' }
        }
    });
    if (error) console.error('Google sign-in error:', error.message);
}

/** Sign out */
async function signOut() {
    await db.auth.signOut();
    window.location.reload();
}

// ============================================================
// PROFILE HELPERS
// ============================================================

async function getProfile(userId) {
    const { data, error } = await db
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) console.error('getProfile error:', error.message);
    return data;
}

async function getUserStats(userId) {
    const { data, error } = await db
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error) console.error('getUserStats error:', error.message);
    return data;
}

// ============================================================
// TASK SESSION HELPERS
// ============================================================

/**
 * Save a new task session after decompose returns.
 * Call this right after rendering results.
 *
 * @param {string}   userId
 * @param {string}   feeling      - user's feeling input (can be '')
 * @param {string}   taskPrompt   - the task text
 * @param {number}   energyScore  - 0–100
 * @param {Array}    tasks        - [{step, isMVE, points, completed: false}]
 * @returns {string|null}  the new session id (for later updates)
 */
async function saveTaskSession(userId, feeling, taskPrompt, energyScore, tasks) {
    const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 0), 0);
    const payload = tasks.map(t => ({ ...t, completed: false }));

    const { data, error } = await db
        .from('task_sessions')
        .insert({
            user_id: userId,
            feeling: feeling || null,
            task_prompt: taskPrompt,
            energy_score: energyScore,
            tasks: payload,
            total_points: totalPoints,
            completed_steps: 0,
            completed_points: 0
        })
        .select('id')
        .single();

    if (error) {
        console.error('saveTaskSession error:', error.message);
        return null;
    }
    return data.id;
}

/**
 * Update task progress (checked steps) for an existing session.
 * Call whenever a checkbox is toggled.
 *
 * @param {string} sessionId  - UUID returned by saveTaskSession
 * @param {Array}  tasks      - full updated tasks array (with completed flags)
 */
async function updateTaskProgress(sessionId, tasks) {
    const completedSteps = tasks.filter(t => t.completed).length;
    const completedPoints = tasks.filter(t => t.completed).reduce((s, t) => s + (t.points || 0), 0);

    const { error } = await db
        .from('task_sessions')
        .update({
            tasks,
            completed_steps: completedSteps,
            completed_points: completedPoints,
            updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

    if (error) console.error('updateTaskProgress error:', error.message);
}

/**
 * Fetch paginated task history for the account page.
 *
 * @param {string} userId
 * @param {number} page   - 0-indexed page number
 * @param {number} limit  - sessions per page (default 10)
 */
async function getTaskHistory(userId, page = 0, limit = 10) {
    const from = page * limit;
    const to = from + limit - 1;

    const { data, error, count } = await db
        .from('task_sessions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        console.error('getTaskHistory error:', error.message);
        return { sessions: [], total: 0 };
    }
    return { sessions: data, total: count };
}

/** Delete a specific session */
async function deleteSession(sessionId) {
    const { error } = await db
        .from('task_sessions')
        .delete()
        .eq('id', sessionId);
    if (error) console.error('deleteSession error:', error.message);
}

// ============================================================
// AUTH STATE OBSERVER
// Runs on every page — updates the navbar avatar/icon and
// exposes window.davedUser for other scripts.
// ============================================================
(async function initAuth() {
    const session = await getSession();
    window.davedUser = session?.user ?? null;
    window.davedSession = null; // current active task session id

    const accountBtn = document.querySelector('#account .icon-btn');
    if (!accountBtn) return;

    if (window.davedUser) {
        const profile = await getProfile(window.davedUser.id);
        if (profile?.avatar_url) {
            accountBtn.innerHTML = `<img src="${profile.avatar_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" alt="avatar">`;
        } else {
            accountBtn.innerHTML = `<i class="fas fa-user-check"></i>`;
            accountBtn.style.color = 'var(--primary-blue)';
        }
    }

    // Auth state changes (login/logout from other tabs, OAuth redirect)
    db.auth.onAuthStateChange((_event, session) => {
        window.davedUser = session?.user ?? null;
    });
})();
