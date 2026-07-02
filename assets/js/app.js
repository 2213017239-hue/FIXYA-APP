// ============================================================
// FixYa — Lógica principal de la aplicación
// ============================================================
import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { initAuth, getSession, signIn, signUp, signOut } from './auth.js';

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
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');
const authConfigNote = document.getElementById('authConfigNote');

if (isSupabaseConfigured) authConfigNote.classList.remove('show');
else authConfigNote.classList.add('show');

function openAuthModal(tab){
  authModal.classList.remove('hidden');
  setAuthTab(tab || 'login');
  loginError.classList.remove('show');
  signupError.classList.remove('show');
}
function closeAuthModal(){ authModal.classList.add('hidden'); }
function setAuthTab(tab){
  const isLogin = tab === 'login';
  authTabLogin.classList.toggle('active', isLogin);
  authTabSignup.classList.toggle('active', !isLogin);
  loginPanel.classList.toggle('active', isLogin);
  signupPanel.classList.toggle('active', !isLogin);
}
authTabLogin.addEventListener('click', () => setAuthTab('login'));
authTabSignup.addEventListener('click', () => setAuthTab('signup'));
authModalClose.addEventListener('click', closeAuthModal);
authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

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

  providerView.classList.toggle('hidden', role !== 'tecnico');
  providerBottomNav.classList.toggle('hidden', role !== 'tecnico');
  adminView.classList.toggle('hidden', role !== 'admin');

  if (role === 'tecnico') {
    document.getElementById('provGreetName').textContent = `${profile.name} 👋`;
    document.getElementById('provNameLabel').textContent = profile.name;
    document.getElementById('provSpecialtyLabel').textContent = profile.specialty || 'Técnico FixYa';
    document.getElementById('provAvatarInit').textContent = initials(profile.name);
    loadMyPortfolio();
  }
  if (role === 'admin') {
    document.getElementById('adminNameLabel').textContent = profile.name || 'Admin';
    document.getElementById('adminAvatarInit').textContent = initials(profile.name || 'Admin');
    loadAdminSalesData();
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
  let countdownInterval = null;
  let selectedQuote = null;
  function startCountdown(etaMin){
    clearInterval(countdownInterval);
    let totalSeconds = 60;
    const fill = document.getElementById('timerFill');
    const label = document.getElementById('timerCount');
    fill.style.width = '100%';
    countdownInterval = setInterval(() => {
      totalSeconds -= 1;
      fill.style.width = Math.max(0, (totalSeconds / 60) * 100) + '%';
      label.textContent = `~${etaMin} min`;
      if (totalSeconds <= 0) clearInterval(countdownInterval);
    }, 1000);
  }
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showStage('loading');
      setTimeout(() => {
        const { min, max, eta, cat } = btn.dataset;
        selectedQuote = { category: cat, price_min: Number(min), price_max: Number(max) };
        document.getElementById('quotePrice').textContent = `$${min}–$${max}`;
        document.getElementById('quoteEta').textContent = `3 técnicos de ${cat} disponibles`;
        document.getElementById('quoteTechs').textContent = `Llegan en ~${eta} min`;
        showStage('quote');
        startCountdown(eta);
      }, 900);
    });
  });
  document.getElementById('confirmBtn').addEventListener('click', async () => {
    const { user, profile } = getSession();
    if (!profile) {
      openAuthModal('signup');
      return;
    }
    clearInterval(countdownInterval);
    showStage('success');

    if (isSupabaseConfigured && user && selectedQuote) {
      const { error } = await supabase.from('service_requests').insert({
        client_id: user.id,
        category: selectedQuote.category,
        price_min: selectedQuote.price_min,
        price_max: selectedQuote.price_max,
      });
      if (error) console.error('[FixYa] No se pudo registrar la venta:', error.message);
    }
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    clearInterval(countdownInterval);
    catBtns.forEach(b => b.classList.remove('active'));
    showStage('placeholder');
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
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

function techCardHTML(t){
  return `
    <button type="button" class="tech-card js-view-tech" data-tech-id="${t.id}">
      <div class="tech-avatar">${t.avatar_emoji || '🛠️'}</div>
      <h3>${t.name}</h3>
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

  pmAvatar.textContent = tech.avatar_emoji || '🛠️';
  pmName.textContent = tech.name;
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
// Panel de técnico: solicitudes urgentes (demo visual)
// ============================================================
(() => {
  const reqList = document.getElementById('reqList');
  const emptyState = document.getElementById('emptyState');
  const statActive = document.getElementById('statActive');
  const reqCountTop = document.getElementById('reqCountTop');
  function updateActiveCount(){
    const remaining = reqList.querySelectorAll('.req-card:not(.handled)').length;
    statActive.textContent = remaining;
    reqCountTop.textContent = remaining;
    if (remaining === 0) emptyState.style.display = 'block';
  }
  reqList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const card = btn.closest('.req-card');
    card.classList.add('handled');
    setTimeout(() => { card.style.display = 'none'; updateActiveCount(); }, 320);
  });

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

  // Resaltar el enlace activo del sidebar / bottom-nav al hacer scroll no es crítico;
  // dejamos el estado "active" solo como referencia visual al cargar.
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
// Dashboard de Admin: ventas reales (desde service_requests)
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
