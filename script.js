/* ============ AQUÍ VAN TUS DATOS (edítalos o pásaselos a Claude) ============ */
const DATA = {
  nombre: "Anita",

  // CANDADO: la web no se abre hasta esta fecha y hora (la del móvil de quien la abra).
  // Con el código se puede abrir antes (para probarla tú). También vale el enlace: index.html?abrir=TUCODIGO
  bloqueo: {
    fecha: "2026-11-01T00:00:00",
    codigo: "lunallena"
  },
  intro: "Un rinconcito hecho con cariño para recordarte lo mucho que significas para mí.",

  // Opcional: foto redonda en la portada (ej: "fotos/anita.jpg"). Vacío = no se muestra.
  fotoPortada: "",

  // Opcional: fecha en que os hicisteis amigas, formato "AAAA-MM-DD" (ej: "2019-09-01").
  // Si la pones, la portada muestra cuánto tiempo lleváis juntas. Vacío = no se muestra.
  amistadDesde: "",

  // Los recuerdos salen primero en la animación y luego en la línea del tiempo.
  // "foto" es opcional: pon el nombre de la imagen (ej: "fotos/1.jpg") o déjalo vacío.
  eventos: [
    { cuando: "El principio", titulo: "El día que nos conocimos", texto: "Aquí va cómo nos conocimos y qué pensé de ti al principio.", emoji: "✨", foto: "" },
    { cuando: "Cuando nos hicimos inseparables", titulo: "Nuestra primera aventura", texto: "Ese momento en el que supe que esto iba en serio.", emoji: "🌙", foto: "" },
    { cuando: "Un día cualquiera", titulo: "Una de nuestras mil risas", texto: "Ese recuerdo absurdo que solo entendemos nosotras.", emoji: "😂", foto: "" },
    { cuando: "Cuando más la necesité", titulo: "Estuviste ahí", texto: "Gracias por quedarte cuando las cosas se pusieron difíciles.", emoji: "🫂", foto: "" },
    { cuando: "Hoy", titulo: "Y aquí seguimos", texto: "Después de tanto tiempo, sigues siendo mi persona favorita.", emoji: "💜", foto: "" }
  ],

  // La carta que sale al abrir el sobre grande.
  cartaPrincipal: {
    titulo: "Para ti, Anita",
    texto: "Llevamos muchos años juntas y quería darte algo que te recordara lo importante que eres para mí.\n\nGracias por cada risa, cada conversación y por estar siempre.\n\nTe quiero muchísimo.",
    firma: "Tu amiga"
  },

  razones: [
    { emoji: "😂", titulo: "Me haces reír", texto: "Contigo hasta los días malos acaban en risas." },
    { emoji: "🫶", titulo: "Siempre estás", texto: "Aunque pase el tiempo, sé que puedo contar contigo." },
    { emoji: "🌟", titulo: "Eres auténtica", texto: "No cambias por nadie y eso es lo que más admiro." },
    { emoji: "🧠", titulo: "Me entiendes", texto: "A veces ni hace falta que hable para que sepas qué me pasa." },
    { emoji: "🎉", titulo: "Todo es mejor contigo", texto: "Cualquier plan es mejor si vienes tú." },
    { emoji: "💌", titulo: "Eres de las pocas", texto: "De esas personas que se quedan para siempre." }
  ],

  fotos: [
    { src: "", pie: "Nuestro primer verano" },
    { src: "", pie: "Cara de risa total" },
    { src: "", pie: "Esa noche" },
    { src: "", pie: "Siempre juntas" },
    { src: "", pie: "Locuras varias" },
    { src: "", pie: "Mi favorita" }
  ],

  cartas: [
    { titulo: "Lo que más admiro de ti", sub: "Ábrela primero", texto: "Admiro tu forma de ser, cómo cuidas de los demás y lo valiente que eres, aunque a veces no te des cuenta.\n\nGracias por ser como eres." },
    { titulo: "Mi recuerdo favorito", sub: "Uno de los mejores", texto: "Hay un momento contigo que siempre vuelve a mi cabeza y me hace sonreír.\n\nCuéntalo aquí con tus palabras." },
    { titulo: "Para cuando tengas un mal día", sub: "Guárdala bien", texto: "Recuerda que eres increíble, que no estás sola y que tienes una amiga que te quiere mucho.\n\nSiempre, siempre, aquí." }
  ],

  finalTitulo: "Gracias por estos años",
  finalTexto: "Por muchos más juntas 💜"
};
/* ========================================================================== */

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Esperas que se pueden saltar (solo la animación inicial) ---------- */
let skipped = false, wake = [];
const sleep = ms => new Promise(res => {
  if (skipped) return res();
  const t = setTimeout(done, ms);
  function done() { clearTimeout(t); wake = wake.filter(w => w !== done); res(); }
  wake.push(done);
});
function skip() { skipped = true; wake.slice().forEach(w => w()); }

