/* ============ AQUÍ VAN TUS DATOS (edítalos o pásaselos a Claude) ============ */
const DATA = {
  nombre: "Anita",
  juego: "Obby Creator",       // el juego donde os conocisteis
  yoNombre: "Mario",           // la etiqueta de tu cubito en la animación
  intro: "Todo empezó con una partida de Obby Creator. Esto es para recordar lo que vino después.",

  // CANDADO: la web no se abre hasta esta fecha y hora (la del móvil de quien la abra).
  // "codigoHash" es la huella del código secreto (el código no está escrito aquí).
  // Para cambiar el código, pídeselo a Claude: te devuelve la huella nueva.
  // Para abrirla antes: escribe el código en el candado, o usa index.html?abrir=CODIGO
  bloqueo: {
    fecha: "2026-11-01T00:00:00",
    codigoHash: "1im1gaxzis7"
  },

  // Opcional: foto en la portada (ej: "fotos/anita.jpg"). Vacío = no se muestra.
  fotoPortada: "",

  // Fecha en que os conocisteis, formato "AAAA-MM-DD". La portada muestra cuánto tiempo ha pasado.
  amistadDesde: "2022-08-20",
  amistadNota: "desde el 20 de agosto de 2022, en Obby Creator",

  // Cada recuerdo es una ETAPA de la animación y luego sale en la línea del tiempo.
  // "escena" es el mundo animado de esa etapa. Opciones:
  //   obby (concurso de construir en Obby Creator) · llamada (horas en llamada, jugar de todo)
  //   corazon (salir y quedar como amigos) · rieles (tren y sustos) · exito (juego famoso y compartir)
  //   distancia (dejar de hablar) · reencuentro (volver a hablar)
  //   noche (estrellas) · hoguera (tranquilidad) · lluvia (un mal momento y el sol) · fiesta (celebrar)
  //   carrera (carrera en un obby) · build (construir una pirámide)
  // Puedes poner todas las etapas que quieras; si pones más de 7 se repiten las escenas.
  // "foto" es opcional: pon el nombre de la imagen (ej: "fotos/1.jpg") o déjalo vacío.
  eventos: [
    { escena: "obby", cuando: "20 · 08 · 2022", titulo: "Nos conocimos en Obby Creator", texto: "Estabas con unos amigos y me uní. Hice un concurso con uno de ellos: quién construía mejor la casa de Calamardo de Bob Esponja. Gané, me metiste en llamada y desde ahí hablamos casi todos los días.", foto: "" },
    { escena: "llamada", cuando: "Después de aquella llamada", titulo: "Horas y horas en llamada", texto: "Pasábamos horas y horas en llamada. Jugábamos a todo lo que se nos ponía por delante.", foto: "" },
    { escena: "corazon", cuando: "Más adelante", titulo: "Salimos, y lo dejamos como amigos", texto: "Empecé a gustarte y empezamos a salir. No funcionó, así que lo dejamos como amigos.", foto: "" },
    { escena: "rieles", cuando: "Nuestra época de Rieles Muertos", titulo: "Rieles Muertos", texto: "Empezamos a jugar muchísimo a Rieles Muertos, de Roblox. Un tren, muchos sustos y mil partidas juntos.", foto: "" },
    { escena: "exito", cuando: "Cuando me fue bien", titulo: "Lo compartí con vosotros", texto: "Hice un juego de terror psicológico que se hizo famoso y empecé a ganar dinero. Decidí compartirlo contigo y con más amigos.", foto: "" },
    { escena: "distancia", cuando: "Un tiempo después", titulo: "Dejamos de hablar", texto: "Durante mucho tiempo dejamos de hablar. Cada uno por su lado.", foto: "" },
    { escena: "reencuentro", cuando: "Hoy", titulo: "Mejor que nunca", texto: "Volvimos a hablar y ahora estamos mejor que nunca. Siempre has sido la persona que me ha apoyado en todo.", foto: "" }
  ],

  // Velocidad de la animación: 1 = normal (~1 min). 2 = el doble de pausada, 3 = muy pausada (~3 min)...
  ritmo: 1,

  // La carta que sale al abrir el sobre grande.
  cartaPrincipal: {
    titulo: "Para ti, Anita",
    texto: "Todo empezó el 20 de agosto de 2022, en una partida de Obby Creator. Desde entonces han pasado muchas partidas, muchas risas y mucha vida.\n\nGracias por cada conversación y por estar siempre.\n\nTe quiero muchísimo.",
    firma: "Mario"
  },

  razones: [
    { titulo: "Me haces reír", texto: "Contigo hasta los días malos acaban en risas." },
    { titulo: "Me apoyas en todo", texto: "Siempre has sido la persona que me ha apoyado en todo." },
    { titulo: "Eres auténtica", texto: "No cambias por nadie y eso es lo que más admiro." },
    { titulo: "Me entiendes", texto: "A veces ni hace falta que hable para que sepas qué me pasa." },
    { titulo: "Todo es mejor contigo", texto: "Cualquier plan es mejor si vienes tú, aunque sea otro obby imposible." },
    { titulo: "Eres de las pocas", texto: "De esas personas que se quedan para siempre." }
  ],

  fotos: [
    { src: "", pie: "Nuestro primer verano" },
    { src: "", pie: "Cara de risa total" },
    { src: "", pie: "Esa noche" },
    { src: "", pie: "Siempre juntos" },
    { src: "", pie: "Locuras varias" },
    { src: "", pie: "Mi favorita" }
  ],

  cartas: [
    { titulo: "Lo que más admiro de ti", sub: "Ábrela primero", texto: "Admiro tu forma de ser, cómo cuidas de los demás y lo valiente que eres, aunque a veces no te des cuenta.\n\nGracias por ser como eres." },
    { titulo: "Mi recuerdo favorito", sub: "Uno de los mejores", texto: "Hay un momento contigo que siempre vuelve a mi cabeza y me hace sonreír.\n\nCuéntalo aquí con tus palabras." },
    { titulo: "Para cuando tengas un mal día", sub: "Guárdala bien", texto: "Recuerda que eres increíble, que no estás sola y que tienes un amigo que te quiere mucho.\n\nSiempre, siempre, aquí." }
  ],

  finalTitulo: "Gracias por estos años.",
  finalTexto: "Por muchas partidas más."
};
/* ========================================================================== */

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const target = new Date(DATA.bloqueo.fecha);
const fechaLarga = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- Sin zoom: pellizco, doble toque y Ctrl + rueda ---------- */
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());
addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });

