/* ============ AQUÍ VAN TUS DATOS (edítalos o dímelos y los cambio yo) ============ */
const DATA = {
  nombre: "Anita",
  intro: "Una pequeña página para recordarte lo mucho que significas para mí.",
  eventos: [
    { cuando: "El principio", titulo: "El día que nos conocimos", texto: "Aquí va cómo nos conocimos y qué pensé de ti al principio." },
    { cuando: "Cuando nos hicimos inseparables", titulo: "Nuestra primera aventura", texto: "Ese momento en el que supe que esto iba en serio." },
    { cuando: "Un día cualquiera", titulo: "Una de nuestras mil risas", texto: "Ese recuerdo absurdo que solo entendemos nosotras." },
    { cuando: "Cuando más la necesité", titulo: "Estuviste ahí", texto: "Gracias por quedarte cuando las cosas se pusieron difíciles." },
    { cuando: "Hoy", titulo: "Y aquí seguimos", texto: "Después de tanto tiempo, sigues siendo mi persona favorita." }
  ],
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
  finalTexto: "Por muchos más juntas. Te quiero."
};
/* ================================================================================ */

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

$('nombre').textContent = DATA.nombre;
$('intro').textContent = DATA.intro;
document.title = 'Para ' + DATA.nombre + ' 💌';
$('finalTitle').textContent = DATA.finalTitulo;
$('finalText').textContent = DATA.finalTexto;

$('timeline').innerHTML = DATA.eventos.map(e =>
  `<div class="event reveal"><div class="when">${esc(e.cuando)}</div><h3>${esc(e.titulo)}</h3><p>${esc(e.texto)}</p></div>`).join('');

$('grid').innerHTML = DATA.fotos.map((f,i) => `
  <figure class="ph reveal" data-i="${i}" style="margin:0 0 12px">
    ${f.src ? `<img src="${f.src}" alt="${esc(f.pie)}" loading="lazy">` : `<div class="img" style="--r:${f.ratio||1}">📷</div>`}
    <figcaption>${esc(f.pie)}</figcaption>
  </figure>`).join('');

document.querySelectorAll('.ph').forEach(el => el.addEventListener('click', () => {
  const f = DATA.fotos[el.dataset.i];
  $('lb').innerHTML = (f.src ? `<img src="${f.src}" alt="">` : `<div class="big">📷</div>`) + `<p>${esc(f.pie)}</p>`;
  $('lb').classList.add('on');
}));

$('letters').innerHTML = DATA.cartas.map(c => `
  <div class="letter reveal">
    <button type="button" aria-expanded="false"><span class="env">💌</span>
      <span><div class="lt">${esc(c.titulo)}</div><div class="ls">${esc(c.sub||'')}</div></span></button>
    <div class="body"><div>${esc(c.texto)}</div></div>
  </div>`).join('');
document.querySelectorAll('.letter button').forEach(b => b.addEventListener('click', () => {
  const l = b.parentElement; l.classList.toggle('open');
  b.setAttribute('aria-expanded', l.classList.contains('open'));
}));

/* Reveal al hacer scroll */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* Corazones flotantes */
const hero = document.querySelector('.hero'), icons = ['💗','💖','✨','🌸','💕'];
function spawn(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const s = document.createElement('span'); s.className = 'float';
  s.textContent = icons[Math.floor(Math.random()*icons.length)];
  s.style.left = Math.random()*100 + '%';
  s.style.fontSize = (16 + Math.random()*22) + 'px';
  s.style.animationDuration = (7 + Math.random()*7) + 's';
  hero.appendChild(s); setTimeout(() => s.remove(), 15000);
}
setInterval(spawn, 900);