/* ---------- Fondo de estrellas ---------- */
(function stars() {
  const c = $('stars'), ctx = c.getContext('2d');
  const colors = ['#ffffff', '#c4b5fd', '#a8d8ff', '#a78bfa'];
  let w, h, list = [];
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr;
    list = Array.from({ length: 110 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: (Math.random() * 1.4 + .4) * dpr, p: Math.random() * 6.28,
      s: Math.random() * .02 + .005, col: colors[Math.floor(Math.random() * colors.length)]
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of list) {
      s.p += s.s;
      ctx.globalAlpha = reduced ? .6 : .25 + .6 * Math.abs(Math.sin(s.p));
      ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill();
    }
    if (!reduced) requestAnimationFrame(draw);
  }
  addEventListener('resize', resize);
  resize(); draw();
})();

/* ---------- Pintar la página ---------- */
const stagger = i => `style="--d:${Math.min(i, 6) * 80}ms"`;

function render() {
  const nombre = DATA.nombre;
  document.title = 'Para ' + nombre + ' 💜';
  $('navName').textContent = nombre;
  $('footName').textContent = nombre;
  $('nombre').textContent = nombre;
  $('introTxt').textContent = DATA.intro;
  $('finalTitle').textContent = DATA.finalTitulo;
  $('finalText').textContent = DATA.finalTexto;

  // Foto de portada (opcional)
  if (DATA.fotoPortada) {
    $('heroPhoto').innerHTML = `<img src="${esc(DATA.fotoPortada)}" alt="${esc(nombre)}">`;
    $('heroPhoto').classList.remove('hidden');
  }

  // Carta principal
  const cp = DATA.cartaPrincipal;
  $('paper').innerHTML = `<h3>${esc(cp.titulo)}</h3><div class="body">${esc(cp.texto)}</div>` +
    (cp.firma ? `<div class="sign">— ${esc(cp.firma)}</div>` : '');

  // Línea del tiempo
  $('timeline').innerHTML = DATA.eventos.map((e, i) => `
    <div class="tl-item reveal">
      <div class="tl-dot">${esc(e.emoji || '💜')}</div>
      <div class="tl-card">
        ${e.foto ? `<img src="${esc(e.foto)}" alt="${esc(e.titulo)}" loading="lazy">` : ''}
        <span class="tl-when">${esc(e.cuando)}</span>
        <h3>${esc(e.titulo)}</h3>
        <p>${esc(e.texto)}</p>
      </div>
    </div>`).join('');

  // Razones
  $('reasons').innerHTML = DATA.razones.map((r, i) => `
    <div class="reason reveal" ${stagger(i % 3)}>
      <div class="ico">${esc(r.emoji)}</div>
      <div><h3>${esc(r.titulo)}</h3><p>${esc(r.texto)}</p></div>
    </div>`).join('');

  // Galería
  $('gallery').innerHTML = DATA.fotos.map((f, i) => f.src
    ? `<button class="photo reveal" type="button" data-i="${i}" ${stagger(i % 3)} aria-label="${esc(f.pie)}">
         <img src="${esc(f.src)}" alt="${esc(f.pie)}" loading="lazy"><span class="cap">${esc(f.pie)}</span></button>`
    : `<button class="photo empty reveal" type="button" data-i="${i}" ${stagger(i % 3)} aria-label="${esc(f.pie)}">
         <span class="em">📷</span><span class="hint">Tu foto aquí</span><span class="cap">${esc(f.pie)}</span></button>`).join('');

  // Cartas
  $('letters').innerHTML = DATA.cartas.map((c, i) => `
    <div class="letter reveal" ${stagger(i)}>
      <button class="letter-head" type="button" aria-expanded="false">
        <span class="ico">💌</span>
        <span class="txt"><span class="lt">${esc(c.titulo)}</span><br><span class="ls">${esc(c.sub || '')}</span></span>
        <span class="chev">⌄</span>
      </button>
      <div class="panel"><div>${esc(c.texto)}</div></div>
    </div>`).join('');

  document.querySelectorAll('.letter-head').forEach(b => b.addEventListener('click', () => {
    const l = b.parentElement; l.classList.toggle('open');
    b.setAttribute('aria-expanded', l.classList.contains('open'));
  }));
  document.querySelectorAll('.photo').forEach(el => el.addEventListener('click', () => openLb(+el.dataset.i)));

  renderCounter();
}

