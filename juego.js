/* =========================================================
   EL ÚLTIMO RETO · un obby de plataformas para ganarse el regalo
   5 secciones, checkpoints y 7 estrellas. La caja del regalo
   solo se abre con las 7 estrellas. Controles táctiles y de teclado.
   ========================================================= */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  /* ---------- Sonidos (sintetizados, sin archivos) y vibración ---------- */
  function makeSfx() {
    let ac = null;
    const ensure = () => { if (!ac) { try { ac = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    const tone = (f0, f1, dur, type, vol, delay) => {
      const a = ensure(); if (!a) return;
      try {
        const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .03);
      } catch (e) {}
    };
    return {
      unlock: ensure,
      jump: () => tone(330, 660, .11, 'square', .035),
      land: () => tone(140, 70, .09, 'sine', .06),
      bounce: () => tone(220, 980, .22, 'sine', .07),
      crumble: () => tone(150, 55, .22, 'sawtooth', .035),
      coin: () => tone(988, 1319, .07, 'triangle', .04),
      star: () => [660, 880, 1320].forEach((f, i) => tone(f, f * 1.01, .13, 'triangle', .06, i * .07)),
      cp: () => { tone(523, 523, .1, 'triangle', .06); tone(784, 784, .2, 'triangle', .06, .1); },
      die: () => tone(320, 50, .4, 'sawtooth', .06),
      tick: fin => tone(fin ? 880 : 440, fin ? 880 : 440, fin ? .3 : .12, 'triangle', .06),
      win: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, f, .26, 'triangle', .07, i * .1))
    };
  }
  const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

  /* ---------- Constantes de juego (unidades por segundo) ---------- */
  const G = 1500, JUMP = 560, RUN = 190, ACC = 1500, FRICTION = 1700, MAXFALL = 780, COYOTE = .14, BUFFER = .16;
  const PW = 22, PH = 28, DEATH_Y = 430, LAVA_Y = 392, STARS_NEEDED = 5, STARS_TOTAL = 7;

  /* ---------- El nivel ---------- */
  function buildLevel() {
    const P = (x, y, w, o) => Object.assign({ x, y, w, h: 16, type: 'static', dx: 0, dy: 0, on: true }, o || {});
    const plats = [
      // 1 · calentamiento
      P(-140, 300, 320), P(236, 292, 78), P(364, 274, 72), P(484, 300, 78), P(640, 300, 160, { cp: 1 }),
      // 2 · plataformas que se mueven sobre la lava
      P(836, 300, 76, { type: 'move', ax: 836, ay: 300, bx: 936, by: 300, sp: .65, ph: 0 }),
      P(1010, 300, 76, { type: 'move', ax: 1010, ay: 256, bx: 1010, by: 336, sp: .75, ph: 1.2 }),
      P(1120, 290, 76, { type: 'move', ax: 1120, ay: 290, bx: 1226, by: 290, sp: .7, ph: .5 }),
      P(1290, 300, 84), P(1420, 300, 150, { cp: 2 }),
      // 3 · barras giratorias y suelo que se derrumba
      P(1600, 300, 380, { cp: 3 }),
      P(2020, 300, 70, { type: 'crumble' }), P(2128, 300, 70, { type: 'crumble' }), P(2236, 300, 70, { type: 'crumble' }),
      P(2350, 300, 150, { cp: 4 }),
      // 4 · rebote y plataformas que parpadean
      P(2540, 300, 90, { bounce: true }), P(2680, 160, 90, { cp: 5 }),
      P(2820, 250, 72, { type: 'blink', ph: 0 }), P(2934, 232, 72, { type: 'blink', ph: 1.1 }), P(3048, 250, 72, { type: 'blink', ph: 0 }),
      P(3180, 300, 140, { cp: 6 }),
      // 5 · la última prueba
      P(3360, 300, 52), P(3460, 270, 52), P(3560, 300, 52), P(3660, 270, 52),
      P(3764, 270, 64, { type: 'move', ax: 3764, ay: 270, bx: 3870, by: 270, sp: .8, ph: 0 }),
      P(3950, 300, 320, { cp: 7 }), P(4320, 300, 110, { cp: 8 }),
      P(4490, 300, 300, { goal: true })
    ];
    const bars = [
      { px: 1730, py: 246, L: 62, w: 1.4, ph: 0 }, { px: 1870, py: 246, L: 62, w: -1.4, ph: 1.6 },
      { px: 3436, py: 244, L: 46, w: 1.7, ph: .4 }, { px: 3636, py: 244, L: 46, w: -1.7, ph: 2.1 }
    ];
    const spikes = [{ x: 4030, w: 22 }, { x: 4112, w: 22 }, { x: 4194, w: 22 }].map(s => Object.assign(s, { y: 300 }));
    const stars = [{ x: 400, y: 205 }, { x: 1048, y: 176 }, { x: 1800, y: 238 }, { x: 2585, y: 108 }, { x: 3486, y: 205 }, { x: 3820, y: 208 }, { x: 4153, y: 212 }].map(s => Object.assign(s, { got: false }));
    // monedas: siguen el camino (y marcan el arco de cada salto)
    const coins = [];
    const solid = plats.filter(q => q.type === 'static');
    solid.forEach(q => { if (q.goal) return; for (let x = q.x + 14; x <= q.x + q.w - 12; x += 26) coins.push({ x, y: q.y - 16 }); });
    for (let i = 1; i < solid.length; i++) {
      const A = solid[i - 1], B = solid[i], gap = B.x - (A.x + A.w);
      if (gap > 26 && gap < 130 && !B.goal) for (let k = 1; k <= 3; k++) { const t = k / 4; coins.push({ x: A.x + A.w + gap * t, y: lerp(A.y, B.y, t) - 38 * 4 * t * (1 - t) - 18 }); }
    }
    plats.filter(q => q.type !== 'static').forEach(q => coins.push({ x: q.x + q.w / 2, y: q.y - 36 }));
    coins.forEach(c => { c.got = false; });
    return { plats, bars, spikes, stars, coins, gift: { x: 4640, y: 300 }, end: 4850 };
  }

  function play(opts) {
    return new Promise(resolve => {
      const root = opts.root, cv = root.querySelector('#gameCv'), ctx = cv.getContext('2d');
      const $ = s => root.querySelector(s);
      const hud = { stars: $('#gStars'), deaths: $('#gDeaths'), toast: $('#gToast') };
      const gProg = $('#gProg'), gCount = $('#gCount'), sfx = makeSfx();
      let W = 0, H = 0, dpr = 1, K = 1, OY = 0;
      const level = buildLevel();
      const keys = { left: false, right: false, jump: false };
      let coinsGot = 0, countT = 0, lastCount = '', state = 'intro', time = 0, deaths = 0, assist = false, stars = 0, running = true, raf = 0, last = 0, acc = 0, toastT = 0, introT = 0, winT = 0, shake = 0;
      const cam = { x: 0 }; let respawn = { x: 40, y: 262, cp: 0 };
      const p = { x: 40, y: 262, vx: 0, vy: 0, ground: null, coyote: 0, buffer: 0, face: 1, sx: 1, sy: 1, run: 0, blink: 2, dead: 0, jumpHeld: false };
      const particles = [], flags = {}, floaters = [];
      for (const q of level.plats) if (q.cp) { const t = document.createElement('b'); t.style.left = (q.x / level.end * 100) + '%'; $('#gProgBox').appendChild(t); }

      /* ---------- Entrada ---------- */
      const setKey = (k, v) => { keys[k] = v; if (k === 'jump' && v) p.buffer = BUFFER; };
      const bindBtn = (id, key) => {
        const el = $(id); if (!el) return;
        const down = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} setKey(key, true); el.classList.add('held'); };
        const up = e => { e.preventDefault(); setKey(key, false); el.classList.remove('held'); };
        el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
        el.addEventListener('contextmenu', e => e.preventDefault());
      };
      bindBtn('#gL', 'left'); bindBtn('#gR', 'right'); bindBtn('#gJ', 'jump');
      const kmap = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump' };
      const onKey = v => e => { const k = kmap[e.key]; if (k && state !== 'intro') { e.preventDefault(); if (e.repeat) return; setKey(k, v); } };
      const kd = onKey(true), ku = onKey(false);
      addEventListener('keydown', kd); addEventListener('keyup', ku);

      function resize() {
        dpr = Math.min(global.devicePixelRatio || 1, 2);
        const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        K = Math.min(W / 330, H / 470); OY = H * .6 - 300 * K;   // se ven ~330 unidades de ancho y el suelo queda al 60% de la altura
      }
      resize(); addEventListener('resize', resize);

      /* ---------- Utilidades ---------- */
      const sx = x => (x - cam.x) * K, sy = y => y * K + OY;
      const toast = (txt, ms) => { hud.toast.textContent = txt; hud.toast.classList.add('on'); toastT = ms || 1.8; };
      const burst = (x, y, n, cols, sp, life) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = (.3 + Math.random() * .7) * sp; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life, max: life, s: 2 + Math.random() * 3, c: cols[(Math.random() * cols.length) | 0], r: Math.random() * TAU }); } };
      const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      const pbox = () => ({ x: p.x, y: p.y, w: PW, h: PH });
      const solids = () => level.plats.filter(q => q.on && !q.fallen);
      const assistK = () => assist ? .75 : 1;

      function updateHud() {
        hud.stars.textContent = '★ ' + stars + ' / ' + STARS_TOTAL + '  ·  ' + coinsGot + ' ●';
        hud.deaths.textContent = deaths + (deaths === 1 ? ' caída' : ' caídas');
      }

      /* ---------- Plataformas con vida ---------- */
      function updatePlats(dt) {
        for (const q of level.plats) {
          q.dx = 0; q.dy = 0;
          if (q.type === 'move') {
            const t = time * q.sp * assistK() + q.ph, u = (Math.sin(t) + 1) / 2, nx = lerp(q.ax, q.bx, u), ny = lerp(q.ay, q.by, u);
            q.dx = nx - q.x; q.dy = ny - q.y; q.x = nx; q.y = ny;
          } else if (q.type === 'blink') {
            const c = (time + q.ph) % 2.6; q.on = c < 1.9; q.warn = c > 1.5 && c < 1.9;
          } else if (q.type === 'crumble') {
            if (q.t == null) q.t = 0;
            if (q.state === 'shake') { q.t -= dt; if (q.t <= 0) { q.state = 'fall'; q.fallen = true; q.t = 2.2; burst(q.x + q.w / 2, q.y, 10, ['#ffd19a', '#e8b27a'], 90, .7); } }
            else if (q.state === 'fall') { q.t -= dt; if (q.t <= 0) { q.state = null; q.fallen = false; } }
          }
        }
      }

      /* ---------- Física del jugador ---------- */
      function moveX(dx) {
        p.x += dx;
        for (const q of solids()) if (overlap(pbox(), q)) { if (dx > 0) p.x = q.x - PW; else if (dx < 0) p.x = q.x + q.w; else p.x = p.x < q.x + q.w / 2 ? q.x - PW : q.x + q.w; p.vx = 0; }
      }
      function moveY(dy) {
        p.y += dy;
        for (const q of solids()) if (overlap(pbox(), q)) {
          if (dy > 0 || (dy === 0 && p.vy >= 0)) { p.y = q.y - PH; const v = p.vy; p.vy = 0; if (v > 0) land(q, v); }
          else if (dy < 0) { p.y = q.y + q.h; p.vy = 0; }
        }
      }
      function land(q, v) {
        if (v > 220) { sfx.land(); p.sy = .72; p.sx = 1.22; burst(p.x + PW / 2, p.y + PH, 5, ['#e8e1ff', '#a9d4ff'], 60, .4); }
        if (q.bounce) { sfx.bounce(); p.vy = -830; p.sy = 1.3; p.sx = .8; burst(q.x + q.w / 2, q.y, 14, ['#ffd0ec', '#ffffff'], 120, .6); q.squash = .25; return; }
      }
      function groundProbe() {
        const pr = { x: p.x, y: p.y + 1.5, w: PW, h: PH };
        let g = null; for (const q of solids()) if (overlap(pr, q) && p.y + PH <= q.y + 6) { g = q; break; }
        return g;
      }

      function die() {
        if (p.dead) return;
        p.dead = .75; deaths++; shake = 7; updateHud(); sfx.die(); buzz(40);
        burst(p.x + PW / 2, p.y + PH / 2, 26, ['#e6dcff', '#9b82ff', '#ffffff'], 190, .9);
        if (!assist && deaths >= 10) { assist = true; toast('Modo ayuda: los obstáculos van más lentos', 3.2); }
      }
      function doRespawn() {
        p.x = respawn.x; p.y = respawn.y; p.vx = p.vy = 0; p.dead = 0; p.ground = null; p.sx = p.sy = 1;
        burst(p.x + PW / 2, p.y + PH, 14, ['#e6dcff', '#a9d4ff'], 110, .6);
      }

      function step(dt) {
        time += dt;
        for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i]; q.life -= dt; if (q.life <= 0) { particles.splice(i, 1); continue; } q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 6; }
        if (toastT > 0) { toastT -= dt; if (toastT <= 0) hud.toast.classList.remove('on'); }
        shake *= Math.pow(.02, dt);
        for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].t += dt; if (floaters[i].t > 1.1) floaters.splice(i, 1); }
        if (state === 'intro') { introT += dt; updatePlats(dt); return; }
        if (state === 'count') {
          countT += dt; updatePlats(dt);
          const n = 3 - Math.floor(countT / .6), lbl = n > 0 ? String(n) : '¡YA!';
          if (lbl !== lastCount) { lastCount = lbl; gCount.textContent = lbl; gCount.classList.remove('pop'); void gCount.offsetWidth; gCount.classList.add('pop'); sfx.tick(lbl === '¡YA!'); }
          if (countT >= 2.3) { state = 'play'; p.buffer = 0; keys.left = keys.right = keys.jump = false; }
          return;
        }
        if (state === 'won') { winT += dt; updatePlats(dt); return; }
        updatePlats(dt);
        if (p.dead) { p.dead -= dt; if (p.dead <= 0) doRespawn(); return; }

        // las plataformas que se mueven arrastran al jugador
        if (p.ground && (p.ground.dx || p.ground.dy)) { moveX(p.ground.dx); moveY(p.ground.dy); }
        // entrada
        const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        if (dir) { p.face = dir; const a = (p.ground ? ACC : ACC * .8) * dt; p.vx = clamp(p.vx + dir * a, -RUN, RUN); if (Math.sign(p.vx) !== dir && p.vx !== 0) p.vx += dir * a; }
        else { const f = FRICTION * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
        p.vy = Math.min(MAXFALL, p.vy + G * dt);
        if (p.buffer > 0) p.buffer -= dt;
        if (p.ground) p.coyote = COYOTE; else p.coyote -= dt;
        if (p.buffer > 0 && p.coyote > 0) { p.vy = -JUMP; p.coyote = 0; p.buffer = 0; p.ground = null; p.sy = 1.22; p.sx = .84; p.jumpHeld = true; burst(p.x + PW / 2, p.y + PH, 4, ['#e8e1ff'], 50, .3); sfx.jump(); }
        if (p.jumpHeld && !keys.jump && p.vy < -170) { p.vy *= .5; p.jumpHeld = false; }
        if (!keys.jump) p.jumpHeld = false;
        moveX(p.vx * dt); moveY(p.vy * dt);
        const g = groundProbe(); p.ground = g;
        if (g) { if (g.type === 'crumble' && !g.state) { g.state = 'shake'; g.t = .7; sfx.crumble(); } if (g.cp && g.cp > respawn.cp) { respawn = { x: g.x + Math.min(g.w - PW - 6, 30), y: g.y - PH - 1, cp: g.cp }; flags[g.cp] = time; sfx.cp(); buzz(18); toast('Punto de control guardado', 1.3); burst(p.x + PW / 2, p.y, 16, ['#a9d4ff', '#ffffff', '#c9bcff'], 120, .8); } }
        for (const q of level.plats) if (q.squash) q.squash = Math.max(0, q.squash - dt);
        p.sx = lerp(p.sx, 1, Math.min(1, dt * 14)); p.sy = lerp(p.sy, 1, Math.min(1, dt * 14));
        p.run += Math.abs(p.vx) * dt * .09; p.blink -= dt; if (p.blink < -.12) p.blink = 1.8 + Math.random() * 2.2;

        // peligros
        if (p.y > DEATH_Y || p.y + PH > LAVA_Y + 4) return die();
        const hb = { x: p.x + 3, y: p.y + 3, w: PW - 6, h: PH - 5 };
        for (const s of level.spikes) if (overlap(hb, { x: s.x + 3, y: s.y - 12, w: s.w - 6, h: 12 })) return die();
        for (const b of level.bars) {
          const a = time * b.w * assistK() + b.ph;
          for (let t = .25; t <= 1.001; t += .125) { const bx = b.px + Math.cos(a) * b.L * t, by = b.py + Math.sin(a) * b.L * t; if (bx > hb.x - 3 && bx < hb.x + hb.w + 3 && by > hb.y - 3 && by < hb.y + hb.h + 3) return die(); }
        }
        // estrellas
        for (const s of level.stars) if (!s.got && Math.hypot(s.x - (p.x + PW / 2), s.y - (p.y + PH / 2)) < 20) { s.got = true; stars++; updateHud(); sfx.star(); buzz(14); floaters.push({ x: s.x, y: s.y, text: '+1 ★', t: 0 }); burst(s.x, s.y, 20, ['#ffe9a0', '#fff', '#ffd35c'], 150, .8); toast(stars === STARS_NEEDED ? '¡Ya puedes abrir el regalo!' : stars === STARS_TOTAL ? '¡Las 7 estrellas!' : '★ ' + stars + ' de ' + STARS_TOTAL, 1.5); }
        // monedas
        for (const c of level.coins) if (!c.got && Math.hypot(c.x - (p.x + PW / 2), c.y - (p.y + PH / 2)) < 17) { c.got = true; coinsGot++; updateHud(); sfx.coin(); burst(c.x, c.y, 5, ['#ffd35c', '#fff3c4'], 70, .4); }
        // regalo
        const gf = level.gift;
        if (Math.abs(p.x + PW / 2 - gf.x) < 28 && Math.abs(p.y + PH - gf.y) < 30) {
          if (stars >= STARS_NEEDED) win(); else if (toastT < .3) toast('Necesitas ' + (STARS_NEEDED - stars) + ' ★ más para abrirlo', 1.8);
        }
        cam.x = lerp(cam.x, clamp(p.x - W / K * .36, -60, level.end - W / K + 40), Math.min(1, dt * 5));
        gProg.style.width = clamp(p.x / level.end * 100, 0, 100) + '%';
      }

      function win() {
        if (state === 'won') return;
        state = 'won'; winT = 0; keys.left = keys.right = keys.jump = false; sfx.win(); buzz([30, 40, 30, 40, 70]);
        burst(level.gift.x, level.gift.y - 20, 90, ['#ffe9a0', '#ff8fbc', '#7df3ff', '#c9bcff', '#ffffff'], 330, 1.6);
        setTimeout(() => { $('#gWin').classList.remove('hidden'); $('#gWinStats').textContent = stars + ' estrellas · ' + coinsGot + ' monedas · ' + deaths + (deaths === 1 ? ' caída' : ' caídas'); }, 1500);
      }

      /* ---------- Dibujo ---------- */
      const starPts = Array.from({ length: 90 }, (_, k) => ({ x: ((k * 73) % 997) / 997, y: ((k * 191) % 983) / 983 * .62, r: .6 + ((k * 7) % 5) * .35, ph: k * 1.7 }));
      const lanterns = Array.from({ length: 12 }, (_, k) => ({ x: ((k * 331) % 1000) / 1000, y: ((k * 177) % 600) / 600, v: 6 + (k % 4) * 3, ph: k * 1.9, r: 3 + (k % 3) * 1.4 }));
      function ridge(par, base, amp, f1, f2, col) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H + 2);
        for (let x = 0; x <= W + 12; x += 12) { const wx = x / K + cam.x * par; ctx.lineTo(x, sy(base + Math.sin(wx * f1) * amp + Math.sin(wx * f2 + 1.7) * amp * .4)); }
        ctx.lineTo(W, H + 2); ctx.closePath(); ctx.fill();
      }
      function glow(x, y, r, hex, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(hex, a)); g.addColorStop(1, rgba(hex, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
      function sparkle(x, y, r, a, col) { ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * .14, -r * .14, r, 0); ctx.quadraticCurveTo(r * .14, r * .14, 0, r); ctx.quadraticCurveTo(-r * .14, r * .14, -r, 0); ctx.quadraticCurveTo(-r * .14, -r * .14, 0, -r); ctx.fill(); ctx.restore(); }
      function star5(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); for (let k = 0; k < 10; k++) { const q = k % 2 ? r * .45 : r, an = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * q, y + Math.sin(an) * q); } ctx.closePath(); ctx.fill(); }

      function drawSky() {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120a3d'); g.addColorStop(.4, '#4d2a8a'); g.addColorStop(.72, '#d9689a'); g.addColorStop(1, '#ffc58a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (const s of starPts) { ctx.fillStyle = `rgba(255,240,255,${.25 + .6 * Math.abs(Math.sin(time * (.6 + s.ph % 1) + s.ph))})`; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r * Math.max(1, K * .8), 0, TAU); ctx.fill(); }
        { const cx = W * .72, cy = sy(250);
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * .04); ctx.fillStyle = 'rgba(255,232,190,.10)'; for (let k = 0; k < 14; k++) { ctx.rotate(TAU / 14); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 1.4, -22 * K); ctx.lineTo(W * 1.4, 22 * K); ctx.closePath(); ctx.fill(); } ctx.restore();
          glow(cx, cy, 200 * K, '#ffd9a0', .55); ctx.fillStyle = '#fff1d6'; ctx.beginPath(); ctx.arc(cx, cy, 26 * K, 0, TAU); ctx.fill(); }
        ridge(.08, 270, 26, .008, .021, '#8a3f94'); ridge(.2, 310, 20, .012, .034, '#5e2f86'); ridge(.38, 345, 14, .02, .05, '#3a2068');
        for (const l of lanterns) { const x = ((l.x * W + Math.sin(time * .5 + l.ph) * 14 - cam.x * K * .5) % (W + 60) + W + 60) % (W + 60) - 30, y = ((l.y * H - time * l.v * K) % H + H) % H; glow(x, y, l.r * 5 * K, '#ffd9a0', .35); ctx.fillStyle = 'rgba(255,236,200,.9)'; ctx.beginPath(); ctx.arc(x, y, l.r * K * .6, 0, TAU); ctx.fill(); }
      }
      function drawLava() {
        const y0 = sy(LAVA_Y), g = ctx.createLinearGradient(0, y0 - 24 * K, 0, H); g.addColorStop(0, 'rgba(255,90,130,0)'); g.addColorStop(.25, '#ff5b82'); g.addColorStop(.6, '#c4204f'); g.addColorStop(1, '#5c0f2c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H + 2); ctx.lineTo(0, y0);
        for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, y0 + Math.sin((x / K + cam.x) * .045 + time * 2.2) * 3 * K);
        ctx.lineTo(W, H + 2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,180,.85)'; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let x = 0; x <= W + 8; x += 8) { const y = y0 + Math.sin((x / K + cam.x) * .045 + time * 2.2) * 3 * K; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      }
      function drawPlat(q) {
        if (q.fallen) return;
        const x = sx(q.x), y = sy(q.y), w = q.w * K, th = 8 * K, fh = 13 * K;
        if (x > W + 40 || x + w < -40) return;
        if (!q.on) { if (q.type === 'blink') { ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = '#ff8ae6'; ctx.setLineDash([4, 4]); rr(ctx, x, y, w, th + fh, 4 * K); ctx.stroke(); ctx.restore(); } return; }
        const sq = q.squash ? Math.sin(q.squash / .25 * Math.PI) * 4 * K : 0;
        const pal = q.type === 'move' ? ['#7df3ff', '#1d5a8a'] : q.type === 'crumble' ? ['#ffd19a', '#8a5a3a'] : q.type === 'blink' ? ['#ff8ae6', '#7a2a7a'] : q.bounce ? ['#ffb3de', '#a8286f'] : q.goal ? ['#fff3c4', '#b8893f'] : q.cp ? ['#d6cbff', '#4d3ba8'] : ['#c9bcff', '#43348f'];
        ctx.save();
        if (q.type === 'crumble' && q.state === 'shake') ctx.translate(Math.sin(time * 70) * 1.6 * K, 0);
        if (q.type === 'blink' && q.warn) ctx.globalAlpha = .45 + .45 * Math.abs(Math.sin(time * 26));
        glow(x + w / 2, y + th + fh, w * .8, q.type === 'move' ? '#7df3ff' : '#9b82ff', .22);
        ctx.fillStyle = pal[1]; rr(ctx, x, y + th * .5 + sq, w, fh + th * .5, 4 * K); ctx.fill();
        ctx.fillStyle = pal[0]; rr(ctx, x, y + sq, w, th, 3 * K); ctx.fill();
        ctx.strokeStyle = 'rgba(14,8,40,.6)'; ctx.lineWidth = 1.4; rr(ctx, x, y + sq, w, th + fh, 4 * K); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(x + 3 * K, y + sq + 1, w - 6 * K, 1.4);
        ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < q.w / 16; k++) { ctx.beginPath(); ctx.ellipse(x + (8 + k * 16) * K, y + sq + 3.2 * K, 3.8 * K, 1.4 * K, 0, 0, TAU); ctx.fill(); }
        if (q.type === 'crumble') { ctx.strokeStyle = 'rgba(60,30,10,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + w * .3, y + th); ctx.lineTo(x + w * .4, y + th + fh * .8); ctx.moveTo(x + w * .7, y + th); ctx.lineTo(x + w * .62, y + th + fh * .7); ctx.stroke(); }
        if (q.bounce) { ctx.fillStyle = '#fff'; ctx.font = `800 ${12 * K}px "DM Sans",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('↑↑', x + w / 2, y - 4 * K); }
        ctx.restore();
        if (q.cp) { const fx = x + w - 10 * K, up = clamp(((time - (flags[q.cp] || -9)) / .8), 0, 1), done = respawn.cp >= q.cp; ctx.strokeStyle = '#e9e4fa'; ctx.lineWidth = 1.8 * K; ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx, y - 40 * K); ctx.stroke(); const fy = y - 8 * K - 26 * K * (done ? smooth(up) : 0); ctx.fillStyle = done ? '#7dffd8' : '#8a85a8'; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 18 * K, fy + 6 * K); ctx.lineTo(fx, fy + 12 * K); ctx.closePath(); ctx.fill(); }
      }
      function drawBar(b) {
        const a = time * b.w * assistK() + b.ph, x = sx(b.px), y = sy(b.py), ex = x + Math.cos(a) * b.L * K, ey = y + Math.sin(a) * b.L * K;
        ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,90,130,.35)'; ctx.lineWidth = 11 * K; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = '#ff5c7a'; ctx.lineWidth = 6 * K; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = '#3a3358'; ctx.fillRect(x - 3 * K, y, 6 * K, (LAVA_Y - b.py) * K); ctx.fillStyle = '#ffb3c2'; ctx.beginPath(); ctx.arc(x, y, 5 * K, 0, TAU); ctx.fill();
      }
      function drawSpike(s) { const x = sx(s.x), y = sy(s.y), w = s.w * K, h = 14 * K; ctx.fillStyle = '#e9e4fa'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ff5c7a'; ctx.beginPath(); ctx.moveTo(x + w * .3, y); ctx.lineTo(x + w / 2, y - h * .55); ctx.lineTo(x + w * .7, y); ctx.closePath(); ctx.fill(); }
      function drawGift() {
        const gf = level.gift, x = sx(gf.x), y = sy(gf.y), s = 38 * K, ready = stars >= STARS_NEEDED, bob = Math.sin(time * 3) * 2 * K;
        if (ready) { ctx.save(); const bg = ctx.createLinearGradient(0, y - s * 6, 0, y); bg.addColorStop(0, 'rgba(255,233,160,0)'); bg.addColorStop(1, 'rgba(255,233,160,.38)'); ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(x - s * .5, y); ctx.lineTo(x - s * 1.3, y - s * 6); ctx.lineTo(x + s * 1.3, y - s * 6); ctx.lineTo(x + s * .5, y); ctx.closePath(); ctx.fill(); ctx.restore(); }
        glow(x, y - s * .6, s * 2.4, ready ? '#ffe9a0' : '#c9bcff', ready ? .55 : .22);
        if (state === 'won') { ctx.save(); ctx.translate(x, y - s); ctx.fillStyle = '#ff8fbc'; rr(ctx, -s / 2, 0, s, s, 4 * K); ctx.fill(); ctx.fillStyle = '#ffe29a'; ctx.fillRect(-3 * K, 0, 6 * K, s); ctx.translate(0, -Math.min(60, winT * 90) * K); ctx.rotate(-Math.min(.9, winT * 1.6)); ctx.fillStyle = '#ffa3cb'; rr(ctx, -s / 2 - 3 * K, -10 * K, s + 6 * K, 10 * K, 3 * K); ctx.fill(); ctx.restore(); return; }
        ctx.save(); ctx.translate(x, y - bob);
        ctx.fillStyle = ready ? '#ff8fbc' : '#8d83bd'; rr(ctx, -s / 2, -s, s, s, 4 * K); ctx.fill();
        ctx.fillStyle = ready ? '#ffe29a' : '#b6aed6'; ctx.fillRect(-3 * K, -s, 6 * K, s);
        ctx.fillStyle = ready ? '#ffa3cb' : '#9b92c9'; rr(ctx, -s / 2 - 3 * K, -s - 10 * K, s + 6 * K, 10 * K, 3 * K); ctx.fill();
        ctx.fillStyle = ready ? '#ffe29a' : '#b6aed6'; ctx.fillRect(-3 * K, -s - 10 * K, 6 * K, 10 * K);
        ctx.beginPath(); ctx.ellipse(-8 * K, -s - 14 * K, 8 * K, 5 * K, -.4, 0, TAU); ctx.ellipse(8 * K, -s - 14 * K, 8 * K, 5 * K, .4, 0, TAU); ctx.fill();
        if (!ready) { ctx.fillStyle = 'rgba(10,6,30,.7)'; ctx.font = `800 ${13 * K}px "DM Sans",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('★ ' + Math.min(stars, STARS_NEEDED) + '/' + STARS_NEEDED, 0, -s * .38); }
        ctx.restore();
        if (ready) for (let k = 0; k < 4; k++) sparkle(x + Math.sin(time * 2 + k * 1.7) * 34 * K, y - s - 12 * K - ((time * 22 + k * 20) % 60) * K, 4 * K, .8, '#fff4c8');
      }
      function drawCoin(c) {
        if (c.got) return; const x = sx(c.x), y = sy(c.y + Math.sin(time * 4 + c.x * .05) * 1.6), w = Math.abs(Math.cos(time * 3 + c.x * .08)) * 5.5 * K + 1.2 * K;
        if (x < -20 || x > W + 20) return;
        ctx.fillStyle = '#c98a14'; ctx.beginPath(); ctx.ellipse(x, y, w + .8 * K, 6.2 * K, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.ellipse(x, y, w, 5.4 * K, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x - w * .25, y - 1.6 * K, w * .35, 1.6 * K, 0, 0, TAU); ctx.fill();
      }
      function drawHint() {
        const right = cam.x + W / K;
        for (const s of level.stars) if (!s.got && s.x > right && s.x - right < 300) {
          const y = clamp(sy(s.y), 110, H * .8), x = W - 30, a = clamp(1 - (s.x - right) / 300, .35, 1);
          ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,4,28,.85)'; rr(ctx, x - 26, y - 14, 52, 28, 14); ctx.fill(); ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 1.4; rr(ctx, x - 26, y - 14, 52, 28, 14); ctx.stroke();
          star5(x - 10, y, 7, '#ffe27a'); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(x + 4, y - 6); ctx.lineTo(x + 16, y); ctx.lineTo(x + 4, y + 6); ctx.closePath(); ctx.fill(); ctx.restore(); break;
        }
      }
      function drawStar(s) { if (s.got) return; const x = sx(s.x), y = sy(s.y + Math.sin(time * 3 + s.x) * 3), r = 9 * K; glow(x, y, r * 3.2, '#ffe29a', .55); star5(x, y, r, '#ffe27a'); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x - r * .25, y - r * .25, r * .2, 0, TAU); ctx.fill(); }
      function drawPlayer() {
        if (p.dead) return;
        const x = sx(p.x + PW / 2), y = sy(p.y + PH), sc = K * 1;
        { let gy = null; for (const q of solids()) if (p.x + PW > q.x && p.x < q.x + q.w && q.y >= p.y + PH - 2 && (gy === null || q.y < gy)) gy = q.y;
          if (gy !== null) { const hgt = clamp(1 - (gy - (p.y + PH)) / 150, .3, 1); ctx.save(); ctx.globalAlpha = .38 * hgt; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, sy(gy) + 1, 12 * sc * hgt, 3 * sc * hgt, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
        ctx.save(); ctx.translate(x, y); ctx.scale(sc * p.sx, sc * p.sy);
        const sw = Math.sin(p.run * 6) * 3.2, moving = Math.abs(p.vx) > 20 && p.ground;
        ctx.fillStyle = '#4a3aa0'; rr(ctx, -8.5, -6 - (moving ? Math.max(0, sw) : 0), 6, 6, 2); ctx.fill(); rr(ctx, 2.5, -6 - (moving ? Math.max(0, -sw) : 0), 6, 6, 2); ctx.fill();
        const g = ctx.createLinearGradient(0, -32, 0, -4); g.addColorStop(0, '#e6dcff'); g.addColorStop(1, '#9b82ff'); ctx.fillStyle = g; rr(ctx, -12, -32, 24, 27, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(20,10,50,.3)'; ctx.lineWidth = 1; rr(ctx, -12, -32, 24, 27, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(ctx, -9, -29, 8, 3, 1.5); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6, -33); ctx.lineTo(1, -39); ctx.lineTo(1, -29); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(6, -33); ctx.lineTo(11, -39); ctx.lineTo(11, -29); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a3aa0'; ctx.beginPath(); ctx.arc(6, -33, 1.8, 0, TAU); ctx.fill();
        const lk = p.face * 1.6, eh = p.blink < 0 ? .5 : 3.4; ctx.fillStyle = '#1a1033'; ctx.beginPath(); ctx.ellipse(-4.6 + lk, -19, 2.5, eh, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(4.6 + lk, -19, 2.5, eh, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#1a1033'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath();
        if (p.vy < -120) ctx.ellipse(lk, -11.5, 2.2, 2.8, 0, 0, TAU); else ctx.arc(lk, -13.5, 3.4, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
        ctx.restore();
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        if (shake > .3) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
        let zoom = 1;
        if (state === 'intro') zoom = 1.18 - .18 * smooth(clamp(introT / 1.6, 0, 1));
        if (zoom !== 1) { ctx.translate(W / 2, H * .72); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * .72); }
        drawSky();
        level.bars.forEach(drawBar);
        level.plats.forEach(drawPlat);
        level.spikes.forEach(drawSpike);
        level.coins.forEach(drawCoin);
        level.stars.forEach(drawStar);
        drawGift();
        drawLava();
        drawPlayer();
        drawHint();
        for (const q of particles) { const a = Math.max(0, q.life / q.max); ctx.globalAlpha = a; ctx.fillStyle = q.c; ctx.save(); ctx.translate(sx(q.x), sy(q.y)); ctx.rotate(q.r); const s = q.s * K * (.5 + a * .5); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); }
        ctx.globalAlpha = 1;
        for (const f of floaters) { const a = clamp(1 - f.t / 1.1, 0, 1); ctx.save(); ctx.globalAlpha = a; ctx.font = `800 ${15 * K}px "DM Sans",sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,6,50,.85)'; ctx.strokeText(f.text, sx(f.x), sy(f.y - 14 - f.t * 34)); ctx.fillStyle = '#ffe27a'; ctx.fillText(f.text, sx(f.x), sy(f.y - 14 - f.t * 34)); ctx.restore(); }
        const vg = ctx.createRadialGradient(W / 2, H * .5, Math.min(W, H) * .35, W / 2, H * .5, Math.max(W, H) * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,0,30,.38)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      function frame(ts) {
        if (!running) return;
        const dt = Math.min(.1, Math.max(0, (ts - (last || ts)) / 1000)); last = ts;
        acc += dt; let n = 0; const h = 1 / 120;
        while (acc >= h && n < 14) { step(h * (p.dead > .5 ? .35 : 1)); acc -= h; n++; }
        if (n === 14) acc = 0;
        draw();
        raf = requestAnimationFrame(frame);
      }

      /* ---------- Arranque ---------- */
      if (opts.allStars) { level.stars.forEach(s => { s.got = true; }); stars = STARS_TOTAL; }
      if (opts.startCp) { const q = level.plats.find(z => z.cp === opts.startCp); if (q) { respawn = { x: q.x + 12, y: q.y - PH - 1, cp: q.cp }; p.x = respawn.x; p.y = respawn.y; cam.x = p.x - 80; } }
      updateHud();
      $('#gIntro').classList.remove('hidden'); $('#gWin').classList.add('hidden');
      $('#gStart').addEventListener('click', () => { sfx.unlock(); $('#gIntro').classList.add('hidden'); state = 'count'; countT = 0; lastCount = ''; keys.left = keys.right = keys.jump = false; });
      $('#gWinBtn').addEventListener('click', () => {
        running = false; cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', resize);
        resolve({ deaths, time });
      });
      // utilidades para probar (no afectan al juego)
      global.__juego = { p, level, get state() { return state; }, get stars() { return stars; }, get deaths() { return deaths; }, keys, setPos: (x, y) => { p.x = x; p.y = y; p.vx = p.vy = 0; cam.x = x - 80; }, giveStars: n => { level.stars.forEach((s, i) => { s.got = i < n; }); stars = Math.min(n, STARS_TOTAL); updateHud(); }, start: () => $('#gStart').click() };
      raf = requestAnimationFrame(frame);
    });
  }

  global.Juego = { play };
})(window);
