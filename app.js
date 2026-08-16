// Simple client-side Document Monitoring System
// Stores documents in localStorage under key 'dms_docs'

const USERS_STORAGE_KEY = 'dms_users_v1';
// Basic demo users and roles
const USERS = {
  admin: { password: 'password', role: 'admin' },
  user: { password: 'password', role: 'user' }
};
// Key used to persist authenticated user across refreshes
const AUTH_KEY = 'dms_auth_v1';
const AUTH_ROLE_KEY = 'dms_auth_role_v1';
const AUTH_TOKEN_KEY = 'dms_auth_token_v1';
let currentUserRole = null;
// Optional server API for shared DB
const API_BASE = '/api';
let USE_SERVER = false;
let WS_CLIENT = null;
let WS_RECONNECT_TIMER = null;

// probe server once
(function(){
  try{
    fetch(API_BASE.replace('/api','') + '/api/ping').then(r => {
      if(r.ok){
        USE_SERVER = true;
        try{ announceStatus('Connected to sync server'); }catch(e){}
        try{ startWebsocket(); }catch(e){}
      }
    }).catch(()=>{});
  }catch(e){}
})();

// start a websocket client to receive server push updates (reconnects automatically)
function startWebsocket(){
  try{
    if(WS_CLIENT && (WS_CLIENT.readyState === WebSocket.OPEN || WS_CLIENT.readyState === WebSocket.CONNECTING)) return;
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = scheme + '//' + location.host + '/ws';
    WS_CLIENT = new WebSocket(wsUrl);
    WS_CLIENT.addEventListener('open', () => { announceStatus('Realtime sync connected'); if(WS_RECONNECT_TIMER){ clearTimeout(WS_RECONNECT_TIMER); WS_RECONNECT_TIMER = null; } });
    WS_CLIENT.addEventListener('message', (ev) => {
    });
    WS_CLIENT.addEventListener('close', () => {
      try{ announceStatus('Realtime sync disconnected'); }catch(e){}
      if(WS_RECONNECT_TIMER) clearTimeout(WS_RECONNECT_TIMER);
      WS_RECONNECT_TIMER = setTimeout(() => { try{ startWebsocket(); }catch(e){} }, 3000);
    });
    WS_CLIENT.addEventListener('error', () => { try{ WS_CLIENT.close(); }catch(e){} });
  }catch(e){}
}


// Elements
const loginSection = document.getElementById('login-section');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const navUser = document.getElementById('nav-user');
const userBtn = document.getElementById('user-btn');
const userMenu = document.getElementById('user-menu');
const navToggle = document.getElementById('nav-toggle');
const navbar = document.querySelector('.navbar');
const NAV_OPEN_KEY = 'dms_nav_open_v1';

// Announce short status messages for screen readers.
function announceStatus(msg){
  try{
    const el = document.getElementById('sr-status');
    if(el){ el.textContent = msg; /* keep briefly */ setTimeout(()=>{ try{ el.textContent = ''; }catch(e){} }, 1200); }
  }catch(e){}
}

// Inactivity logout (1 hour)
const INACTIVITY_MS = 60 * 60 * 1000;
let inactivityTimer = null;
function resetInactivityTimer(){
  try{ localStorage.setItem('dms_last_activity', String(Date.now())); }catch(e){}
  if(inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    // Only sign out if dashboard is visible (i.e., user is logged in)
    if(dashboard && !dashboard.classList.contains('hidden')){
      try{ alert('You have been logged out due to 1 hour of inactivity.'); }catch(e){}
      signOut();
    }
  }, INACTIVITY_MS);
}
function startInactivityWatcher(){
  resetInactivityTimer();
  ['mousemove','keydown','click','touchstart','scroll'].forEach(ev => window.addEventListener(ev, resetInactivityTimer));
}
function stopInactivityWatcher(){
  if(inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
  ['mousemove','keydown','click','touchstart','scroll'].forEach(ev => window.removeEventListener(ev, resetInactivityTimer));
}

function getCandidateDates(dateStr) {
    if (!dateStr) return [];
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return [d];
    return [];
}

// Enhance common toolbar buttons with icons and tooltips
function enhanceToolbarIcons(){
  const map = [
    ['new-doc-btn','New Document', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>'],
    ['refresh-docs','Refresh','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.36-3.36L23 10"></path><path d="M20.49 15a9 9 0 0 1-14.36 3.36L1 14"></path></svg>'],
    ['search-btn','Search','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'],
    ['clear-search','Clear','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'],
    ['download-template','Download Template','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'],
    ['export-csv','Export CSV','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'],
    ['bulk-update','Update Selected','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 11l5-5 5 5"></path></svg>'],
    ['bulk-delete','Delete Selected','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>'],
    ['clear-status-filter','Clear Filter','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'],
    ['clear-wins-filter','Clear WINS Filter','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'],
    ['clear-age-filter','Clear Age Filter','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>']
  ];
  map.forEach(([id, title, svg]) => {
    try{
      const el = document.getElementById(id);
      if(!el) return;
      // keep possible existing label span for responsive show/hide
      const label = el.querySelector('.btn-label');
      el.innerHTML = svg + (label ? label.outerHTML : '');
      el.setAttribute('title', title);
      el.setAttribute('aria-label', title);
      el.classList.add('icon-btn');
    }catch(e){}
  });
}

// run enhancement on load
try{ enhanceToolbarIcons(); }catch(e){}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]);
}