/* ---------- Contador de amistad (opcional) ---------- */
function renderCounter() {
  const box = $('counter');
  if (!DATA.amistadDesde) return;
  const from = new Date(DATA.amistadDesde + 'T00:00:00'), now = new Date();
  if (isNaN(from) || from > now) return;
  let y = now.getFullYear() - from.getFullYear(), m = now.getMonth() - from.getMonth(), d = now.getDate() - from.getDate();
  if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  const desde = from.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  box.innerHTML = `
    <div class="counter">
      <div class="box"><b data-n="${y}">0</b><span>años</span></div>
      <div class="box"><b data-n="${m}">0</b><span>meses</span></div>
      <div class="box"><b data-n="${d}">0</b><span>días</span></div>
    </div>
    <p class="counter-note">juntas desde ${esc(desde)}</p>`;
  box.classList.remove('hidden');
}

function countUp() {
  document.querySelectorAll('.counter b[data-n]').forEach(el => {
    const target = +el.dataset.n;
    if (reduced || !target) { el.textContent = target; return; }
    const t0 = performance.now(), dur = 1400;
    (function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
}

/* ---------- 1) Pantalla de carga ---------- */
async function runLoader() {
  const msgs = ['Cargando recuerdos…', 'Guardando risas…', 'Juntando momentos…', 'Casi listo…'];
  const total = reduced ? 600 : 3200, t0 = performance.now();
  await new Promise(res => {
    (function tick(now) {
      const p = Math.min((now - t0) / total, 1), e = 1 - Math.pow(1 - p, 2);
      $('barFill').style.width = (e * 100) + '%';
      $('pct').textContent = Math.round(e * 100) + '%';
      $('loaderText').textContent = msgs[Math.min(Math.floor(p * msgs.length), msgs.length - 1)];
      p < 1 ? requestAnimationFrame(tick) : res();
    })(t0);
  });
  await sleep(350);
  $('loader').classList.add('fade-out');
  await sleep(800);
  $('loader').classList.add('hidden');
}

/* ---------- 2) Animación de recuerdos ---------- */
async function type(el, text) {
  if (reduced) { el.textContent = text; return; }
  el.textContent = '';
  for (const ch of text) {
    if (skipped) { el.textContent = text; return; }
    el.textContent += ch;
    await sleep(24);
  }
}

async function playIntro() {
  const scenes = DATA.eventos.concat([{ cuando: 'Y ahora…', titulo: 'Tengo algo para ti', texto: 'Ábrelo con mucho cariño.', emoji: '💌', foto: '' }]);
  $('intro').classList.remove('hidden', 'fade-out');
  $('dots').innerHTML = scenes.map(() => '<i></i>').join('');
  const dots = $('dots').children;

  for (let i = 0; i < scenes.length && !skipped; i++) {
    const s = scenes[i];
    const card = document.createElement('div');
    card.className = 'scene-card';
    card.innerHTML = `
      <div class="polaroid">${s.foto ? `<img src="${esc(s.foto)}" alt="">` : `<div class="ph-in">${esc(s.emoji || '💜')}</div>`}</div>
      <div class="when">${esc(s.cuando)}</div>
      <h2>${esc(s.titulo)}</h2>
      <p></p>`;
    $('scene').replaceChildren(card);
    [...dots].forEach((d, k) => d.classList.toggle('on', k === i));
    void card.offsetWidth;
    card.classList.add('in');
    await sleep(500);
    await type(card.querySelector('p'), s.texto);
    await sleep(1500);
    card.classList.remove('in'); card.classList.add('out');
    await sleep(700);
  }
  $('intro').classList.add('fade-out');
  await sleep(800);
  $('intro').classList.add('hidden');
}

/* ---------- 3) Revelar la página ---------- */
function burst() {
  const icons = ['💜', '💙', '✨', '🤍', '💫'], box = $('burst');
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('span');
    s.textContent = icons[Math.floor(Math.random() * icons.length)];
    s.style.left = Math.random() * 100 + '%';
    s.style.fontSize = (16 + Math.random() * 24) + 'px';
    s.style.animationDuration = (4 + Math.random() * 5) + 's';
    s.style.animationDelay = (Math.random() * 1.5) + 's';
    box.appendChild(s);
    setTimeout(() => s.remove(), 11000);
  }
}

function setupScroll() {
  // Aparecer al hacer scroll
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    if (e.target.id === 'counter') countUp();
  }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // Barra de navegación: aparece al bajar y marca la sección actual
  const nav = $('nav'), links = [...nav.querySelectorAll('.links a')];
  const onScroll = () => nav.classList.toggle('show', scrollY > innerHeight * .5);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => s && spy.observe(s));
}