/* ---------- Esperas que se pueden saltar (solo la animación inicial) ---------- */
let skipped = false, wake = [];
const sleep = ms => new Promise(res => {
  if (skipped) return res();
  const t = setTimeout(done, ms);
  function done() { clearTimeout(t); wake = wake.filter(w => w !== done); res(); }
  wake.push(done);
});
function skip() { skipped = true; wake.slice().forEach(w => w()); if (window.Obby) Obby.skip(); }

/* ---------- Fondo de estrellas (muy sutil) ---------- */
(function stars() {
  const c = $('stars'), ctx = c.getContext('2d');
  const colors = ['#ffffff', '#c4b5fd', '#a9d4ff'];
  let w, h, list = [];
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr;
    list = Array.from({ length: 70 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: (Math.random() * 1.1 + .35) * dpr, p: Math.random() * 6.28,
      s: Math.random() * .015 + .004, col: colors[Math.floor(Math.random() * colors.length)]
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of list) {
      s.p += s.s;
      ctx.globalAlpha = reduced ? .4 : .12 + .4 * Math.abs(Math.sin(s.p));
      ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill();
    }
    if (!reduced) requestAnimationFrame(draw);
  }
  addEventListener('resize', resize);
  resize(); draw();
})();

/* ---------- Pintar la página ---------- */
const stagger = i => `style="--d:${Math.min(i, 5) * 70}ms"`;