// Render small avatar in navbar. Prefer server avatar when available.
function renderNavAvatar(){
  try{
    const el = document.getElementById('nav-avatar');
    if(!el) return;
    const local = localStorage.getItem('dms_profile_avatar');
    const uname = sessionStorage.getItem(AUTH_KEY) || '';
    // if server available, try fetching server avatar (async) and update when received
    if(USE_SERVER && uname){
      fetch(API_BASE + '/users/' + encodeURIComponent(uname) + '/avatar').then(r => r.json()).then(j => {
        try{
          const a = j && j.avatar ? j.avatar : local;
          if(a) el.innerHTML = '<img src="'+a+'" alt="avatar">'; else { const initials = (uname||'').split(' ').map(s=>s[0]||'').join('').slice(0,2).toUpperCase() || '?'; el.innerHTML = initials; }
        }catch(e){ if(local){ el.innerHTML = '<img src="'+local+'" alt="avatar">'; } }
      }).catch(()=>{ if(local) el.innerHTML = '<img src="'+local+'" alt="avatar">'; else { const initials = (uname||'').split(' ').map(s=>s[0]||'').join('').slice(0,2).toUpperCase() || '?'; el.innerHTML = initials; } });
      return;
    }
    if(local){ el.innerHTML = '<img src="'+local+'" alt="avatar">'; return; }
    const initials = (uname||'').split(' ').map(s=>s[0]||'').join('').slice(0,2).toUpperCase() || '?'; el.innerHTML = initials;
  }catch(e){}
}
window.renderNavAvatar = renderNavAvatar;

// Auth
function signIn(username, password){
  // Try server auth first
  if(USE_SERVER){
    try{
      return fetch(API_BASE + '/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) }).then(r => {
        if(!r.ok) return null;
        return r.json().then(j => {
            try{ sessionStorage.setItem(AUTH_KEY, j.username || username); sessionStorage.setItem(AUTH_ROLE_KEY, j.role || 'user'); if(j.token) sessionStorage.setItem(AUTH_TOKEN_KEY, j.token); }catch(e){}
          return j.role || 'user';
        }).catch(()=>null);
      }).catch(()=>null);
    }catch(e){/* fallthrough */}
  }
  // Fallback to local demo users
  // check persisted users first
  try{
    const stored = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
    if(stored && stored[username] && stored[username].password === password){
      if(stored[username].approved === false) return 'PENDING';
      return stored[username].role || 'user';
    }
  }catch(e){}
  const u = USERS[username];
  if(u && u.password === password) return u.role;
  return null;
}

// Users persistence helpers (client-side demo)
function loadUsers(){
  try{ return JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}'); }catch(e){ return {}; }
}
function saveUsers(obj){
  try{ localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(obj)); }catch(e){}
}
function registerUser(username, password, role){
  if(!username || !password) return { ok:false, error:'username and password required' };
  const users = loadUsers();
  if(users[username]) return { ok:false, error:'username already exists' };
  users[username] = { password, role: role || 'user', createdAt: Date.now(), approved: false };
  saveUsers(users);
  return { ok:true };
}

function showDashboard(userName){
  // remove centered login if present
  if(loginSection) {
    loginSection.classList.add('hidden');
  }
  if(dashboard) dashboard.classList.remove('hidden');
  try{ if(navUser) navUser.style.display = ''; }catch(e){}
  // ensure navbar is visible on the dashboard
  try{ document.body.classList.remove('no-navbar'); }catch(e){}
  if(usernameDisplay) usernameDisplay.textContent = userName;
  // restore role from storage if available
  try{ currentUserRole = sessionStorage.getItem(AUTH_ROLE_KEY) || currentUserRole; }catch(e){}
  try{ adjustUIForRole(); }catch(e){}
  try{ renderNavAvatar(); }catch(e){}
  try{ renderPendingCycleCounts(); }catch(e){}
  startInactivityWatcher();
  try{ announceStatus('Signed in'); }catch(e){}
}

function showLogoutConfirmation() {
  let modal = document.getElementById('logout-confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'logout-confirm-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content card" style="max-width: 300px; text-align: center; margin-top: 15vh;">
        <h3>Confirm Logout</h3>
        <p>Are you sure you want to log out?</p>
        <div style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
          <button id="confirm-logout-btn" style="background: #d9534f; color: white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Logout</button>
          <button id="cancel-logout-btn" style="background: #eee; color: #333; border:1px solid #ccc; padding:8px 16px; border-radius:4px; cursor:pointer;">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    const close = () => modal.classList.add('hidden');
    modal.querySelector('.modal-overlay').addEventListener('click', close);
    document.getElementById('cancel-logout-btn').addEventListener('click', close);
    document.getElementById('confirm-logout-btn').addEventListener('click', () => { close(); signOut(); });
  }
  modal.classList.remove('hidden');
}

function signOut(){
  try{ sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_ROLE_KEY); sessionStorage.removeItem(AUTH_TOKEN_KEY); }catch(e){}
  stopInactivityWatcher();

  if(loginSection) {
    loginSection.classList.remove('hidden');
    if(dashboard) dashboard.classList.add('hidden');
    try{ if(navUser) navUser.style.display = 'none'; }catch(e){}
    // hide navbar on the login screen
    try{ document.body.classList.add('no-navbar'); }catch(e){}
    if(usernameDisplay) usernameDisplay.textContent = '';
    currentUserRole = null;
    try{ announceStatus('Signed out'); }catch(e){}
  } else {
    window.location.href = 'index.html';
  }
}

// Adjust UI and permissions based on role (admin vs user)
function adjustUIForRole(){
  try{ currentUserRole = currentUserRole || sessionStorage.getItem(AUTH_ROLE_KEY) || null; }catch(e){}
  const isAdmin = (currentUserRole === 'admin');
  const roleBadge = document.getElementById('role-badge');

  // Show global controls to all users (both Admin and User)
  if(bulkDeleteBtn) bulkDeleteBtn.style.display = '';
  if(bulkUpdateBtn) bulkUpdateBtn.style.display = '';
  if(importFileInput) importFileInput.style.display = '';
  if(exportCsvBtn) exportCsvBtn.style.display = '';
  if(downloadTemplateBtn) downloadTemplateBtn.style.display = ''; 

  // Update role badge UI
  if(roleBadge){
    roleBadge.textContent = isAdmin ? 'Admin' : (currentUserRole ? 'User' : '');
    roleBadge.style.display = currentUserRole ? '' : 'none';
  }

}