function reveal() {
  document.body.classList.remove('locked');
  $('main').classList.remove('hidden');
  scrollTo(0, 0);
  requestAnimationFrame(() => requestAnimationFrame(() => $('main').classList.add('show')));
  if (!reduced) burst();
  setupScroll();
}

/* ---------- Sobre / carta principal ---------- */
let opened = false;
async function openEnvelope() {
  if (opened) return;
  opened = true;
  $('openLetter').classList.add('hidden');
  $('envHint').classList.add('hidden');
  $('env').classList.add('open');
  await wait(1300);
  $('paper').classList.remove('hidden');
  $('paper').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
}
$('openLetter').addEventListener('click', openEnvelope);
$('env').addEventListener('click', openEnvelope);
$('env').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); } });

/* ---------- Visor de fotos ---------- */
let cur = 0;
function showPhoto(i) {
  const n = DATA.fotos.length;
  cur = (i + n) % n;
  const f = DATA.fotos[cur];
  $('lbBody').innerHTML = f.src
    ? `<img src="${esc(f.src)}" alt="${esc(f.pie)}">`
    : `<div class="lb-empty">📷<span>Tu foto aquí</span></div>`;
  $('lbCap').textContent = f.pie;
  $('lbCount').textContent = (cur + 1) + ' / ' + n;
}
function openLb(i) { showPhoto(i); $('lb').classList.add('on'); document.body.classList.add('noscroll'); }
function closeLb() { $('lb').classList.remove('on'); document.body.classList.remove('noscroll'); }
$('lbClose').addEventListener('click', closeLb);
$('lbPrev').addEventListener('click', () => showPhoto(cur - 1));
$('lbNext').addEventListener('click', () => showPhoto(cur + 1));
$('lb').addEventListener('click', e => { if (e.target === $('lb') || e.target === $('lbBody')) closeLb(); });
addEventListener('keydown', e => {
  if (!$('lb').classList.contains('on')) return;
  if (e.key === 'Escape') closeLb();
  if (e.key === 'ArrowLeft') showPhoto(cur - 1);
  if (e.key === 'ArrowRight') showPhoto(cur + 1);
});
let tx = null;
$('lb').addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
$('lb').addEventListener('touchend', e => {
  if (tx === null) return;
  const dx = e.changedTouches[0].clientX - tx; tx = null;
  if (Math.abs(dx) > 50) showPhoto(cur + (dx < 0 ? 1 : -1));
}, { passive: true });

/* ---------- Botones del final ---------- */
$('toTop').addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
$('replay').addEventListener('click', () => location.href = location.pathname);
$('skip').addEventListener('click', skip);

