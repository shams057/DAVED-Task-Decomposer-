// ============================================================
// auth-modal.js — Controls the login/signup modal
// Depends on: auth.js (db, signInWithGoogle, signOut, getProfile)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const overlay       = document.getElementById('auth-overlay');
    const closeBtn      = document.getElementById('auth-close');
    const accountBtn    = document.getElementById('account-btn');

    const signinView    = document.getElementById('auth-signin-view');
    const signupView    = document.getElementById('auth-signup-view');
    const userView      = document.getElementById('auth-user-view');

    // ---- Open/close ----
    function openModal() {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        overlay.style.animation = 'none';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.opacity = '';
            overlay.style.transition = '';
            overlay.style.animation = '';
            document.body.style.overflow = '';
        }, 200);
    }

    accountBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // ---- Determine which view to show ----
    async function refreshModalView() {
        const user = window.davedUser;
        if (user) {
            // Logged in — show user info panel
            signinView.style.display = 'none';
            signupView.style.display = 'none';
            userView.style.display = 'block';

            const profile = await getProfile(user.id);
            document.getElementById('auth-user-name').textContent  = profile?.full_name || user.email?.split('@')[0] || 'User';
            document.getElementById('auth-user-email').textContent = user.email || '';

            const avatarEl = document.getElementById('auth-avatar-img');
            if (profile?.avatar_url) {
                avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="avatar">`;
            } else {
                avatarEl.innerHTML = `<i class="fas fa-user"></i>`;
            }
        } else {
            // Not logged in — show sign-in
            showSignin();
        }
    }

    // Run on open
    accountBtn.addEventListener('click', refreshModalView);

    // ---- Switch between sign-in / sign-up ----
    function showSignin() {
        signupView.style.display = 'none';
        userView.style.display   = 'none';
        signinView.style.display = 'block';
    }
    function showSignup() {
        signinView.style.display = 'none';
        userView.style.display   = 'none';
        signupView.style.display = 'block';
    }

    document.getElementById('go-signup').addEventListener('click', showSignup);
    document.getElementById('go-signin').addEventListener('click', showSignin);

    // ---- Google OAuth ----
    document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);
    document.getElementById('google-signup-btn').addEventListener('click', signInWithGoogle);

    // ---- Email/password sign-in ----
    document.getElementById('signin-submit-btn').addEventListener('click', async () => {
        const email    = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;
        const errEl    = document.getElementById('signin-error');
        const btn      = document.getElementById('signin-submit-btn');

        if (!email || !password) {
            showError(errEl, 'Please fill in all fields.');
            return;
        }

        btn.textContent = 'Signing in…';
        btn.disabled = true;
        errEl.style.display = 'none';

        const { error } = await db.auth.signInWithPassword({ email, password });
        btn.textContent = 'Sign in';
        btn.disabled = false;

        if (error) {
            showError(errEl, error.message);
        } else {
            window.davedUser = (await db.auth.getUser()).data.user;
            closeModal();
            // Refresh navbar avatar
            location.reload();
        }
    });

    // ---- Email/password sign-up ----
    document.getElementById('signup-submit-btn').addEventListener('click', async () => {
        const name     = document.getElementById('signup-name').value.trim();
        const email    = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const errEl    = document.getElementById('signup-error');
        const btn      = document.getElementById('signup-submit-btn');

        if (!email || !password) {
            showError(errEl, 'Please fill in all fields.');
            return;
        }
        if (password.length < 8) {
            showError(errEl, 'Password must be at least 8 characters.');
            return;
        }

        btn.textContent = 'Creating account…';
        btn.disabled = true;
        errEl.style.display = 'none';

        const { error } = await db.auth.signUp({
            email, password,
            options: { data: { full_name: name } }
        });

        btn.textContent = 'Create account';
        btn.disabled = false;

        if (error) {
            showError(errEl, error.message);
        } else {
            // Show confirmation message
            signupView.innerHTML = `
                <div style="text-align:center;padding:20px 0;">
                    <div style="font-size:40px;margin-bottom:12px;">📬</div>
                    <h2 class="auth-title">Check your email</h2>
                    <p class="auth-sub">We sent a confirmation link to <strong>${email}</strong>. Click it to activate your account.</p>
                </div>`;
        }
    });

    // ---- Sign out ----
    document.getElementById('signout-btn').addEventListener('click', async () => {
        await signOut();
    });

    // ---- Helper ----
    function showError(el, msg) {
        el.textContent = msg;
        el.style.display = 'block';
    }
});
