// ============================================================
// FixYa — Lógica principal de la aplicación
// ============================================================
import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { initAuth, getSession, signIn, signUp, signOut, sendPasswordReset, updatePassword } from './auth.js';

const ROLE_LABEL = { cliente: 'Cliente', tecnico: 'Técnico', admin: 'Admin' };

const CATEGORY_ICON = {
  'Plomería': '🔧', 'Electricidad': '⚡', 'Carpintería': '🪚', 'Cerrajería': '🔑',
  'Pintura': '🎨', 'Limpieza': '🧹', 'A/C': '❄️', 'Otro': '✨'
};
function categoryIcon(cat){ return CATEGORY_ICON[cat] || '🛠️'; }

// ============================================================
// Datos de ejemplo (se usan solo si Supabase no está configurado)
// ============================================================
const MOCK_TECHNICIANS = [
  {
    id: 'demo-1', name: 'Jorge Ramírez', specialty: 'Plomería · Electricidad', zone: 'Polanco',
    rating: 4.9, avatar_emoji: '🔧',
    jobs: [
      { title: 'Reparación de fuga en cocina', category: 'Plomería', description: 'Cambio de tubería y sellado completo en 45 minutos.' },
      { title: 'Instalación de calentador', category: 'Plomería', description: 'Instalación nueva con prueba de presión incluida.' },
      { title: 'Apagón parcial resuelto', category: 'Electricidad', description: 'Diagnóstico de corto circuito y reemplazo de breaker.' },
    ]
  },
  {
    id: 'demo-2', name: 'Ana Martínez', specialty: 'Electricidad', zone: 'Condesa',
    rating: 5.0, avatar_emoji: '⚡',
    jobs: [
      { title: 'Instalación de lámparas', category: 'Electricidad', description: 'Cinco puntos de luz nuevos en sala y cocina.' },
      { title: 'Revisión de cableado', category: 'Electricidad', description: 'Diagnóstico completo antes de una remodelación.' },
    ]
  },
  {
    id: 'demo-3', name: 'Luis Torres', specialty: 'Carpintería', zone: 'Santa Fe',
    rating: 4.8, avatar_emoji: '🪚',
    jobs: [
      { title: 'Clóset a la medida', category: 'Carpintería', description: 'Diseño y fabricación en 3 días.' },
      { title: 'Reparación de puertas', category: 'Carpintería', description: 'Ajuste de bisagras y cambio de chapa.' },
    ]
  },
  {
    id: 'demo-4', name: 'Daniela Vega', specialty: 'Pintura · Limpieza', zone: 'Masaryk',
    rating: 4.9, avatar_emoji: '🎨',
    jobs: [
      { title: 'Pintura de departamento completo', category: 'Pintura', description: '65 m² terminados en dos días.' },
      { title: 'Limpieza profunda post-obra', category: 'Limpieza', description: 'Incluye ventanas, pisos y acabados.' },
    ]
  },
];

let demoPortfolio = []; // trabajos que un técnico sube durante esta sesión sin Supabase

// ============================================================
// Utilidades UI
// ============================================================
function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function initials(name){
  return (name || '?').trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase() || '').join('');
}

// ============================================================
// Menú móvil
// ============================================================
const burger = document.getElementById('burgerBtn');
const mobilePanel = document.getElementById('mobilePanel');
burger.addEventListener('click', () => {
  const open = mobilePanel.classList.toggle('open');
  burger.setAttribute('aria-expanded', open);
});
mobilePanel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mobilePanel.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
}));

// ============================================================
// Modal: Iniciar sesión / Crear cuenta
// ============================================================
const authModal = document.getElementById('authModal');
const authModalClose = document.getElementById('authModalClose');
const authTabLogin = document.getElementById('authTabLogin');
const authTabSignup = document.getElementById('authTabSignup');
const loginPanel = document.getElementById('loginPanel');
const signupPanel = document.getElementById('signupPanel');
const resetPanel = document.getElementById('resetPanel');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const resetForm = document.getElementById('resetForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');
const resetError = document.getElementById('resetError');
const resetSuccess = document.getElementById('resetSuccess');
const authConfigNote = document.getElementById('authConfigNote');

if (isSupabaseConfigured) authConfigNote.classList.remove('show');
else authConfigNote.classList.add('show');

function openAuthModal(tab){
  authModal.classList.remove('hidden');
  setAuthTab(tab || 'login');
  loginError.classList.remove('show');
  signupError.classList.remove('show');
  resetError.classList.remove('show');
  resetSuccess.classList.remove('show');
}
function closeAuthModal(){ authModal.classList.add('hidden'); }
function setAuthTab(tab){
  const isLogin = tab === 'login';
  const isReset = tab === 'reset';
  authTabLogin.classList.toggle('active', isLogin);
  authTabSignup.classList.toggle('active', !isLogin && !isReset);
  loginPanel.classList.toggle('active', isLogin);
  signupPanel.classList.toggle('active', !isLogin && !isReset);
  resetPanel.classList.toggle('active', isReset);
}
authTabLogin.addEventListener('click', () => setAuthTab('login'));
authTabSignup.addEventListener('click', () => setAuthTab('signup'));
authModalClose.addEventListener('click', closeAuthModal);
authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });
document.getElementById('gotoReset').addEventListener('click', () => setAuthTab('reset'));
document.getElementById('gotoLoginFromReset').addEventListener('click', () => setAuthTab('login'));