/* ---------- Música ---------- */
const music = $('music'), musicBtn = $('musicBtn');
let musicOk = true;
const icon = () => { musicBtn.firstElementChild.textContent = music.paused ? '🔇' : '🔊'; };
music.addEventListener('play', icon);
music.addEventListener('pause', icon);
// Si no se encuentra el archivo, se esconde el botón y la web sigue sin sonido.
music.addEventListener('error', () => { musicOk = false; musicBtn.classList.add('hidden'); }, true);
musicBtn.addEventListener('click', () => {
  if (music.paused) music.play().catch(() => {}); else music.pause();
});

function startMusic() {
  music.volume = 0;
  const p = music.play();                 // tiene que ir dentro del toque para que el móvil lo permita
  if (p) p.catch(() => {});
  if (musicOk) musicBtn.classList.remove('hidden');
  let v = 0;                              // subida suave de volumen
  const fade = setInterval(() => {
    v = Math.min(v + 0.05, 0.9);
    music.volume = v;
    if (v >= 0.9) clearInterval(fade);
  }, 150);
}

/* ---------- Candado (abre el 1 de noviembre) ---------- */
const params = new URLSearchParams(location.search);
const LOCK_KEY = 'homenaje_desbloqueada';
const target = new Date(DATA.bloqueo.fecha);
const codeOk = v => !!v && String(v).trim().toLowerCase() === String(DATA.bloqueo.codigo).trim().toLowerCase();
const store = {
  get: () => { try { return localStorage.getItem(LOCK_KEY); } catch (e) { return null; } },
  set: () => { try { localStorage.setItem(LOCK_KEY, '1'); } catch (e) {} }
};

function isUnlocked() {
  if (isNaN(target) || Date.now() >= target) return true;   // ya es la fecha (o fecha mal puesta)
  if (store.get()) return true;                              // ya se abrió antes con el código
  if (codeOk(params.get('abrir'))) { store.set(); return true; }
  return false;
}

let lockTimer = null;
function showLock() {
  const fecha = target.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  $('lockTitle').textContent = 'Todavía no, ' + DATA.nombre + '…';
  $('lockSub').textContent = 'Esto se abrirá el ' + fecha + '. Hay que esperar un poquito más.';
  $('lock').classList.remove('hidden');
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    const ms = target - Date.now();
    if (ms <= 0) { unlockNow(); return; }
    const t = Math.floor(ms / 1000);
    $('cdD').textContent = Math.floor(t / 86400);
    $('cdH').textContent = pad(Math.floor(t % 86400 / 3600));
    $('cdM').textContent = pad(Math.floor(t % 3600 / 60));
    $('cdS').textContent = pad(t % 60);
  }
  tick();
  lockTimer = setInterval(tick, 1000);
}

function unlockNow() {
  clearInterval(lockTimer);
  $('lock').classList.add('fade-out');
  setTimeout(() => { $('lock').classList.add('hidden'); boot(); }, 800);
}

// Código secreto para abrir antes de tiempo
$('codeToggle').addEventListener('click', () => {
  $('codeForm').classList.toggle('hidden');
  if (!$('codeForm').classList.contains('hidden')) $('codeInput').focus();
});
function tryCode() {
  if (codeOk($('codeInput').value)) {
    store.set();
    $('codeMsg').textContent = '';
    unlockNow();
  } else {
    $('codeMsg').textContent = 'Ese código no es correcto';
    const box = $('codeInput'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  }
}
$('codeBtn').addEventListener('click', tryCode);
$('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryCode(); });

/* ---------- Arranque ---------- */
render();

// Se ejecuta cuando la web ya está desbloqueada
function boot() {
  if (params.has('directo')) {
    // Atajo para editar rápido: index.html?directo&abrir=TUCODIGO → sale la página sin animación.
    reveal();
    return;
  }
  $('gate').classList.remove('hidden');
  $('start').addEventListener('click', async () => {
    startMusic();
    $('gate').classList.add('fade-out');
    await sleep(600);
    $('gate').classList.add('hidden');
    $('loader').classList.remove('hidden');
    await runLoader();
    await playIntro();
    reveal();
  }, { once: true });
}

if (isUnlocked()) boot(); else showLock();
