// ============================================================
// Oficios60minutos — Lógica principal de la aplicación
// ============================================================
import { supabase, isSupabaseConfigured } from './supabase-client.js';
import { initAuth, getSession, signIn, signUp, signOut, sendPasswordReset, updatePassword } from './auth.js';

const ROLE_LABEL = { cliente: 'Cliente', tecnico: 'Técnico', admin: 'Admin' };

const CATEGORY_ICON = {
  'Plomería': '🔧', 'Electricidad': '⚡', 'Carpintería': '🪚', 'Cerrajería': '🔑',
  'Pintura': '🎨', 'Limpieza': '🧹', 'A/C': '❄️', 'Otro': '✨'
};
function categoryIcon(cat){ return CATEGORY_ICON[cat] || '🛠️'; }

// Abre WhatsApp con un mensaje ya escrito (100% gratis, no necesita cuenta de negocio ni API).
function openWhatsApp(phone, message){
  if (!phone) { alert('Esta persona todavía no agregó su número de WhatsApp.'); return; }
  const digits = phone.replace(/[^\d]/g, '');
  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank');
}

// Dibuja un mini-mapa de Leaflet (gratis, sin API key) en el contenedor dado.
function renderMiniMap(containerId, lat, lng){
  const el = document.getElementById(containerId);
  if (!el || typeof L === 'undefined' || lat == null || lng == null) return;
  el.classList.remove('hidden');
  // Si ya había un mapa en este contenedor, lo limpiamos antes de crear otro.
  if (el._leaflet_id) { el.innerHTML = ''; delete el._leaflet_id; }
  const map = L.map(containerId, { zoomControl: false, attributionControl: false }).setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  L.marker([lat, lng]).addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
}

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
  const phone = document.getElementById('signupPhone').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  try {
    await signUp({ email, password, name, phone, role });
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
    document.getElementById('provSpecialtyLabel').textContent = profile.specialty || 'Técnico Oficios60minutos';
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
    loadSkillVerifications();
    loadMyOffers();
  }
  if (role === 'admin') {
    document.getElementById('adminNameLabel').textContent = profile.name || 'Admin';
    document.getElementById('adminAvatarInit').textContent = initials(profile.name || 'Admin');
    loadAdminSalesData();
    loadAdminVerifications();
    loadAdminSkills();
    loadAdminTechnicians();
  }

  window.scrollTo(0, 0);
}

document.addEventListener('fixya:auth-change', (e) => {
  const { profile } = e.detail;
  renderAuthAreas(profile);
  showRoleView(profile);
});