document.querySelectorAll('.js-open-login').forEach(b => b.addEventListener('click', () => openAuthModal('login')));
document.querySelectorAll('.js-open-signup').forEach(b => b.addEventListener('click', () => openAuthModal('signup')));

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.remove('show');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    await signIn({ email, password });
    closeAuthModal();
    loginForm.reset();
  } catch (err) {
    loginError.textContent = err.message || 'No se pudo iniciar sesión.';
    loginError.classList.add('show');
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupError.classList.remove('show');
  const role = document.querySelector('input[name="signupRole"]:checked').value;
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  try {
    await signUp({ email, password, name, role });
    closeAuthModal();
    signupForm.reset();
  } catch (err) {
    signupError.textContent = err.message || 'No se pudo crear la cuenta.';
    signupError.classList.add('show');
  }
});

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resetError.classList.remove('show');
  resetSuccess.classList.remove('show');
  const email = document.getElementById('resetEmail').value.trim();
  try {
    await sendPasswordReset(email);
    resetSuccess.classList.add('show');
    resetForm.reset();
  } catch (err) {
    resetError.textContent = err.message || 'No se pudo enviar el correo de recuperación.';
    resetError.classList.add('show');
  }
});

// ============================================================
// Modal: elegir nueva contraseña (llega desde el link del correo)
// ============================================================
const newPasswordModal = document.getElementById('newPasswordModal');
const newPasswordForm = document.getElementById('newPasswordForm');
const newPasswordError = document.getElementById('newPasswordError');

document.addEventListener('fixya:password-recovery', () => {
  closeAuthModal();
  newPasswordModal.classList.remove('hidden');
});

newPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  newPasswordError.classList.remove('show');
  const password = document.getElementById('newPasswordInput').value;
  try {
    await updatePassword(password);
    newPasswordModal.classList.add('hidden');
    newPasswordForm.reset();
    alert('Tu contraseña se actualizó correctamente.');
  } catch (err) {
    newPasswordError.textContent = err.message || 'No se pudo actualizar la contraseña.';
    newPasswordError.classList.add('show');
  }
});

// ============================================================
// Encabezado: botones de invitado o chip de usuario
// ============================================================
const navAuthArea = document.getElementById('navAuthArea');
const navAuthAreaMobile = document.getElementById('navAuthAreaMobile');

function guestButtonsHTML(){
  return `
    <button class="btn btn-ghost btn-sm js-open-login">Iniciar sesión</button>
    <button class="btn btn-primary btn-sm js-open-signup">Crear cuenta</button>
  `;
}
function userChipHTML(profile){
  const name = profile?.name || 'Usuario';
  const role = ROLE_LABEL[profile?.role] || profile?.role || '';
  return `
    <div class="user-chip">
      <span>${name}</span>
      <span class="role-pill">${role}</span>
      <button class="js-logout">Salir</button>
    </div>
  `;
}
function renderAuthAreas(profile){
  const html = profile ? userChipHTML(profile) : guestButtonsHTML();
  navAuthArea.innerHTML = html;
  navAuthAreaMobile.innerHTML = html;
  wireDynamicButtons(navAuthArea);
  wireDynamicButtons(navAuthAreaMobile);
}
function wireDynamicButtons(container){
  container.querySelectorAll('.js-open-login').forEach(b => b.addEventListener('click', () => openAuthModal('login')));
  container.querySelectorAll('.js-open-signup').forEach(b => b.addEventListener('click', () => openAuthModal('signup')));
  container.querySelectorAll('.js-logout').forEach(b => b.addEventListener('click', handleLogout));
}
async function handleLogout(){
  await signOut();
}
document.querySelectorAll('.js-logout').forEach(b => b.addEventListener('click', handleLogout));

// ============================================================
// Cambio de vista según sesión / rol
// ============================================================
const publicView = document.getElementById('publicView');
const publicFooter = document.getElementById('publicFooter');
const providerView = document.getElementById('providerView');
const providerBottomNav = document.getElementById('providerBottomNav');
const adminView = document.getElementById('adminView');
const misSolicitudesSection = document.getElementById('mis-solicitudes');

function showRoleView(profile){
  const role = profile?.role;

  const showPublic = !profile || role === 'cliente';
  publicView.classList.toggle('hidden', !showPublic);
  publicFooter.classList.toggle('hidden', !showPublic);
  misSolicitudesSection.classList.toggle('hidden', role !== 'cliente');
  if (role === 'cliente') loadMyRequests();

  providerView.classList.toggle('hidden', role !== 'tecnico');
  providerBottomNav.classList.toggle('hidden', role !== 'tecnico');
  adminView.classList.toggle('hidden', role !== 'admin');

  if (role === 'tecnico') {
    document.getElementById('provGreetName').textContent = `${profile.name} 👋`;
    document.getElementById('provNameLabel').textContent = profile.name;
    document.getElementById('provSpecialtyLabel').textContent = profile.specialty || 'Técnico FixYa';
    const sidebarAvatar = document.getElementById('provAvatarInit');
    if (profile.avatar_url) {
      sidebarAvatar.style.backgroundImage = `url('${profile.avatar_url}')`;
      sidebarAvatar.textContent = '';
    } else {
      sidebarAvatar.style.backgroundImage = '';
      sidebarAvatar.textContent = initials(profile.name);
    }
    loadMyPortfolio();
    loadUrgentRequests();
    loadTechnicianStats();
    loadMyProfileForm();
    loadVerificationStatus();
  }
  if (role === 'admin') {
    document.getElementById('adminNameLabel').textContent = profile.name || 'Admin';
    document.getElementById('adminAvatarInit').textContent = initials(profile.name || 'Admin');
    loadAdminSalesData();
    loadAdminVerifications();
  }

  window.scrollTo(0, 0);
}