function render() {
  const nombre = DATA.nombre;
  document.title = 'Para ' + nombre;
  $('navName').textContent = nombre;
  $('footName').textContent = 'Para ' + nombre;
  $('gateKicker').textContent = 'Para ' + nombre;
  $('nombre').textContent = nombre;
  $('envInitial').textContent = nombre.charAt(0);
  $('introTxt').textContent = DATA.intro;
  $('finalTitle').textContent = DATA.finalTitulo;
  $('finalText').textContent = DATA.finalTexto;
  if (!isNaN(target)) {
    $('heroDate').textContent = fechaLarga(target);
    $('footDate').textContent = fechaLarga(target);
  }

  if (DATA.fotoPortada) {
    $('heroPhoto').innerHTML = `<img src="${esc(DATA.fotoPortada)}" alt="${esc(nombre)}">`;
    $('heroPhoto').classList.remove('hidden');
  }

  const cp = DATA.cartaPrincipal;
  $('paper').innerHTML = `<h3>${esc(cp.titulo)}</h3><div class="body">${esc(cp.texto)}</div>` +
    (cp.firma ? `<div class="sign">${esc(cp.firma)}</div>` : '');

  $('timeline').innerHTML = DATA.eventos.map((e, i) => `
    <article class="tl-item reveal">
      <div class="tl-meta"><span class="tl-idx">${pad2(i + 1)}</span><span>${esc(e.cuando)}</span></div>
      <div class="tl-body">
        ${e.foto ? `<img src="${esc(e.foto)}" alt="${esc(e.titulo)}" loading="lazy">` : ''}
        <h3>${esc(e.titulo)}</h3>
        <p>${esc(e.texto)}</p>
      </div>
    </article>`).join('');

  $('reasons').innerHTML = DATA.razones.map((r, i) => `
    <li class="reason reveal" ${stagger(i % 2)}>
      <span class="r-num">${pad2(i + 1)}</span>
      <div><h3>${esc(r.titulo)}</h3><p>${esc(r.texto)}</p></div>
    </li>`).join('');

  $('gallery').innerHTML = DATA.fotos.map((f, i) => `
    <figure class="photo reveal" ${stagger(i % 3)}>
      <button class="frame${f.src ? '' : ' empty'}" type="button" data-i="${i}" aria-label="Ver foto: ${esc(f.pie)}">
        ${f.src ? `<img src="${esc(f.src)}" alt="${esc(f.pie)}" loading="lazy">` : 'Foto ' + pad2(i + 1)}
      </button>
      <figcaption><span class="n">${pad2(i + 1)}</span><span>${esc(f.pie)}</span></figcaption>
    </figure>`).join('');

  $('letters').innerHTML = DATA.cartas.map((c, i) => `
    <div class="letter reveal">
      <button class="letter-head" type="button" aria-expanded="false">
        <span class="l-num">${pad2(i + 1)}</span>
        <span><span class="l-title">${esc(c.titulo)}</span><span class="l-sub">${esc(c.sub || '')}</span></span>
        <span class="l-icon"></span>
      </button>
      <div class="panel"><div class="panel-in">${esc(c.texto)}</div></div>
    </div>`).join('');

  document.querySelectorAll('.letter-head').forEach(b => b.addEventListener('click', () => {
    const l = b.parentElement; l.classList.toggle('open');
    b.setAttribute('aria-expanded', l.classList.contains('open'));
  }));
  document.querySelectorAll('.frame').forEach(el => el.addEventListener('click', () => openLb(+el.dataset.i)));

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
    <div class="counter-row">
      <div><b data-n="${y}">0</b><span>años</span></div>
      <div><b data-n="${m}">0</b><span>meses</span></div>
      <div><b data-n="${d}">0</b><span>días</span></div>
    </div>
    <p class="counter-note">${esc(DATA.amistadNota || ('desde ' + desde))}</p>`;
  box.classList.remove('hidden');
}

function countUp() {
  document.querySelectorAll('.counter b[data-n]').forEach(el => {
    const t = +el.dataset.n;
    if (reduced || !t) { el.textContent = t; return; }
    const t0 = performance.now(), dur = 1400;
    (function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(t * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
}

/* ---------- Pantalla de carga ---------- */
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

/* ---------- Animación: el obby de vuestra historia ---------- */
async function type(el, text) {
  if (reduced) { el.textContent = text; return; }
  el.textContent = '';
  for (const ch of text) {
    if (skipped) { el.textContent = text; return; }
    el.textContent += ch;
    await sleep(21 * (DATA.ritmo || 1));
  }
}

let activeCard = null;
// Altura que ocupará la tarjeta (con todo el texto): la escena se coloca debajo para no taparla.
function measureCard(label, s) {
  const box = $('sceneMeasure');
  box.innerHTML = `<div class="scene-card in"><p class="sc-stage">${esc(label)}</p><p class="sc-when">${esc(s.cuando)}</p>
    <h2 class="sc-title">${esc(s.titulo)}</h2><p class="sc-text">${esc(s.texto)}</p></div>`;
  const r = box.firstElementChild.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom };
}

async function showCard(label, s, hold) {
  const card = document.createElement('div');
  card.className = 'scene-card';
  card.innerHTML = `<p class="sc-stage">${esc(label)}</p><p class="sc-when">${esc(s.cuando)}</p>
    <h2 class="sc-title">${esc(s.titulo)}</h2><p class="sc-text"></p>`;
  $('scene').replaceChildren(card);
  activeCard = card;
  // fija la altura del texto desde el principio (así no "crece" al escribirse)
  const tp = card.querySelector('.sc-text'); tp.textContent = s.texto; tp.style.minHeight = tp.offsetHeight + 'px'; tp.textContent = '';
  void card.offsetWidth;
  card.classList.add('in');
  await sleep(450);
  await type(card.querySelector('.sc-text'), s.texto);
  await sleep((hold == null ? 1300 : hold) * (DATA.ritmo || 1));
}
async function hideCard() {
  if (!activeCard) return;
  activeCard.classList.remove('in'); activeCard.classList.add('out');
  await sleep(550);
  activeCard = null;
}

const DEFAULT_SCENES = ['obby', 'llamada', 'corazon', 'rieles', 'exito', 'distancia', 'reencuentro'];

async function playIntro() {
  // Para probar una sola escena: index.html?abrir=CODIGO&escena=lluvia
  let order = DATA.eventos.map((e, i) => i);
  const forced = params.get('escena');
  if (forced) { const k = DATA.eventos.findIndex(e => e.escena === forced); if (k >= 0) order = [k]; }
  const evs = order.map(i => DATA.eventos[i]);
  const N = evs.length;
  const fechaCorta = isNaN(new Date(DATA.amistadDesde))
    ? '' : ' · ' + new Date(DATA.amistadDesde + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.');
  $('intro').classList.remove('hidden', 'fade-out');
  $('introCount').textContent = DATA.juego + fechaCorta;
  const label = j => 'Etapa ' + pad2(order[j] + 1);

  if (reduced || !window.Obby) {
    // Versión sin movimiento: solo las tarjetas con cada recuerdo
    $('obby').classList.add('hidden');
    for (let i = 0; i < N && !skipped; i++) {
      $('introCount').textContent = label(i) + ' / ' + pad2(DATA.eventos.length);
      $('introBar').style.width = ((i + 1) / N * 100) + '%';
      await showCard(label(i), evs[i]);
      await hideCard();
    }
  } else {
    try { await Obby.play({
      canvas: $('obby'),
      scenes: evs.map((e, i) => e.escena || DEFAULT_SCENES[order[i] % DEFAULT_SCENES.length]),
      names: { me: DATA.yoNombre || 'Yo', her: DATA.nombre },
      sleep,
      pace: DATA.ritmo || 1,
      onUniverse: look => { $('intro').style.setProperty('--uni', look.accent || '#a9d4ff'); $('intro').dataset.uni = look.id || ''; },
      cardBox: j => j >= N ? measureCard('Meta', { cuando: 'Y ahora', titulo: 'Un último reto.', texto: 'Ahora toca ganarte tu regalo.' }) : measureCard(label(j), evs[j]),
      card: {
        show: j => showCard(label(j), evs[j]),
        showFinal: () => showCard('Meta', { cuando: 'Y ahora', titulo: 'Un último reto.', texto: 'Ahora toca ganarte tu regalo.' }, 900),
        hide: hideCard
      },
      onStage: j => {
        $('introCount').textContent = label(j) + ' / ' + pad2(DATA.eventos.length);
        $('introBar').style.width = ((j + 1) / N * 100) + '%';
      }
    });
    } catch (err) { console.error(err); }
  }
  // Al terminar el recorrido por vuestra historia, un portal teletransporta a Anita al juego final.
  if (window.Juego && !params.has('sinjuego') && !gifted()) {
    $('intro').classList.add('hidden');
    await playGame();
    reveal();
    $('game').classList.add('fade-out');
    await wait(850);
    $('game').classList.add('hidden');
    return;
  }
  // (sin juego) La página aparece debajo mientras la animación se desvanece
  reveal();
  $('intro').classList.add('fade-out');
  await wait(850);
  $('intro').classList.add('hidden');
}

/* ---------- El último reto: un obby para ganarse el regalo ---------- */
const GIFT_KEY = 'homenaje_regalo_ganado';
const gifted = () => { try { return !!localStorage.getItem(GIFT_KEY); } catch (e) { return false; } };
async function playGame() {
  document.body.classList.add('in-game');
  $('game').classList.remove('hidden', 'fade-out');
  // reinicia el destello de teletransporte
  const fl = $('game').querySelector('.g-flash'); fl.style.animation = 'none'; void fl.offsetWidth; fl.style.animation = '';
  try {
    await Juego.play({ root: $('game'), startCp: +params.get('cp') || 0, allStars: params.has('estrellas') });
    try { localStorage.setItem(GIFT_KEY, '1'); } catch (e) {}
  } catch (err) { console.error(err); }   // si algo fallara, nunca se queda sin su regalo
  document.body.classList.remove('in-game');
}

/* ---------- Revelar la página ---------- */
function setupScroll() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    if (e.target.classList.contains('hero-foot')) countUp();
  }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  const nav = $('nav'), links = [...nav.querySelectorAll('.links a')];
  const onScroll = () => nav.classList.toggle('show', scrollY > innerHeight * .5);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-40% 0px -55% 0px' });
  links.map(a => document.querySelector(a.getAttribute('href'))).forEach(s => s && spy.observe(s));
}

function reveal() {
  document.body.classList.remove('locked');
  $('main').classList.remove('hidden');
  scrollTo(0, 0);
  requestAnimationFrame(() => requestAnimationFrame(() => $('main').classList.add('show')));
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
    : `<div class="lb-empty">Foto ${pad2(cur + 1)}</div>`;
  $('lbCap').textContent = f.pie;
  $('lbCount').textContent = pad2(cur + 1) + ' / ' + pad2(n);
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
const syncIcon = () => musicBtn.classList.toggle('is-off', music.paused);
music.addEventListener('play', syncIcon);
music.addEventListener('pause', syncIcon);
// Si no se encuentra cancion.mp3, se esconde el botón y la web sigue sin sonido.
music.addEventListener('error', () => { musicOk = false; musicBtn.classList.add('hidden'); });
musicBtn.addEventListener('click', () => {
  if (music.paused) music.play().catch(() => {}); else music.pause();
});

function startMusic() {
  music.volume = 0;
  const p = music.play();                 // tiene que ir dentro del toque para que el móvil lo permita
  if (p) p.catch(syncIcon);
  if (musicOk) musicBtn.classList.remove('hidden');
  syncIcon();
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
// Huella del código: así el código no aparece escrito en este archivo.
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
const codeOk = v => !!v && cyrb53('anita·' + String(v).trim().toLowerCase()) === DATA.bloqueo.codigoHash;
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
  $('lockTitle').textContent = 'Todavía no, ' + DATA.nombre + '.';
  $('lockSub').textContent = 'Esto se abre el ' + fechaLarga(target) + '. Hay que esperar un poquito más.';
  $('lock').classList.remove('hidden');
  function tick() {
    const ms = target - Date.now();
    if (ms <= 0) { unlockNow(); return; }
    const t = Math.floor(ms / 1000);
    $('cdD').textContent = Math.floor(t / 86400);
    $('cdH').textContent = pad2(Math.floor(t % 86400 / 3600));
    $('cdM').textContent = pad2(Math.floor(t % 3600 / 60));
    $('cdS').textContent = pad2(t % 60);
  }
  tick();
  lockTimer = setInterval(tick, 1000);
}

function unlockNow() {
  clearInterval(lockTimer);
  $('lock').classList.add('fade-out');
  setTimeout(() => { $('lock').classList.add('hidden'); showGate(); }, 800);
}

function tryCode() {
  if (codeOk($('codeInput').value)) {
    store.set();
    $('codeMsg').textContent = '';
    unlockNow();
  } else {
    $('codeMsg').textContent = 'Ese código no es correcto';
    const box = $('codeBox'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  }
}
$('codeBtn').addEventListener('click', tryCode);
$('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryCode(); });

/* ---------- Arranque ---------- */
render();

// Pantalla "Empezar": el toque permite que suene la música en el móvil
function showGate() {
  $('gate').classList.remove('hidden');
  $('start').addEventListener('click', async () => {
    startMusic();
    $('gate').classList.add('fade-out');
    await sleep(600);
    $('gate').classList.add('hidden');
    await playIntro();
  }, { once: true });
}

// 1) carga  →  2) candado (si aún no es la fecha) o "Empezar"  →  3) animación  →  4) la página
async function start() {
  if (params.has('directo') && isUnlocked()) {
    // Atajo para editar rápido: index.html?directo&abrir=CODIGO → sale la página sin animación.
    $('loader').classList.add('hidden');
    reveal();
    return;
  }
  await runLoader();
  if (params.has('juego') && isUnlocked()) {
    // Atajo para probar el juego: index.html?juego&abrir=CODIGO  (cp=1..5 empieza en un punto de control, estrellas = ya las tiene)
    await playGame(); reveal(); $('game').classList.add('hidden'); return;
  }
  if (isUnlocked()) showGate(); else showLock();
}
start();
