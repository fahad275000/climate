// Global Frontend Application Logic

const API_BASE = window.location.origin;

// Toast Notification System
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} glass-card`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';
  
  toast.innerHTML = `<span style="font-size: 1.25rem;">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Authentication Helpers
function getAuthToken() {
  return localStorage.getItem('token');
}

function getUserRole() {
  return localStorage.getItem('role');
}

function getUsername() {
  return localStorage.getItem('username');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('username');
  showToast("Logged out successfully.", "success");
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
}

function checkAuthentication() {
  const token = getAuthToken();
  const path = window.location.pathname;
  const isLoginPage = path.includes('login.html');
  const isLandingPage = path.includes('index.html') || path === '/' || path === '';
  
  if (!token && !isLoginPage && !isLandingPage) {
    // Redirect unauthenticated users
    window.location.href = 'login.html';
    return false;
  }
  
  if (token && isLoginPage) {
    // Redirect authenticated users trying to access login
    window.location.href = 'dashboard.html';
    return false;
  }
  
  return true;
}

// Protected Fetch Wrapper
async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
  
  if (res.status === 401 || res.status === 403) {
    // Token might be invalid or expired
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
    throw new Error("Session expired. Please log in again.");
  }
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }
  
  return res.json();
}

// Sidebar Navigation Builder
function renderSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;
  
  const activePath = window.location.pathname;
  const role = getUserRole();
  const username = getUsername() || 'Guest';
  const displayRole = role === 'admin' ? 'Administrator' : 'Platform User';
  const initials = username.substring(0, 2).toUpperCase();
  
  const adminLink = role === 'admin' ? `
    <li class="nav-item ${activePath.includes('admin.html') ? 'active' : ''}">
      <a href="admin.html">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
        <span>Admin Panel</span>
      </a>
    </li>
  ` : '';
  
  sidebarContainer.innerHTML = `
    <div class="sidebar">
      <div class="brand">
        <div class="brand-logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
        <div class="brand-name">ClimateRisk</div>
      </div>
      <ul class="nav-links">
        <li class="nav-item ${activePath.includes('dashboard.html') ? 'active' : ''}">
          <a href="dashboard.html">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span>
            <span>Dashboard</span>
          </a>
        </li>
        <li class="nav-item ${activePath.includes('predict.html') ? 'active' : ''}">
          <a href="predict.html">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></span>
            <span>Climate Predictor</span>
          </a>
        </li>
        <li class="nav-item ${activePath.includes('analytics.html') ? 'active' : ''}">
          <a href="analytics.html">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
            <span>ML Analytics</span>
          </a>
        </li>
        <li class="nav-item ${activePath.includes('explorer.html') ? 'active' : ''}">
          <a href="explorer.html">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
            <span>Data Explorer</span>
          </a>
        </li>
        ${adminLink}
      </ul>
      <div class="sidebar-footer">
        <div class="user-profile">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="username">${username}</div>
            <div class="role">${displayRole}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-outline" onclick="logout()" style="width: 100%;">
          <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span> <span>Sign Out</span>
        </button>
      </div>
    </div>
  `;
}

// Theme Management
function initTheme() {
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = currentTheme === 'light' ? '🌙' : '☀️';
    toggleBtn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = activeTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      toggleBtn.innerHTML = newTheme === 'light' ? '🌙' : '☀️';
      showToast(`Switched to ${newTheme} mode.`, "info");
    });
  }
}

// Setup Page when DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  if (checkAuthentication()) {
    renderSidebar();
    initTheme();
  }
});