document.addEventListener('fixya:auth-change', (e) => {
  const { profile } = e.detail;
  renderAuthAreas(profile);
  showRoleView(profile);
});

initAuth();

// ============================================================
// Simulador de solicitud (vista pública)
// ============================================================
(() => {
  const catBtns = document.querySelectorAll('#catGrid .cat-btn');
  const stages = {
    placeholder: document.getElementById('stagePlaceholder'),
    loading: document.getElementById('stageLoading'),
    quote: document.getElementById('stageQuote'),
    success: document.getElementById('stageSuccess'),
  };
  function showStage(name){
    Object.values(stages).forEach(s => s.classList.remove('active'));
    stages[name].classList.add('active');
  }
  let selectedQuote = null;
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showStage('loading');
      setTimeout(() => {
        const { min, max, cat } = btn.dataset;
        selectedQuote = { category: cat, price_min: Number(min), price_max: Number(max) };
        document.getElementById('quotePrice').textContent = `$${min}–$${max}`;
        document.getElementById('quoteEta').textContent = cat;
        showStage('quote');
      }, 700);
    });
  });
  document.getElementById('confirmBtn').addEventListener('click', async () => {
    const { user, profile } = getSession();
    if (!profile) {
      openAuthModal('signup');
      return;
    }
    const address = document.getElementById('quoteAddress').value.trim();
    const description = document.getElementById('quoteDescription').value.trim();
    if (!address) {
      alert('Cuéntanos a dónde tiene que ir el técnico antes de confirmar.');
      document.getElementById('quoteAddress').focus();
      return;
    }
    showStage('success');

    if (isSupabaseConfigured && user && selectedQuote) {
      const { error } = await supabase.from('service_requests').insert({
        client_id: user.id,
        category: selectedQuote.category,
        price_min: selectedQuote.price_min,
        price_max: selectedQuote.price_max,
        address, description,
      });
      if (error) console.error('[FixYa] No se pudo registrar la venta:', error.message);
      else if (typeof loadMyRequests === 'function') loadMyRequests();
    }
    document.getElementById('quoteAddress').value = '';
    document.getElementById('quoteDescription').value = '';
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    document.getElementById('quoteAddress').value = '';
    document.getElementById('quoteDescription').value = '';
    showStage('placeholder');
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    document.getElementById('quoteAddress').value = '';
    document.getElementById('quoteDescription').value = '';
    showStage('placeholder');
  });
})();

// ============================================================
// Directorio de técnicos + modal de portafolio (vista pública)
// ============================================================
const techGrid = document.getElementById('techGrid');
const portfolioModal = document.getElementById('portfolioModal');
const portfolioModalClose = document.getElementById('portfolioModalClose');
const pmAvatar = document.getElementById('pmAvatar');
const pmName = document.getElementById('pmName');
const pmMeta = document.getElementById('pmMeta');
const pmGrid = document.getElementById('pmGrid');

function techAvatarStyle(t){
  return t.avatar_url ? `style="background-image:url('${t.avatar_url}');background-size:cover;background-position:center;"` : '';
}
function verifiedBadgeHTML(t){
  return t.verified ? `<span title="Cuenta verificada" style="color:var(--accent);">✓</span>` : '';
}

function techCardHTML(t){
  return `
    <button type="button" class="tech-card js-view-tech" data-tech-id="${t.id}">
      <div class="tech-avatar" ${techAvatarStyle(t)}>${t.avatar_url ? '' : (t.avatar_emoji || '🛠️')}</div>
      <h3>${t.name} ${verifiedBadgeHTML(t)}</h3>
      <p class="tech-specialty">${t.specialty || ''}</p>
      <div class="tech-meta-row">
        <span class="tech-rating">★ ${Number(t.rating || 5).toFixed(1)}</span>
        <span class="tech-jobs-count">${t.jobCount ?? (t.jobs ? t.jobs.length : 0)} trabajos</span>
      </div>
      ${t.zone ? `<span class="tech-zone">📍 ${t.zone}</span>` : ''}
    </button>
  `;
}

function portfolioItemHTML(job){
  const thumbStyle = job.image_url ? `style="background-image:url('${job.image_url}')"` : '';
  return `
    <div class="portfolio-item">
      <div class="portfolio-thumb" ${thumbStyle}>${job.image_url ? '' : categoryIcon(job.category)}</div>
      <div class="portfolio-item-body">
        <span class="cat-tag">${job.category}</span>
        <h4>${job.title}</h4>
        ${job.description ? `<p>${job.description}</p>` : ''}
      </div>
    </div>
  `;
}