// Events
if(loginForm) loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  const remember = document.getElementById('remember-me');
  if(remember && remember.checked){
    try{ localStorage.setItem('dms_remember_user', u); }catch(e){}
  } else {
    try{ localStorage.removeItem('dms_remember_user'); }catch(e){}
  }
  const maybe = signIn(u,p);
  if(maybe && typeof maybe.then === 'function'){
    maybe.then(role => {
      if(role){ try{ sessionStorage.setItem(AUTH_KEY, u); sessionStorage.setItem(AUTH_ROLE_KEY, role); }catch(e){}
        window.location.href = 'homepage.html';
      } else { alert('Invalid credentials'); }
    }).catch(() => { alert('Invalid credentials'); });
  } else {
    const role = maybe;
    if(role === 'PENDING') { alert('Your account is pending approval by an admin.'); return; }
    if(role){ try{ sessionStorage.setItem(AUTH_KEY, u); sessionStorage.setItem(AUTH_ROLE_KEY, role); }catch(e){}
      window.location.href = 'homepage.html';
    } else { alert('Invalid credentials'); }
  }
});

// Registration form handling
const showRegisterBtn = document.getElementById('show-register');
const registerForm = document.getElementById('register-form');
const cancelRegisterBtn = document.getElementById('cancel-register');
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');

if(showRegisterBtn && loginBox && registerBox){
  showRegisterBtn.addEventListener('click', (ev) => { loginBox.classList.add('hidden'); registerBox.classList.remove('hidden'); });
}
if(cancelRegisterBtn && loginBox && registerBox){
  cancelRegisterBtn.addEventListener('click', (ev) => { 
    registerBox.classList.add('hidden'); loginBox.classList.remove('hidden'); 
    if(registerForm) registerForm.reset(); 
  });
}
if(registerForm){
  registerForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const u = (document.getElementById('reg-username') || {}).value && document.getElementById('reg-username').value.trim();
    const p = (document.getElementById('reg-password') || {}).value;
    const pc = (document.getElementById('reg-password-confirm') || {}).value;
    const role = (document.getElementById('reg-role') || {}).value || 'user';
    if(!u || !p){ alert('Username and password required'); return; }
    if(p !== pc){ alert('Passwords do not match'); return; }
    // Only allow creating admin if there is no admin yet or current session is admin
    const users = loadUsers();
    const hasAdmin = Object.keys(users).some(k => users[k].role === 'admin');
    const currentRole = (sessionStorage.getItem(AUTH_ROLE_KEY) || null);
    if(role === 'admin' && hasAdmin && currentRole !== 'admin'){
      alert('Creating additional admin accounts is restricted.');
      return;
    }

    // If server is available, attempt server-side registration first so accounts persist
    if(USE_SERVER){
      const token = sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
      fetch(API_BASE + '/auth/register', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': token ? ('Bearer ' + token) : '' }, body: JSON.stringify({ username: u, password: p, role }) }).then(r => {
        if(!r.ok){ r.json().then(j => alert(j && j.error ? j.error : 'Registration failed on server')); return; }
        r.json().then(j => {
          // After successful registration, do NOT auto-login; show success and return to login form
          alert('Registration successful. Please sign in using your new credentials.');
          registerForm.classList.add('hidden'); showRegisterBtn.classList.remove('hidden'); registerForm.reset();
        }).catch(()=>{ alert('Registration succeeded but unexpected server response'); });
      }).catch(()=>{ alert('Registration failed (network)'); });
      return;
    }

    const res = registerUser(u,p,role);
    if(!res.ok){ alert(res.error || 'Unable to register'); return; }
    // For local/demo registration, do NOT auto-login; ask user to sign in
    alert('Registration successful. Your account is pending approval by an admin.');
    registerBox.classList.add('hidden'); loginBox.classList.remove('hidden'); registerForm.reset();
  });
}

if(logoutBtn) logoutBtn.addEventListener('click', (e) => {
  e.preventDefault();
  showLogoutConfirmation();
});

// Toggle user dropdown menu when clicking user button
if(userBtn && navUser){
  userBtn.addEventListener('click', (ev) => { ev.stopPropagation(); const open = navUser.classList.toggle('open'); userBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); });
  // close when clicking outside
  document.addEventListener('click', () => { if(navUser) navUser.classList.remove('open'); });
  if(userMenu) userMenu.addEventListener('click', ev => ev.stopPropagation());
  // ensure nav-user hidden by default when not signed in
  try{ if(!usernameDisplay || !usernameDisplay.textContent) navUser.style.display = 'none'; }catch(e){}
}

// Restore persisted hamburger/nav state
try{
  const wasOpen = localStorage.getItem(NAV_OPEN_KEY);
  if(wasOpen === '1' && navbar){ navbar.classList.add('open'); if(navToggle) navToggle.setAttribute('aria-expanded','true'); }
}catch(e){}

// Hamburger nav toggle for small screens
if(navToggle && navbar){
  navToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navbar.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    try{ localStorage.setItem(NAV_OPEN_KEY, isOpen ? '1' : '0'); }catch(e){}
  });
  // close when clicking outside
  document.addEventListener('click', () => { if(navbar && navbar.classList.contains('open')) navbar.classList.remove('open'); });
}

// keyboard accessibility: Esc closes open menus
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' || e.key === 'Esc'){
    try{ if(navUser) navUser.classList.remove('open'); }catch(ex){}
    try{ if(navbar && navbar.classList.contains('open')){ navbar.classList.remove('open'); if(navToggle) navToggle.setAttribute('aria-expanded','false'); } }catch(ex){}
  }
});

// Profile is a standalone page now (profile.html); inline modal handlers removed.

// Forgot password handler (link in login forms)
document.addEventListener('click', (ev) => {
  try{
    const a = ev.target.closest && ev.target.closest('#forgot-password-link');
    if(!a) return;
    ev.preventDefault();
    const u = prompt('Enter your username to reset password:');
    if(!u) return;
    if(USE_SERVER){
      fetch(API_BASE + '/auth/forgot', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: u }) }).then(r => r.json()).then(j => {
        if(!j || !j.ok){ alert(j && j.error ? j.error : 'Unable to request reset'); return; }
        // demo: server returns token; prompt user to enter token + new password
        const token = j.token || '';
        alert('Reset token: ' + token + '\n(For demo only; in production this would be emailed.)');
        const provided = prompt('Enter the reset token you received:');
        if(!provided) return;
        const npw = prompt('Enter your new password:');
        if(!npw) return;
        fetch(API_BASE + '/auth/reset', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: provided, password: npw }) }).then(r2 => r2.json()).then(j2 => {
          if(!j2 || !j2.ok){ alert(j2 && j2.error ? j2.error : 'Reset failed'); return; }
          alert('Password reset. Please sign in.');
        }).catch(()=>{ alert('Reset failed'); });
      }).catch(()=>{ alert('Reset request failed'); });
    } else {
      // local-demo fallback: update persisted users if present
      try{
        const users = loadUsers();
        if(!users[u]){ alert('User not found'); return; }
        const npw = prompt('Enter your new password:');
        if(!npw) return;
        users[u].password = npw;
        saveUsers(users);
        alert('Password reset locally. Please sign in.');
      }catch(e){ alert('Reset failed'); }
    }
  }catch(e){}
});

