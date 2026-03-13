/**
 * Leviathan 前端认证工具
 * 所有页面引入此文件获取登录状态和用户信息
 */
const AUTH = (() => {
    const AUTH_API = LEVIATHAN_CONFIG.API_V1 + '/auth';

    function getToken() { return localStorage.getItem('token'); }
    function getUser() {
        try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
    }
    function isLoggedIn() { return !!getToken(); }
    function isAdmin() { const u = getUser(); return u && u.role === 'admin'; }
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/pages/auth/login.html';
    }
    function requireLogin() {
        if (!isLoggedIn()) { window.location.href = '/pages/auth/login.html'; return false; }
        return true;
    }
    function authHeaders() {
        const t = getToken();
        return t ? { 'Authorization': `Bearer ${t}` } : {};
    }
    async function refreshUser() {
        const t = getToken();
        if (!t) return null;
        try {
            const resp = await fetch(`${AUTH_API}/me`, { headers: { 'Authorization': `Bearer ${t}` } });
            if (!resp.ok) { logout(); return null; }
            const data = await resp.json();
            if (data.status === 'success') {
                localStorage.setItem('user', JSON.stringify(data.user));
                return data.user;
            }
        } catch { }
        return getUser();
    }

    function renderUserMenu(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const user = getUser();
        if (!user) {
            container.innerHTML = `<a href="/pages/auth/login.html" style="color:var(--accent-cyan);text-decoration:none;font-size:13px">登录</a>`;
            return;
        }
        const isAdm = user.role === 'admin';
        container.innerHTML = `
            <div class="user-menu-trigger" onclick="this.parentElement.classList.toggle('open')">
                ${isAdm ? 'Admin' : user.username}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="user-dropdown">
                ${isAdm ? '<a href="/pages/admin/settings.html" class="dropdown-item">系统设置</a>' : '<a href="/pages/user/recharge.html" class="dropdown-item">用户中心</a>'}
                <a href="#" class="dropdown-item" onclick="AUTH.logout();return false">退出登录</a>
            </div>
        `;
    }

    return { getToken, getUser, isLoggedIn, isAdmin, logout, requireLogin, authHeaders, refreshUser, renderUserMenu };
})();