async function openTechPortfolio(techId){
  let tech, jobs;
  if (isSupabaseConfigured) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', techId).single();
    const { data: items } = await supabase.from('portfolio_items').select('*').eq('technician_id', techId).order('created_at', { ascending: false });
    tech = profile;
    jobs = items || [];
  } else {
    tech = MOCK_TECHNICIANS.find(t => t.id === techId);
    jobs = tech?.jobs || [];
  }
  if (!tech) return;

  if (tech.avatar_url) {
    pmAvatar.style.backgroundImage = `url('${tech.avatar_url}')`;
    pmAvatar.style.backgroundSize = 'cover';
    pmAvatar.style.backgroundPosition = 'center';
    pmAvatar.textContent = '';
  } else {
    pmAvatar.style.backgroundImage = '';
    pmAvatar.textContent = tech.avatar_emoji || '🛠️';
  }
  pmName.textContent = tech.name + (tech.verified ? ' ✓' : '');
  pmMeta.textContent = `${tech.specialty || ''}${tech.zone ? ' · ' + tech.zone : ''} · ★ ${Number(tech.rating || 5).toFixed(1)}`;
  pmGrid.innerHTML = jobs.length
    ? jobs.map(portfolioItemHTML).join('')
    : `<p class="portfolio-empty">Este técnico todavía no ha subido trabajos anteriores.</p>`;
  portfolioModal.classList.remove('hidden');
}
portfolioModalClose.addEventListener('click', () => portfolioModal.classList.add('hidden'));
portfolioModal.addEventListener('click', (e) => { if (e.target === portfolioModal) portfolioModal.classList.add('hidden'); });

async function renderTechDirectory(){
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, portfolio_items(count)')
      .eq('role', 'tecnico');
    if (error || !data || data.length === 0) {
      techGrid.innerHTML = `<p class="tech-directory-empty">Todavía no hay técnicos registrados. Sé el primero en crear una cuenta de técnico.</p>`;
      return;
    }
    techGrid.innerHTML = data.map(t => techCardHTML({
      ...t, jobCount: t.portfolio_items?.[0]?.count ?? 0
    })).join('');
  } else {
    techGrid.innerHTML = MOCK_TECHNICIANS.map(techCardHTML).join('');
  }
  techGrid.querySelectorAll('.js-view-tech').forEach(card => {
    card.addEventListener('click', () => openTechPortfolio(card.dataset.techId));
  });
}
renderTechDirectory();

// ============================================================
// Cliente: "Tus solicitudes" (datos reales del cliente en sesión)
// ============================================================
const myRequestsBody = document.getElementById('myRequestsBody');
const myRequestsEmpty = document.getElementById('myRequestsEmpty');

const REQUEST_STATUS_LABEL = {
  confirmada: 'Buscando técnico', aceptada: 'Técnico asignado',
  completada: 'Completado', cancelada: 'Cancelado'
};
const REQUEST_STATUS_CLASS = {
  confirmada: 'active', aceptada: 'active', completada: 'done', cancelada: 'cancel'
};

function myRequestRowHTML(r){
  const date = new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  return `<tr>
    <td>${date}</td>
    <td>${categoryIcon(r.category)} ${r.category}</td>
    <td>$${r.price_min}–$${r.price_max}</td>
    <td><span class="status-pill ${REQUEST_STATUS_CLASS[r.status] || 'active'}">${REQUEST_STATUS_LABEL[r.status] || r.status}</span></td>
  </tr>`;
}