// Change password implementation (used by profile.html form)
window.changePassword = function(oldPwd, newPwd){
  if(USE_SERVER){
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
    return fetch(API_BASE + '/auth/change', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': token ? ('Bearer ' + token) : '' }, body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }) }).then(r => r.json()).then(j => { return j; }).catch(e => ({ ok:false }));
  }
  // local fallback
  try{
    const current = sessionStorage.getItem(AUTH_KEY);
    if(!current) return Promise.resolve({ ok:false, error:'not signed in' });
    const users = loadUsers();
    if(!users[current]) return Promise.resolve({ ok:false, error:'user not found' });
    if(users[current].password !== oldPwd) return Promise.resolve({ ok:false, error:'invalid old password' });
    users[current].password = newPwd;
    saveUsers(users);
    return Promise.resolve({ ok:true });
  }catch(e){ return Promise.resolve({ ok:false }); }
};

// Debounced auto-search: render as the user types (300ms debounce)
function debounce(fn, wait){
  let timer = null;
  return function(...args){
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}


function generateControlNumber(){
  // Generate control number in the form ECOM-<YEAR>-<4DIGITS>
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000; // 4-digit
  return `ECOM-${year}-${rand}`;
}

function msToDatetimeLocal(ms){
  if(!ms) return '';
  const d = new Date(Number(ms));
  const pad = n => String(n).padStart(2,'0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function datetimeLocalToMs(val){
  if(!val) return null;
  const d = new Date(val);
  if(isNaN(d.getTime())) return null;
  return d.getTime();
}

function formatDateForCSV(ms){
  if(!ms) return '';
  const d = new Date(Number(ms));
  const pad = n => String(n).padStart(2,'0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}


function applyTheme(){
  const theme = localStorage.getItem('ims_theme') || 'light';
  document.body.classList.remove('dark-mode', 'pastel-teal-mode', 'cream-mode', 'navy-blue-mode');
  if(theme === 'dark'){
    document.body.classList.add('dark-mode');
  } else if(theme === 'pastel-teal'){
    document.body.classList.add('pastel-teal-mode');
  } else if(theme === 'cream'){
    document.body.classList.add('cream-mode');
  } else if(theme === 'navy-blue'){
    document.body.classList.add('navy-blue-mode');
  }
}
window.applyTheme = applyTheme;

function toggleTheme(){
  const current = localStorage.getItem('ims_theme') || 'light';
  let next = 'dark';
  if (current === 'dark') next = 'pastel-teal';
  else if (current === 'pastel-teal') next = 'cream';
  else if (current === 'cream') next = 'navy-blue';
  else if (current === 'navy-blue') next = 'light';
  
  localStorage.setItem('ims_theme', next);
  applyTheme();
}
window.toggleTheme = toggleTheme;

function updateAvatar(base64Image){
  if(USE_SERVER){
    const u = sessionStorage.getItem(AUTH_KEY);
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
    if(!u) return Promise.reject('Not logged in');
    return fetch(API_BASE + '/users/' + encodeURIComponent(u) + '/avatar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      body: JSON.stringify({ avatar: base64Image })
    }).then(r => r.json());
  } else {
    try{
      localStorage.setItem('dms_profile_avatar', base64Image);
      renderNavAvatar();
      return Promise.resolve({ ok: true });
    }catch(e){ return Promise.resolve({ ok: false, error: e.message }); }
  }
}
window.updateAvatar = updateAvatar;

// Universal Search Logic
function initUniversalSearch() {
  // Prevent duplicate initialization
  if (document.getElementById('univ-search-modal')) return;

  // Modal HTML
  const modalHtml = `
    <div id="univ-search-modal" class="modal hidden" style="z-index: 11000;">
      <div class="modal-overlay"></div>
      <div class="modal-content card" style="max-width: 600px; margin-top: 10vh; padding: 0; overflow: hidden; display: flex; flex-direction: column; max-height: 80vh;">
        <div style="padding: 15px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 10px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;color:#999"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="univ-search-input" placeholder="Search documents, IRs, inventory..." style="flex: 1; border: none; outline: none; font-size: 16px; background: transparent; color: inherit;">
          <button class="icon-btn close-search" style="font-size: 20px;">&times;</button>
        </div>
        <div id="univ-search-results" style="flex: 1; overflow-y: auto; padding: 0; background: var(--bg);">
          <div style="padding: 20px; text-align: center; color: #999;">Type to search...</div>
        </div>
        <div style="padding: 8px 15px; background: var(--bg); border-top: 1px solid #eee; font-size: 11px; color: #666; display: flex; justify-content: space-between;">
           <span><strong>Enter</strong> to select</span>
           <span><strong>Esc</strong> to close</span>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('univ-search-modal');
  const input = document.getElementById('univ-search-input');
  const resultsContainer = document.getElementById('univ-search-results');
  const closeBtn = modal.querySelector('.close-search');
  const overlay = modal.querySelector('.modal-overlay');

  const closeSearch = () => modal.classList.add('hidden');
  const openSearch = (types) => {
    modal.classList.remove('hidden');
    input.value = '';
    resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Type to search...</div>';
    input.focus();
  };

  closeBtn.addEventListener('click', closeSearch);
  overlay.addEventListener('click', closeSearch);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeSearch();
  });

  input.addEventListener('input', debounce((e) => {
    const query = e.target.value.trim().toLowerCase();
    if (!query) {
      resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Type to search...</div>';
      return;
    }
    performUniversalSearch(query, resultsContainer);
  }, 300));

  // Expose globally
  window.openUniversalSearch = openSearch;

  // Inject Button into Navbar if exists
  const navRight = document.querySelector('.nav-right');
  if (navRight && !document.getElementById('univ-search-btn')) {
    const searchBtn = document.createElement('button');
    searchBtn.id = 'univ-search-btn';
    searchBtn.className = 'notification-btn';
    searchBtn.title = 'Universal Search (Ctrl+K)';
    searchBtn.style.marginRight = '8px';
    searchBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    searchBtn.addEventListener('click', openSearch);
    navRight.insertBefore(searchBtn, navRight.firstChild);
  }
}

function performUniversalSearch(query, container) {
  const results = [];
  try { const irs = JSON.parse(localStorage.getItem('ims_ir_records_v1') || '[]'); irs.forEach(ir => { if ((ir.id && ir.id.toLowerCase().includes(query)) || (ir.description && ir.description.toLowerCase().includes(query))) { results.push({ type: 'Incident Report', title: ir.id, subtitle: ir.description, meta: ir.status, link: `ir_monitoring.html?search=${encodeURIComponent(ir.id)}`, icon: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>' }); } }); } catch (e) {}
  try { const ccs = JSON.parse(localStorage.getItem('ims_cycle_count_v1') || '[]'); ccs.forEach(cc => { if ((cc.itemCode && String(cc.itemCode).toLowerCase().includes(query)) || (cc.location && cc.location.toLowerCase().includes(query))) { results.push({ type: 'Cycle Count', title: cc.itemCode, subtitle: cc.location, meta: `Var: ${cc.physical - cc.system}`, link: `cycle_count.html?search=${encodeURIComponent(cc.itemCode)}`, icon: '<polyline points="23 4 23 10 17 10"></polyline>' }); } }); } catch (e) {}
  try { const atts = JSON.parse(localStorage.getItem('ims_daily_attendance_v1') || '[]'); atts.forEach(a => { if ((a.name && a.name.toLowerCase().includes(query)) || (a.userId && a.userId.toLowerCase().includes(query))) { results.push({ type: 'Attendance', title: a.name, subtitle: a.userId, meta: a.role, link: `all_ic_attendance.html`, icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle>' }); } }); } catch (e) {}
  try { const dcs = JSON.parse(localStorage.getItem('ims_daily_counters_v1') || '[]'); dcs.forEach(dc => { if ((dc.date && dc.date.includes(query)) || (dc.shift && dc.shift.toLowerCase().includes(query))) { results.push({ type: 'Daily Counter', title: dc.date, subtitle: dc.shift, meta: `Req: ${dc.required}`, link: `daily_cycle_count.html`, icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line>' }); } }); } catch (e) {}
  try { const vts = JSON.parse(localStorage.getItem('ims_validation_tasks_v1') || '[]'); vts.forEach(vt => { if ((vt.sku && vt.sku.toLowerCase().includes(query)) || (vt.validator && vt.validator.toLowerCase().includes(query))) { results.push({ type: 'Validation Task', title: vt.sku, subtitle: vt.validator, meta: vt.status, link: `all_ic_attendance.html`, icon: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' }); } }); } catch (e) {}

  let filteredResults = results;
  if (window.univSearchTypes && window.univSearchTypes.length > 0) {
      filteredResults = results.filter(r => window.univSearchTypes.includes(r.type));
  }

  if (filteredResults.length === 0) { container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No results found.</div>'; return; }

  const grouped = filteredResults.reduce((acc, item) => { if (!acc[item.type]) acc[item.type] = []; acc[item.type].push(item); return acc; }, {});
  let html = '';
  for (const type in grouped) {
    html += `<div style="padding: 8px 15px; background: #eee; font-size: 12px; font-weight: bold; color: #666; text-transform: uppercase;">${type}</div>`;
    grouped[type].slice(0, 5).forEach(item => {
      html += `<a href="${item.link}" class="search-result-item" style="display: flex; align-items: center; padding: 10px 15px; border-bottom: 1px solid #eee; text-decoration: none; color: inherit; transition: background 0.2s;">
          <div style="width: 32px; height: 32px; background: #eef2f6; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 12px; color: #2752a7;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px">${item.icon}</svg></div>
          <div style="flex: 1; min-width: 0;"><div style="font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.title)}</div><div style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.subtitle)}</div></div>
          <div style="font-size: 11px; color: #999; background: #f5f5f5; padding: 2px 6px; border-radius: 4px;">${escapeHtml(item.meta)}</div>
        </a>`;
    });
  }
  container.innerHTML = html;
  container.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = '#f0f7ff');
      el.addEventListener('mouseleave', () => el.style.background = 'transparent');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // If you want auto-login during development, uncomment:
  // showDashboard(DEMO_USER.username);
  // If a user was previously signed in, restore their session and show dashboard
  try{
    const storedUser = sessionStorage.getItem(AUTH_KEY);
    if(storedUser){
      showDashboard(storedUser);
    } else {
      // center login form when no user stored
      if(loginSection) loginSection.classList.remove('hidden');
      try{
        const rem = localStorage.getItem('dms_remember_user');
        if(rem && document.getElementById('username')){
          document.getElementById('username').value = rem;
          const rcb = document.getElementById('remember-me');
          if(rcb) rcb.checked = true;
        }
      }catch(e){}
    }
  }catch(e){
    if(loginSection) loginSection.classList.remove('hidden');
  }

  applyTheme();
  
  // Inject Dark Mode toggle in header if not present
  const headerRight = document.querySelector('.header-right');
  if(headerRight && !document.getElementById('theme-toggle')){
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'icon-btn';
    btn.title = 'Toggle Dark Mode';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    btn.addEventListener('click', toggleTheme);
    headerRight.insertBefore(btn, headerRight.firstChild);
  }

  try{ renderNavAvatar(); }catch(e){}
  
  // Initialize Universal Search
  try { initUniversalSearch(); } catch(e) { console.error('Universal Search Init Failed', e); }

  // Add "Forgot password" link to login form (if present)
  try{
    if(loginForm){
      let fp = document.getElementById('forgot-password-link');
      if(!fp){
        fp = document.createElement('button');
        fp.type = 'button';
        fp.id = 'forgot-password-link';
        fp.className = 'icon-btn';
        fp.style.background = 'transparent';
        fp.style.color = 'var(--accent)';
        fp.style.marginTop = '6px';
        fp.textContent = 'Forgot password?';
        loginForm.appendChild(fp);
      }
      fp.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const user = prompt('Enter username to reset password:');
        if(!user) return;
        // If server available, call server reset endpoint
        if(USE_SERVER){
          try{
            const r = await fetch(API_BASE + '/auth/reset', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: user }) });
            if(!r.ok){ const j = await r.json().catch(()=>null); alert('Reset failed: ' + (j && j.error ? j.error : r.status)); return; }
            const j = await r.json().catch(()=>null);
            alert('Password for ' + user + ' has been reset. Temporary password: ' + (j && j.tempPassword ? j.tempPassword : 'password'));
            return;
          }catch(e){ console.error(e); alert('Reset failed'); }
        }
        // fallback: local users or demo users
        try{
          const stored = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '{}');
          if(stored && stored[user]){
            stored[user].password = 'password';
            saveUsers(stored);
            alert('Local user password reset. Temporary password: password');
            return;
          }
        }catch(e){}
        // check built-in demo users
        if(USERS[user]){
          // nothing to persist for built-in demo, just inform
          alert('Demo account. Default temporary password: password');
          return;
        }
        alert('User not found');
      });
    }
  }catch(e){}

  // Sidebar toggle behavior (hide/unhide)
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if(sidebarToggle){
    // restore previous state
    const collapsed = localStorage.getItem('dms_sidebar_collapsed') === '1';
    const sb = document.getElementById('left-sidebar');
    if(collapsed && sb){
      sb.classList.add('collapsed');
      sb.setAttribute('aria-hidden','true');
      sidebarToggle.setAttribute('aria-expanded','false');
      sidebarToggle.textContent = '›';
      sidebarToggle.title = 'Show sidebar';
    }

    // Prevent missing hit area: ensure toggle sits outside normal flow and listens to clicks
    sidebarToggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const sb = document.getElementById('left-sidebar');
      if(!sb) return;
      const isCollapsed = sb.classList.toggle('collapsed');
      sb.setAttribute('aria-hidden', isCollapsed ? 'true' : 'false');
      sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
      sidebarToggle.textContent = isCollapsed ? '›' : '‹';
      sidebarToggle.title = isCollapsed ? 'Show sidebar' : 'Hide sidebar';
      // persist
      try{ localStorage.setItem('dms_sidebar_collapsed', isCollapsed ? '1' : '0'); }catch(e){}
      // re-render sidebar so pagination remains consistent
      renderLeftSidebar();
    });
  }

  // Main App Sidebar Toggle
  const mainSidebarToggle = document.getElementById('main-sidebar-toggle');
  const appSidebar = document.getElementById('app-sidebar');
  if(mainSidebarToggle && appSidebar){
    const collapsed = localStorage.getItem('ims_sidebar_collapsed') === '1';
    if(collapsed){
      appSidebar.classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
    }
    mainSidebarToggle.addEventListener('click', () => {
      const isCollapsed = appSidebar.classList.toggle('collapsed');
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
      localStorage.setItem('ims_sidebar_collapsed', isCollapsed ? '1' : '0');
      setTimeout(() => { if(typeof Chart !== 'undefined'){ Object.values(Chart.instances).forEach(c => c.resize()); } }, 300);
    });
  }

  // Modal elements
  const modal = document.getElementById('doc-modal');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');
  const modalForm = document.getElementById('modal-doc-form');
  const modalCancel = document.getElementById('modal-cancel');
  const modalOpenNew = document.getElementById('modal-open-new');

  function closeModal(){
    if(modal){
      modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
      // remove focus trap
      try{ if(modal._trapHandler) modal.removeEventListener('keydown', modal._trapHandler); }catch(e){}
      try{ if(modal._previouslyFocused) modal._previouslyFocused.focus(); }
      catch(e){}
      try{ announceStatus('Dialog closed'); }catch(e){}
    }
  }
  function openModal(){
    if(modal){
      modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
      // focus trapping: remember previously focused element
      try{ modal._previouslyFocused = document.activeElement; }catch(e){}
      // gather focusable elements inside modal
      try{
        const focusableSelectors = 'a[href], area[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const nodes = modal.querySelectorAll(focusableSelectors);
        modal._focusable = Array.prototype.slice.call(nodes);
        if(modal._focusable.length) modal._focusable[0].focus();
        // trap Tab within modal
        modal._trapHandler = function(e){
          if(e.key === 'Tab'){
            const first = modal._focusable[0];
            const last = modal._focusable[modal._focusable.length - 1];
            if(e.shiftKey){ if(document.activeElement === first){ e.preventDefault(); last.focus(); } }
            else { if(document.activeElement === last){ e.preventDefault(); first.focus(); } }
          }
        };
        modal.addEventListener('keydown', modal._trapHandler);
      }catch(e){}
      try{ announceStatus('Dialog opened'); }catch(e){}
    }
  }

  modalClose && modalClose.addEventListener('click', closeModal);
  modalOverlay && modalOverlay.addEventListener('click', closeModal);
  modalCancel && modalCancel.addEventListener('click', closeModal);
  document.addEventListener('keydown', (ev) => { if(ev.key === 'Escape') closeModal(); });

  // Global Tooltip Initialization (Convert title to data-tooltip for .icon-btn)
  function initTooltips(node = document){
    const elements = node.querySelectorAll ? node.querySelectorAll('.icon-btn[title]') : [];
    elements.forEach(btn => {
      btn.setAttribute('data-tooltip', btn.getAttribute('title'));
      btn.removeAttribute('title');
    });
    if(node.matches && node.matches('.icon-btn[title]')){
      node.setAttribute('data-tooltip', node.getAttribute('title'));
      node.removeAttribute('title');
    }
  }

  const tooltipObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(n => {
        if(n.nodeType === 1) initTooltips(n);
      });
    });
  });
  tooltipObserver.observe(document.body, { childList: true, subtree: true });
  initTooltips();

  // start clock
  updateClock();
  setInterval(updateClock, 1000);
});

function updateClock(){
  const el = document.getElementById('clock');
  if(!el) return;
  const now = new Date();
  // Format: Mon, Dec 15 2026 — 14:05:32
  const datePart = now.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const timePart = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour12: false });
  el.textContent = `${datePart} — ${timePart}`;
}

function exportToCSV(){
  const headers = ['controlNumber','title','notes','owner','status','winsStatus','createdAt','updatedAt'];
  const lines = [headers.join(',')];
  docs.forEach(d => {
    const row = [d.controlNumber, d.title, d.notes || '', d.owner || '', d.status || '', d.winsStatus || '', formatDateForCSV(d.createdAt), formatDateForCSV(d.updatedAt)];
    lines.push(row.map(csvEscape).join(','));
  });
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'documents_export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadTemplate(){
  const headers = ['controlNumber','title','notes','owner','status','winsStatus','createdAt','updatedAt'];
  const example = ['ECOM-20XX-0001','Example Document','Example notes','Alice','Revision','Pending for Approve','',''];
  const csv = headers.join(',') + '\n' + example.map(csvEscape).join(',');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'documents_template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseDateFromCSV(s){
  if(!s || typeof s !== 'string') return null;
  s = s.trim();
  // Try standard parse first
  let d = new Date(s);
  if(!isNaN(d.getTime())) return d.getTime();

  // Fallback: manual parse for dd/mm/yyyy or yyyy-mm-dd with optional time
  const parts = s.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';

  const dParts = datePart.includes('/') ? datePart.split('/') : datePart.split('-');
  if(dParts.length !== 3) return null;

  let yyyy, mm, dd;
  if(datePart.includes('/')){
    // dd/mm/yyyy
    [dd, mm, yyyy] = dParts.map(Number);
  } else {
    // yyyy-mm-dd
    [yyyy, mm, dd] = dParts.map(Number);
  }
  
  const tParts = timePart.split(':');
  const hh = tParts[0] ? Number(tParts[0]) : 0;
  const min = tParts[1] ? Number(tParts[1]) : 0;
  const ss = tParts[2] ? Number(tParts[2]) : 0;

  d = new Date(yyyy, mm-1, dd, hh, min, ss);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function parseCSV(text){
  // Simple CSV parser supporting quoted fields and newlines inside quotes
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    if(inQuotes){
      if(ch === '"'){
        if(text[i+1] === '"'){
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if(ch === '"'){
        inQuotes = true;
      } else if(ch === ','){
        row.push(cur);
        cur = '';
      } else if(ch === '\r'){
        // ignore
      } else if(ch === '\n'){
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  // final
  if(cur !== '' || row.length > 0){
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function importFromCSVText(text){
  const rows = parseCSV(text);
  if(rows.length === 0) return { added:0, updated:0, skipped:0 };
  const header = rows[0].map(h => String(h).trim());
  const mapIndex = {};
  header.forEach((h,i) => mapIndex[h] = i);
  const parsed = [];
  const duplicates = [];
  for(let r=1;r<rows.length;r++){
    const row = rows[r];
    if(row.length === 0) continue;
    const controlNumber = (row[mapIndex['controlNumber']] || '').trim();
    if(!controlNumber) continue;
    const title = (row[mapIndex['title']] || '').trim();
    const notes = (row[mapIndex['notes']] || '').trim();
    const owner = (row[mapIndex['owner']] || '').trim();
    const status = (row[mapIndex['status']] || 'Revision').trim();
    const winsStatus = (row[mapIndex['winsStatus']] || 'Pending for Approve').trim();
    const createdAtRaw = row[mapIndex['createdAt']];
    const updatedAtRaw = row[mapIndex['updatedAt']];
    const createdAt = createdAtRaw ? parseDateFromCSV(createdAtRaw) : null;
    const updatedAt = updatedAtRaw ? parseDateFromCSV(updatedAtRaw) : null;
    const doc = { controlNumber, title, notes, owner, status, winsStatus, createdAt, updatedAt };
    parsed.push(doc);
    if(docs.find(d => d.controlNumber === controlNumber)) duplicates.push(controlNumber);
  }

  let added = 0, updated = 0, skipped = 0;
  let overwriteDuplicates = false;
  if(duplicates.length > 0){
    const shown = duplicates.slice(0,20).join(', ');
    const more = duplicates.length > 20 ? '\n...and ' + (duplicates.length - 20) + ' more' : '';
    overwriteDuplicates = confirm(`Found ${duplicates.length} duplicate control numbers:\n${shown}${more}\n\nPress OK to overwrite duplicates, Cancel to skip duplicates.`);
  }

  parsed.forEach(doc => {
    const idx = docs.findIndex(d => d.controlNumber === doc.controlNumber);
    if(idx >= 0){
      if(overwriteDuplicates){ 
        doc.createdAt = doc.createdAt || docs[idx].createdAt; // use from CSV if valid, else preserve
        doc.updatedAt = doc.updatedAt || Date.now(); // use from CSV if valid, else set to now
        docs[idx] = doc; 
        updated++; 
      }
      else { skipped++; }
    } else { 
      doc.createdAt = doc.createdAt || Date.now(); // use from CSV if valid, else set to now
      doc.updatedAt = doc.updatedAt || Date.now(); // use from CSV if valid, else set to now
      docs.unshift(doc); 
      added++; 
    }
  });

  saveDocs();
  renderDocs();
  return { added, updated, skipped };
}

// --- Notification System ---
const NOTIFICATIONS_KEY = 'dms_notifications_v1';

function loadNotifications() {
  try { return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]'); } catch(e) { return []; }
}

function saveNotifications(list) {
  try { localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list)); } catch(e) {}
}

function addNotification(message, type = 'info') {
  const list = loadNotifications();
  list.unshift({ id: Date.now(), message, type, time: Date.now(), read: false });
  if (list.length > 50) list.pop();
  saveNotifications(list);
  updateNotificationBadge();

  // Show toast popup
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  
  // Reset styles
  toast.style.top = '30px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.fontSize = '16px';
  toast.style.padding = '16px';
  toast.style.width = 'auto';
  toast.style.maxWidth = 'none';
  toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  toast.style.zIndex = '20000';

  if (type === 'reminder') {
      toast.style.backgroundColor = '#8e44ad';
      toast.style.top = '50%';
      toast.style.transform = 'translate(-50%, -50%)';
      toast.style.fontSize = '24px';
      toast.style.padding = '40px';
      toast.style.width = '80%';
      toast.style.maxWidth = '600px';
      toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
      toast.style.zIndex = '21000';
      if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
  } else {
      toast.style.backgroundColor = (type === 'warning' || type === 'error') ? '#e74c3c' : '#2ecc71';
  }

  if (toast.classList.contains('show')) {
    toast.classList.remove('show');
    void toast.offsetWidth; // Force reflow to restart animation
  }
  toast.classList.add('show');

  if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
  toast.hideTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}
window.addNotification = addNotification;

function updateNotificationBadge() {
  const list = loadNotifications();
  const count = list.length;
  const badges = document.querySelectorAll('.notification-badge');
  badges.forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'block' : 'none';
  });
}

function renderNotificationMenu() {
  const menus = document.querySelectorAll('.notification-menu');
  const list = loadNotifications();
  menus.forEach(menu => {
    const listContainer = menu.querySelector('.notification-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    if (list.length === 0) {
      listContainer.innerHTML = '<li class="notification-empty">No notifications</li>';
      return;
    }
    list.forEach(n => {
      const li = document.createElement('li');
      li.className = 'notification-item';
      li.innerHTML = `<div>${n.message}</div><span class="notification-time">${new Date(n.time).toLocaleString()}</span>`;
      listContainer.appendChild(li);
    });
  });
}

function checkStaleData() {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  const check = (key, label, f1, f2) => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(data) || data.length === 0) return;
      
      const lastTime = data.reduce((max, item) => {
        const t1 = item[f1] ? new Date(item[f1]).getTime() : 0;
        const t2 = item[f2] ? new Date(item[f2]).getTime() : 0;
        return Math.max(max, t1 || 0, t2 || 0);
      }, 0);

      if (lastTime > 0 && (now - lastTime > ONE_DAY_MS)) {
        const msg = `Alert: No ${label} activity in 24h.`;
        const notes = loadNotifications();
        // Prevent spamming: check if same alert exists within last 24h
        const recent = notes.some(n => n.message === msg && (now - n.time < ONE_DAY_MS));
        if (!recent) addNotification(msg, 'warning');
      }
    } catch (e) { console.error(e); }
  };

  check('ims_ir_records_v1', 'IR', 'updatedDate', 'date');
  check('ims_cycle_count_v1', 'Cycle Count', 'date', 'createdDate');
}

// Manual Status Reminder Check
setInterval(() => {
    const timesStr = localStorage.getItem('ims_status_reminder_time');
    if (!timesStr) return;
    let times = [];
    try { times = JSON.parse(timesStr); } catch(e) { times = timesStr.split(','); }
    if (!Array.isArray(times)) times = [timesStr];
    const now = new Date();
    const currentHM = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
    const lastAlert = sessionStorage.getItem('ims_last_reminder_alert');
    if (lastAlert === currentHM) return;
    if (times.includes(currentHM)) {
        addNotification("🔔 Reminder: Please update your manual status report.", "reminder");
        sessionStorage.setItem('ims_last_reminder_alert', currentHM);
    }
}, 10000);

function renderPendingCycleCounts() {
  const SCHEDULE_KEY = 'ims_cycle_count_schedule_v1';
  let schedules = [];
  try { schedules = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]'); } catch(e) {}
  const pending = schedules.filter(s => s.status === 'pending').length;

  const dashboard = document.getElementById('dashboard');
  if (dashboard) {
    let widget = document.getElementById('widget-pending-counts');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'widget-pending-counts';
      widget.className = 'card';
      widget.style.cssText = 'background:#fff; padding:15px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1); margin: 0 15px 15px 0; display:inline-block; min-width:200px; vertical-align:top; border-left: 4px solid #e67e22;';
      
      // Insert before the first card or chart if possible
      const firstContainer = dashboard.querySelector('.card') || dashboard.querySelector('#total-docs')?.closest('.card') || dashboard.firstChild;
      if(firstContainer) {
          dashboard.insertBefore(widget, firstContainer);
      } else {
          dashboard.appendChild(widget);
      }
    }
    
    widget.innerHTML = `
      <div style="font-size:12px; color:#666; text-transform:uppercase; font-weight:600;">Pending Cycle Counts</div>
      <div style="font-size:28px; font-weight:bold; color:#e67e22; margin:5px 0;">${pending}</div>
      <div style="font-size:12px;"><a href="cycle_count_schedule.html" style="text-decoration:none; color:#2980b9;">View Schedule &rarr;</a></div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkStaleData();
  updateNotificationBadge();
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.notification-btn');
    if (btn) {
      const menu = btn.nextElementSibling;
      if (menu && menu.classList.contains('notification-menu')) {
        e.stopPropagation();
        const isShow = menu.classList.contains('show');
        document.querySelectorAll('.notification-menu').forEach(m => m.classList.remove('show'));
        if (!isShow) { renderNotificationMenu(); menu.classList.add('show'); }
      }
    } else if (e.target.classList.contains('clear-notifications')) {
      saveNotifications([]); updateNotificationBadge(); renderNotificationMenu();
    } else if (!e.target.closest('.notification-menu')) {
      document.querySelectorAll('.notification-menu').forEach(m => m.classList.remove('show'));
    }
  });
});

// Global Loading Spinner Helpers
window.showLoading = function() { const el = document.getElementById('loading-spinner-overlay'); if(el) el.classList.add('visible'); };
window.hideLoading = function() { const el = document.getElementById('loading-spinner-overlay'); if(el) el.classList.remove('visible'); };

// Inject spinner on load
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('loading-spinner-overlay')) {
    const overlay = document.createElement('div'); overlay.id = 'loading-spinner-overlay'; overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div>'; document.body.appendChild(overlay);
  }
});
