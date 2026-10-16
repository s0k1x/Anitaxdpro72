/* ============ AQUÍ VAN TUS DATOS (edítalos o pásaselos a Claude) ============ */
const DATA = {
  nombre: "Anita",
  intro: "Una pequeña sorpresa para recordarte lo mucho que significas para mí.",

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
    texto: "Llevamos muchos años juntas y quería darte algo que te recordara lo importante que eres para mí.\n\nGracias por cada risa, cada conversación y por estar siempre.\n\nTe quiero muchísimo."
  },

  fotos: [
    { src: "", pie: "Nuestro primer verano", ratio: 1 },
    { src: "", pie: "Cara de risa total", ratio: 1.3 },
    { src: "", pie: "Esa noche", ratio: 0.8 },
    { src: "", pie: "Siempre juntas", ratio: 1 },
    { src: "", pie: "Locuras varias", ratio: 1.2 },
    { src: "", pie: "Mi favorita", ratio: 0.9 }
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
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Esperas que se pueden saltar ---------- */
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

/* ---------- Pintar contenido principal ---------- */
function render() {
  $('nombre').textContent = DATA.nombre;
  $('introTxt').textContent = DATA.intro;
  document.title = 'Para ' + DATA.nombre + ' 💜';
  $('finalTitle').textContent = DATA.finalTitulo;
  $('finalText').textContent = DATA.finalTexto;

  $('paper').innerHTML = `<h3>${esc(DATA.cartaPrincipal.titulo)}</h3><div>${esc(DATA.cartaPrincipal.texto)}</div>`;

  $('timeline').innerHTML = DATA.eventos.map(e =>
    `<div class="event reveal"><div class="when">${esc(e.cuando)}</div><h3>${esc(e.titulo)}</h3><p>${esc(e.texto)}</p></div>`).join('');

  $('grid').innerHTML = DATA.fotos.map((f, i) => `
    <figure class="ph reveal" data-i="${i}">
      ${f.src ? `<img src="${esc(f.src)}" alt="${esc(f.pie)}" loading="lazy">` : `<div class="img" style="--r:${f.ratio || 1}">📷</div>`}
      <figcaption>${esc(f.pie)}</figcaption>
    </figure>`).join('');

  $('letters').innerHTML = DATA.cartas.map(c => `
    <div class="letter reveal">
      <button type="button" aria-expanded="false"><span class="env-i">💌</span>
        <span><div class="lt">${esc(c.titulo)}</div><div class="ls">${esc(c.sub || '')}</div></span></button>
      <div class="body"><div>${esc(c.texto)}</div></div>
    </div>`).join('');

  document.querySelectorAll('.ph').forEach(el => el.addEventListener('click', () => {
    const f = DATA.fotos[el.dataset.i];
    $('lb').innerHTML = (f.src ? `<img src="${esc(f.src)}" alt="">` : `<div class="big">📷</div>`) + `<p>${esc(f.pie)}</p>`;
    $('lb').classList.add('on');
  }));
  $('lb').addEventListener('click', () => $('lb').classList.remove('on'));

  document.querySelectorAll('.letter button').forEach(b => b.addEventListener('click', () => {
    const l = b.parentElement; l.classList.toggle('open');
    b.setAttribute('aria-expanded', l.classList.contains('open'));
  }));
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

/* ---------- 3) Revelar la web ---------- */
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

function reveal() {
  document.body.classList.remove('locked');
  $('main').classList.remove('hidden');
  scrollTo(0, 0);
  requestAnimationFrame(() => requestAnimationFrame(() => $('main').classList.add('show')));
  if (!reduced) burst();
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

/* ---------- Sobre / carta principal ---------- */
$('openLetter').addEventListener('click', async () => {
  $('openLetter').classList.add('hidden');
  $('env').classList.add('open');
  await new Promise(r => setTimeout(r, 1300));
  $('paper').classList.remove('hidden');
  $('paper').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('skip').addEventListener('click', skip);
$('replay').addEventListener('click', () => location.reload());

/* ---------- Arranque ---------- */
render();
(async () => {
  await runLoader();
  await playIntro();
  reveal();
})();