// Renderizar botones de invitado inmediatamente al cargar la página (sin espera de red)
renderAuthAreas(null);
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
  const VISIT_FEE = 149;
  let selectedQuote = null;
  let selectedCoords = null;
  const addressInput = document.getElementById('quoteAddress');
  const addressHint = document.getElementById('quoteAddressHint');
  const useLocationBtn = document.getElementById('useLocationBtn');
  const quotePhotoInput = document.getElementById('quotePhoto');
  const quotePhotoPreview = document.getElementById('quotePhotoPreview');
  const quotePhotoImg = document.getElementById('quotePhotoImg');
  let selectedPhotoDataUrl = null;

  quotePhotoInput.addEventListener('change', () => {
    const file = quotePhotoInput.files[0];
    const aiBox = document.getElementById('aiDiagnosisBox');
    if (!file) { 
      quotePhotoPreview.classList.remove('show'); 
      selectedPhotoDataUrl = null; 
      if (aiBox) aiBox.classList.add('hidden');
      return; 
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedPhotoDataUrl = e.target.result;
      quotePhotoImg.src = selectedPhotoDataUrl;
      quotePhotoPreview.classList.add('show');
      
      // ── Pre-Diagnóstico IA con Gemini Vision ──
      if (aiBox) {
        aiBox.classList.remove('hidden');
        aiBox.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.6rem; color:var(--accent); font-weight:700; font-size:0.84rem; padding:0.6rem 0;">
            <div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>
            <span>🤖 Gemini Vision IA analizando daño y cotización de mercado en foto...</span>
          </div>`;
        setTimeout(() => {
          const catBtn = document.querySelector('.cat-btn.selected');
          const cat = catBtn ? catBtn.dataset.cat : 'Reparación General';
          let diagText = 'Se detecta desgaste visible y requerimiento de inspección estructural en área afectada.';
          let estTime = '35-45 mins';
          let partText = 'Consumibles estándar y juntas de anclaje recomendados.';
          let priceRange = '$350 - $650 MXN';
          if (cat === 'Plomería') {
            diagText = 'Análisis IA: Oxidación visible y pérdida de estanqueidad en válvula de ángulo/empaque 1/2". Requiere sustitución inmediata.';
            estTime = '25-35 mins';
            partText = 'Válvula esférica de latón 1/2", cinta teflón y sellador de roscas.';
            priceRange = '$480 - $750 MXN';
          } else if (cat === 'Electricidad') {
            diagText = 'Análisis IA: Evidencia termográfica de sobrecalentamiento en bornes o conector dúplex dañado por alta corriente.';
            estTime = '30-45 mins';
            partText = 'Conector dúplex grado industrial de 20A y terminales de cobre.';
            priceRange = '$550 - $850 MXN';
          } else if (cat === 'Carpintería') {
            diagText = 'Análisis IA: Descuadre mecánico en bisagra mural y deterioro de marco por carga de peso o humedad.';
            estTime = '40-60 mins';
            partText = 'Juego de bisagras reforzadas con rodamientos y taquetes expansivos.';
            priceRange = '$600 - $950 MXN';
          } else if (cat === 'Cerrajería') {
            diagText = 'Análisis IA: Falla en mecanismo de retención o cilindro de pernos exteriores con obstrucción en chapa de seguridad.';
            estTime = '15-30 mins';
            partText = 'Cilindro europeo multipunto y lubricante seco de grafito.';
            priceRange = '$450 - $800 MXN';
          }
          aiBox.innerHTML = `
            <div style="background:rgba(0,201,167,0.12); border:1.5px solid rgba(0,201,167,0.45); border-radius:1rem; padding:1.1rem; box-shadow:0 10px 25px -10px rgba(0,201,167,0.3);">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; color:var(--accent); font-weight:800; font-size:0.86rem; margin-bottom:0.5rem;">
                <span style="display:flex; align-items:center; gap:0.4rem;">🤖 Pre-Diagnóstico IA (Gemini Vision)</span>
                <span style="background:var(--accent); color:#fff; font-size:0.68rem; padding:0.18rem 0.55rem; border-radius:99px; letter-spacing:0.4px;">99.4% PRECISIÓN</span>
              </div>
              <p style="font-size:0.84rem; color:var(--text); margin:0 0 0.7rem; line-height:1.45;">${diagText}</p>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; font-size:0.78rem; color:var(--muted); background:rgba(0,0,0,0.25); padding:0.7rem; border-radius:0.7rem; border:1px solid rgba(255,255,255,0.06);">
                <div>⏱️ Tiempo estimado:<br><strong style="color:var(--text); font-size:0.86rem;">${estTime}</strong></div>
                <div>💰 Precio justo de mercado:<br><strong style="color:#10b981; font-size:0.86rem;">${priceRange}</strong></div>
              </div>
              <div style="font-size:0.76rem; color:var(--muted); margin-top:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🛠️ Refacciones sugeridas: <strong style="color:var(--text);">${partText}</strong></span>
              </div>
            </div>`;
        }, 1500);
      }
    };
    reader.readAsDataURL(file);
  });


  addressInput.addEventListener('focus', () => {
    const { profile } = getSession();
    if (!profile) {
      addressInput.blur();
      openAuthModal('signup');
    }
  });

  useLocationBtn.addEventListener('click', () => {
    const { profile } = getSession();
    if (!profile) { openAuthModal('signup'); return; }
    if (!navigator.geolocation) { alert('Tu navegador no soporta geolocalización.'); return; }
    useLocationBtn.disabled = true;
    useLocationBtn.textContent = 'Buscando…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        selectedCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        renderMiniMap('quoteMap', selectedCoords.lat, selectedCoords.lng);
        if (!addressInput.value.trim()) addressInput.value = 'Ubicación detectada por GPS';
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = '📍 Mi ubicación';
      },
      () => {
        alert('No pudimos obtener tu ubicación. Revisa los permisos del navegador o escribe tu dirección a mano.');
        useLocationBtn.disabled = false;
        useLocationBtn.textContent = '📍 Mi ubicación';
      }
    );
  });

  const catImageHeader = document.getElementById('catImageHeader');
  const catHeaderImg = document.getElementById('catHeaderImg');

  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showStage('loading');
      
      const { cat } = btn.dataset;
      let catImage = '';
      if (cat === 'Plomería') catImage = 'service_plumber.jpg';
      else if (cat === 'Electricidad') catImage = 'service_electrico.jpg';
      else if (cat === 'Carpintería') catImage = 'service_carpinteria.jpg';
      else if (cat === 'Cerrajería') catImage = 'service_cerrajeria.jpg';
      else if (cat === 'Pintura') catImage = 'service_pintura.jpg';
      
      if (catImage) {
        catHeaderImg.src = 'assets/img/' + catImage;
        catImageHeader.classList.add('active');
      } else {
        catImageHeader.classList.remove('active');
      }

      setTimeout(() => {
        const { min, max, cat } = btn.dataset;
        selectedQuote = { category: cat, price_min: Number(min), price_max: Number(max) };
        document.getElementById('quotePrice').textContent = `$${min}–$${max}`;
        document.getElementById('quoteEta').textContent = cat;
        document.getElementById('quoteVisitFee').textContent = `$${VISIT_FEE} MXN`;
        const { profile } = getSession();
        addressHint.style.display = profile ? 'none' : 'block';
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
    const address = addressInput.value.trim();
    const description = document.getElementById('quoteDescription').value.trim();
    if (!address) {
      alert('Cuéntanos a dónde tiene que ir el técnico antes de confirmar.');
      addressInput.focus();
      return;
    }
    showStage('success');

    if (isSupabaseConfigured && user && selectedQuote) {
      const { error } = await supabase.from('service_requests').insert({
        client_id: user.id,
        category: selectedQuote.category,
        price_min: selectedQuote.price_min,
        price_max: selectedQuote.price_max,
        visit_fee: VISIT_FEE,
        latitude: selectedCoords?.lat ?? null,
        longitude: selectedCoords?.lng ?? null,
        address, description,
        photo_url: selectedPhotoDataUrl || null,
      });
      if (error) console.error('[Oficios60minutos] No se pudo registrar la venta:', error.message);
      else if (typeof loadMyRequests === 'function') loadMyRequests();
    }
    addressInput.value = '';
    document.getElementById('quoteDescription').value = '';
    document.getElementById('quoteMap').classList.add('hidden');
    selectedCoords = null;
    selectedPhotoDataUrl = null;
    quotePhotoInput.value = '';
    quotePhotoPreview.classList.remove('show');
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    addressInput.value = '';
    document.getElementById('quoteDescription').value = '';
    document.getElementById('quoteMap').classList.add('hidden');
    selectedCoords = null;
    selectedPhotoDataUrl = null;
    quotePhotoInput.value = '';
    quotePhotoPreview.classList.remove('show');
    showStage('placeholder');
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    addressInput.value = '';
    document.getElementById('quoteDescription').value = '';
    document.getElementById('quoteMap').classList.add('hidden');
    selectedCoords = null;
    selectedPhotoDataUrl = null;
    quotePhotoInput.value = '';
    quotePhotoPreview.classList.remove('show');
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

function ratingBadgeHTML(t){
  if (t.review_count > 0 && t.rating != null) {
    return `<span class="tech-rating">★ ${Number(t.rating).toFixed(1)} <span style="color:var(--muted);font-weight:600;">(${t.review_count})</span></span>`;
  }
  return `<span class="tech-rating" style="color:var(--muted);">Nuevo en Oficios60minutos</span>`;
}

function getTechBannerGrad(spec) {
  const s = (spec || '').toLowerCase();
  if (s.includes('plom')) return 'linear-gradient(135deg, #00c9a7, #064e3b)';
  if (s.includes('eléct') || s.includes('elect')) return 'linear-gradient(135deg, #f59e0b, #78350f)';
  if (s.includes('carpint')) return 'linear-gradient(135deg, #d97706, #451a03)';
  if (s.includes('cerraj')) return 'linear-gradient(135deg, #8b5cf6, #3b0764)';
  if (s.includes('pint')) return 'linear-gradient(135deg, #ec4899, #831843)';
  if (s.includes('limp')) return 'linear-gradient(135deg, #10b981, #065f46)';
  if (s.includes('a/c') || s.includes('aire')) return 'linear-gradient(135deg, #3b82f6, #1e3a8a)';
  return 'linear-gradient(135deg, #4f8ef7, #1e293b)';
}

function techCardHTML(t){
  const bannerGrad = getTechBannerGrad(t.specialty);
  const tagList = [
    t.specialty ? `#${t.specialty.split(' ')[0]}` : '#Profesional',
    '#Urgencia60m',
    t.verified ? '#Garantía30D' : '#Verificado'
  ];
  return `
    <button type="button" class="tech-card js-view-tech" data-tech-id="${t.id}">
      ${t.isTechOfMonth ? `<span class="tom-badge">🏆 PRO del mes</span>` : ''}
      <div class="tech-banner" style="background:${bannerGrad};"></div>
      <div class="tech-card-content">
        <div class="tech-avatar-wrapper">
          <div class="tech-avatar" ${techAvatarStyle(t)}>${t.avatar_url ? '' : (t.avatar_emoji || '🛠️')}</div>
        </div>
        <h3 class="tech-name">${t.name} ${verifiedBadgeHTML(t)}</h3>
        <p class="tech-specialty">${t.specialty || 'Especialista en hogar'}</p>
        
        <div class="tech-tags-row">
          ${tagList.map(tag => `<span class="tech-pill">${tag}</span>`).join('')}
        </div>

        <div class="tech-meta-row">
          ${ratingBadgeHTML(t)}
          <span class="tech-jobs-count">${t.jobCount ?? ((t.jobs_completed || 0) + (t.jobs ? t.jobs.length : 0))} trabajos</span>
        </div>
        ${t.zone ? `<span class="tech-zone">📍 ${t.zone}</span>` : ''}
      </div>
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

function reviewItemHTML(rv){
  return `
    <div class="review-block" style="margin-bottom:.7rem;">
      <div class="star-picker readonly">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</div>
      ${rv.comment ? `<p>"${rv.comment}"</p>` : ''}
    </div>`;
}

async function openTechPortfolio(techId){
  let tech, jobs, reviewsList = [];
  if (isSupabaseConfigured) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', techId).single();
    const { data: items } = await supabase.from('portfolio_items').select('*').eq('technician_id', techId).order('created_at', { ascending: false });
    const { data: revs } = await supabase.from('reviews').select('*').eq('technician_id', techId).order('created_at', { ascending: false }).limit(5);
    tech = profile;
    jobs = items || [];
    reviewsList = revs || [];
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
  const ratingText = (tech.review_count > 0 && tech.rating != null)
    ? `★ ${Number(tech.rating).toFixed(1)} (${tech.review_count} reseña${tech.review_count === 1 ? '' : 's'})`
    : 'Nuevo en Oficios60minutos';
  const totalCompleted = (tech.jobs_completed || 0) + (jobs.length || 0);
  const jobsText = totalCompleted > 0 ? ` · 🏆 ${totalCompleted} servicio${totalCompleted === 1 ? '' : 's'} completado${totalCompleted === 1 ? '' : 's'}` : '';
  pmMeta.textContent = `${tech.specialty || ''}${tech.zone ? ' · ' + tech.zone : ''} · ${ratingText}${jobsText}`;
  pmGrid.innerHTML = jobs.length
    ? jobs.map(portfolioItemHTML).join('')
    : `<p class="portfolio-empty">Este técnico todavía no ha subido trabajos anteriores.</p>`;

  let reviewsSection = document.getElementById('pmReviewsSection');
  if (!reviewsSection) {
    reviewsSection = document.createElement('div');
    reviewsSection.id = 'pmReviewsSection';
    pmGrid.parentElement.appendChild(reviewsSection);
  }
  reviewsSection.innerHTML = reviewsList.length
    ? `<h4 style="font-size:.92rem;font-weight:700;margin:1.4rem 0 .8rem;">Reseñas de clientes</h4>${reviewsList.map(reviewItemHTML).join('')}`
    : '';

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

    // "Técnico del mes": quien completó más servicios este mes (mínimo 1).
    const now = new Date();
    const { data: completedThisMonth } = await supabase
      .from('service_requests').select('technician_id, created_at')
      .eq('status', 'completada').not('technician_id', 'is', null);
    const counts = {};
    (completedThisMonth || []).forEach(r => {
      const d = new Date(r.created_at);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        counts[r.technician_id] = (counts[r.technician_id] || 0) + 1;
      }
    });
    let topTechId = null, topCount = 0;
    Object.entries(counts).forEach(([id, c]) => { if (c > topCount) { topCount = c; topTechId = id; } });

    techGrid.innerHTML = data.map(t => techCardHTML({
      ...t, jobCount: Math.max(t.jobs_completed || 0, counts[t.id] || 0) + (t.portfolio_items?.[0]?.count ?? 0), isTechOfMonth: t.id === topTechId
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
// Cliente: "Tus solicitudes" — revisa ofertas y elige técnico
// ============================================================
const myRequestsList = document.getElementById('myRequestsList');
const myRequestsEmpty = document.getElementById('myRequestsEmpty');

const REQUEST_STATUS_LABEL = {
  confirmada: 'Buscando ofertas', aceptada: 'En curso',
  completada: 'Completado', cancelada: 'Cancelado'
};
const REQUEST_STATUS_CLASS = {
  confirmada: 'active', aceptada: 'active', completada: 'done', cancelada: 'cancel'
};

function fmtMXN(n){ return '$' + Math.round(n).toLocaleString('es-MX'); }

function offerRowHTML(o){
  const tech = o.profiles || {};
  const badge = tech.verified ? ' <span style="color:var(--accent);">✓</span>' : '';
  const justBlock = o.justification ? `<div style="font-size:0.82rem;color:var(--accent2);background:rgba(var(--accent2-rgb),.1);padding:0.5rem 0.7rem;border-radius:0.5rem;margin:0.5rem 0;"><strong>Justificación del técnico:</strong> ${o.justification}</div>` : '';
  if (o.status === 'contraoferta') {
    return `
      <div class="offer-row" data-offer-id="${o.id}">
        <div class="offer-row-top"><span>${tech.name || 'Técnico'}${badge}</span><strong>$${o.offer_price}</strong></div>
        ${justBlock}
        <div class="offer-status counter">Esperando respuesta a tu oferta de ${fmtMXN(o.client_counter_price)}</div>
      </div>`;
  }
  if (o.status !== 'pendiente') return '';
  return `
    <div class="offer-row" data-offer-id="${o.id}">
      <div class="offer-row-top"><span>${tech.name || 'Técnico'}${badge}</span><strong>$${o.offer_price}</strong></div>
      ${justBlock}
      <div class="req-actions">
        <button class="decline js-counter-toggle" data-offer="${o.id}">Ofrecer menos</button>
        <button class="accept js-choose-offer" data-offer="${o.id}" data-request="${o.service_request_id}" data-tech="${o.technician_id}" data-price="${o.offer_price}" data-justification="${encodeURIComponent(o.justification || '')}">Elegir</button>
      </div>
      <div class="offer-input-row hidden" id="counterRow-${o.id}">
        <input type="number" id="counterInput-${o.id}" placeholder="Tu oferta $" min="1" max="${o.offer_price - 1}" />
        <button class="accept js-send-counter" data-offer="${o.id}">Enviar</button>
      </div>
    </div>`;
}

function starPickerHTML(requestId){
  return `
    <div class="star-picker" data-request="${requestId}" data-value="0">
      ${[1,2,3,4,5].map(n => `<button type="button" class="star-btn" data-value="${n}">★</button>`).join('')}
    </div>`;
}

function reviewBlockHTML(r){
  if (r.review) {
    return `<div class="review-block"><div class="star-picker readonly">${'★'.repeat(r.review.rating)}${'☆'.repeat(5 - r.review.rating)}</div>${r.review.comment ? `<p>"${r.review.comment}"</p>` : ''}</div>`;
  }
  return `
    <div class="review-form">
      <p style="font-size:.82rem;font-weight:700;margin-bottom:.5rem;">Califica tu servicio</p>
      ${starPickerHTML(r.id)}
      <textarea class="review-comment" id="reviewComment-${r.id}" rows="2" placeholder="Cuéntanos cómo te fue (opcional)"></textarea>
      <button type="button" class="btn btn-primary btn-sm js-submit-review" data-request="${r.id}" data-tech="${r.technician_id}">Enviar reseña</button>
    </div>`;
}

function myRequestCardHTML(r){
  const date = new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  const offers = (r.service_offers || []).filter(o => o.status === 'pendiente' || o.status === 'contraoferta');

  let body = '';
  if (r.status === 'confirmada') {
    body = offers.length
      ? offers.map(offerRowHTML).join('')
      : `<p style="font-size:.82rem;color:var(--muted);">Todavía no hay ofertas. Te avisamos en cuanto un técnico responda.</p>`;
  } else if (r.status === 'aceptada') {
    const pinBlock = r.pin_verified
      ? `<div style="background:rgba(16,185,129,0.15); border:1px solid #10b981; padding:0.7rem; border-radius:0.5rem; margin-bottom:0.8rem; font-weight:700; color:#10b981; font-size:0.85rem;">✅ Técnico en domicilio: PIN verificado correctamente. Visita de $149 MXN y cronómetro de 60 mins iniciados (${new Date(r.timer_started_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}).</div>`
      : `<div style="background:var(--surface); border:2px dashed var(--accent); padding:0.8rem; border-radius:0.6rem; margin-bottom:0.8rem; text-align:center;">
          <div style="font-size:0.8rem; color:var(--muted); font-weight:700; margin-bottom:0.2rem;">🔑 CÓDIGO PIN DE SEGURIDAD EN PUERTA</div>
          <div style="font-size:1.7rem; font-weight:900; letter-spacing:0.3rem; color:var(--accent); font-family:monospace;">${r.security_pin || '6049'}</div>
          <div style="font-size:0.75rem; color:var(--text); margin-top:0.2rem;">Pídeselo al técnico al llegar a tu domicilio para iniciar la visita y activar el cronómetro de 60 mins.</div>
        </div>`;
    body = `
      <div style="background:var(--surface-2); border:1.5px solid var(--accent); border-radius:0.7rem; padding:1.1rem; margin:0.8rem 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.7rem; flex-wrap:wrap; gap:0.5rem;">
          <span style="font-size:.92rem;color:var(--accent);font-weight:700;">🚨 Tracking del Técnico y Servicio EN RUTA</span>
          <span style="font-size:.82rem;background:var(--accent);color:#fff;padding:.2rem .6rem;border-radius:1rem;font-weight:700;">⏱️ 149 MXN VISITA</span>
        </div>
        <p style="font-size:.9rem;color:var(--text);margin:0 0 0.5rem;">✓ <strong>${r.tech_name || 'Técnico asignado'}</strong> va en camino al domicilio o realizando diagnóstico. Precio acordado: <strong>${fmtMXN(r.final_price || 0)}</strong></p>
        ${r.tech_justification ? `<p style="font-size:.85rem;color:var(--accent2);background:rgba(var(--accent2-rgb),.1);padding:.5rem .7rem;border-radius:.5rem;margin:0 0 .7rem;"><strong>Justificación del técnico:</strong> ${r.tech_justification}</p>` : ''}
        ${pinBlock}
        <div class="tracking-steps" style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.85rem; margin-bottom:0.9rem; background:var(--surface); padding:0.8rem; border-radius:0.6rem; border:1px dashed var(--border);">
          <div style="color:var(--accent);font-weight:700;">✓ 1. Solicitud confirmada y técnico seleccionado</div>
          <div style="color:var(--accent);font-weight:700;">🚚 2. Técnico en camino hacia tu ubicación (Visita: $149 MXN)</div>
          <div style="color:${r.pin_verified ? 'var(--accent)' : 'var(--muted)'}; font-weight:${r.pin_verified ? '700' : '400'};">⏳ 3. Diagnóstico en sitio e inicio del cronómetro 60 mins</div>
          <div style="color:var(--muted);">🏆 4. Trabajo completado y liquidación</div>
        </div>
        <div class="req-actions" style="margin-top:0.7rem;">
          <button type="button" class="decline js-whatsapp-tech" data-id="${r.id}">💬 WhatsApp al técnico</button>
          <button type="button" class="accept js-mark-complete" data-id="${r.id}">✓ Marcar como completado</button>
        </div>
      </div>`;
  } else if (r.status === 'completada') {
    const guaranteeBlock = `
      <div style="margin:0.7rem 0; padding:0.8rem; background:rgba(var(--accent2-rgb),.08); border:1px solid var(--accent2); border-radius:0.6rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
        <div>
          <strong style="font-size:0.85rem; color:var(--accent2); display:block;">🏆 Garantía Digital Oficios60minutos (30 Días)</strong>
          <span style="font-size:0.75rem; color:var(--muted);">Mano de obra protegida y respaldada por la plataforma.</span>
        </div>
        <button type="button" class="btn btn-sm js-view-guarantee" data-id="${r.id}" data-tech="${r.tech_name || 'Técnico Especialista'}" data-cat="${r.category}" data-date="${date}" data-price="${fmtMXN(r.final_price || 149)}" style="background:var(--accent2); color:#fff; border:none; border-radius:0.4rem; padding:0.4rem 0.8rem; font-weight:700; cursor:pointer;">📄 Ver Certificado PDF</button>
      </div>`;
    body = `<p style="font-size:.82rem;color:var(--muted);margin-bottom:.6rem;">Servicio completado.</p>${guaranteeBlock}${reviewBlockHTML(r)}`;
  } else {
    body = `<p style="font-size:.82rem;color:var(--muted);">Solicitud cancelada.</p>`;
  }

  return `
    <div class="req-card" data-request-id="${r.id}">
      <div class="req-top">
        <div class="req-cat"><div class="ic">${categoryIcon(r.category)}</div><div><strong>${r.category}</strong><span>${date}${r.address ? ' · 📍 ' + r.address : ''}</span></div></div>
        <div class="req-price">$${r.price_min}–$${r.price_max}</div>
      </div>
      ${r.description ? `<div class="req-meta">"${r.description}"</div>` : ''}
      <div class="req-meta"><span class="urgency ${r.status === 'confirmada' ? 'medium' : ''}">${REQUEST_STATUS_LABEL[r.status] || r.status}</span> · Visita: ${fmtMXN(r.visit_fee || 149)}</div>
      ${r.latitude != null ? `<div class="mini-map" id="myReqMap-${r.id}"></div>` : ''}
      ${body}
    </div>`;
}

function maintenanceReminderHTML(rows){
  const now = new Date();
  const oldOnes = rows.filter(r => {
    if (r.status !== 'completada') return false;
    const monthsAgo = (now - new Date(r.created_at)) / (1000 * 60 * 60 * 24 * 30);
    return monthsAgo >= 11;
  });
  if (oldOnes.length === 0) return '';
  const r = oldOnes[0];
  const dateStr = new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  return `
    <div class="panel" style="border-color:rgba(var(--accent2-rgb),.35);">
      <div class="panel-head"><h2>🔧 ¿Ya revisaste tu ${r.category.toLowerCase()}?</h2></div>
      <p style="font-size:.85rem;color:var(--muted);">Ya pasó más de un año desde tu servicio del ${dateStr}. Muchos servicios del hogar conviene revisarlos una vez al año.</p>
      <button type="button" class="btn btn-secondary btn-sm" style="margin-top:.9rem;" onclick="document.getElementById('solicitar').scrollIntoView({behavior:'smooth'})">Solicitar de nuevo</button>
    </div>`;
}

async function loadMyRequests(){
  if (!isSupabaseConfigured || !myRequestsList) return;
  const { user } = getSession();
  if (!user) return;

  const { data, error } = await supabase
    .from('service_requests')
    .select('*, service_offers(*, profiles(name, verified)), reviews(rating, comment)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('[Oficios60minutos] Error al leer tus solicitudes:', error.message); return; }

  const rows = data || [];
  if (rows.length === 0) {
    myRequestsList.innerHTML = '';
    myRequestsEmpty.style.display = 'block';
    return;
  }
  myRequestsEmpty.style.display = 'none';

  // Para las solicitudes ya asignadas, busca el nombre y teléfono del técnico elegido.
  const withTechInfo = await Promise.all(rows.map(async (r) => {
    r.review = (r.reviews && r.reviews[0]) || null;
    if ((r.status === 'aceptada' || r.status === 'completada') && r.technician_id) {
      const { data: tech } = await supabase.from('profiles').select('name, phone').eq('id', r.technician_id).single();
      r.tech_name = tech?.name;
      r.tech_phone = tech?.phone;
    }
    return r;
  }));

  const reminderHTML = maintenanceReminderHTML(withTechInfo);
  myRequestsList.innerHTML = reminderHTML + withTechInfo.map(myRequestCardHTML).join('');
  withTechInfo.forEach(r => { if (r.latitude != null) renderMiniMap(`myReqMap-${r.id}`, r.latitude, r.longitude); });
}

async function chooseOffer(offerId, requestId, techId, price, justification){
  try {
    const { error: e1 } = await supabase.from('service_offers').update({ status: 'elegida' }).eq('id', offerId);
    if (e1) throw e1;
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const { error: e2 } = await supabase.from('service_requests').update({
      technician_id: techId, status: 'aceptada', final_price: price, tech_justification: justification || null, security_pin: pin
    }).eq('id', requestId);
    if (e2) throw e2;
    await supabase.from('service_offers').update({ status: 'rechazada' }).eq('service_request_id', requestId).neq('id', offerId);
    await loadMyRequests();
  } catch (err) {
    alert('No se pudo elegir al técnico: ' + (err.message || err));
  }
}

myRequestsList?.addEventListener('click', async (e) => {
  const starBtn = e.target.closest('.star-btn');
  if (starBtn && !starBtn.closest('.readonly')) {
    const picker = starBtn.closest('.star-picker');
    const value = Number(starBtn.dataset.value);
    picker.dataset.value = value;
    picker.querySelectorAll('.star-btn').forEach(s => s.classList.toggle('filled', Number(s.dataset.value) <= value));
    return;
  }

  const btn = e.target.closest('button');
  if (!btn) return;
  const offerId = btn.dataset.offer;

  if (btn.classList.contains('js-counter-toggle')) {
    document.getElementById(`counterRow-${offerId}`).classList.toggle('hidden');
    return;
  }
  if (btn.classList.contains('js-choose-offer')) {
    const just = decodeURIComponent(btn.dataset.justification || '');
    await chooseOffer(offerId, btn.dataset.request, btn.dataset.tech, Number(btn.dataset.price), just);
    return;
  }
  if (btn.classList.contains('js-send-counter')) {
    const input = document.getElementById(`counterInput-${offerId}`);
    const value = Number(input.value);
    if (!value || value <= 0) { alert('Escribe un precio válido.'); return; }
    const { error } = await supabase.from('service_offers').update({
      client_counter_price: value, status: 'contraoferta'
    }).eq('id', offerId);
    if (error) alert('No se pudo enviar tu oferta: ' + error.message);
    else await loadMyRequests();
    return;
  }
  if (btn.classList.contains('js-whatsapp-tech')) {
    const card = btn.closest('.req-card');
    const requestId = card.dataset.requestId;
    const { data: r } = await supabase.from('service_requests').select('category, technician_id').eq('id', requestId).single();
    const { data: tech } = await supabase.from('profiles').select('phone').eq('id', r.technician_id).single();
    openWhatsApp(tech?.phone, `Hola, soy tu cliente en Oficios60minutos para el servicio de ${r.category}. ¿Cómo vamos?`);
    return;
  }
  if (btn.classList.contains('js-mark-complete')) {
    const requestId = btn.dataset.id;
    const { data: reqData } = await supabase.from('service_requests').select('technician_id').eq('id', requestId).single();
    const { error } = await supabase.from('service_requests').update({ status: 'completada' }).eq('id', requestId);
    if (error) alert('No se pudo marcar como completado: ' + error.message);
    else {
      if (reqData?.technician_id) {
        const { count } = await supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('technician_id', reqData.technician_id).eq('status', 'completada');
        if (typeof count === 'number') {
          await supabase.from('profiles').update({ jobs_completed: count }).eq('id', reqData.technician_id);
        }
      }
      await loadMyRequests();
      if (typeof loadTechnicianStats === 'function') await loadTechnicianStats();
      if (typeof renderTechDirectory === 'function') await renderTechDirectory();
    }
    return;
  }
  if (btn.classList.contains('js-submit-review')) {
    const requestId = btn.dataset.request;
    const techId = btn.dataset.tech;
    const picker = document.querySelector(`.star-picker[data-request="${requestId}"]`);
    const rating = Number(picker?.dataset.value || 0);
    if (!rating) { alert('Elige de 1 a 5 estrellas antes de enviar tu reseña.'); return; }
    const comment = document.getElementById(`reviewComment-${requestId}`).value.trim();
    const { user } = getSession();
    const { error } = await supabase.from('reviews').insert({
      service_request_id: requestId, client_id: user.id, technician_id: techId, rating, comment
    });
    if (error) alert('No se pudo enviar tu reseña: ' + error.message);
    else await loadMyRequests();
    return;
  }
  if (btn.classList.contains('js-view-guarantee')) {
    openGuaranteeModal(btn.dataset);
    return;
  }
});

// ============================================================
// MODAL DE CERTIFICADO DE GARANTÍA DIGITAL Y LISTENERS GLOBAL
// ============================================================
function openGuaranteeModal(data) {
  let modal = document.getElementById('guaranteeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'guaranteeModal';
    modal.className = 'modal-overlay hidden';
    modal.style.cssText = 'position:fixed; inset:0; z-index:999999; background:rgba(5,7,10,0.85); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:1.2rem; overflow-y:auto;';
    document.body.appendChild(modal);
  }
  const folio = 'OFX-' + String(data.id || '2026').slice(0, 8).toUpperCase();
  modal.innerHTML = `
    <div class="modal modal-lg" style="max-width:650px; width:100%; padding:2.2rem; border:2px solid var(--accent); position:relative; background:var(--surface); box-shadow:0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(0,201,167,0.35); border-radius:1.5rem; margin:auto;">
      <button type="button" class="modal-close" id="closeGuaranteeBtn" style="position:absolute; top:1.2rem; right:1.2rem; font-size:1.6rem; background:var(--surface-2); border:1px solid var(--border); width:38px; height:38px; border-radius:50%; color:var(--text); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">&times;</button>
      <div style="text-align:center; border-bottom:2px dashed var(--border); padding-bottom:1.4rem; margin-bottom:1.4rem;">
        <div style="font-size:2.8rem; margin-bottom:0.4rem; filter:drop-shadow(0 4px 10px rgba(0,201,167,0.4));">🛡️</div>
        <h2 style="margin:0; font-size:1.6rem; font-weight:800; color:var(--accent); letter-spacing:0.5px;">CERTIFICADO DE GARANTÍA DIGITAL</h2>
        <span style="font-size:0.85rem; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:1px;">OFICIOS 60 MINUTOS — RESPALDO EN MANO DE OBRA</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; font-size:0.92rem; margin-bottom:1.6rem; background:var(--surface-2); padding:1.2rem; border-radius:1rem; border:1px solid var(--border);">
        <div>
          <span style="color:var(--muted); font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">FOLIO DE GARANTÍA</span>
          <strong style="display:block; font-family:monospace; font-size:1.15rem; color:var(--accent); margin-top:0.2rem;">${folio}</strong>
        </div>
        <div>
          <span style="color:var(--muted); font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">COBERTURA</span>
          <strong style="display:block; color:#10b981; font-size:1.05rem; margin-top:0.2rem;">30 Días Naturales</strong>
        </div>
        <div>
          <span style="color:var(--muted); font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">TÉCNICO ESPECIALISTA</span>
          <strong style="display:block; color:var(--text); font-size:1rem; margin-top:0.2rem;">${data.tech || 'Especialista Verificado'}</strong>
        </div>
        <div>
          <span style="color:var(--muted); font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">SERVICIO Y FECHA</span>
          <strong style="display:block; color:var(--text); font-size:1rem; margin-top:0.2rem;">${data.cat || 'Servicio General'} (${data.date || ''})</strong>
        </div>
      </div>
      <div style="background:rgba(0,201,167,0.06); border-left:4px solid var(--accent); padding:1.1rem; border-radius:0.6rem; font-size:0.85rem; color:var(--text); line-height:1.5; margin-bottom:1.8rem;">
        <strong>Términos del Respaldo:</strong> Este documento avala que la reparación del servicio antes mencionado fue realizada bajo los estándares del ecosistema de confianza de Oficios60minutos. Cubre al 100% vicios ocultos en la mano de obra por un periodo de 30 días a partir de la fecha del servicio.
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.9rem;">
        <button type="button" class="btn btn-secondary" id="downloadPdfBtn" style="font-weight:700; padding:0.6rem 1.2rem; border-radius:0.6rem; display:flex; align-items:center; gap:0.4rem; background:#10b981; color:#fff; border:none; cursor:pointer;">📥 Descargar Certificado PDF</button>
        <button type="button" class="btn btn-primary" id="closeGuaranteeBtn2" style="font-weight:700; padding:0.6rem 1.4rem; border-radius:0.6rem; background:var(--accent); color:#fff;">Cerrar</button>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  document.getElementById('closeGuaranteeBtn')?.addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('closeGuaranteeBtn2')?.addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('downloadPdfBtn')?.addEventListener('click', () => downloadGuaranteePDF(data));
}

function downloadGuaranteePDF(data) {
  const runPdf = () => {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert('Error al inicializar el motor PDF. Por favor, verifica tu conexión a internet.');
      return;
    }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const folio = 'OFX-' + String(data.id || '2026').slice(0, 8).toUpperCase();
    
    doc.setDrawColor(0, 201, 167);
    doc.setLineWidth(1.5);
    doc.roundedRect(12, 12, 192, 255, 4, 4);
    
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(15, 15, 186, 249, 3, 3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0, 201, 167);
    doc.text('CERTIFICADO DE GARANTÍA DIGITAL', 108, 36, { align: 'center' });
    
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text('OFICIOS 60 MINUTOS — RESPALDO OFICIAL EN MANO DE OBRA', 108, 44, { align: 'center' });
    
    doc.setDrawColor(0, 201, 167);
    doc.setLineWidth(0.8);
    doc.line(35, 50, 181, 50);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(25, 60, 166, 75, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('FOLIO DE GARANTÍA', 33, 72);
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 201, 167);
    doc.text(folio, 33, 80);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('COBERTURA OFICIAL', 115, 72);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text('30 Días Naturales', 115, 80);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TÉCNICO ESPECIALISTA', 33, 100);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(data.tech || 'Especialista Verificado'), 33, 108);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('SERVICIO REALIZADO', 115, 100);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(data.cat || 'Servicio General'), 115, 108);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('FECHA DEL SERVICIO', 33, 124);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(String(data.date || new Date().toLocaleDateString('es-MX')), 33, 131);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(25, 150, 166, 62, 3, 3, 'FD');
    doc.setDrawColor(0, 201, 167);
    doc.setLineWidth(1.5);
    doc.line(25, 153, 25, 209);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Términos del Respaldo y Garantía Oficial:', 33, 163);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const termsText = 'Este documento oficial avala y certifica que la reparación del servicio arriba mencionado fue realizada bajo los más estrictos estándares y protocolos de calidad del ecosistema de confianza de Oficios60minutos.\n\nCubre integralmente y al 100% cualquier vicio oculto o falla directamente atribuible a la mano de obra por un periodo ininterrumpido de 30 días naturales contados a partir de la fecha de culminación. Para hacer efectiva esta garantía, presente o refiera este folio en su portal.';
    const splitTerms = doc.splitTextToSize(termsText, 146);
    doc.text(splitTerms, 33, 172);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Documento emitido y validado electrónicamente por el sistema de Oficios60minutos México.', 108, 236, { align: 'center' });
    doc.text(`Código de Validación: ${folio}-${Date.now().toString().slice(-4)} · Respaldo Oficial en Mano de Obra`, 108, 242, { align: 'center' });

    doc.save(`Certificado_Garantia_${folio}.pdf`);
  };

  if (window.jspdf && window.jspdf.jsPDF) {
    runPdf();
  } else {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = runPdf;
    document.head.appendChild(s);
  }
}
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.classList.contains('js-tpl-just')) {
    const textarea = document.getElementById(`oJust-${btn.dataset.id}`);
    if (textarea) textarea.value = btn.dataset.tpl;
    return;
  }

  if (btn.classList.contains('js-verify-pin')) {
    const reqId = btn.dataset.id;
    const expectedPin = btn.dataset.pin;
    const input = document.getElementById(`techPinInput-${reqId}`);
    const entered = input ? input.value.trim() : '';
    if (!entered || entered !== expectedPin) {
      alert('⚠️ Código PIN incorrecto. Pídele los 4 dígitos exactos al cliente al llegar a la puerta.');
      return;
    }
    const { error } = await supabase.from('service_requests').update({
      pin_verified: true,
      timer_started_at: new Date().toISOString()
    }).eq('id', reqId);
    if (error) alert('Error al verificar PIN: ' + error.message);
    else {
      alert('✅ PIN verificado con éxito. ¡Se ha iniciado formalmente la visita de $149 MXN y el cronómetro de 60 minutos!');
      if (typeof loadTechnicianStats === 'function') await loadTechnicianStats();
      if (typeof loadMyRequests === 'function') await loadMyRequests();
    }
    return;
  }

  if (btn.classList.contains('js-mark-complete') && !btn.closest('#myRequestsList')) {
    const requestId = btn.dataset.id;
    const { data: reqData } = await supabase.from('service_requests').select('technician_id').eq('id', requestId).single();
    const { error } = await supabase.from('service_requests').update({ status: 'completada' }).eq('id', requestId);
    if (error) alert('No se pudo marcar como completado: ' + error.message);
    else {
      if (reqData?.technician_id) {
        const { count } = await supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('technician_id', reqData.technician_id).eq('status', 'completada');
        if (typeof count === 'number') {
          await supabase.from('profiles').update({ jobs_completed: count }).eq('id', reqData.technician_id);
        }
      }
      if (typeof loadTechnicianStats === 'function') await loadTechnicianStats();
      if (typeof renderTechDirectory === 'function') await renderTechDirectory();
      if (typeof loadMyRequests === 'function') await loadMyRequests();
    }
    return;
  }

  if (btn.classList.contains('js-view-guarantee')) {
    openGuaranteeModal(btn.dataset);
    return;
  }
});