async function loadMyRequests(){
  if (!isSupabaseConfigured || !myRequestsBody) return;
  const { user } = getSession();
  if (!user) return;
  const { data, error } = await supabase
    .from('service_requests').select('*').eq('client_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('[FixYa] Error al leer tus solicitudes:', error.message); return; }
  const rows = data || [];
  if (rows.length === 0) {
    myRequestsBody.innerHTML = '';
    myRequestsEmpty.style.display = 'block';
  } else {
    myRequestsEmpty.style.display = 'none';
    myRequestsBody.innerHTML = rows.map(myRequestRowHTML).join('');
  }
}

// ============================================================
// Panel de técnico: solicitudes urgentes + historial (datos reales)
// ============================================================
const reqList = document.getElementById('reqList');
const emptyState = document.getElementById('emptyState');
const statActive = document.getElementById('statActive');
const reqCountTop = document.getElementById('reqCountTop');
const provHistoryBody = document.getElementById('provHistoryBody');
const provHistoryEmpty = document.getElementById('provHistoryEmpty');
const provEarningsMonth = document.getElementById('provEarningsMonth');
const provEarningsSub = document.getElementById('provEarningsSub');
const provServicesMonth = document.getElementById('provServicesMonth');

function fmtMXN(n){ return '$' + Math.round(n).toLocaleString('es-MX'); }

function timeAgo(dateStr){
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  return `hace ${Math.round(diffMin / 60)} h`;
}

function urgentReqCardHTML(r){
  return `
    <div class="req-card" data-id="${r.id}">
      <div class="req-top">
        <div class="req-cat"><div class="ic">${categoryIcon(r.category)}</div><div><strong>${r.category}</strong><span>${r.address ? '📍 ' + r.address : 'Sin dirección'} · Solicitada ${timeAgo(r.created_at)}</span></div></div>
        <div class="req-price">$${r.price_min}–$${r.price_max}</div>
      </div>
      ${r.description ? `<div class="req-meta">"${r.description}"</div>` : ''}
      <div class="req-meta"><span class="urgency medium">Sin asignar · MXN, cotización del cliente</span></div>
      <div class="req-actions"><button class="decline" data-id="${r.id}">Ocultar</button><button class="accept" data-id="${r.id}">Aceptar</button></div>
    </div>
  `;
}

async function loadUrgentRequests(){
  if (!isSupabaseConfigured) {
    reqList.innerHTML = '';
    emptyState.style.display = 'block';
    reqCountTop.textContent = '0';
    return;
  }
  const { data, error } = await supabase
    .from('service_requests')
    .select('*')
    .is('technician_id', null)
    .eq('status', 'confirmada')
    .order('created_at', { ascending: false });
  if (error) { console.error('[FixYa] Error al leer solicitudes:', error.message); return; }
  const rows = data || [];
  reqCountTop.textContent = rows.length;
  if (rows.length === 0) {
    reqList.innerHTML = '';
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    reqList.innerHTML = rows.map(urgentReqCardHTML).join('');
  }
}

async function handleAcceptRequest(id){
  const { user } = getSession();
  if (!user) return;
  const { error } = await supabase
    .from('service_requests')
    .update({ technician_id: user.id, status: 'aceptada' })
    .eq('id', id);
  if (error) { alert('No se pudo aceptar la solicitud (puede que ya la haya tomado otro técnico): ' + error.message); }
  await loadUrgentRequests();
  await loadTechnicianStats();
}

reqList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const card = btn.closest('.req-card');
  if (btn.classList.contains('accept')) {
    handleAcceptRequest(btn.dataset.id);
  } else {
    // "Ocultar" solo la quita de tu pantalla; sigue disponible para otros técnicos.
    card.classList.add('handled');
    setTimeout(() => { card.style.display = 'none'; }, 320);
  }
});

function historyRowHTML(r){
  const date = new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  const avg = (Number(r.price_min) + Number(r.price_max)) / 2;
  const pillClass = r.status === 'completada' ? 'done' : (r.status === 'cancelada' ? 'cancel' : 'active');
  const pillLabel = r.status === 'completada' ? 'Completado' : (r.status === 'cancelada' ? 'Cancelado' : 'Aceptada');
  return `<tr><td>${date}</td><td>${categoryIcon(r.category)} ${r.category}</td><td>${fmtMXN(avg)}</td><td><span class="status-pill ${pillClass}">${pillLabel}</span></td></tr>`;
}

async function loadTechnicianStats(){
  const { user } = getSession();
  if (!user || !isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from('service_requests').select('*').eq('technician_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('[FixYa] Error al leer tu historial:', error.message); return; }
  const rows = data || [];

  if (rows.length === 0) {
    provHistoryBody.innerHTML = '';
    provHistoryEmpty.style.display = 'block';
  } else {
    provHistoryEmpty.style.display = 'none';
    provHistoryBody.innerHTML = rows.map(historyRowHTML).join('');
  }

  const active = rows.filter(r => r.status === 'aceptada');
  statActive.textContent = active.length;

  const now = new Date();
  const thisMonth = rows.filter(r => {
    const d = new Date(r.created_at);
    return (r.status === 'aceptada' || r.status === 'completada')
      && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const gross = thisMonth.reduce((sum, r) => sum + (Number(r.price_min) + Number(r.price_max)) / 2, 0);
  provEarningsMonth.textContent = fmtMXN(gross * 0.85);
  provEarningsSub.textContent = thisMonth.length > 0
    ? `Neto de ${thisMonth.length} servicio${thisMonth.length === 1 ? '' : 's'} (comisión de FixYa ya descontada)`
    : 'Aún sin servicios aceptados';
  provServicesMonth.textContent = thisMonth.length;
}

(() => {
  const statusToggle = document.getElementById('statusToggle');
  const statusLabel = document.getElementById('statusLabel');
  const statusSwitch = document.getElementById('statusSwitch');
  statusToggle.addEventListener('click', () => {
    const isOn = statusSwitch.classList.toggle('on');
    statusToggle.classList.toggle('online', isOn);
    statusLabel.textContent = isOn ? 'Disponible' : 'No disponible';
  });

  const slider = document.getElementById('svcSlider');
  const svcVal = document.getElementById('svcVal');
  const calcMonthly = document.getElementById('calcMonthly');
  const calcGross = document.getElementById('calcGross');
  const calcFee = document.getElementById('calcFee');
  const calcNet = document.getElementById('calcNet');
  const TICKET = 800, COMMISSION = 0.15;
  function fmt(n){ return '$' + n.toLocaleString('es-MX'); }
  function recalc(){
    const perWeek = Number(slider.value);
    svcVal.textContent = perWeek;
    const monthly = perWeek * 4;
    const gross = monthly * TICKET;
    const fee = gross * COMMISSION;
    calcMonthly.textContent = monthly;
    calcGross.textContent = fmt(gross);
    calcFee.textContent = '-' + fmt(fee);
    calcNet.textContent = fmt(gross - fee);
  }
  slider.addEventListener('input', recalc);
  recalc();
})();

// ============================================================
// Panel de técnico: Mi Portafolio (subir trabajos anteriores)
// ============================================================
const portfolioForm = document.getElementById('portfolioForm');
const myPortfolioGrid = document.getElementById('myPortfolioGrid');
const portfolioModeTag = document.getElementById('portfolioModeTag');
const portfolioConfigNote = document.getElementById('portfolioConfigNote');

if (isSupabaseConfigured) {
  portfolioModeTag.textContent = 'Sincronizado con Supabase';
  portfolioConfigNote.classList.remove('show');
} else {
  portfolioModeTag.textContent = 'Modo demo (sin guardar)';
  portfolioConfigNote.classList.add('show');
}

function myPortfolioItemHTML(job){
  const thumbStyle = job.image_url ? `style="background-image:url('${job.image_url}')"` : '';
  return `
    <div class="portfolio-item" data-id="${job.id || ''}">
      <div class="portfolio-thumb" ${thumbStyle}>${job.image_url ? '' : categoryIcon(job.category)}</div>
      <div class="portfolio-item-body">
        <span class="cat-tag">${job.category}</span>
        <h4>${job.title}</h4>
        ${job.description ? `<p>${job.description}</p>` : ''}
      </div>
      <div class="portfolio-item-actions">
        <button type="button" class="btn btn-danger-ghost btn-sm js-delete-job" data-id="${job.id || ''}">Eliminar</button>
      </div>
    </div>
  `;
}

function renderMyPortfolio(items){
  myPortfolioGrid.innerHTML = items.length
    ? items.map(myPortfolioItemHTML).join('')
    : `<p class="portfolio-empty">Aún no has subido trabajos. ¡Sube el primero arriba!</p>`;
  myPortfolioGrid.querySelectorAll('.js-delete-job').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteJob(btn.dataset.id));
  });
  const countEl = document.getElementById('provPortfolioCount');
  if (countEl) countEl.textContent = items.length;
}

async function loadMyPortfolio(){
  const { user } = getSession();
  if (!user) return;
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('portfolio_items').select('*').eq('technician_id', user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    renderMyPortfolio(data || []);
  } else {
    renderMyPortfolio(demoPortfolio);
  }
}

async function handleDeleteJob(id){
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('portfolio_items').delete().eq('id', id);
    if (error) { alert('No se pudo eliminar: ' + error.message); return; }
    loadMyPortfolio();
  } else {
    demoPortfolio = demoPortfolio.filter(j => String(j.id) !== String(id));
    renderMyPortfolio(demoPortfolio);
  }
}

portfolioForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { user } = getSession();
  if (!user) { openAuthModal('login'); return; }

  const title = document.getElementById('pfTitle').value.trim();
  const category = document.getElementById('pfCategory').value;
  const description = document.getElementById('pfDesc').value.trim();
  const file = document.getElementById('pfPhoto').files[0];
  const submitBtn = portfolioForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Subiendo…';

  try {
    if (isSupabaseConfigured) {
      let image_url = null;
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from('portfolio').upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('portfolio').getPublicUrl(path);
        image_url = pub.publicUrl;
      }
      const { error } = await supabase.from('portfolio_items').insert({
        technician_id: user.id, title, category, description, image_url
      });
      if (error) throw error;
      await loadMyPortfolio();
    } else {
      demoPortfolio.unshift({
        id: 'local-' + Date.now(),
        title, category, description,
        image_url: file ? URL.createObjectURL(file) : null,
      });
      renderMyPortfolio(demoPortfolio);
    }
    portfolioForm.reset();
  } catch (err) {
    alert('No se pudo subir el trabajo: ' + (err.message || err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Subir trabajo';
  }
});

// ============================================================
// Panel de técnico: Mi Perfil (foto, zona, especialidades)
// ============================================================
const profileForm = document.getElementById('profileForm');
const profileAvatarPreview = document.getElementById('profileAvatarPreview');
const profileConfigNote = document.getElementById('profileConfigNote');
const profileSavedNote = document.getElementById('profileSavedNote');
const SPEC_IDS = ['spec-plomeria','spec-electricidad','spec-carpinteria','spec-cerrajeria','spec-pintura','spec-limpieza','spec-ac','spec-otro'];

if (isSupabaseConfigured) profileConfigNote.classList.remove('show');
else profileConfigNote.classList.add('show');

function setProfileAvatarPreview(url, emoji){
  if (url) {
    profileAvatarPreview.style.backgroundImage = `url('${url}')`;
    profileAvatarPreview.textContent = '';
  } else {
    profileAvatarPreview.style.backgroundImage = '';
    profileAvatarPreview.textContent = emoji || '🛠️';
  }
}

