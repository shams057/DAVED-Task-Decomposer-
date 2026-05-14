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
    // total_points is 0 on creation — points only accumulate as steps are ticked.
    // This prevents the DB INSERT trigger from adding uncompleted step points to user_stats.
    const payload = tasks.map(t => ({ ...t, completed: false }));

    const { data, error } = await db
        .from('task_sessions')
        .insert({
            user_id: userId,
            feeling: feeling || null,
            task_prompt: taskPrompt,
            energy_score: energyScore,
            tasks: payload,
            total_points: 0,
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
// STREAK & DAILY POINTS HELPERS
// ============================================================

const PTS_DAILY_LIMIT = 100;

/**
 * Get today's date string in YYYY-MM-DD (local time)
 */
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Get current month string YYYY-MM
 */
function monthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

/**
 * Load streak data for user.
 * Returns { current_streak, longest_streak, last_active_date, freezes_used, freezes_month }
 */
async function getStreakData(userId) {
    const { data, error } = await db
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error && error.code !== 'PGRST116') console.error('getStreakData error:', error.message);
    return data || null;
}

/**
 * Get today's date string in YYYY-MM-DD (UTC, so DB queries are consistent)
 */
function todayUTC() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

/**
 * Get the start of the current week (Monday 00:00 UTC) as ISO string.
 */
function weekStartUTC() {
    const d = new Date();
    const day = d.getUTCDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day); // days back to Monday
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10) + 'T00:00:00.000Z';
}

/**
 * Get how many points the user has earned TODAY (capped to daily limit per session).
 * Used for the daily cap enforcement on the main page badge.
 */
async function getTodayPoints(userId) {
    const today = todayUTC();
    const { data, error } = await db
        .from('task_sessions')
        .select('completed_points')
        .eq('user_id', userId)
        .gte('created_at', today + 'T00:00:00.000Z')
        .lte('created_at', today + 'T23:59:59.999Z');
    if (error) { console.error('getTodayPoints error:', error.message); return 0; }
    return (data || []).reduce((s, sess) => s + (sess.completed_points || 0), 0);
}

/**
 * Get how many points the user has earned this week (Mon–Sun).
 * Max 100/day × 7 = 700 possible.
 */
async function getWeekPoints(userId) {
    const weekStart = weekStartUTC();
    const { data, error } = await db
        .from('task_sessions')
        .select('completed_points, created_at')
        .eq('user_id', userId)
        .gte('created_at', weekStart);
    if (error) { console.error('getWeekPoints error:', error.message); return 0; }

    // Group by day, cap each day at 100, then sum
    const byDay = {};
    (data || []).forEach(sess => {
        const day = sess.created_at.slice(0, 10);
        byDay[day] = (byDay[day] || 0) + (sess.completed_points || 0);
    });
    return Object.values(byDay).reduce((sum, dayPts) => sum + Math.min(dayPts, 100), 0);
}

/**
 * Get all-time total points: sum of each calendar day's earned pts, each day capped at 100.
 * This is the "true" total that can never be inflated beyond 100/day.
 */
async function getAllTimeDailyPoints(userId) {
    const { data, error } = await db
        .from('task_sessions')
        .select('completed_points, created_at')
        .eq('user_id', userId);
    if (error) { console.error('getAllTimeDailyPoints error:', error.message); return 0; }

    const byDay = {};
    (data || []).forEach(sess => {
        const day = sess.created_at.slice(0, 10);
        byDay[day] = (byDay[day] || 0) + (sess.completed_points || 0);
    });
    return Object.values(byDay).reduce((sum, dayPts) => sum + Math.min(dayPts, 100), 0);
}

/**
 * Update streak after user earns points today.
 * Called whenever progress is saved.
 */
async function updateStreak(userId) {
    const today = todayStr();
    const streakData = await getStreakData(userId);

    if (!streakData) {
        // First time — create row
        await db.from('user_streaks').insert({
            user_id: userId,
            current_streak: 1,
            longest_streak: 1,
            last_active_date: today,
            freezes_used: 0,
            freezes_month: monthStr()
        });
        return;
    }

    const last = streakData.last_active_date;
    if (last === today) return; // already counted today

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

    let newStreak = streakData.current_streak;
    let freezesUsed = streakData.freezes_used;
    const curMonth = monthStr();
    // Reset freeze count if new month
    if (streakData.freezes_month !== curMonth) freezesUsed = 0;

    if (last === yStr) {
        // Consecutive day
        newStreak += 1;
    } else {
        // Gap — check if freeze can cover it
        const gapDays = Math.floor((new Date(today) - new Date(last)) / 86400000);
        const freezesAvailable = 5 - freezesUsed;
        if (gapDays <= freezesAvailable + 1) {
            // Use freezes
            const freezesToUse = gapDays - 1;
            freezesUsed = Math.min(freezesUsed + freezesToUse, 5);
            newStreak += 1;
        } else {
            // Streak broken
            newStreak = 1;
        }
    }

    const newLongest = Math.max(newStreak, streakData.longest_streak || 0);

    await db.from('user_streaks').update({
        current_streak: newStreak,
        longest_streak: newLongest,
        last_active_date: today,
        freezes_used: freezesUsed,
        freezes_month: curMonth,
        updated_at: new Date().toISOString()
    }).eq('user_id', userId);
}

/**
 * Use a freeze to protect streak (called manually from UI if needed)
 */
async function useFreeze(userId) {
    const streakData = await getStreakData(userId);
    if (!streakData) return false;
    const curMonth = monthStr();
    let freezesUsed = streakData.freezes_month !== curMonth ? 0 : streakData.freezes_used;
    if (freezesUsed >= 5) return false;
    await db.from('user_streaks').update({
        freezes_used: freezesUsed + 1,
        freezes_month: curMonth,
        updated_at: new Date().toISOString()
    }).eq('user_id', userId);
    return true;
}

// ============================================================
// AUTH STATE OBSERVER
// Runs on every page — updates the navbar avatar/icon and
// exposes window.davedUser for other scripts.
// ============================================================
// davedAuthReady resolves once the initial session check is done.
// Other scripts await this before reading window.davedUser.
let _authReadyResolve;
window.davedAuthReady = new Promise(res => { _authReadyResolve = res; });

(async function initAuth() {
    const session = await getSession();
    window.davedUser = session?.user ?? null;
    window.davedSession = null;

    const accountBtn = document.querySelector('#account .icon-btn');

    if (window.davedUser && accountBtn) {
        const profile = await getProfile(window.davedUser.id);
        if (profile?.avatar_url) {
            accountBtn.innerHTML = `<img src="${profile.avatar_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" alt="avatar">`;
        } else {
            accountBtn.innerHTML = `<i class="fas fa-user-check"></i>`;
            accountBtn.style.color = 'var(--primary-blue)';
        }
    }

    // Signal that auth is ready — scripts can now safely read window.davedUser
    _authReadyResolve(window.davedUser);

    // Auth state changes (login via email/password, OAuth redirect on same session)
    db.auth.onAuthStateChange((_event, session) => {
        const wasLoggedOut = !window.davedUser;
        window.davedUser = session?.user ?? null;
        if (wasLoggedOut && window.davedUser) {
            window.dispatchEvent(new Event('davedLoggedIn'));
        }
    });
})();