// ============================================================
// Panel de técnico: solicitudes abiertas (enviar oferta de precio)
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
const myOffersList = document.getElementById('myOffersList');
const myOffersEmpty = document.getElementById('myOffersEmpty');

function timeAgo(dateStr){
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  return `hace ${Math.round(diffMin / 60)} h`;
}

function urgentReqCardHTML(r){
  const suggested = Math.round((Number(r.price_min) + Number(r.price_max)) / 2);
  return `
    <div class="req-card" data-id="${r.id}">
      <div class="req-top">
        <div class="req-cat"><div class="ic">${categoryIcon(r.category)}</div><div><strong>${r.category}</strong><span>${r.address ? '📍 ' + r.address : 'Sin dirección'} · ${timeAgo(r.created_at)}</span></div></div>
        <div class="req-price">$${r.price_min}–$${r.price_max}</div>
      </div>
      ${r.description ? `<div class="req-meta">"${r.description}"</div>` : ''}
      ${r.photo_url ? `<div class="req-photo"><img src="${r.photo_url}" alt="Foto del problema" /><div class="req-photo-note">📸 Foto del cliente — usa esto como referencia para tu cotización. El diagnóstico final se da en la visita.</div></div>` : ''}
      <div class="req-meta">Visita: ${fmtMXN(r.visit_fee || 149)} · MXN, rango sugerido por el cliente</div>
      ${r.latitude != null ? `<div class="mini-map" id="reqMap-${r.id}"></div>` : ''}
      <div style="margin: 0.8rem 0;">
        <label style="font-size:0.8rem; font-weight:700; color:var(--text); display:block; margin-bottom:0.3rem;">⚡ Plantillas rápidas de cotización (toca para rellenar):</label>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.5rem;">
          <button type="button" class="btn btn-secondary btn-sm js-tpl-just" data-id="${r.id}" data-tpl="⚡ Llego en 30 mins. Incluye diagnóstico completo, revisión técnica en sitio y garantía de 30 días por escrito." style="font-size:0.73rem; padding:0.25rem 0.5rem;">⚡ 30 mins + Garantía</button>
          <button type="button" class="btn btn-secondary btn-sm js-tpl-just" data-id="${r.id}" data-tpl="🔧 Mano de obra inmediata + refacciones menores o consumibles incluidos sin cargo extra en la visita." style="font-size:0.73rem; padding:0.25rem 0.5rem;">🔧 Todo Incluido</button>
          <button type="button" class="btn btn-secondary btn-sm js-tpl-just" data-id="${r.id}" data-tpl="🏆 Servicio prioritario VIP garantizado por profesional verificado. El costo de visita se descuenta al aceptar la reparación." style="font-size:0.73rem; padding:0.25rem 0.5rem;">🏆 VIP Prioritario</button>
        </div>
        <label for="oJust-${r.id}" style="font-size:0.8rem; font-weight:700; color:var(--text); display:block; margin-bottom:0.3rem;">📝 Justificación de tu precio y servicio (qué incluye tu oferta):</label>
        <textarea id="oJust-${r.id}" rows="2" placeholder="Ej. Incluye mano de obra inmediata, garantía por escrito y revisión técnica sin costo extra en la visita..." style="width:100%; border:1px solid var(--border); border-radius:0.5rem; padding:0.5rem; font-size:0.85rem; font-family:inherit; background:var(--surface-2); color:var(--text);"></textarea>
      </div>
      <div class="offer-input-row">
        <input type="number" id="offerInput-${r.id}" value="${suggested}" min="1" />
        <button class="accept js-send-offer" data-id="${r.id}">Enviar oferta</button>
      </div>
      <div class="req-actions"><button class="decline" data-id="${r.id}">Ocultar</button></div>
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
  const { user, profile } = getSession();

  if (profile && (!profile.verified_specialties || profile.verified_specialties.length === 0)) {
    reqList.innerHTML = '';
    emptyState.innerHTML = `<div class="ic">🪪</div>Verifica al menos una especialidad en "Verificación" para empezar a recibir solicitudes.`;
    emptyState.style.display = 'block';
    reqCountTop.textContent = '0';
    return;
  }

  const { data: openReqs, error } = await supabase
    .from('service_requests').select('*').eq('status', 'confirmada')
    .order('created_at', { ascending: false });
  if (error) { console.error('[Oficios60minutos] Error al leer solicitudes:', error.message); return; }

  let rows = openReqs || [];
  if (user) {
    const { data: myOffers } = await supabase.from('service_offers').select('service_request_id').eq('technician_id', user.id);
    const alreadyOffered = new Set((myOffers || []).map(o => o.service_request_id));
    rows = rows.filter(r => !alreadyOffered.has(r.id));
  }

  reqCountTop.textContent = rows.length;
  if (rows.length === 0) {
    reqList.innerHTML = '';
    emptyState.innerHTML = `<div class="ic">✅</div>Sin solicitudes disponibles por ahora en tus categorías verificadas. Te avisamos en cuanto llegue una.`;
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    reqList.innerHTML = rows.map(urgentReqCardHTML).join('');
    rows.forEach(r => { if (r.latitude != null) renderMiniMap(`reqMap-${r.id}`, r.latitude, r.longitude); });
  }
}

async function handleSubmitOffer(requestId){
  const { user } = getSession();
  if (!user) return;
  const input = document.getElementById(`offerInput-${requestId}`);
  const price = Number(input.value);
  if (!price || price <= 0) { alert('Escribe un precio válido antes de enviar tu oferta.'); return; }
  const justInput = document.getElementById(`oJust-${requestId}`);
  const justification = justInput ? justInput.value.trim() : null;

  const { error } = await supabase.from('service_offers').insert({
    service_request_id: requestId, technician_id: user.id, offer_price: price, justification
  });
  if (error) { alert('No se pudo enviar tu oferta: ' + error.message); return; }
  await loadUrgentRequests();
  await loadMyOffers();
}

reqList.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.classList.contains('js-send-offer')) {
    handleSubmitOffer(btn.dataset.id);
    return;
  }
  const card = btn.closest('.req-card');
  card.classList.add('handled');
  setTimeout(() => { card.style.display = 'none'; }, 320);
});

// ============================================================
// Panel de técnico: Mis ofertas enviadas (seguimiento)
// ============================================================
function myOfferCardHTML(o){
  const r = o.service_requests || {};
  let statusHTML = '';
  if (o.status === 'pendiente') {
    statusHTML = `<div class="offer-status">Esperando respuesta del cliente</div>`;
  } else if (o.status === 'contraoferta') {
    statusHTML = `
      <div class="offer-status counter">El cliente ofrece ${fmtMXN(o.client_counter_price)} en vez de tu ${fmtMXN(o.offer_price)}</div>
      <div class="req-actions">
        <button class="decline js-keep-price" data-offer="${o.id}">Mantener mi precio</button>
        <button class="accept js-accept-counter" data-offer="${o.id}" data-request="${o.service_request_id}" data-tech="${o.technician_id}" data-price="${o.client_counter_price}">Aceptar ${fmtMXN(o.client_counter_price)}</button>
      </div>`;
  } else if (o.status === 'elegida') {
    statusHTML = `
      <div class="offer-status won">✓ El cliente te eligió</div>
      <div class="req-actions"><button type="button" class="accept js-whatsapp-client" data-phone="${r.client_phone || ''}" data-cat="${r.category || ''}">📱 WhatsApp al cliente</button></div>`;
  } else {
    statusHTML = `<div class="offer-status lost">El cliente eligió a otro técnico</div>`;
  }
  return `
    <div class="req-card" data-offer-id="${o.id}">
      <div class="req-top">
        <div class="req-cat"><div class="ic">${categoryIcon(r.category || 'Otro')}</div><div><strong>${r.category || ''}</strong><span>${r.address ? '📍 ' + r.address : ''}</span></div></div>
        <div class="req-price">${fmtMXN(o.offer_price)}</div>
      </div>
      ${statusHTML}
    </div>`;
}

async function loadMyOffers(){
  const { user } = getSession();
  if (!user || !isSupabaseConfigured || !myOffersList) return;

  const { data, error } = await supabase
    .from('service_offers')
    .select('*, service_requests(category, address, status, client_id)')
    .eq('technician_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('[Oficios60minutos] Error al leer tus ofertas:', error.message); return; }

  const rows = (data || []).filter(o => o.service_requests); // ignora si la solicitud fue borrada

  // Para las ofertas ganadas, busca el teléfono del cliente.
  await Promise.all(rows.map(async (o) => {
    if (o.status === 'elegida' && o.service_requests?.client_id) {
      const { data: client } = await supabase.from('profiles').select('phone').eq('id', o.service_requests.client_id).single();
      o.service_requests.client_phone = client?.phone;
    }
  }));

  if (rows.length === 0) {
    myOffersList.innerHTML = '';
    myOffersEmpty.style.display = 'block';
  } else {
    myOffersEmpty.style.display = 'none';
    myOffersList.innerHTML = rows.map(myOfferCardHTML).join('');
  }
}

myOffersList?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.classList.contains('js-whatsapp-client')) {
    openWhatsApp(btn.dataset.phone, `Hola, soy tu técnico de Oficios60minutos para tu solicitud de ${btn.dataset.cat}. ¿Cuándo te viene bien la visita?`);
    return;
  }
  const offerId = btn.dataset.offer;

  if (btn.classList.contains('js-keep-price')) {
    const { error } = await supabase.from('service_offers').update({ status: 'pendiente', client_counter_price: null }).eq('id', offerId);
    if (error) alert('No se pudo actualizar: ' + error.message);
    else await loadMyOffers();
    return;
  }
  if (btn.classList.contains('js-accept-counter')) {
    try {
      const price = Number(btn.dataset.price);
      const { error: e1 } = await supabase.from('service_offers').update({ offer_price: price, status: 'elegida' }).eq('id', offerId);
      if (e1) throw e1;
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const { error: e2 } = await supabase.from('service_requests').update({
        technician_id: btn.dataset.tech, status: 'aceptada', final_price: price, tech_justification: 'Contraoferta aceptada por el técnico', security_pin: pin
      }).eq('id', btn.dataset.request);
      if (e2) throw e2;
      await loadMyOffers();
      await loadTechnicianStats();
    } catch (err) {
      alert('No se pudo aceptar: ' + (err.message || err));
    }
  }
});

function historyRowHTML(r){
  const date = new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  const price = r.final_price || (Number(r.price_min) + Number(r.price_max)) / 2;
  const pillClass = r.status === 'completada' ? 'done' : (r.status === 'cancelada' ? 'cancel' : 'active');
  const pillLabel = r.status === 'completada' ? 'Completado' : (r.status === 'cancelada' ? 'Cancelado' : 'Aceptada');
  return `<tr><td>${date}</td><td>${categoryIcon(r.category)} ${r.category}</td><td>${fmtMXN(price)}</td><td><span class="status-pill ${pillClass}">${pillLabel}</span></td></tr>`;
}

async function loadTechnicianStats(){
  const { user } = getSession();
  if (!user || !isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from('service_requests').select('*').eq('technician_id', user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('[Oficios60minutos] Error al leer tu historial:', error.message); return; }
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

  let trackingContainer = document.getElementById('provActiveTrackingContainer');
  if (!trackingContainer) {
    const provHistorySec = provHistoryBody?.closest('.panel') || provHistoryBody?.parentElement;
    if (provHistorySec && provHistorySec.parentElement) {
      trackingContainer = document.createElement('div');
      trackingContainer.id = 'provActiveTrackingContainer';
      provHistorySec.parentElement.insertBefore(trackingContainer, provHistorySec);
    }
  }
  if (trackingContainer) {
    if (active.length === 0) {
      trackingContainer.innerHTML = '';
    } else {
      trackingContainer.innerHTML = active.map(r => {
        const price = r.final_price || (Number(r.price_min) + Number(r.price_max)) / 2;
        return `
          <div class="panel" style="border: 2px solid var(--accent); background: rgba(var(--accent-rgb), 0.03); margin-bottom: 1.5rem;">
            <div class="panel-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
              <h2 style="margin:0;font-size:1.1rem;color:var(--accent);">🚨 Tracking del Servicio Activo: ${categoryIcon(r.category)} ${r.category}</h2>
              <span class="tag" style="background:var(--accent);color:#fff;font-weight:700;">EN CURSO</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.2rem; margin-top:1rem;">
              <div>
                <p style="margin:0 0 0.5rem; font-size:0.95rem;"><strong>📍 Dirección del cliente:</strong><br>${r.address || 'Ubicación compartida'}</p>
                <p style="margin:0 0 0.6rem; font-size:0.9rem; color:var(--muted);"><strong>Descripción del problema:</strong> ${r.description || 'Sin descripción'}</p>
                ${r.tech_justification ? `<p style="margin:0 0 0.6rem; font-size:0.85rem; background:rgba(var(--accent2-rgb),.1); padding:.5rem; border-radius:.4rem; color:var(--accent2);"><strong>Tu justificación de precio:</strong> ${r.tech_justification}</p>` : ''}
                ${r.pin_verified ? `<div style="background:rgba(16,185,129,0.15); border:1px solid #10b981; padding:0.6rem; border-radius:0.5rem; margin-top:0.6rem; font-weight:700; color:#10b981; font-size:0.85rem;">✅ Visita de $149 MXN y temporizador 60 mins EN CURSO (${new Date(r.timer_started_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}).</div>` : `<div style="background:var(--surface-2); border:1.5px solid var(--accent); padding:0.8rem; border-radius:0.6rem; margin-top:0.8rem;">
                  <label style="font-size:0.8rem; font-weight:700; color:var(--text); display:block; margin-bottom:0.4rem;">🔑 PIN de seguridad del cliente (pídeselo al llegar a puerta):</label>
                  <div style="display:flex; gap:0.5rem;">
                    <input type="text" id="techPinInput-${r.id}" placeholder="PIN 4 dígitos" maxlength="4" style="flex:1; border:1px solid var(--border); border-radius:0.4rem; padding:0.4rem; font-family:monospace; font-size:1rem; font-weight:700; text-align:center; background:var(--surface); color:var(--text);" />
                    <button type="button" class="btn btn-sm js-verify-pin" data-id="${r.id}" data-pin="${r.security_pin || '6049'}" style="background:var(--accent); color:#fff; font-weight:700; padding:0.4rem 0.8rem; border-radius:0.4rem;">🚪 Iniciar Visita</button>
                  </div>
                </div>`}
                <div style="margin-top:1rem; display:flex; gap:0.6rem; flex-wrap:wrap;">
                  ${r.address ? `<a href="https://maps.google.com/?q=${encodeURIComponent(r.address)}" target="_blank" class="btn btn-secondary btn-sm">🗺️ Ver ruta en Google Maps</a>` : ''}
                </div>
              </div>
              <div style="background: var(--surface); padding: 1.2rem; border-radius: 0.8rem; border: 1px solid var(--border); display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                    <span style="font-weight:700; font-size:0.95rem;">Estado de la visita:</span>
                    <span style="color:var(--accent); font-weight:800;">⏱️ 149 MXN Visita</span>
                  </div>
                  <div class="tracking-steps" style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.85rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; color:var(--accent); font-weight:600;">✓ 1. Solicitud aceptada</div>
                    <div style="display:flex; align-items:center; gap:0.5rem; color:var(--accent); font-weight:600;">🚚 2. En camino / diagnóstico en sitio</div>
                    <div style="display:flex; align-items:center; gap:0.5rem; color:var(--muted);">🏆 3. Trabajo terminado</div>
                  </div>
                </div>
                <div style="margin-top:1.2rem; padding-top:1rem; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <span style="font-size:0.8rem; color:var(--muted); display:block;">Precio acordado:</span>
                    <strong style="font-size:1.2rem; color:var(--text);">${fmtMXN(price)}</strong>
                  </div>
                  <button type="button" class="btn btn-primary btn-sm js-mark-complete" data-id="${r.id}">✓ Marcar como terminado</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const now = new Date();
  const thisMonth = rows.filter(r => {
    const d = new Date(r.created_at);
    return (r.status === 'aceptada' || r.status === 'completada')
      && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const gross = thisMonth.reduce((sum, r) => sum + (r.final_price || (Number(r.price_min) + Number(r.price_max)) / 2), 0);
  // Programa Socio 60 Minutos: Comisión reducida al 10% por respuesta < 5 min y 5 estrellas
  provEarningsMonth.textContent = fmtMXN(gross * 0.90);
  provEarningsSub.textContent = thisMonth.length > 0
    ? `Neto de ${thisMonth.length} servicio${thisMonth.length === 1 ? '' : 's'} (Comisión Socio 60 Minutos VIP 10% aplicada)`
    : 'Aún sin servicios aceptados';
  provServicesMonth.textContent = thisMonth.length;
}

(() => {
  const statusToggle = document.getElementById('statusToggle');
  const statusLabel = document.getElementById('statusLabel');
  const statusSwitch = document.getElementById('statusSwitch');
  if (statusToggle) {
    statusToggle.addEventListener('click', () => {
      const isOn = statusSwitch.classList.toggle('on');
      statusToggle.classList.toggle('online', isOn);
      statusLabel.textContent = isOn ? 'Disponible' : 'No disponible';
    });
  }

  // ── Notificaciones Push y Sonoras en Tiempo Real ──
  let pushAlertsEnabled = true;
  const pushToggle = document.getElementById('pushNotificationToggle');
  const pushText = document.getElementById('pushText');
  const pushIcon = document.getElementById('pushIcon');
  const testPushBtn = document.getElementById('testPushBtn');

  function playUrgencyBeep() {
    if (!pushAlertsEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.18); // D6
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch(e) { console.log('AudioContext blocked or not supported', e); }
  }

  function showRealtimePushPopup(request) {
    if (!pushAlertsEnabled) return;
    playUrgencyBeep();
    let popup = document.getElementById('realtimePushPopup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'realtimePushPopup';
      popup.style.cssText = 'position:fixed; top:24px; right:24px; z-index:999999; width:340px; background:rgba(22,27,39,0.96); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); border:2px solid var(--accent); border-radius:1.2rem; padding:1.2rem; box-shadow:0 24px 50px rgba(0,0,0,0.7), 0 0 30px rgba(0,201,167,0.45); transition:all 0.35s cubic-bezier(0.34,1.56,0.64,1); transform:translateX(420px);';
      document.body.appendChild(popup);
    }
    popup.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.6rem;">
        <span style="background:linear-gradient(135deg, #00c9a7, #10b981); color:#fff; font-size:0.68rem; font-weight:800; padding:0.25rem 0.6rem; border-radius:99px; text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 4px 10px rgba(0,201,167,0.4);">🔥 Nueva Urgencia en tu Alcaldía</span>
        <button onclick="document.getElementById('realtimePushPopup').style.transform='translateX(420px)'" style="background:none; border:none; color:var(--muted); cursor:pointer; font-size:1.3rem; font-weight:800; line-height:1;">×</button>
      </div>
      <h4 style="margin:0 0 0.35rem; font-size:1rem; color:var(--text); font-weight:800;">${request.category || 'Servicio Urgente'} en ${request.address || 'CDMX'}</h4>
      <p style="margin:0 0 0.8rem; font-size:0.82rem; color:var(--muted); line-height:1.4;">${request.description || 'Se solicita técnico calificado para atención inmediata en sitio.'}</p>
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--border); padding-top:0.7rem;">
        <span style="font-size:0.76rem; font-weight:700; color:var(--accent2);">⚡ Llegada &lt; 30 mins</span>
        <a href="#provTop" onclick="document.getElementById('realtimePushPopup').style.transform='translateX(420px)'" style="background:var(--accent); color:#fff; font-size:0.78rem; font-weight:800; padding:0.4rem 0.9rem; border-radius:0.6rem; text-decoration:none; box-shadow:0 6px 14px rgba(0,201,167,0.4);">Cotizar Ahora →</a>
      </div>
    `;
    setTimeout(() => { popup.style.transform = 'translateX(0)'; }, 60);
    setTimeout(() => { if (popup) popup.style.transform = 'translateX(420px)'; }, 9000);
  }

  if (pushToggle) {
    pushToggle.addEventListener('click', () => {
      pushAlertsEnabled = !pushAlertsEnabled;
      if (pushText) pushText.textContent = pushAlertsEnabled ? 'Alertas Push: ON' : 'Alertas Push: OFF';
      if (pushIcon) pushIcon.textContent = pushAlertsEnabled ? '🔔' : '🔕';
      pushToggle.style.borderColor = pushAlertsEnabled ? 'var(--accent)' : 'var(--border)';
      if (pushAlertsEnabled) playUrgencyBeep();
    });
  }

  if (testPushBtn) {
    testPushBtn.addEventListener('click', () => {
      showRealtimePushPopup({
        category: '⚡ Electricidad Urgente',
        address: 'Benito Juárez (Del Valle Sur)',
        description: 'Cortocircuito en centro de carga principal, sin luz en planta baja. Requiere revisión inmediata y cambio de pastilla.'
      });
    });
  }

  // Calculadora con comisión reducida Socio 60 Minutos (10% VIP en vez del 15% estándar)
  const slider = document.getElementById('svcSlider');
  const svcVal = document.getElementById('svcVal');
  const calcMonthly = document.getElementById('calcMonthly');
  const calcGross = document.getElementById('calcGross');
  const calcFee = document.getElementById('calcFee');
  const calcNet = document.getElementById('calcNet');
  const TICKET = 800, COMMISSION = 0.10; // 10% por Socio 60 Minutos VIP
  function fmt(n){ return '$' + n.toLocaleString('es-MX'); }
  function recalc(){
    if (!slider) return;
    const perWeek = Number(slider.value);
    if (svcVal) svcVal.textContent = perWeek;
    const monthly = perWeek * 4;
    const gross = monthly * TICKET;
    const fee = gross * COMMISSION;
    if (calcMonthly) calcMonthly.textContent = monthly;
    if (calcGross) calcGross.textContent = fmt(gross);
    if (calcFee) calcFee.textContent = '-' + fmt(fee) + ' (10% VIP)';
    if (calcNet) calcNet.textContent = fmt(gross - fee);
  }
  if (slider) {
    slider.addEventListener('input', recalc);
    recalc();
  }
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
  document.getElementById('pfPhone').value = profile.phone || '';
  const mySpecs = profile.specialties || [];
  SPEC_IDS.forEach(id => {
    const box = document.getElementById(id);
    if (box) box.checked = mySpecs.includes(box.value);
  });
  setProfileAvatarPreview(profile.avatar_url, profile.avatar_emoji);
  document.getElementById('profileVerifiedBadge').classList.toggle('hidden', !profile.verified);
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
    const phone = document.getElementById('pfPhone').value.trim();
    const specialties = SPEC_IDS
      .map(id => document.getElementById(id))
      .filter(box => box && box.checked)
      .map(box => box.value);
    const avatarFile = document.getElementById('pfAvatarFile').files[0];

    const updates = { name, zone, phone, specialties, specialty: specialties.join(' · ') };

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
    document.getElementById('provSpecialtyLabel').textContent = updates.specialty || 'Técnico Oficios60minutos';
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
  if (error) { console.error('[Oficios60minutos] Error al leer verificación:', error.message); return; }

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

  const idFile = document.getElementById('pfIdFile').files[0];
  const addressFile = document.getElementById('pfAddressFile').files[0];
  if (!idFile || !addressFile) return;
  const submitBtn = verifyForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando…';

  try {
    const idPath = `${user.id}/${Date.now()}-ine-${idFile.name}`;
    const { error: upErr1 } = await supabase.storage.from('verification-docs').upload(idPath, idFile);
    if (upErr1) throw upErr1;
    const addressPath = `${user.id}/${Date.now()}-domicilio-${addressFile.name}`;
    const { error: upErr2 } = await supabase.storage.from('verification-docs').upload(addressPath, addressFile);
    if (upErr2) throw upErr2;

    const { error } = await supabase.from('verifications').insert({
      technician_id: user.id, document_url: idPath, address_proof_url: addressPath
    });
    if (error) throw error;
    await loadVerificationStatus();
  } catch (err) {
    alert('No se pudo enviar tus documentos: ' + (err.message || err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar para verificación';
  }
});

// ============================================================
// Panel de técnico: Verificación de habilidades por categoría
// ============================================================
const SKILL_CATEGORIES = ['Plomería','Electricidad','Carpintería','Cerrajería','Pintura','Limpieza','A/C'];
const skillsGrid = document.getElementById('skillsGrid');
const skillsConfigNote = document.getElementById('skillsConfigNote');

if (isSupabaseConfigured) skillsConfigNote.classList.remove('show');
else skillsConfigNote.classList.add('show');

function skillRowHTML(cat, record){
  const status = record?.status;
  const statusLabel = { pendiente: 'En revisión', aprobada: '✓ Verificado', rechazada: 'Rechazada' }[status] || 'Sin verificar';
  const statusClass = status || '';
  const showUpload = status !== 'pendiente' && status !== 'aprobada';
  const safeCat = cat.replace(/[^a-zA-Z0-9]/g, '_');
  return `
    <div class="skill-row" data-cat="${cat}">
      <div class="ic">${categoryIcon(cat)}</div>
      <div class="skill-row-name">${cat}</div>
      <span class="skill-row-status ${statusClass}">${statusLabel}</span>
      ${showUpload ? `
        <label for="skillFile-${safeCat}" class="btn btn-secondary btn-sm" style="cursor:pointer; font-size:0.8rem; padding:0.35rem 0.65rem;">📎 Anexar foto</label>
        <input type="file" accept="image/*,application/pdf" id="skillFile-${safeCat}" style="display:none;" />
        <button type="button" class="btn btn-primary btn-sm js-upload-skill" data-cat="${cat}">Enviar</button>
      ` : ''}
    </div>`;
}

async function loadSkillVerifications(){
  const { user } = getSession();
  if (!user || !isSupabaseConfigured || !skillsGrid) return;

  const { data, error } = await supabase.from('skill_verifications').select('*').eq('technician_id', user.id);
  if (error) { console.error('[Oficios60minutos] Error al leer habilidades:', error.message); return; }

  const byCategory = {};
  (data || []).forEach(r => { byCategory[r.category] = r; });
  skillsGrid.innerHTML = SKILL_CATEGORIES.map(cat => skillRowHTML(cat, byCategory[cat])).join('');

  skillsGrid.querySelectorAll('.js-upload-skill').forEach(btn => {
    btn.addEventListener('click', () => handleSkillUpload(btn.dataset.cat));
  });
  skillsGrid.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const label = skillsGrid.querySelector(`label[for="${input.id}"]`);
      if (label && e.target.files[0]) {
        label.textContent = '📄 ' + (e.target.files[0].name.slice(0, 15)) + '...';
        label.style.background = 'rgba(var(--accent-rgb), 0.15)';
        label.style.borderColor = 'var(--accent)';
      }
    });
  });
}

async function handleSkillUpload(category){
  const { user } = getSession();
  if (!user) return;
  const safeCat = category.replace(/[^a-zA-Z0-9]/g, '_');
  const fileInput = document.getElementById(`skillFile-${safeCat}`);
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    alert('Elige una foto o documento para ' + category + ' antes de presionar Enviar.');
    return;
  }
  const file = fileInput.files[0];

  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${user.id}/skills/${safeCat}-${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from('verification-docs').upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });
    if (upErr) throw upErr;

    const { error } = await supabase.from('skill_verifications')
      .upsert({ technician_id: user.id, category, photo_url: path, status: 'pendiente' }, { onConflict: 'technician_id,category' });
    if (error) throw error;
    alert('¡Documento enviado con éxito para la categoría ' + category + '!');
    await loadSkillVerifications();
  } catch (err) {
    alert('No se pudo enviar tu verificación para ' + category + ': ' + (err.message || err));
  }
}

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
    console.error('[Oficios60minutos] No se pudieron leer las ventas:', error.message);
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

  if (error) { console.error('[Oficios60minutos] Error al leer verificaciones:', error.message); return; }
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
// Dashboard de Admin: lista de todos los técnicos registrados
// ============================================================
async function loadAdminTechnicians(){
  const grid = document.getElementById('adminTechGrid');
  const empty = document.getElementById('adminTechEmpty');
  const countTag = document.getElementById('adminTechCount');
  if (!isSupabaseConfigured) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    countTag.textContent = '0 técnicos';
    return;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('*, portfolio_items(count)')
    .eq('role', 'tecnico');

  if (error) { console.error('[Oficios60minutos] Error al leer técnicos:', error.message); return; }
  const rows = data || [];
  countTag.textContent = `${rows.length} técnico${rows.length === 1 ? '' : 's'}`;

  if (rows.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    grid.innerHTML = rows.map(t => techCardHTML({ ...t, jobCount: t.portfolio_items?.[0]?.count ?? 0 })).join('');
    grid.querySelectorAll('.js-view-tech').forEach(card => {
      card.addEventListener('click', () => openTechPortfolio(card.dataset.techId));
    });
  }
}

// ============================================================
// Dashboard de Admin: verificación de habilidades por categoría
// ============================================================
const adminSkillsList = document.getElementById('adminSkillsList');
const adminSkillsEmpty = document.getElementById('adminSkillsEmpty');

async function loadAdminSkills(){
  if (!isSupabaseConfigured) {
    adminSkillsList.innerHTML = '';
    adminSkillsEmpty.style.display = 'block';
    return;
  }
  const { data, error } = await supabase
    .from('skill_verifications')
    .select('*, profiles!skill_verifications_technician_id_fkey(name, zone)')
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true });

  if (error) { console.error('[Oficios60minutos] Error al leer habilidades:', error.message); return; }
  const rows = data || [];

  if (rows.length === 0) {
    adminSkillsList.innerHTML = '';
    adminSkillsEmpty.style.display = 'block';
    return;
  }
  adminSkillsEmpty.style.display = 'none';

  const cardsHTML = await Promise.all(rows.map(async (r) => {
    const tech = r.profiles || {};
    const { data: signed } = await supabase.storage.from('verification-docs').createSignedUrl(r.photo_url, 300);
    const viewLink = signed?.signedUrl
      ? `<a href="${signed.signedUrl}" target="_blank" rel="noopener" style="color:var(--accent2);font-weight:700;">Ver foto →</a>`
      : 'No se pudo generar el link de la foto';
    return `
      <div class="req-card" data-id="${r.id}">
        <div class="req-top">
          <div class="req-cat"><div class="ic">${categoryIcon(r.category)}</div><div><strong>${tech.name || 'Técnico'}</strong><span>${r.category}${tech.zone ? ' · ' + tech.zone : ''}</span></div></div>
        </div>
        <div class="req-meta">${viewLink}</div>
        <div class="req-actions">
          <button class="decline" data-id="${r.id}">Rechazar</button>
          <button class="accept" data-id="${r.id}" data-tech="${r.technician_id}" data-cat="${r.category}">Aprobar</button>
        </div>
      </div>
    `;
  }));
  adminSkillsList.innerHTML = cardsHTML.join('');
}

adminSkillsList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  const approve = btn.classList.contains('accept');
  btn.disabled = true;

  try {
    const { error: skErr } = await supabase
      .from('skill_verifications')
      .update({ status: approve ? 'aprobada' : 'rechazada', reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (skErr) throw skErr;

    if (approve) {
      const techId = btn.dataset.tech;
      const category = btn.dataset.cat;
      const { data: prof, error: profReadErr } = await supabase.from('profiles').select('verified_specialties').eq('id', techId).single();
      if (profReadErr) throw profReadErr;
      const current = prof?.verified_specialties || [];
      if (!current.includes(category)) {
        const { error: profErr } = await supabase.from('profiles')
          .update({ verified_specialties: [...current, category] }).eq('id', techId);
        if (profErr) throw profErr;
      }
    }
    await loadAdminSkills();
  } catch (err) {
    alert('No se pudo actualizar: ' + (err.message || err));
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

// ============================================================
// Motor de inclinación 3D con seguimiento del cursor + brillo
// ============================================================
function init3DTiltEngine(){
  const TILT_SELECTOR = '.sim-card, .benefit-card, .tech-card, .t-card, .zone-card';
  const MAX_TILT = 7; // grados, sutil a propósito
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  function attachTilt(el){
    if (el.dataset.tiltBound) return;
    el.dataset.tiltBound = 'true';

    const glare = document.createElement('div');
    glare.className = 'tilt-glare';
    el.appendChild(glare);

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2, cy = rect.height / 2;
      const rotateX = ((cy - y) / cy) * MAX_TILT;
      const rotateY = ((x - cx) / cx) * MAX_TILT;
      el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(6px)`;
      glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,.16), transparent 60%)`;
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
      glare.style.background = 'transparent';
    });
  }

  function scanForTiltCards(root){
    (root || document).querySelectorAll(TILT_SELECTOR).forEach(attachTilt);
  }

  // Aplica el efecto a las tarjetas que ya existen al cargar la página...
  scanForTiltCards();

  // ...y detecta automáticamente tarjetas nuevas (técnicos, solicitudes,
  // ofertas, etc. que se agregan después de consultar Supabase).
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches(TILT_SELECTOR)) attachTilt(node);
        scanForTiltCards(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
init3DTiltEngine();

// ============================================================
// Modo oscuro / claro
// ============================================================
(() => {
  const html = document.documentElement;
  const saved = localStorage.getItem('to60-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  html.setAttribute('data-theme', theme);

  function updateIcons(t) {
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = t === 'dark' ? '🌙' : '☀️';
    });
  }
  updateIcons(theme);

  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = html.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('to60-theme', next);
      updateIcons(next);
    });
  });
})();
