// ============================================================
// TuOficio60Minutos — Asistente de preguntas frecuentes
// ============================================================
// Nota importante: este es un asistente basado en reglas (busca
// coincidencias de palabras clave), NO un modelo de IA generativo.
// Es intencional: conectar un modelo real (como Claude) requiere una
// clave de API que nunca debe quedar expuesta en el navegador de un
// sitio público. La forma correcta de hacerlo es a través de un
// backend seguro (por ejemplo, una Supabase Edge Function) que
// guarde esa clave del lado del servidor. Este archivo deja la
// estructura lista para conectarse a algo así en el futuro —
// solo habría que reemplazar `findAnswer()` por una llamada a esa
// función en vez de buscar en la lista de FAQ_KB.
// ============================================================

const FAQ_KB = [
  { keywords: ['como funciona', 'que es fixya', 'que es esto', 'de que trata', 'para que sirve'],
    answer: 'TuOficio60Minutos conecta a expertos del hogar verificados con quienes los necesitan. Publicas tu urgencia, recibes una cotización inmediata y confirmas con un técnico verificado — en menos de 60 minutos.' },
  { keywords: ['cuanto tarda', 'cuanto tiempo', 'cuando llega', 'tiempo de respuesta', 'minutos'],
    answer: 'El tiempo de respuesta promedio es de menos de 60 minutos, dependiendo de la categoría y tu zona.' },
  { keywords: ['cuanto cuesta', 'precio', 'costo', 'cotizar', 'gratis'],
    answer: 'Cotizar no tiene costo. Ves el precio estimado del servicio antes de confirmar, así que no hay sorpresas.' },
  { keywords: ['categorias', 'servicios', 'que arreglan', 'tipos de servicio', 'que reparan'],
    answer: 'Trabajamos con Plomería, Electricidad, Carpintería, Cerrajería, Pintura, Limpieza, Aire acondicionado (A/C) y otros servicios del hogar.' },
  { keywords: ['zonas', 'cobertura', 'donde', 'ciudades', 'ubicacion'],
    answer: 'Por ahora tenemos cobertura activa en Polanco, Masaryk, Santa Fe y Condesa.' },
  { keywords: ['verificado', 'confianza', 'seguro', 'antecedentes'],
    answer: 'Sí, todos los técnicos pasan por un proceso de verificación antes de poder recibir solicitudes en la plataforma.' },
  { keywords: ['app', 'descargar', 'aplicacion', 'play store', 'app store'],
    answer: 'No necesitas descargar ninguna app. TuOficio60Minutos funciona directo desde el navegador, en computadora o celular.' },
  { keywords: ['registrar', 'crear cuenta', 'cuenta nueva', 'como me registro'],
    answer: 'Dale clic a "Crear cuenta" arriba a la derecha, elige si eres Cliente o Técnico, y listo — ya puedes usar TuOficio60Minutos.' },
  { keywords: ['iniciar sesion', 'login', 'no puedo entrar', 'contrasena', 'olvide'],
    answer: 'Usa el botón "Iniciar sesión" arriba a la derecha con tu correo y contraseña. Si acabas de crear tu cuenta, revisa tu correo por si necesitas confirmarlo primero.' },
  { keywords: ['ser tecnico', 'trabajar', 'unirme', 'quiero ser tecnico', 'ofrecer mis servicios'],
    answer: 'Crea una cuenta y elige "Soy técnico" al registrarte. Vas a poder aceptar solicitudes, subir tu portafolio de trabajos anteriores y llevar el control de tus ganancias.' },
  { keywords: ['comision', 'cuanto gana', 'ganancias', 'ticket promedio'],
    answer: 'TuOficio60Minutos retiene una comisión del 15% sobre cada servicio. El ticket promedio en la plataforma es de $800 MXN.' },
  { keywords: ['portafolio', 'trabajos anteriores', 'fotos', 'ver tecnico', 'trabajos pasados'],
    answer: 'Sí — en la sección "Técnicos" puedes ver el perfil de cada uno y su portafolio de trabajos anteriores antes de confirmar tu solicitud.' },
  { keywords: ['cancelar', 'cancelacion'],
    answer: 'Puedes cancelar tu solicitud mientras sigue en cotización, desde el mismo simulador. Si ya fue aceptada por un técnico, te recomendamos contactarlo directamente.' },
  { keywords: ['soporte', 'ayuda humana', 'contacto', 'hablar con alguien', 'humano'],
    answer: 'Por ahora este asistente cubre las preguntas más comunes. Para algo más específico, escríbenos y te ayudamos personalmente.' },
];

const FAQ_FALLBACK = 'No estoy seguro de haber entendido eso. Intenta con otras palabras, o elige una de las preguntas sugeridas abajo.';
const FAQ_GREETING = '¡Hola! 👋 Soy el asistente de TuOficio60Minutos. Puedo ayudarte con preguntas sobre cómo funciona la plataforma, precios, zonas de cobertura y más. ¿Qué quieres saber?';
const FAQ_QUICK_QUESTIONS = [
  '¿Cómo funciona TuOficio60Minutos?',
  '¿Cuánto cuesta cotizar?',
  '¿Qué zonas cubren?',
  '¿Cómo me registro?',
  '¿Cómo puedo ser técnico?',
];

function faqNormalize(str){
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,]/g, '')
    .trim();
}

function findAnswer(question){
  const q = faqNormalize(question);
  let best = null, bestScore = 0;
  FAQ_KB.forEach(item => {
    let score = 0;
    item.keywords.forEach(kw => {
      if (q.includes(faqNormalize(kw))) score += kw.split(' ').length;
    });
    if (score > bestScore) { bestScore = score; best = item; }
  });
  return best ? best.answer : FAQ_FALLBACK;
}

(() => {
  const toggleBtn = document.getElementById('chatToggleBtn');
  const panel = document.getElementById('chatPanel');
  const iconOpen = document.getElementById('chatIconOpen');
  const iconClose = document.getElementById('chatIconClose');
  const closeBtn = document.getElementById('chatCloseBtn');
  const body = document.getElementById('chatBody');
  const quick = document.getElementById('chatQuick');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  if (!toggleBtn) return;

  let started = false;

  function addMessage(text, sender){
    const div = document.createElement('div');
    div.className = `chat-msg ${sender}`;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function renderQuick(){
    quick.innerHTML = '';
    FAQ_QUICK_QUESTIONS.forEach(q => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = q;
      btn.addEventListener('click', () => handleUserMessage(q));
      quick.appendChild(btn);
    });
  }

  function handleUserMessage(text){
    if (!text.trim()) return;
    addMessage(text, 'user');
    input.value = '';
    setTimeout(() => addMessage(findAnswer(text), 'bot'), 350);
  }

  function openChat(){
    panel.classList.remove('hidden');
    iconOpen.classList.add('hidden');
    iconClose.classList.remove('hidden');
    if (!started) {
      started = true;
      addMessage(FAQ_GREETING, 'bot');
      renderQuick();
    }
    input.focus();
  }
  function closeChat(){
    panel.classList.add('hidden');
    iconOpen.classList.remove('hidden');
    iconClose.classList.add('hidden');
  }

  toggleBtn.addEventListener('click', () => {
    panel.classList.contains('hidden') ? openChat() : closeChat();
  });
  closeBtn.addEventListener('click', closeChat);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleUserMessage(input.value);
  });
})();