async function loadMyProfileForm(){
  const { profile } = getSession();
  if (!profile) return;
  document.getElementById('pfName').value = profile.name || '';
  document.getElementById('pfZone').value = profile.zone || 'Polanco';
  const mySpecs = profile.specialties || [];
  SPEC_IDS.forEach(id => {
    const box = document.getElementById(id);
    if (box) box.checked = mySpecs.includes(box.value);
  });
  setProfileAvatarPreview(profile.avatar_url, profile.avatar_emoji);
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { user } = getSession();
  if (!user || !isSupabaseConfigured) return;

  const submitBtn = profileForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando…';

  try {
    const name = document.getElementById('pfName').value.trim();
    const zone = document.getElementById('pfZone').value;
    const specialties = SPEC_IDS
      .map(id => document.getElementById(id))
      .filter(box => box && box.checked)
      .map(box => box.value);
    const avatarFile = document.getElementById('pfAvatarFile').files[0];

    const updates = { name, zone, specialties, specialty: specialties.join(' · ') };

    if (avatarFile) {
      const path = `${user.id}/${Date.now()}-${avatarFile.name}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      updates.avatar_url = pub.publicUrl;
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;

    if (updates.avatar_url) setProfileAvatarPreview(updates.avatar_url);
    document.getElementById('provNameLabel').textContent = name;
    document.getElementById('provSpecialtyLabel').textContent = updates.specialty || 'Técnico FixYa';
    document.getElementById('provGreetName').textContent = `${name} 👋`;
    if (updates.avatar_url) {
      const sidebarAvatar = document.getElementById('provAvatarInit');
      sidebarAvatar.style.backgroundImage = `url('${updates.avatar_url}')`;
      sidebarAvatar.textContent = '';
    }

    profileSavedNote.classList.add('show');
    setTimeout(() => profileSavedNote.classList.remove('show'), 3000);
    renderTechDirectory();
  } catch (err) {
    alert('No se pudo guardar tu perfil: ' + (err.message || err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar cambios';
  }
});

// ============================================================
// Panel de técnico: Verificación de identidad
// ============================================================
const verifyForm = document.getElementById('verifyForm');
const verifyStatusTag = document.getElementById('verifyStatusTag');
const verifyConfigNote = document.getElementById('verifyConfigNote');
const verifyPendingNote = document.getElementById('verifyPendingNote');
const verifyApprovedNote = document.getElementById('verifyApprovedNote');

if (isSupabaseConfigured) verifyConfigNote.classList.remove('show');
else verifyConfigNote.classList.add('show');

async function loadVerificationStatus(){
  const { user } = getSession();
  if (!user || !isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from('verifications').select('*').eq('technician_id', user.id)
    .order('created_at', { ascending: false }).limit(1);
  if (error) { console.error('[FixYa] Error al leer verificación:', error.message); return; }

  const latest = (data && data[0]) || null;
  verifyPendingNote.classList.remove('show');
  verifyApprovedNote.classList.remove('show');
  verifyForm.classList.remove('hidden');

  if (!latest) {
    verifyStatusTag.textContent = 'Sin verificar';
  } else if (latest.status === 'pendiente') {
    verifyStatusTag.textContent = 'En revisión';
    verifyPendingNote.classList.add('show');
    verifyForm.classList.add('hidden');
  } else if (latest.status === 'aprobada') {
    verifyStatusTag.textContent = '✓ Verificado';
    verifyApprovedNote.classList.add('show');
    verifyForm.classList.add('hidden');
  } else {
    verifyStatusTag.textContent = 'Rechazada — vuelve a intentar';
  }
}

verifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { user } = getSession();
  if (!user || !isSupabaseConfigured) return;

  const file = document.getElementById('pfIdFile').files[0];
  if (!file) return;
  const submitBtn = verifyForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando…';

  try {
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('verification-docs').upload(path, file);
    if (upErr) throw upErr;
    const { error } = await supabase.from('verifications').insert({
      technician_id: user.id, document_url: path
    });
    if (error) throw error;
    await loadVerificationStatus();
  } catch (err) {
    alert('No se pudo enviar tu documento: ' + (err.message || err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar para verificación';
  }
});

// ============================================================
async function loadAdminSalesData(){
  const kpiGmv = document.getElementById('kpiGmv');
  const kpiGmvSub = document.getElementById('kpiGmvSub');
  const kpiCommission = document.getElementById('kpiCommission');
  const chartEl = document.getElementById('realSalesChart');
  const emptyEl = document.getElementById('realSalesEmpty');
  function fmt(n){ return '$' + Math.round(n).toLocaleString('es-MX'); }

  if (!isSupabaseConfigured) {
    chartEl.innerHTML = '';
    emptyEl.textContent = 'Conecta Supabase para que aquí se muestren tus ventas reales en vez de este aviso.';
    emptyEl.style.display = 'block';
    return;
  }

  const { data, error } = await supabase
    .from('service_requests')
    .select('category, price_min, price_max')
    .neq('status', 'cancelada');

  if (error) {
    console.error('[FixYa] No se pudieron leer las ventas:', error.message);
    chartEl.innerHTML = '';
    emptyEl.textContent = 'No se pudieron cargar las ventas todavía.';
    emptyEl.style.display = 'block';
    return;
  }

  const rows = data || [];
  if (rows.length === 0) {
    chartEl.innerHTML = '';
    emptyEl.textContent = 'Aún no hay ventas registradas. En cuanto un cliente confirme una solicitud desde el simulador, va a aparecer aquí automáticamente — sin que tengas que tocar nada.';
    emptyEl.style.display = 'block';
    kpiGmv.innerHTML = '$0 <span style="font-size:.8rem;color:var(--muted);">MXN</span>';
    kpiGmvSub.textContent = '0 servicios confirmados';
    kpiCommission.textContent = '$0 MXN';
    return;
  }

  emptyEl.style.display = 'none';

  let totalGmv = 0;
  const byCategory = {};
  rows.forEach(r => {
    const avg = (Number(r.price_min) + Number(r.price_max)) / 2;
    totalGmv += avg;
    byCategory[r.category] = byCategory[r.category] || { count: 0, gmv: 0 };
    byCategory[r.category].count += 1;
    byCategory[r.category].gmv += avg;
  });
  const commission = totalGmv * 0.15;

  kpiGmv.innerHTML = `${fmt(totalGmv)} <span style="font-size:.8rem;color:var(--muted);">MXN</span>`;
  kpiGmvSub.textContent = `${rows.length} servicio${rows.length === 1 ? '' : 's'} confirmado${rows.length === 1 ? '' : 's'}`;
  kpiCommission.textContent = `${fmt(commission)} MXN`;

  const maxGmv = Math.max(...Object.values(byCategory).map(c => c.gmv));
  const sorted = Object.entries(byCategory).sort((a, b) => b[1].gmv - a[1].gmv);

  chartEl.innerHTML = sorted.map(([cat, info]) => `
    <div class="bar-col">
      <div class="bar-val">${fmt(info.gmv)}</div>
      <div class="bar" data-target="${(info.gmv / maxGmv) * 100}" style="height:0;"></div>
      <div class="bar-label">${categoryIcon(cat)} ${cat}</div>
      <div class="bar-sub">${info.count} servicio${info.count === 1 ? '' : 's'}</div>
    </div>
  `).join('');

  requestAnimationFrame(() => {
    chartEl.querySelectorAll('.bar').forEach(bar => {
      bar.style.height = bar.dataset.target + '%';
    });
  });
}

// ============================================================
// Dashboard de Admin: verificación de identidad de técnicos
// ============================================================
const adminVerifyList = document.getElementById('adminVerifyList');
const adminVerifyEmpty = document.getElementById('adminVerifyEmpty');

async function loadAdminVerifications(){
  if (!isSupabaseConfigured) {
    adminVerifyList.innerHTML = '';
    adminVerifyEmpty.style.display = 'block';
    return;
  }
  const { data, error } = await supabase
    .from('verifications')
    .select('*, profiles!verifications_technician_id_fkey(name, specialty, zone)')
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true });

  if (error) { console.error('[FixYa] Error al leer verificaciones:', error.message); return; }
  const rows = data || [];

  if (rows.length === 0) {
    adminVerifyList.innerHTML = '';
    adminVerifyEmpty.style.display = 'block';
    return;
  }
  adminVerifyEmpty.style.display = 'none';

  const cardsHTML = await Promise.all(rows.map(async (r) => {
    const tech = r.profiles || {};
    const { data: signed } = await supabase.storage.from('verification-docs').createSignedUrl(r.document_url, 300);
    const viewLink = signed?.signedUrl
      ? `<a href="${signed.signedUrl}" target="_blank" rel="noopener" style="color:var(--accent2);font-weight:700;">Ver documento →</a>`
      : 'No se pudo generar el link del documento';
    return `
      <div class="req-card" data-id="${r.id}">
        <div class="req-top">
          <div class="req-cat"><div class="ic">🪪</div><div><strong>${tech.name || 'Técnico'}</strong><span>${tech.specialty || ''}${tech.zone ? ' · ' + tech.zone : ''}</span></div></div>
        </div>
        <div class="req-meta">${viewLink}</div>
        <div class="req-actions">
          <button class="decline" data-id="${r.id}" data-tech="${r.technician_id}">Rechazar</button>
          <button class="accept" data-id="${r.id}" data-tech="${r.technician_id}">Aprobar</button>
        </div>
      </div>
    `;
  }));
  adminVerifyList.innerHTML = cardsHTML.join('');
}

adminVerifyList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  const techId = btn.dataset.tech;
  const approve = btn.classList.contains('accept');

  btn.disabled = true;
  try {
    const { error: verErr } = await supabase
      .from('verifications')
      .update({ status: approve ? 'aprobada' : 'rechazada', reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (verErr) throw verErr;

    if (approve) {
      const { error: profErr } = await supabase.from('profiles').update({ verified: true }).eq('id', techId);
      if (profErr) throw profErr;
    }
    await loadAdminVerifications();
  } catch (err) {
    alert('No se pudo actualizar la verificación: ' + (err.message || err));
    btn.disabled = false;
  }
});

// ============================================================
// Dashboard de Admin: animaciones del stack y canales (demo)
// ============================================================
(() => {
  function animateOnView(selector, attr, cssProp){
    const els = document.querySelectorAll(selector);
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.style[cssProp] = entry.target.dataset[attr] + '%';
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    els.forEach(elm => io.observe(elm));
  }
  animateOnView('.channel-fill', 'w', 'width');
})();

// ============================================================
// Resaltar enlace activo del sidebar / bottom-nav al hacer clic
// ============================================================
document.querySelectorAll('.side-nav').forEach(nav => {
  nav.querySelectorAll('.side-link').forEach(link => {
    link.addEventListener('click', () => {
      nav.querySelectorAll('.side-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
});
document.querySelectorAll('.bottom-nav').forEach(nav => {
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.querySelectorAll('a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
});
