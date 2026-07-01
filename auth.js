/* =============================================
   auth.js — shared authentication logic
   ============================================= */

const AUTH = {
    USERS_KEY: 'marks_users',
    SESSION_KEY: 'marks_session',

    // Get all registered users
    getUsers() {
        try {
            return JSON.parse(localStorage.getItem(this.USERS_KEY)) || {};
        } catch { return {}; }
    },

    // Save users object
    saveUsers(users) {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    // Create a new account — returns { ok, error }
    signup(name, username, password) {
        name = name.trim();
        username = username.trim().toLowerCase();
        password = password.trim();

        if (!name || name.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' };
        if (!username || username.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
        if (/[^a-z0-9._]/.test(username)) return { ok: false, error: 'Username can only have letters, numbers, dots, underscores.' };
        if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };

        const users = this.getUsers();
        if (users[username]) return { ok: false, error: 'Username already taken.' };

        users[username] = {
            name,
            username,
            password: this._hash(password),
            createdAt: Date.now(),
        };

        this.saveUsers(users);
        this._setSession(username, name);
        return { ok: true };
    },

    // Log in — returns { ok, error }
    login(username, password) {
        username = username.trim().toLowerCase();
        password = password.trim();

        if (!username || !password) return { ok: false, error: 'Please fill in all fields.' };

        const users = this.getUsers();
        const user = users[username];

        if (!user) return { ok: false, error: 'Account not found.' };
        if (user.password !== this._hash(password)) return { ok: false, error: 'Wrong password.' };

        this._setSession(username, user.name);
        return { ok: true };
    },

    // Log out
    logout() {
        localStorage.removeItem(this.SESSION_KEY);
        window.location.href = 'login.html';
    },

    // Get current session — returns { username, name } or null
    getSession() {
        try {
            const s = JSON.parse(localStorage.getItem(this.SESSION_KEY));
            if (s && s.username && s.name) return s;
        } catch {}
        return null;
    },

    // Check auth — redirect to login if not logged in
    requireAuth() {
        if (!this.getSession()) {
            window.location.href = 'login.html';
            return null;
        }
        return this.getSession();
    },

    // If already logged in, redirect away from login page
    redirectIfLoggedIn() {
        if (this.getSession()) {
            window.location.href = 'index.html';
        }
    },

    // Marks storage key per user
    marksKey(username) {
        return `marks_data_${username}`;
    },

    // --- Internal ---
    _setSession(username, name) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify({ username, name }));
    },

    // Simple hash (not cryptographic — fine for localStorage demo)
    _hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + c;
            hash |= 0;
        }
        return 'h_' + Math.abs(hash).toString(36);
    }
};
